// Todas as regras de negócio configuráveis ficam aqui, em um só lugar.
// Valores em dinheiro são sempre CENTAVOS (inteiros) para evitar erros como 14.399999.

export const REGIOES = Object.freeze(['Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul']);

export const CATEGORIAS = Object.freeze(['eletronicos', 'livros', 'alimentos', 'vestuario', 'casa']);

export const TIPOS_CUPOM = Object.freeze(['percentual', 'fixo', 'frete']);

// Ordem em que os cupons são aplicados: percentuais, depois fixos, por último o de frete.
export const ORDEM_APLICACAO_CUPONS = TIPOS_CUPOM;

export const STATUS = Object.freeze({
  ABERTO: 'aberto',
  CONFIRMADO: 'confirmado',
  CANCELADO: 'cancelado',
});

// Frete = taxa da região + valor por unidade de produto no pedido.
export const FRETE_TAXA_REGIAO_CENTAVOS = Object.freeze({
  Norte: 3500,
  Nordeste: 2500,
  'Centro-Oeste': 3000,
  Sudeste: 2000,
  Sul: 2200,
});
export const FRETE_POR_UNIDADE_CENTAVOS = 150;
export const FRETE_GRATIS_A_PARTIR_CENTAVOS = 30000; // sobre o valor já com descontos

// Cupons
export const MAX_CUPONS_POR_PEDIDO = 2;
export const TETO_DESCONTO_PERCENTUAL = 30; // soma dos descontos <= 30% do subtotal

// Tributos aproximados (Lei 12.741/2012) — informativo, não soma no total. Alíquotas fictícias, em %.
export const ALIQUOTA_TRIBUTOS_PERCENTUAL = Object.freeze({
  eletronicos: 12,
  livros: 0,
  alimentos: 5,
  vestuario: 8,
  casa: 10,
});

// Comissão do marketplace por categoria (fictícia), em %.
export const COMISSAO_PERCENTUAL = Object.freeze({
  eletronicos: 8,
  livros: 15,
  alimentos: 10,
  vestuario: 12,
  casa: 10,
});
