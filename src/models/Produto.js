import { reaisParaCentavos } from '../utils/dinheiro.js';

// Produto anunciado por um vendedor. O preço é guardado em reais e lido em centavos pelo Pedido.
export class Produto {
  constructor({ id, nome, preco, categoria, vendedorId }) {
    this.id = id;
    this.nome = nome;
    this.preco = preco;
    this.categoria = categoria;
    this.vendedorId = vendedorId;
  }

  get precoCentavos() {
    return reaisParaCentavos(this.preco);
  }
}
