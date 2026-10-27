import {
  ALIQUOTA_TRIBUTOS_PERCENTUAL,
  COMISSAO_PERCENTUAL,
  FRETE_GRATIS_A_PARTIR_CENTAVOS,
  FRETE_POR_UNIDADE_CENTAVOS,
  FRETE_TAXA_REGIAO_CENTAVOS,
  MAX_CUPONS_POR_PEDIDO,
  ORDEM_APLICACAO_CUPONS,
  STATUS,
  TETO_DESCONTO_PERCENTUAL,
} from '../config/regras.js';
import { emReais, formatarBRL, percentualDe } from '../utils/dinheiro.js';
import { ErroNegocio } from '../utils/respostas.js';
import { Estoque } from './Estoque.js';

// Orquestra as regras do pedido: itens, cupons, frete, tributos, total, comissão e status.
// Status e estoque só mudam por métodos (adicionarItem, confirmar, cancelar...).
export class Pedido {
  #id;
  #cliente;
  #estoque;
  #itens = [];
  #cupons = [];
  #status = STATUS.ABERTO;
  #fechamento = null; // cálculo "congelado" no momento da confirmação

  constructor(id, cliente, estoque) {
    // LGPD: o CPF não entra no pedido (rest tira o cpf do resto dos dados).
    const { cpf, ...clienteSeguro } = cliente; // eslint-disable-line no-unused-vars
    this.#id = id;
    this.#cliente = clienteSeguro;
    this.#estoque = estoque;
  }

  get id() {
    return this.#id;
  }

  get status() {
    return this.#status;
  }

  get cliente() {
    return { ...this.#cliente };
  }

  get itens() {
    return this.#itens.map((item) => ({ ...item }));
  }

  // Cálculo financeiro (em centavos) do pedido confirmado; null enquanto não confirmado.
  get fechamento() {
    return this.#fechamento ? structuredClone(this.#fechamento) : null;
  }

  contemProduto(produtoId) {
    return this.#itens.some((item) => item.produtoId === produtoId);
  }

  // ---------- Itens ----------

  adicionarItem(produto, vendedor, quantidade) {
    this.#exigirAberto('alterar itens');
    const qtd = Number(quantidade);
    if (!Number.isInteger(qtd) || qtd <= 0) {
      throw new ErroNegocio('A quantidade precisa ser um número inteiro maior que zero.');
    }
    const jaExiste = this.contemProduto(produto.id);
    this.#itens = jaExiste
      ? this.#itens.map((item) =>
          item.produtoId === produto.id ? { ...item, quantidade: item.quantidade + qtd } : item,
        )
      : [
          ...this.#itens,
          {
            produtoId: produto.id,
            nome: produto.nome,
            categoria: produto.categoria,
            vendedorId: vendedor.id,
            nomeLoja: vendedor.nomeLoja,
            precoUnitarioCentavos: produto.precoCentavos,
            quantidade: qtd,
          },
        ];
  }

  // Sem informar a quantidade, remove o item inteiro.
  removerItem(produtoId, quantidade = Infinity) {
    this.#exigirAberto('alterar itens');
    const item = this.#itens.find((i) => i.produtoId === produtoId);
    if (!item) throw new ErroNegocio(`O produto ${produtoId} não está no pedido ${this.#id}.`);
    if (!(quantidade > 0)) throw new ErroNegocio('A quantidade a remover precisa ser maior que zero.');
    const restante = item.quantidade - quantidade;
    this.#itens =
      restante > 0
        ? this.#itens.map((i) => (i.produtoId === produtoId ? { ...i, quantidade: restante } : i))
        : this.#itens.filter((i) => i.produtoId !== produtoId);
  }

  // ---------- Cupons ----------

