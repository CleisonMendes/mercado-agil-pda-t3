import { formatarBRL, reaisParaCentavos } from '../utils/dinheiro.js';

// Cupom do marketplace (vale para o pedido inteiro). Sabe dizer se é válido.
export class CupomDesconto {
  constructor({ codigo, tipo, valor, validade, valorMinimo = 0, cumulativo = true }) {
    this.codigo = codigo;
    this.tipo = tipo; // 'percentual' | 'fixo' | 'frete'
    this.valor = tipo === 'frete' ? 0 : valor; // % para percentual, R$ para fixo
    this.validade = new Date(validade);
    this.valorMinimo = valorMinimo; // em reais
    this.cumulativo = cumulativo;
  }

  get valorCentavos() {
    return reaisParaCentavos(this.valor);
  }

  get valorMinimoCentavos() {
    return reaisParaCentavos(this.valorMinimo);
  }

  // Vale até o momento da validade (o cupom pode vencer depois de cadastrado).
  estaValido(agora = new Date()) {
    return agora <= this.validade;
  }

  // Devolve o motivo da recusa, ou null se o cupom pode ser usado nesse subtotal.
  motivoRecusa(subtotalCentavos, agora = new Date()) {
    if (!this.estaValido(agora)) {
      return `Cupom ${this.codigo} vencido em ${this.validade.toLocaleDateString('pt-BR')}.`;
    }
    if (subtotalCentavos < this.valorMinimoCentavos) {
      return (
        `Cupom ${this.codigo} exige subtotal mínimo de ${formatarBRL(this.valorMinimo)} ` +
        `(subtotal atual: ${formatarBRL(subtotalCentavos / 100)}).`
      );
    }
    return null;
  }
}
