import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { carregarSeed } from '../src/data/seed.js';
import { Marketplace } from '../src/services/Marketplace.js';

let m;
const estoqueDe = (nome) => m.buscarProdutos(nome).dados.find((p) => p.nome === nome).estoque;
const pedidoExemplo = () => {
  const { id } = m.criarPedido(1).dados; // Ana Souza — Nordeste
  m.adicionarItem(id, 'Mouse', 1);
  m.adicionarItem(id, 'Livro de JavaScript', 1);
  return id;
};

beforeEach(() => {
  m = new Marketplace();
  carregarSeed(m);
});

describe('Exemplo completo do descritivo', () => {
  test('total R$ 193,00, tributos, comissão e repasses', () => {
    const id = pedidoExemplo();
    m.aplicarCupom(id, 'BEMVINDO10');
    const r = m.aplicarCupom(id, 'PDA15').dados;

    assert.equal(r.subtotal, 200);
    assert.equal(r.descontoTotal, 35);
    assert.equal(r.frete, 28);
    assert.equal(r.total, 193);
    assert.equal(r.tributos, 14.4);
    assert.equal(r.comissao, 21.6);
    assert.deepEqual(
      r.repasses.map((p) => [p.nomeLoja, p.repasse]),
      [['TechBahia', 110.4], ['Livraria Sol', 68]],
    );
  });

  test('a ordem dos cupons aplicados não muda o resultado (percentual vem antes do fixo)', () => {
    const id = pedidoExemplo();
    m.aplicarCupom(id, 'PDA15');
    const r = m.aplicarCupom(id, 'BEMVINDO10').dados;
    assert.equal(r.total, 193);
  });
});

describe('Estoque: tudo ou nada', () => {
  test('confirmar dá baixa; cancelar pedido confirmado devolve', () => {
    const id = pedidoExemplo();
    assert.equal(m.confirmarPedido(id).ok, true);
    assert.equal(estoqueDe('Mouse'), 9);
    assert.equal(m.cancelarPedido(id).ok, true);
    assert.equal(estoqueDe('Mouse'), 10);
  });

  test('cancelar pedido já cancelado é recusado', () => {
    const id = pedidoExemplo();
    m.cancelarPedido(id);
    const r = m.cancelarPedido(id);
    assert.equal(r.ok, false);
  });

  test('se faltar item, nada é confirmado e a mensagem lista TODOS os que faltam', () => {
    const id = m.criarPedido(1).dados.id;
    m.adicionarItem(id, 'Jogo de Panelas', 5); // estoque 4
    m.adicionarItem(id, 'Teclado Mecânico', 6); // estoque 5
    m.adicionarItem(id, 'Mouse', 1); // ok
    const r = m.confirmarPedido(id);

    assert.equal(r.ok, false);
    assert.equal(r.erros.length, 2);
    assert.match(r.erros[0], /Estoque insuficiente: Jogo de Panelas \(pedido 5, disponível 4\)/);
    assert.equal(estoqueDe('Mouse'), 10); // nada saiu do estoque
    assert.equal(m.resumoPedido(id).dados.status, 'aberto');
  });

  test('pedido confirmado não aceita alterações', () => {
    const id = pedidoExemplo();
    m.confirmarPedido(id);
    assert.equal(m.adicionarItem(id, 'Mouse', 1).ok, false);
    assert.equal(m.aplicarCupom(id, 'BEMVINDO10').ok, false);
  });

  test('pedido vazio não confirma', () => {
    const id = m.criarPedido(1).dados.id;
    assert.equal(m.confirmarPedido(id).ok, false);
  });
});

