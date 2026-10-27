import { ErroNegocio } from '../utils/respostas.js';

// Guarda a quantidade de cada produto. O saldo é privado: só muda pelos métodos abaixo.
export class Estoque {
  #saldos = new Map();

  definir(produtoId, quantidade) {
    this.#saldos.set(produtoId, quantidade);
  }

  disponivel(produtoId) {
    return this.#saldos.get(produtoId) ?? 0;
  }

  repor(produtoId, quantidade) {
    this.definir(produtoId, this.disponivel(produtoId) + quantidade);
  }

  remover(produtoId) {
    this.#saldos.delete(produtoId);
  }

  // Recebe itens [{ produtoId, nome, quantidade }] e devolve TODOS os que faltam.
  verificar(itens) {
    return itens
      .filter((item) => this.disponivel(item.produtoId) < item.quantidade)
      .map((item) => ({
        produtoId: item.produtoId,
        nome: item.nome,
        pedido: item.quantidade,
        disponivel: this.disponivel(item.produtoId),
      }));
  }

  // Tudo ou nada: se faltar qualquer item, não baixa nenhum.
  baixar(itens) {
    const faltas = this.verificar(itens);
    if (faltas.length > 0) {
      throw new ErroNegocio(faltas.map(Estoque.mensagemFalta));
    }
    itens.forEach((item) => this.#saldos.set(item.produtoId, this.disponivel(item.produtoId) - item.quantidade));
  }

  devolver(itens) {
    itens.forEach((item) => this.repor(item.produtoId, item.quantidade));
  }

  static mensagemFalta({ nome, pedido, disponivel }) {
    return `Estoque insuficiente: ${nome} (pedido ${pedido}, disponível ${disponivel})`;
  }
}
