import { formatarBRL } from '../utils/dinheiro.js';

export const brl = (reais) => formatarBRL(reais);

// Aceita dd/mm/aaaa ou aaaa-mm-dd e devolve a data ao FIM do dia (o cupom vale o dia todo).
// Se o texto não for uma data reconhecível, devolve o texto como veio e o Zod recusa com mensagem clara.
export function lerData(texto) {
  const br = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const iso = texto.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const [ano, mes, dia] = br ? [br[3], br[2], br[1]] : iso ? [iso[1], iso[2], iso[3]] : [];
  if (!ano) return texto;
  const data = new Date(Number(ano), Number(mes) - 1, Number(dia), 23, 59, 59);
  return Number.isNaN(data.getTime()) ? texto : data;
}

export function mostrarErros(erros) {
  erros.forEach((erro) => console.log(`${erro}`));
}

// Mostra o resultado de uma chamada ao serviço: o menu só lê a resposta e mostra na tela.
export function mostrar(resposta, aoSucesso) {
  if (resposta.ok) aoSucesso(resposta.dados);
  else mostrarErros(resposta.erros);
}

export function imprimirResumoPedido(r) {
  console.log(`\nPedido #${r.id} — ${r.status.toUpperCase()} — ${r.cliente.nome} (${r.cliente.regiao})`);
  if (r.itens.length === 0) {
    console.log('   (pedido vazio)');
  } else {
    console.table(
      r.itens.map((i) => ({
        Produto: i.nome,
        Loja: i.nomeLoja,
        Categoria: i.categoria,
        Qtd: i.quantidade,
        Preço: brl(i.precoUnitario),
        Total: brl(i.total),
      })),
    );
  }
  console.log(`Subtotal ........................ ${brl(r.subtotal)}`);
  r.cupons.forEach((c) => {
    const detalhe = c.tipo === 'frete' ? 'frete grátis' : `- ${brl(c.desconto)}${c.limitadoPeloTeto ? ' (limitado pelo teto de 30%)' : ''}`;
    console.log(`(-) Cupom ${c.codigo} (${c.tipo}): ${detalhe}`);
  });
  const freteTexto = r.freteGratis ? `${brl(0)} (grátis: ${r.motivoFreteGratis})` : brl(r.frete);
  console.log(`(+) Frete ....................... ${freteTexto}`);
  console.log(`TOTAL ........................... ${brl(r.total)}`);
  console.log(`\nDescontos concedidos: ${brl(r.descontoTotal)} (teto: ${brl(r.tetoDesconto)})`);
  console.log(`Tributos aproximados (informativo): ${brl(r.tributos)}`);
  console.log(`Comissão do marketplace: ${brl(r.comissao)}`);
  if (r.repasses.length > 0) {
    console.table(
      r.repasses.map((p) => ({ Vendedor: p.nomeLoja, Bruto: brl(p.bruto), Comissão: brl(p.comissao), Repasse: brl(p.repasse) })),
    );
  }
}

export function imprimirRelatorio(r) {
  console.log('\n RELATÓRIO FINANCEIRO (somente pedidos confirmados)');
  console.log(`Pedidos confirmados: ${r.quantidadePedidos}`);
  console.log(`Faturamento total:   ${brl(r.faturamento)}`);
  console.log(`Ticket médio:        ${brl(r.ticketMedio)}`);
  console.log(`Descontos concedidos: ${brl(r.totalDescontos)} | Tributos aprox.: ${brl(r.totalTributos)} | Comissão: ${brl(r.totalComissao)}`);
  console.log('\nValor dos itens por categoria (antes dos descontos):');
  console.table(r.faturamentoPorCategoria.map((c) => ({ Categoria: c.categoria, Valor: brl(c.valorItens) })));
  console.log('Repasse por vendedor:');
  console.table(
    r.repassePorVendedor.map((v) => ({ Vendedor: v.nomeLoja, Bruto: brl(v.bruto), Comissão: brl(v.comissao), 'A repassar': brl(v.repasse) })),
  );
  console.log('Top 3 produtos mais vendidos:');
  console.table(r.top3Produtos.map((p, i) => ({ '#': i + 1, Produto: p.nome, Quantidade: p.quantidade })));
}
