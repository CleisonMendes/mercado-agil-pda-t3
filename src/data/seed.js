// Dados de exemplo carregados ao iniciar (ficam só em memória).
// Com estes dados dá para reproduzir o exemplo do descritivo:
//   Ana (Nordeste) compra 1 Mouse + 1 Livro de JavaScript com BEMVINDO10 e PDA15 => total R$ 193,00.

const emDias = (dias) => new Date(Date.now() + dias * 24 * 60 * 60 * 1000);

const clientes = [
  { nome: 'Ana Souza', email: 'ana@email.com', cpf: '529.982.247-25', regiao: 'Nordeste' },
  { nome: 'Bruno Lima', email: 'bruno@email.com', cpf: '111.444.777-35', regiao: 'Sudeste' },
  { nome: 'Carla Mendes', email: 'carla@email.com', cpf: '390.533.447-05', regiao: 'Sul' },
];

const vendedores = [
  { nomeLoja: 'TechBahia', cnpj: '11.222.333/0001-81', email: 'contato@techbahia.com' },
  { nomeLoja: 'Livraria Sol', cnpj: '11.444.777/0001-61', email: 'contato@livrariasol.com' },
  { nomeLoja: 'Casa Aconchego', cnpj: '45.723.174/0001-10', email: 'contato@casaaconchego.com' },
];

// vendedor: CNPJ da loja (o Marketplace resolve para o id).
const produtos = [
  { nome: 'Mouse', preco: 120, categoria: 'eletronicos', vendedor: '11222333000181', estoque: 10 },
  { nome: 'Teclado Mecânico', preco: 250, categoria: 'eletronicos', vendedor: '11222333000181', estoque: 5 },
  { nome: 'Fone Bluetooth', preco: 180, categoria: 'eletronicos', vendedor: '11222333000181', estoque: 8 },
  { nome: 'Livro de JavaScript', preco: 80, categoria: 'livros', vendedor: '11444777000161', estoque: 20 },
  { nome: 'Livro de Node.js', preco: 95, categoria: 'livros', vendedor: '11444777000161', estoque: 12 },
  { nome: 'Café Especial 500g', preco: 35, categoria: 'alimentos', vendedor: '45723174000110', estoque: 30 },
  { nome: 'Jogo de Panelas', preco: 320, categoria: 'casa', vendedor: '45723174000110', estoque: 4 },
  { nome: 'Luminária de Mesa', preco: 60, categoria: 'casa', vendedor: '45723174000110', estoque: 15 },
];

const cupons = [
  { codigo: 'BEMVINDO10', tipo: 'percentual', valor: 10, validade: emDias(365), valorMinimo: 0, cumulativo: true },
  { codigo: 'PDA15', tipo: 'fixo', valor: 15, validade: emDias(365), valorMinimo: 50, cumulativo: true },
  { codigo: 'FRETEZERO', tipo: 'frete', valor: 0, validade: emDias(365), valorMinimo: 0, cumulativo: true },
  { codigo: 'SUPER20', tipo: 'percentual', valor: 20, validade: emDias(90), valorMinimo: 100, cumulativo: false },
];

// Cadastra tudo passando pelas validações do Zod; se algum dado do seed estiver inválido, avisa na hora.
export function carregarSeed(marketplace) {
  const cadastros = [
    ...clientes.map((c) => ['cliente', marketplace.cadastrarCliente(c)]),
    ...vendedores.map((v) => ['vendedor', marketplace.cadastrarVendedor(v)]),
    ...produtos.map((p) => ['produto', marketplace.cadastrarProduto(p)]),
    ...cupons.map((c) => ['cupom', marketplace.cadastrarCupom(c)]),
  ];
  const erros = cadastros.filter(([, r]) => !r.ok).map(([tipo, r]) => `${tipo}: ${r.erros.join(', ')}`);
  if (erros.length > 0) throw new Error(`Seed inválido -> ${erros.join(' | ')}`);
  return { clientes: clientes.length, vendedores: vendedores.length, produtos: produtos.length, cupons: cupons.length };
}