describe('Cupons', () => {
  test('mesmo cupom duas vezes é recusado', () => {
    const id = pedidoExemplo();
    m.aplicarCupom(id, 'BEMVINDO10');
    assert.equal(m.aplicarCupom(id, 'BEMVINDO10').ok, false);
  });

  test('no máximo 2 cupons por pedido', () => {
    const id = pedidoExemplo();
    m.aplicarCupom(id, 'BEMVINDO10');
    m.aplicarCupom(id, 'PDA15');
    const r = m.aplicarCupom(id, 'FRETEZERO');
    assert.equal(r.ok, false);
    assert.match(r.erros[0], /Limite de 2 cupons/);
  });

  test('cupom não cumulativo só funciona sozinho (nos dois sentidos)', () => {
    const a = pedidoExemplo();
    m.aplicarCupom(a, 'BEMVINDO10');
    assert.equal(m.aplicarCupom(a, 'SUPER20').ok, false);

    const b = pedidoExemplo();
    assert.equal(m.aplicarCupom(b, 'SUPER20').ok, true);
    assert.equal(m.aplicarCupom(b, 'BEMVINDO10').ok, false);
  });

  test('cupom vencido é recusado, mesmo tendo sido válido ao cadastrar', () => {
    const id = pedidoExemplo();
    const daquiA2Anos = new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000);
    const r = m.aplicarCupom(id, 'BEMVINDO10', daquiA2Anos);
    assert.equal(r.ok, false);
    assert.match(r.erros[0], /vencido/);
  });

  test('valor mínimo: PDA15 exige subtotal de R$ 50', () => {
    const id = m.criarPedido(1).dados.id;
    m.adicionarItem(id, 'Café Especial 500g', 1); // R$ 35
    assert.equal(m.aplicarCupom(id, 'PDA15').ok, false);
  });

  test('teto: descontos nunca passam de 30% do subtotal', () => {
    m.cadastrarCupom({ codigo: 'PERC25', tipo: 'percentual', valor: 25, validade: new Date(Date.now() + 1e9) });
    m.cadastrarCupom({ codigo: 'FIXO20', tipo: 'fixo', valor: 20, validade: new Date(Date.now() + 1e9) });
    const id = m.criarPedido(1).dados.id;
    m.adicionarItem(id, 'Mouse', 1); // 120 -> 25% = 30 ; fixo 20 -> excederia o teto (36)
    m.aplicarCupom(id, 'PERC25');
    const r = m.aplicarCupom(id, 'FIXO20').dados;
    assert.equal(r.descontoTotal, 36);
    assert.equal(r.cupons[1].limitadoPeloTeto, true);
    assert.equal(r.cupons[1].desconto, 6);
  });
});

describe('Frete', () => {
  test('taxa da região + R$ 1,50 por unidade (Sul, 3 unidades)', () => {
    const id = m.criarPedido(3).dados.id; // Carla — Sul
    m.adicionarItem(id, 'Café Especial 500g', 3); // R$ 105, abaixo do frete grátis
    const r = m.resumoPedido(id).dados;
    assert.equal(r.frete, 22 + 3 * 1.5);
  });

  test('frete grátis quando o valor com descontos é >= R$ 300', () => {
    const id = m.criarPedido(1).dados.id;
    m.adicionarItem(id, 'Jogo de Panelas', 1); // R$ 320
    const r = m.resumoPedido(id).dados;
    assert.equal(r.frete, 0);
    assert.equal(r.total, 320);
  });

  test('desconto pode tirar o pedido da faixa de frete grátis', () => {
    const id = m.criarPedido(1).dados.id;
    m.adicionarItem(id, 'Jogo de Panelas', 1); // 320 - 10% = 288 < 300
    const r = m.aplicarCupom(id, 'BEMVINDO10').dados;
    assert.equal(r.frete, 25 + 1.5);
  });

  test('cupom de frete zera o frete', () => {
    const id = pedidoExemplo();
    const r = m.aplicarCupom(id, 'FRETEZERO').dados;
    assert.equal(r.frete, 0);
    assert.equal(r.total, 200);
  });
});

describe('Validação com Zod e LGPD', () => {
  test('CPF inválido devolve erro em vez de quebrar', () => {
    const r = m.cadastrarCliente({ nome: 'Fulano', email: 'f@x.com', cpf: '111.111.111-11', regiao: 'Sul' });
    assert.equal(r.ok, false);
    assert.match(r.erros[0], /CPF inválido/);
  });

  test('CNPJ inválido, preço "abc" e cupom com data passada são recusados', () => {
    assert.equal(m.cadastrarVendedor({ nomeLoja: 'X Loja', cnpj: '12.345.678/0001-00', email: 'x@x.com' }).ok, false);
    assert.equal(m.cadastrarProduto({ nome: 'Coisa', preco: 'abc', categoria: 'casa', vendedor: 1 }).ok, false);
    assert.equal(m.cadastrarCupom({ codigo: 'VELHO', tipo: 'fixo', valor: 5, validade: '2020-01-01' }).ok, false);
  });

  test('produto de vendedor que não existe é recusado', () => {
    const r = m.cadastrarProduto({ nome: 'Fantasma', preco: 10, categoria: 'casa', vendedor: 999 });
    assert.equal(r.ok, false);
  });

  test('o CPF não aparece nas listagens, nas buscas nem nos pedidos', () => {
    const textoClientes = JSON.stringify([m.listarClientes().dados, m.buscarClientes('Ana').dados]);
    assert.ok(!textoClientes.includes('529'));
    assert.ok(!('cpf' in m.listarClientes().dados[0]));
    const id = pedidoExemplo();
    assert.ok(!JSON.stringify(m.resumoPedido(id).dados).includes('529'));
  });

  test('buscar cliente por CPF funciona, mesmo sem mostrá-lo', () => {
    assert.equal(m.buscarClientes('529.982.247-25').dados[0].nome, 'Ana Souza');
  });
});

