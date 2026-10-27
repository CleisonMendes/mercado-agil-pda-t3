// Vendedor (loja) que anuncia produtos no marketplace.
export class Vendedor {
  constructor({ id, nomeLoja, cnpj, email }) {
    this.id = id;
    this.nomeLoja = nomeLoja;
    this.cnpj = cnpj;
    this.email = email;
  }
}
