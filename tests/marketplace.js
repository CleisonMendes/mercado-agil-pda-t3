import { Cliente } from '../models/Cliente.js';
import { CupomDesconto } from '../models/CupomDesconto.js';
import { Estoque } from '../models/Estoque.js';
import { Pedido } from '../models/Pedido.js';
import { Produto } from '../models/Produto.js';
import { Vendedor } from '../models/Vendedor.js';
import { STATUS } from '../config/regras.js';
import { clienteSchema } from '../schemas/clienteSchema.js';
import { cupomSchema } from '../schemas/cupomSchema.js';
import { produtoSchema } from '../schemas/produtoSchema.js';
import { vendedorSchema } from '../schemas/vendedorSchema.js';
import { ErroNegocio, executar, validar } from '../utils/respostas.js';
import { apenasDigitos, normalizar } from '../utils/validadores.js';
import { gerarRelatorioFinanceiro } from './relatorios.js';

// LGPD: tira o CPF antes de devolver os dados do cliente (rest operator).
const semCpf = ({ cpf, ...seguro }) => seguro; // eslint-disable-line no-unused-vars

// Classe principal do serviço. O menu só conversa com ela, e TODO método público
// devolve { ok: true, dados } ou { ok: false, erros: [...] } — nunca lança erro.
export class Marketplace {
  #clientes = [];
  #vendedores = [];
  #produtos = [];
  #cupons = [];
  #pedidos = [];
  #estoque = new Estoque();
  #seq = { cliente: 1, vendedor: 1, produto: 1, pedido: 1 };

