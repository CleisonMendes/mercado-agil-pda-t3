// Utilitários de dinheiro. Internamente tudo é centavos (inteiro).

export const reaisParaCentavos = (reais) => Math.round(Number(reais) * 100);

// Percentual de um valor em centavos, arredondado para o centavo mais próximo.
export const percentualDe = (centavos, percentual) => Math.round((centavos * percentual) / 100);

// Formata em reais: R$ 1.234,50
export function formatarBRL(reais) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
    .format(reais)
    .replace(/\u00a0/g, ' ');
}

// Converte recursivamente todo campo "xxxCentavos" para "xxx" em reais.
// Ex.: { totalCentavos: 19300 } -> { total: 193 }
export function emReais(valor) {
  if (Array.isArray(valor)) return valor.map(emReais);
  if (valor && typeof valor === 'object' && !(valor instanceof Date)) {
    return Object.fromEntries(
      Object.entries(valor).map(([chave, v]) =>
        chave.endsWith('Centavos') ? [chave.replace(/Centavos$/, ''), v / 100] : [chave, emReais(v)],
      ),
    );
  }
  return valor;
}