  aplicarCupom(cupom, agora = new Date()) {
    this.#exigirAberto('aplicar cupons');
    if (this.#itens.length === 0) {
      throw new ErroNegocio('Adicione itens ao pedido antes de aplicar cupons.');
    }
    if (this.#cupons.some((c) => c.codigo === cupom.codigo)) {
      throw new ErroNegocio(`O cupom ${cupom.codigo} já foi aplicado neste pedido.`);
    }

    const erros = [];
    if (this.#cupons.length >= MAX_CUPONS_POR_PEDIDO) {
      erros.push(`Limite de ${MAX_CUPONS_POR_PEDIDO} cupons por pedido atingido.`);
    }
    if (!cupom.cumulativo && this.#cupons.length > 0) {
      erros.push(`O cupom ${cupom.codigo} não é cumulativo: só pode ser usado sozinho.`);
    }
    const naoCumulativoAplicado = this.#cupons.find((c) => !c.cumulativo);
    if (naoCumulativoAplicado) {
      erros.push(`O cupom ${naoCumulativoAplicado.codigo} já aplicado não é cumulativo e deve ser usado sozinho.`);
    }
    const motivo = cupom.motivoRecusa(this.#subtotalCentavos(), agora);
    if (motivo) erros.push(motivo);

    if (erros.length > 0) throw new ErroNegocio(erros);
    this.#cupons = [...this.#cupons, cupom];
  }

  removerCupom(codigo) {
    this.#exigirAberto('remover cupons');
    if (!this.#cupons.some((c) => c.codigo === codigo)) {
      throw new ErroNegocio(`O cupom ${codigo} não está aplicado neste pedido.`);
    }
    this.#cupons = this.#cupons.filter((c) => c.codigo !== codigo);
  }

  // ---------- Cálculo ----------

  #subtotalCentavos() {
    return this.#itens.reduce((soma, i) => soma + i.precoUnitarioCentavos * i.quantidade, 0);
  }

