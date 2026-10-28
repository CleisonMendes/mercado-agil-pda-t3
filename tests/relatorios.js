import { STATUS } from '../config/regras.js';
import { emReais } from '../utils/dinheiro.js';

const somar = (lista, campo) => lista.reduce((soma, item) => soma + item[campo], 0);

// Soma valores por chave, usando reduce para gerar um objeto { chave: total }.
const agruparSomando = (lista, chave, campo) =>
  lista.reduce((acc, item) => ({ ...acc, [item[chave]]: (acc[item[chave]] ?? 0) + item[campo] }), {});

// Considera SOMENTE pedidos confirmados (abertos e cancelados ficam de fora).
export function gerarRelatorioFinanceiro(pedidos) {
  const fechamentos = pedidos.filter((p) => p.status === STATUS.CONFIRMADO).map((p) => p.fechamento);
  const itens = fechamentos.flatMap((f) => f.itens);
  const repasses = fechamentos.flatMap((f) => f.repasses);

  const quantidadePedidos = fechamentos.length;
  const faturamentoCentavos = somar(fechamentos, 'totalCentavos');

  const faturamentoPorCategoria = Object.entries(agruparSomando(itens, 'categoria', 'totalCentavos'))
    .map(([categoria, valorItensCentavos]) => ({ categoria, valorItensCentavos }))
    .sort((a, b) => b.valorItensCentavos - a.valorItensCentavos);

  const repassePorVendedor = Object.values(
    repasses.reduce(
      (acc, r) => ({
        ...acc,
        [r.vendedorId]: {
          vendedorId: r.vendedorId,
          nomeLoja: r.nomeLoja,
          brutoCentavos: (acc[r.vendedorId]?.brutoCentavos ?? 0) + r.brutoCentavos,
          comissaoCentavos: (acc[r.vendedorId]?.comissaoCentavos ?? 0) + r.comissaoCentavos,
          repasseCentavos: (acc[r.vendedorId]?.repasseCentavos ?? 0) + r.repasseCentavos,
        },
      }),
      {},
    ),
  ).sort((a, b) => b.repasseCentavos - a.repasseCentavos);

  const top3Produtos = Object.values(
    itens.reduce(
      (acc, i) => ({
        ...acc,
        [i.produtoId]: { produtoId: i.produtoId, nome: i.nome, quantidade: (acc[i.produtoId]?.quantidade ?? 0) + i.quantidade },
      }),
      {},
    ),
  )
    .sort((a, b) => b.quantidade - a.quantidade || a.nome.localeCompare(b.nome))
    .slice(0, 3);

  return emReais({
    quantidadePedidos,
    faturamentoCentavos,
    ticketMedioCentavos: quantidadePedidos ? Math.round(faturamentoCentavos / quantidadePedidos) : 0,
    totalDescontosCentavos: somar(fechamentos, 'descontoTotalCentavos'),
    totalTributosCentavos: somar(fechamentos, 'tributosCentavos'),
    totalComissaoCentavos: somar(fechamentos, 'comissaoCentavos'),
    faturamentoPorCategoria,
    repassePorVendedor,
    top3Produtos,
  });
}