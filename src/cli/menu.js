import { CATEGORIAS, REGIOES, TIPOS_CUPOM } from '../config/regras.js';
import { FimDaEntrada, fecharEntrada, perguntar } from './entrada.js';
import { brl, imprimirRelatorio, imprimirResumoPedido, lerData, mostrar } from './formatadores.js';

// O menu lê do teclado e mostra na tela. Quem decide tudo é o Marketplace.

// Mostra um menu numerado e executa a opção escolhida até o usuário voltar/sair.
async function executarMenu(titulo, opcoes, rotuloSaida = 'Voltar') {
  let continuar = true;
  while (continuar) {
    console.log(`\n=== ${titulo} ===`);
    opcoes.forEach(([rotulo], i) => console.log(`${i + 1}. ${rotulo}`));
    console.log(`0. ${rotuloSaida}`);
    const escolha = await perguntar('Escolha uma opção: ');
    const opcao = opcoes[Number(escolha) - 1];
    if (escolha === '0') continuar = false;
    else if (!opcao) console.log('⚠️  Opção inválida. Digite um dos números do menu.');
    else await opcao[1]();
  }
}

// Mostra uma lista numerada e devolve o item escolhido (ou o texto digitado, se não for um número da lista).
async function escolherDaLista(titulo, itens) {
  console.log(titulo);
  itens.forEach((item, i) => console.log(`  ${i + 1}. ${item}`));
  const resposta = await perguntar('Número (ou digite o valor): ');
  return itens[Number(resposta) - 1] ?? resposta;
}

// Chama a IA avisando que pode demorar; a resposta tem o mesmo formato { ok, dados | erros }.
async function consultarIA(promessa, aoSucesso) {
  console.log('⏳ Consultando a IA...');
  mostrar(await promessa, aoSucesso);
}

// ---------------- Clientes ----------------
const menuClientes = () =>
  executarMenu('Clientes', [
    ['Cadastrar', async () => {
      const nome = await perguntar('Nome: ');
      const email = await perguntar('E-mail: ');
      const cpf = await perguntar('CPF: ');
      const regiao = await escolherDaLista('Região de entrega:', REGIOES);
      mostrar(mercado.cadastrarCliente({ nome, email, cpf, regiao }), (c) => console.log(`✅ Cliente cadastrado: #${c.id} ${c.nome}`));
    }],
    ['Listar', async () => mostrar(mercado.listarClientes(), (lista) =>
      lista.length ? console.table(lista.map(({ id, nome, email, regiao }) => ({ ID: id, Nome: nome, 'E-mail': email, Região: regiao }))) : console.log('Nenhum cliente cadastrado.'))],
    ['Buscar (CPF, id ou nome)', async () => {
      const termo = await perguntar('Busca: ');
      mostrar(mercado.buscarClientes(termo), (lista) => console.table(lista.map(({ id, nome, email, regiao }) => ({ ID: id, Nome: nome, 'E-mail': email, Região: regiao }))));
    }],
    ['Excluir (CPF ou id)', async () => {
      const chave = await perguntar('CPF ou id do cliente: ');
      mostrar(mercado.excluirCliente(chave), (c) => console.log(`✅ Cliente excluído: ${c.nome}`));
    }],
  ]);

// ---------------- Vendedores ----------------
const menuVendedores = () =>
  executarMenu('Vendedores', [
    ['Cadastrar', async () => {
      const nomeLoja = await perguntar('Nome da loja: ');
      const cnpj = await perguntar('CNPJ: ');
      const email = await perguntar('E-mail: ');
      mostrar(mercado.cadastrarVendedor({ nomeLoja, cnpj, email }), (v) => console.log(`✅ Vendedor cadastrado: #${v.id} ${v.nomeLoja}`));
    }],
    ['Listar', async () => mostrar(mercado.listarVendedores(), (lista) =>
      lista.length ? console.table(lista.map((v) => ({ ID: v.id, Loja: v.nomeLoja, CNPJ: v.cnpj, 'E-mail': v.email }))) : console.log('Nenhum vendedor cadastrado.'))],
    ['Buscar (CNPJ, id ou nome)', async () => {
      const termo = await perguntar('Busca: ');
      mostrar(mercado.buscarVendedores(termo), (lista) => console.table(lista.map((v) => ({ ID: v.id, Loja: v.nomeLoja, CNPJ: v.cnpj, 'E-mail': v.email }))));
    }],
    ['Excluir (CNPJ ou id)', async () => {
      const chave = await perguntar('CNPJ ou id do vendedor: ');
      mostrar(mercado.excluirVendedor(chave), (v) => console.log(`✅ Vendedor excluído: ${v.nomeLoja}`));
    }],
  ]);

