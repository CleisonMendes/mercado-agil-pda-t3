import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { carregarSeed } from '../src/data/seed.js';
import { AssistenteIA } from '../src/services/AssistenteIA.js';
import { GeminiClient } from '../src/services/GeminiClient.js';
import { Marketplace } from '../src/services/Marketplace.js';

// Gemini "de mentira": guarda o que foi enviado e devolve a resposta combinada. Nenhum teste usa internet.
const falso = (status = 200, corpo = { candidates: [{ content: { parts: [{ text: '  Texto da IA.  ' }] } }] }) => {
  const chamadas = [];
  const fetchFn = async (url, opcoes) => {
    chamadas.push({ url, opcoes, enviado: JSON.parse(opcoes.body) });
    return { ok: status >= 200 && status < 300, status, json: async () => corpo };
  };
  return { chamadas, fetchFn };
};
const montar = (fake, chave = 'chave-de-teste') =>
  new AssistenteIA(m, new GeminiClient({ chave, modelo: 'modelo-x', fetchFn: fake.fetchFn }));

let m;
beforeEach(() => {
  m = new Marketplace();
  carregarSeed(m);
});

describe('Descrição de produto com IA', () => {
  test('envia o produto ao Gemini com a chave no cabeçalho e devolve o texto limpo', async () => {
    const fake = falso();
    const r = await montar(fake).descreverProduto('Mouse');

    assert.equal(r.ok, true);
    assert.equal(r.dados.nome, 'Mouse');
    assert.equal(r.dados.descricao, 'Texto da IA.');
    assert.match(fake.chamadas[0].url, /modelo-x:generateContent$/);
    assert.equal(fake.chamadas[0].opcoes.headers['x-goog-api-key'], 'chave-de-teste');
    assert.match(fake.chamadas[0].enviado.contents[0].parts[0].text, /Produto: Mouse[\s\S]*TechBahia/);
  });

  test('produto inexistente não chama a IA', async () => {
    const fake = falso();
    const r = await montar(fake).descreverProduto('Foguete');
    assert.equal(r.ok, false);
    assert.equal(fake.chamadas.length, 0);
  });

  test('busca ambígua pede o id', async () => {
    const r = await montar(falso()).descreverProduto('Livro');
    assert.equal(r.ok, false);
    assert.match(r.erros[0], /Mais de um produto/);
  });
});

describe('Resumo do relatório com IA', () => {
  test('sem pedidos confirmados, não chama a IA', async () => {
    const fake = falso();
    const r = await montar(fake).resumirRelatorio();
    assert.equal(r.ok, false);
    assert.equal(fake.chamadas.length, 0);
  });

  test('envia só números agregados (nada de CPF ou e-mail) e devolve o resumo', async () => {
    const id = m.criarPedido(1).dados.id;
    m.adicionarItem(id, 'Mouse', 1);
    m.confirmarPedido(id);

    const fake = falso();
    const r = await montar(fake).resumirRelatorio();
    const enviado = fake.chamadas[0].enviado.contents[0].parts[0].text;

    assert.equal(r.ok, true);
    assert.equal(r.dados.resumo, 'Texto da IA.');
    assert.match(enviado, /"quantidadePedidos":1/);
    assert.ok(!/529\.?982|ana@email|cpf/i.test(enviado));
  });
});

describe('Erros do Gemini viram mensagens em português', () => {
  test('sem chave configurada', async () => {
    const fake = falso();
    const r = await montar(fake, '').descreverProduto('Mouse');
    assert.equal(r.ok, false);
    assert.match(r.erros[0], /GEMINI_API_KEY/);
    assert.equal(fake.chamadas.length, 0);
  });

  test('o diagnóstico nunca revela a chave inteira', () => {
    const segredo = 'AQ.Ab8RN6LsegredoMuitoLongo123';
    const d = new GeminiClient({ chave: segredo }).diagnostico;
    assert.match(d, /30 caracteres, começando com "AQ\."/);
    assert.ok(!d.includes('segredo'));
  });

  test('chave de exemplo do .env.example conta como não configurada', () => {
    assert.equal(new GeminiClient({ chave: 'cole_sua_chave_aqui' }).configurado, false);
  });

  test('429 (limite gratuito), 400 (chave inválida) e 404 (modelo)', async () => {
    const e429 = await montar(falso(429, { error: { message: 'quota' } })).descreverProduto('Mouse');
    assert.match(e429.erros[0], /Limite do plano gratuito/);

    const e400 = await montar(falso(400, { error: { message: 'API key not valid' } })).descreverProduto('Mouse');
    assert.match(e400.erros[0], /Chave da API recusada/);
    assert.match(e400.erros[0], /API key not valid/); // mostra o motivo real do Google

    const e404 = await montar(falso(404, {})).descreverProduto('Mouse');
    assert.match(e404.erros[0], /modelo-x/);
  });

  test('falha de rede e resposta vazia não quebram o programa', async () => {
    const semRede = new AssistenteIA(m, new GeminiClient({ chave: 'x', fetchFn: async () => { throw new Error('offline'); } }));
    assert.match((await semRede.descreverProduto('Mouse')).erros[0], /internet/);

    const vazia = await montar(falso(200, { candidates: [] })).descreverProduto('Mouse');
    assert.equal(vazia.ok, false);
  });
});