describe('Exclusões', () => {
  test('não exclui produto que está em pedido aberto', () => {
    pedidoExemplo();
    assert.equal(m.excluirProduto('Mouse').ok, false);
  });

  test('não exclui vendedor que ainda tem produtos', () => {
    assert.equal(m.excluirVendedor('TechBahia').ok, false);
  });

  test('exclui cupom e cliente sem pedidos', () => {
    assert.equal(m.excluirCupom('pda15').ok, true);
    assert.equal(m.buscarCupom('PDA15').ok, false);
    assert.equal(m.excluirCliente(2).ok, true);
  });
});

describe('Relatórios', () => {
  test('somente pedidos confirmados entram nos números', () => {
    const confirmado = pedidoExemplo();
    m.aplicarCupom(confirmado, 'BEMVINDO10');
    m.aplicarCupom(confirmado, 'PDA15');
    m.confirmarPedido(confirmado);

    pedidoExemplo(); // aberto
    const cancelado = pedidoExemplo();
    m.confirmarPedido(cancelado);
    m.cancelarPedido(cancelado);

    const r = m.gerarRelatorios().dados;
    // o cancelado foi confirmado antes de cancelar, mas não conta
    assert.equal(r.quantidadePedidos, 1);
    assert.equal(r.faturamento, 193);
    assert.equal(r.ticketMedio, 193);
    assert.equal(r.totalDescontos, 35);
    assert.equal(r.totalComissao, 21.6);
    assert.deepEqual(r.repassePorVendedor.map((v) => v.repasse), [110.4, 68]);
    assert.deepEqual(r.faturamentoPorCategoria.map((c) => [c.categoria, c.valorItens]), [['eletronicos', 120], ['livros', 80]]);
  });

  test('sem pedidos confirmados, os relatórios vêm zerados e não quebram', () => {
    const r = m.gerarRelatorios().dados;
    assert.equal(r.quantidadePedidos, 0);
    assert.equal(r.ticketMedio, 0);
    assert.deepEqual(r.top3Produtos, []);
  });

  test('top 3 produtos por quantidade', () => {
    const id = m.criarPedido(2).dados.id;
    m.adicionarItem(id, 'Café Especial 500g', 5);
    m.adicionarItem(id, 'Mouse', 3);
    m.adicionarItem(id, 'Luminária de Mesa', 2);
    m.adicionarItem(id, 'Livro de Node.js', 1);
    m.confirmarPedido(id);
    const top = m.gerarRelatorios().dados.top3Produtos;
    assert.deepEqual(top.map((p) => [p.nome, p.quantidade]), [['Café Especial 500g', 5], ['Mouse', 3], ['Luminária de Mesa', 2]]);
  });
});

describe('Robustez', () => {
  test('entradas absurdas devolvem erro e não lançam exceção', () => {
    assert.equal(m.resumoPedido(999).ok, false);
    assert.equal(m.criarPedido('xyz').ok, false);
    assert.equal(m.adicionarItem(999, 'Mouse', 1).ok, false);
    assert.equal(m.cadastrarCliente(undefined).ok, false);
    assert.equal(m.cadastrarCupom(null).ok, false);
    const id = m.criarPedido(1).dados.id;
    assert.equal(m.adicionarItem(id, 'Mouse', 'abc').ok, false);
    assert.equal(m.adicionarItem(id, 'Mouse', -2).ok, false);
    assert.equal(m.adicionarItem(id, 'Mouse', 1.5).ok, false);
  });

  test('valores em reais sem erros de ponto flutuante', () => {
    const id = m.criarPedido(1).dados.id;
    m.adicionarItem(id, 'Mouse', 1);
    assert.equal(m.resumoPedido(id).dados.tributos, 14.4);
  });
});