// ---------------- Produtos ----------------
const tabelaProdutos = (lista) =>
  console.table(lista.map((p) => ({ ID: p.id, Produto: p.nome, Preço: brl(p.preco), Categoria: p.categoria, Loja: p.vendedor, Estoque: p.estoque })));

const menuProdutos = () =>
  executarMenu('Produtos', [
    ['Cadastrar', async () => {
      mostrar(mercado.listarVendedores(), (lista) => console.table(lista.map((v) => ({ ID: v.id, Loja: v.nomeLoja, CNPJ: v.cnpj }))));
      const vendedor = await perguntar('Vendedor (id, CNPJ ou nome da loja): ');
      const nome = await perguntar('Nome do produto: ');
      const preco = await perguntar('Preço (ex.: 120.50): ');
      const categoria = await escolherDaLista('Categoria:', CATEGORIAS);
      const estoque = await perguntar('Estoque inicial: ');
      mostrar(mercado.cadastrarProduto({ vendedor, nome, preco: preco.replace(',', '.'), categoria, estoque }), (p) => console.log(`✅ Produto cadastrado: #${p.id} ${p.nome}`));
    }],
    ['Listar', async () => mostrar(mercado.listarProdutos(), (lista) => (lista.length ? tabelaProdutos(lista) : console.log('Nenhum produto cadastrado.')))],
    ['Buscar (id ou nome)', async () => {
      const termo = await perguntar('Busca: ');
      mostrar(mercado.buscarProdutos(termo), tabelaProdutos);
    }],
    ['Repor estoque', async () => {
      const chave = await perguntar('Produto (id ou nome): ');
      const quantidade = await perguntar('Quantidade a repor: ');
      mostrar(mercado.reporEstoque(chave, quantidade), (p) => console.log(`✅ ${p.nome}: estoque agora é ${p.estoque}`));
    }],
    ['Gerar descrição com IA (Gemini)', async () => {
      const chave = await perguntar('Produto (id ou nome): ');
      await consultarIA(assistente.descreverProduto(chave), (r) => console.log(`\n✨ ${r.nome}:\n${r.descricao}\n(texto gerado por IA: revise antes de usar)`));
    }],
    ['Excluir (id ou nome)', async () => {
      const chave = await perguntar('Produto (id ou nome): ');
      mostrar(mercado.excluirProduto(chave), (p) => console.log(`✅ Produto excluído: ${p.nome}`));
    }],
  ]);

// ---------------- Cupons ----------------
const tabelaCupons = (lista) =>
  console.table(
    lista.map((c) => ({
      Código: c.codigo,
      Tipo: c.tipo,
      Valor: c.tipo === 'percentual' ? `${c.valor}%` : c.tipo === 'fixo' ? brl(c.valor) : 'frete grátis',
      'Mínimo': brl(c.valorMinimo),
      Cumulativo: c.cumulativo ? 'sim' : 'não',
      Validade: c.validade.toLocaleDateString('pt-BR'),
      Situação: c.vencido ? 'VENCIDO' : 'válido',
    })),
  );

const menuCupons = () =>
  executarMenu('Cupons', [
    ['Cadastrar', async () => {
      const codigo = await perguntar('Código: ');
      const tipo = await escolherDaLista('Tipo:', TIPOS_CUPOM);
      const valor = tipo === 'frete' ? '0' : await perguntar(tipo === 'percentual' ? 'Percentual (ex.: 10): ' : 'Valor em reais (ex.: 15): ');
      const validade = await perguntar('Validade (dd/mm/aaaa): ');
      const valorMinimo = await perguntar('Valor mínimo do pedido em reais (0 para nenhum): ');
      const cumulativo = (await perguntar('Pode ser combinado com outro cupom? (s/n): ')).toLowerCase() !== 'n';
      mostrar(
        mercado.cadastrarCupom({ codigo, tipo, valor: valor.replace(',', '.'), validade: lerData(validade), valorMinimo: valorMinimo.replace(',', '.') || 0, cumulativo }),
        (c) => console.log(`✅ Cupom cadastrado: ${c.codigo}`),
      );
    }],
    ['Listar', async () => mostrar(mercado.listarCupons(), (lista) => (lista.length ? tabelaCupons(lista) : console.log('Nenhum cupom cadastrado.')))],
    ['Buscar (código)', async () => {
      const codigo = await perguntar('Código: ');
      mostrar(mercado.buscarCupom(codigo), (c) => tabelaCupons([c]));
    }],
    ['Excluir (código)', async () => {
      const codigo = await perguntar('Código: ');
      mostrar(mercado.excluirCupom(codigo), (c) => console.log(`✅ Cupom excluído: ${c.codigo}`));
    }],
  ]);