  #proximoId(tipo) {
    const id = this.#seq[tipo];
    this.#seq = { ...this.#seq, [tipo]: id + 1 };
    return id;
  }

  // ================= Localizadores (internos) =================

  #localizarCliente(chave) {
    const t = String(chave ?? '').trim();
    const digitos = apenasDigitos(t);
    return this.#clientes.find((c) => (digitos.length === 11 && c.cpf === digitos) || String(c.id) === t);
  }

  #localizarVendedor(chave) {
    const t = String(chave ?? '').trim();
    const digitos = apenasDigitos(t);
    return this.#vendedores.find(
      (v) => (digitos.length === 14 && v.cnpj === digitos) || String(v.id) === t || normalizar(v.nomeLoja) === normalizar(t),
    );
  }

  #localizarProduto(chave) {
    const t = String(chave ?? '').trim();
    const porId = this.#produtos.find((p) => String(p.id) === t);
    if (porId) return porId;
    const porNome = this.#produtos.filter((p) => normalizar(p.nome) === normalizar(t));
    if (porNome.length > 1) {
      throw new ErroNegocio(`Mais de um produto chamado "${t}". Use o id do produto.`);
    }
    return porNome[0];
  }

  #localizarCupom(codigo) {
    return this.#cupons.find((c) => c.codigo === String(codigo ?? '').trim().toUpperCase());
  }

  #localizarPedido(id) {
    const pedido = this.#pedidos.find((p) => p.id === Number(id));
    if (!pedido) throw new ErroNegocio(`Pedido ${id} não encontrado.`);
    return pedido;
  }

  #exigir(item, mensagem) {
    if (!item) throw new ErroNegocio(mensagem);
    return item;
  }

  #visaoProduto(produto) {
    const vendedor = this.#vendedores.find((v) => v.id === produto.vendedorId);
    return {
      id: produto.id,
      nome: produto.nome,
      preco: produto.preco,
      categoria: produto.categoria,
      vendedorId: produto.vendedorId,
      vendedor: vendedor?.nomeLoja ?? '(removido)',
      estoque: this.#estoque.disponivel(produto.id),
    };
  }

  #visaoCupom(cupom) {
    return { ...cupom, vencido: !cupom.estaValido() };
  }

  // ================= Clientes =================

  cadastrarCliente(dados) {
    return executar(() => {
      const validos = validar(clienteSchema, dados);
      if (this.#clientes.some((c) => c.cpf === validos.cpf)) {
        throw new ErroNegocio('Já existe um cliente cadastrado com este CPF.');
      }
      const cliente = new Cliente({ id: this.#proximoId('cliente'), ...validos });
      this.#clientes = [...this.#clientes, cliente];
      return semCpf(cliente);
    });
  }

  listarClientes() {
    return executar(() => this.#clientes.map(semCpf));
  }

  // Busca por CPF, id ou parte do nome.
  buscarClientes(termo) {
    return executar(() => {
      const t = normalizar(termo);
      if (!t) throw new ErroNegocio('Informe um CPF, id ou nome para buscar.');
      const digitos = apenasDigitos(termo);
      const achados = this.#clientes.filter(
        (c) =>
          (digitos.length === 11 && c.cpf === digitos) || String(c.id) === t || normalizar(c.nome).includes(t),
      );
      if (achados.length === 0) throw new ErroNegocio(`Nenhum cliente encontrado para "${termo}".`);
      return achados.map(semCpf);
    });
  }

  excluirCliente(chave) {
    return executar(() => {
      const cliente = this.#exigir(this.#localizarCliente(chave), `Cliente "${chave}" não encontrado.`);
      if (this.#pedidos.some((p) => p.cliente.id === cliente.id && p.status === STATUS.ABERTO)) {
        throw new ErroNegocio('Não é possível excluir: o cliente tem pedido aberto.');
      }
      this.#clientes = this.#clientes.filter((c) => c.id !== cliente.id);
      return { id: cliente.id, nome: cliente.nome };
    });
  }

  // ================= Vendedores =================

  cadastrarVendedor(dados) {
    return executar(() => {
      const validos = validar(vendedorSchema, dados);
      if (this.#vendedores.some((v) => v.cnpj === validos.cnpj)) {
        throw new ErroNegocio('Já existe um vendedor cadastrado com este CNPJ.');
      }
      const vendedor = new Vendedor({ id: this.#proximoId('vendedor'), ...validos });
      this.#vendedores = [...this.#vendedores, vendedor];
      return { ...vendedor };
    });
  }

  listarVendedores() {
    return executar(() => this.#vendedores.map((v) => ({ ...v })));
  }

  // Busca por CNPJ, id ou parte do nome da loja.
  buscarVendedores(termo) {
    return executar(() => {
      const t = normalizar(termo);
      if (!t) throw new ErroNegocio('Informe um CNPJ, id ou nome da loja para buscar.');
      const digitos = apenasDigitos(termo);
      const achados = this.#vendedores.filter(
        (v) =>
          (digitos.length === 14 && v.cnpj === digitos) || String(v.id) === t || normalizar(v.nomeLoja).includes(t),
      );
      if (achados.length === 0) throw new ErroNegocio(`Nenhum vendedor encontrado para "${termo}".`);
      return achados.map((v) => ({ ...v }));
    });
  }

  excluirVendedor(chave) {
    return executar(() => {
      const vendedor = this.#exigir(this.#localizarVendedor(chave), `Vendedor "${chave}" não encontrado.`);
      if (this.#produtos.some((p) => p.vendedorId === vendedor.id)) {
        throw new ErroNegocio('Não é possível excluir: o vendedor ainda tem produtos cadastrados. Exclua os produtos antes.');
      }
      this.#vendedores = this.#vendedores.filter((v) => v.id !== vendedor.id);
      return { id: vendedor.id, nomeLoja: vendedor.nomeLoja };
    });
  }

  // ================= Produtos =================

  cadastrarProduto(dados) {
    return executar(() => {
      const { vendedor: chaveVendedor, estoque, ...dadosProduto } = validar(produtoSchema, dados);
      const vendedor = this.#exigir(
        this.#localizarVendedor(chaveVendedor),
        `Vendedor "${chaveVendedor}" não encontrado. Cadastre o vendedor antes do produto.`,
      );
      const duplicado = this.#produtos.some(
        (p) => p.vendedorId === vendedor.id && normalizar(p.nome) === normalizar(dadosProduto.nome),
      );
      if (duplicado) throw new ErroNegocio(`${vendedor.nomeLoja} já anuncia um produto chamado "${dadosProduto.nome}".`);

      const produto = new Produto({ id: this.#proximoId('produto'), ...dadosProduto, vendedorId: vendedor.id });
      this.#produtos = [...this.#produtos, produto];
      this.#estoque.definir(produto.id, estoque);
      return this.#visaoProduto(produto);
    });
  }

  listarProdutos() {
    return executar(() => this.#produtos.map((p) => this.#visaoProduto(p)));
  }

  // Busca por id ou parte do nome.
  buscarProdutos(termo) {
    return executar(() => {
      const t = normalizar(termo);
      if (!t) throw new ErroNegocio('Informe o id ou o nome do produto para buscar.');
      const achados = this.#produtos.filter((p) => String(p.id) === t || normalizar(p.nome).includes(t));
      if (achados.length === 0) throw new ErroNegocio(`Nenhum produto encontrado para "${termo}".`);
      return achados.map((p) => this.#visaoProduto(p));
    });
  }

  reporEstoque(chave, quantidade) {
    return executar(() => {
      const produto = this.#exigir(this.#localizarProduto(chave), `Produto "${chave}" não encontrado.`);
      const qtd = Number(quantidade);
      if (!Number.isInteger(qtd) || qtd <= 0) throw new ErroNegocio('A quantidade precisa ser um inteiro maior que zero.');
      this.#estoque.repor(produto.id, qtd);
      return this.#visaoProduto(produto);
    });
  }

  excluirProduto(chave) {
    return executar(() => {
      const produto = this.#exigir(this.#localizarProduto(chave), `Produto "${chave}" não encontrado.`);
      const pedidoAberto = this.#pedidos.find((p) => p.status === STATUS.ABERTO && p.contemProduto(produto.id));
      if (pedidoAberto) {
        throw new ErroNegocio(`Não é possível excluir: o produto está no pedido aberto ${pedidoAberto.id}.`);
      }
      this.#produtos = this.#produtos.filter((p) => p.id !== produto.id);
      this.#estoque.remover(produto.id);
      return { id: produto.id, nome: produto.nome };
    });
  }

  // ================= Cupons =================

  cadastrarCupom(dados) {
    return executar(() => {
      const validos = validar(cupomSchema, dados);
      if (this.#localizarCupom(validos.codigo)) {
        throw new ErroNegocio(`Já existe um cupom com o código ${validos.codigo}.`);
      }
      const cupom = new CupomDesconto(validos);
      this.#cupons = [...this.#cupons, cupom];
      return this.#visaoCupom(cupom);
    });
  }

  listarCupons() {
    return executar(() => this.#cupons.map((c) => this.#visaoCupom(c)));
  }

  buscarCupom(codigo) {
    return executar(() => {
      const cupom = this.#exigir(this.#localizarCupom(codigo), `Cupom "${codigo}" não encontrado.`);
      return this.#visaoCupom(cupom);
    });
  }

  excluirCupom(codigo) {
    return executar(() => {
      const cupom = this.#exigir(this.#localizarCupom(codigo), `Cupom "${codigo}" não encontrado.`);
      this.#cupons = this.#cupons.filter((c) => c.codigo !== cupom.codigo);
      return { codigo: cupom.codigo };
    });
  }

  // ================= Pedidos =================

  criarPedido(chaveCliente) {
    return executar(() => {
      const cliente = this.#exigir(this.#localizarCliente(chaveCliente), `Cliente "${chaveCliente}" não encontrado.`);
      const pedido = new Pedido(this.#proximoId('pedido'), cliente, this.#estoque);
      this.#pedidos = [...this.#pedidos, pedido];
      return pedido.resumo();
    });
  }

  adicionarItem(pedidoId, chaveProduto, quantidade) {
    return executar(() => {
      const pedido = this.#localizarPedido(pedidoId);
      const produto = this.#exigir(this.#localizarProduto(chaveProduto), `Produto "${chaveProduto}" não encontrado.`);
      const vendedor = this.#exigir(
        this.#vendedores.find((v) => v.id === produto.vendedorId),
        'O vendedor deste produto não existe mais.',
      );
      pedido.adicionarItem(produto, vendedor, quantidade);
      return pedido.resumo();
    });
  }

  removerItem(pedidoId, chaveProduto, quantidade) {
    return executar(() => {
      const pedido = this.#localizarPedido(pedidoId);
      const produto = this.#exigir(this.#localizarProduto(chaveProduto), `Produto "${chaveProduto}" não encontrado.`);
      pedido.removerItem(produto.id, quantidade === undefined || quantidade === '' ? undefined : Number(quantidade));
      return pedido.resumo();
    });
  }

  // `agora` é opcional e permite testar cupom vencido.
  aplicarCupom(pedidoId, codigo, agora = new Date()) {
    return executar(() => {
      const pedido = this.#localizarPedido(pedidoId);
      const cupom = this.#exigir(this.#localizarCupom(codigo), `Cupom "${codigo}" não encontrado.`);
      pedido.aplicarCupom(cupom, agora);
      return pedido.resumo();
    });
  }

  removerCupom(pedidoId, codigo) {
    return executar(() => {
      const pedido = this.#localizarPedido(pedidoId);
      pedido.removerCupom(String(codigo ?? '').trim().toUpperCase());
      return pedido.resumo();
    });
  }

  resumoPedido(pedidoId) {
    return executar(() => this.#localizarPedido(pedidoId).resumo());
  }

  confirmarPedido(pedidoId, agora = new Date()) {
    return executar(() => {
      const pedido = this.#localizarPedido(pedidoId);
      pedido.confirmar(agora);
      return pedido.resumo();
    });
  }

  cancelarPedido(pedidoId) {
    return executar(() => {
      const pedido = this.#localizarPedido(pedidoId);
      pedido.cancelar();
      return pedido.resumo();
    });
  }

  listarPedidos() {
    return executar(() =>
      this.#pedidos.map((p) => {
        const { id, status, cliente, itens, total } = p.resumo();
        return { id, status, cliente: cliente.nome, itens: itens.length, total };
      }),
    );
  }

  // ================= Relatórios =================

  gerarRelatorios() {
    return executar(() => gerarRelatorioFinanceiro(this.#pedidos));
  }
}