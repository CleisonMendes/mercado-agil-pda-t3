// Cliente do marketplace. O CPF fica aqui dentro, mas NUNCA sai nas respostas (LGPD):
// o Marketplace usa desestruturação com rest para tirá-lo antes de devolver.
export class Cliente {
  constructor({ id, nome, email, cpf, regiao }) {
    this.id = id;
    this.nome = nome;
    this.email = email;
    this.cpf = cpf;
    this.regiao = regiao;
  }
}