// ---------------- Pedidos ----------------
const menuPedidos = () =>
  executarMenu('Pedidos', [
    ['Criar pedido', async () => {
      mostrar(mercado.listarClientes(), (lista) => console.table(lista.map((c) => ({ ID: c.id, Nome: c.nome, Região: c.regiao }))));
      const cliente = await perguntar('Cliente (id ou CPF): ');
      mostrar(mercado.criarPedido(cliente), (p) => console.log(`✅ Pedido #${p.id} criado para ${p.cliente.nome}. Agora adicione itens.`));
    }],
    ['Adicionar item', async () => {
      const pedido = await perguntar('Número do pedido: ');
      mostrar(mercado.listarProdutos(), tabelaProdutos);
      const produto = await perguntar('Produto (id ou nome): ');
      const quantidade = await perguntar('Quantidade: ');
      mostrar(mercado.adicionarItem(pedido, produto, quantidade), (r) => console.log(`✅ Item adicionado. Subtotal do pedido: ${brl(r.subtotal)}`));
    }],
    ['Remover item', async () => {
      const pedido = await perguntar('Número do pedido: ');
      const produto = await perguntar('Produto (id ou nome): ');
      const quantidade = await perguntar('Quantidade a remover (Enter remove tudo): ');
      mostrar(mercado.removerItem(pedido, produto, quantidade), (r) => console.log(`✅ Item removido. Subtotal do pedido: ${brl(r.subtotal)}`));
    }],
    ['Aplicar cupom', async () => {
      const pedido = await perguntar('Número do pedido: ');
      const codigo = await perguntar('Código do cupom: ');
      mostrar(mercado.aplicarCupom(pedido, codigo), (r) => console.log(`✅ Cupom aplicado. Total atual: ${brl(r.total)}`));
    }],
    ['Remover cupom', async () => {
      const pedido = await perguntar('Número do pedido: ');
      const codigo = await perguntar('Código do cupom: ');
      mostrar(mercado.removerCupom(pedido, codigo), (r) => console.log(`✅ Cupom removido. Total atual: ${brl(r.total)}`));
    }],
    ['Ver resumo', async () => {
      const pedido = await perguntar('Número do pedido: ');
      mostrar(mercado.resumoPedido(pedido), imprimirResumoPedido);
    }],
    ['Confirmar pedido', async () => {
      const pedido = await perguntar('Número do pedido: ');
      mostrar(mercado.confirmarPedido(pedido), (r) => {
        console.log('✅ Pedido confirmado! Estoque atualizado.');
        imprimirResumoPedido(r);
      });
    }],
    ['Cancelar pedido', async () => {
      const pedido = await perguntar('Número do pedido: ');
      mostrar(mercado.cancelarPedido(pedido), (r) => console.log(`✅ Pedido #${r.id} cancelado.`));
    }],
    ['Listar pedidos', async () => mostrar(mercado.listarPedidos(), (lista) =>
      lista.length ? console.table(lista.map((p) => ({ Pedido: p.id, Cliente: p.cliente, Status: p.status, Itens: p.itens, Total: brl(p.total) }))) : console.log('Nenhum pedido criado.'))],
  ]);

// ---------------- Principal ----------------
let mercado; // o serviço que o menu conhece
let assistente; // extras com IA

export async function iniciarMenu(marketplace, assistenteIA) {
  mercado = marketplace;
  assistente = assistenteIA;
  try {
    await executarMenu(
      'MercadoÁgil — Menu principal',
      [
        ['Clientes', menuClientes],
        ['Vendedores', menuVendedores],
        ['Produtos e estoque', menuProdutos],
        ['Cupons', menuCupons],
        ['Pedidos', menuPedidos],
        ['Relatórios financeiros', async () => mostrar(mercado.gerarRelatorios(), imprimirRelatorio)],
        ['Resumo do relatório com IA (Gemini)', async () =>
          consultarIA(assistente.resumirRelatorio(), (r) => console.log(`\n✨ Resumo:\n${r.resumo}\n(texto gerado por IA: confira com a tabela do relatório)`))],
      ],
      'Sair',
    );
    console.log('\nAté logo! 👋');
  } catch (erro) {
    if (!(erro instanceof FimDaEntrada)) throw erro;
    console.log('\nEntrada encerrada. Até logo! 👋');
  } finally {
    fecharEntrada();
  }
}