  // Todos os valores internos em CENTAVOS (inteiros).
  calcularValores() {
    const subtotal = this.#subtotalCentavos();
    const unidades = this.#itens.reduce((soma, i) => soma + i.quantidade, 0);

    // Tributos (informativos) e comissão são calculados sobre o valor dos itens, ANTES dos descontos.
    const itens = this.#itens.map((item) => {
      const total = item.precoUnitarioCentavos * item.quantidade;
      return {
        ...item,
        totalCentavos: total,
        tributoCentavos: percentualDe(total, ALIQUOTA_TRIBUTOS_PERCENTUAL[item.categoria]),
        comissaoCentavos: percentualDe(total, COMISSAO_PERCENTUAL[item.categoria]),
      };
    });

    // Cupons: percentuais -> fixos -> frete (sort é estável), respeitando o teto de 30% do subtotal.
    const tetoDesconto = Math.floor((subtotal * TETO_DESCONTO_PERCENTUAL) / 100);
    const ordenados = [...this.#cupons].sort(
      (a, b) => ORDEM_APLICACAO_CUPONS.indexOf(a.tipo) - ORDEM_APLICACAO_CUPONS.indexOf(b.tipo),
    );
    const { aplicados, descontoTotal } = ordenados.reduce(
      (acc, cupom) => {
        const base = subtotal - acc.descontoTotal;
        const calculado =
          cupom.tipo === 'percentual' ? percentualDe(base, cupom.valor) : cupom.tipo === 'fixo' ? cupom.valorCentavos : 0;
        const desconto = Math.max(0, Math.min(calculado, base, tetoDesconto - acc.descontoTotal));
        return {
          descontoTotal: acc.descontoTotal + desconto,
          aplicados: [
            ...acc.aplicados,
            {
              codigo: cupom.codigo,
              tipo: cupom.tipo,
              descontoCentavos: desconto,
              limitadoPeloTeto: desconto < Math.min(calculado, base),
            },
          ],
        };
      },
      { descontoTotal: 0, aplicados: [] },
    );

    // Frete: taxa da região + R$ 1,50 por unidade; grátis com cupom de frete ou >= R$ 300 já com descontos.
    const valorComDescontos = subtotal - descontoTotal;
    const freteBase =
      unidades === 0 ? 0 : FRETE_TAXA_REGIAO_CENTAVOS[this.#cliente.regiao] + unidades * FRETE_POR_UNIDADE_CENTAVOS;
    const temCupomFrete = this.#cupons.some((c) => c.tipo === 'frete');
    const gratisPorValor = valorComDescontos >= FRETE_GRATIS_A_PARTIR_CENTAVOS;
    const freteGratis = unidades > 0 && (temCupomFrete || gratisPorValor);
    const frete = freteGratis ? 0 : freteBase;

    // Repasse por vendedor = bruto dos itens dele - comissão desses itens.
    const repasses = Object.values(
      itens.reduce((acc, i) => {
        const atual = acc[i.vendedorId] ?? {
          vendedorId: i.vendedorId,
          nomeLoja: i.nomeLoja,
          brutoCentavos: 0,
          comissaoCentavos: 0,
        };
        return {
          ...acc,
          [i.vendedorId]: {
            ...atual,
            brutoCentavos: atual.brutoCentavos + i.totalCentavos,
            comissaoCentavos: atual.comissaoCentavos + i.comissaoCentavos,
          },
        };
      }, {}),
    ).map((r) => ({ ...r, repasseCentavos: r.brutoCentavos - r.comissaoCentavos }));

    return {
      itens,
      unidades,
      subtotalCentavos: subtotal,
      cupons: aplicados,
      tetoDescontoCentavos: tetoDesconto,
      descontoTotalCentavos: descontoTotal,
      freteBaseCentavos: freteBase,
      freteCentavos: frete,
      freteGratis,
      motivoFreteGratis: !freteGratis ? null : temCupomFrete ? 'cupom de frete' : `valor com descontos acima de ${formatarBRL(FRETE_GRATIS_A_PARTIR_CENTAVOS / 100)}`,
      totalCentavos: valorComDescontos + frete,
      tributosCentavos: itens.reduce((soma, i) => soma + i.tributoCentavos, 0),
      comissaoCentavos: itens.reduce((soma, i) => soma + i.comissaoCentavos, 0),
      repasses,
    };
  }

  // Resumo para quem consome o serviço (valores em reais, sem CPF).
  resumo() {
    return emReais({
      id: this.#id,
      status: this.#status,
      cliente: { ...this.#cliente },
      ...(this.#fechamento ?? this.calcularValores()),
    });
  }

  // ---------- Status ----------

  // Tudo ou nada: se faltar qualquer item, nada é confirmado e nada sai do estoque.
  confirmar(agora = new Date()) {
    this.#exigirAberto('confirmar');
    if (this.#itens.length === 0) throw new ErroNegocio('Pedido vazio: adicione itens antes de confirmar.');

    const subtotal = this.#subtotalCentavos();
    const problemasCupom = this.#cupons
      .map((c) => c.motivoRecusa(subtotal, agora))
      .filter(Boolean)
      .map((motivo) => `${motivo} Remova o cupom e confirme novamente.`);
    if (problemasCupom.length > 0) throw new ErroNegocio(problemasCupom);

    const faltas = this.#estoque.verificar(this.#itens);
    if (faltas.length > 0) throw new ErroNegocio(faltas.map(Estoque.mensagemFalta));

    this.#estoque.baixar(this.#itens);
    this.#fechamento = this.calcularValores();
    this.#status = STATUS.CONFIRMADO;
  }

  cancelar() {
    if (this.#status === STATUS.CANCELADO) {
      throw new ErroNegocio(`O pedido ${this.#id} já está cancelado.`);
    }
    if (this.#status === STATUS.CONFIRMADO) this.#estoque.devolver(this.#itens);
    this.#status = STATUS.CANCELADO;
  }

  #exigirAberto(acao) {
    if (this.#status !== STATUS.ABERTO) {
      throw new ErroNegocio(`O pedido ${this.#id} está ${this.#status}: só é possível ${acao} enquanto ele estiver aberto.`);
    }
  }
}
