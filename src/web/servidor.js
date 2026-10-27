// Servidor web (node:http, sem frameworks). Só traduz HTTP <-> Marketplace: as regras continuam nas classes.
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lerData } from '../cli/formatadores.js';
import { carregarEnv } from '../config/env.js';
import { CATEGORIAS, REGIOES, TIPOS_CUPOM } from '../config/regras.js';
import { carregarSeed } from '../data/seed.js';
import { AssistenteIA } from '../services/AssistenteIA.js';
import { Marketplace } from '../services/Marketplace.js';
import { falha, sucesso } from '../utils/respostas.js';

const PUBLICO = join(fileURLToPath(new URL('.', import.meta.url)), 'public');
const PORTA = Number(process.env.PORT) || 3000;
const TIPOS_ARQUIVO = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };

carregarEnv(); // GEMINI_API_KEY do arquivo .env
const mp = new Marketplace();
carregarSeed(mp);
const ia = new AssistenteIA(mp);

const num = (v) => (typeof v === 'string' ? v.replace(',', '.') : v); // aceita "12,50"
const busca = (url) => url.searchParams.get('q');

// [método, caminho, função(parametros, corpo, url)] — cada função devolve { ok, dados | erros }.
const rotas = [
  ['GET', '/api/config', () => sucesso({ regioes: REGIOES, categorias: CATEGORIAS, tipos: TIPOS_CUPOM })],

  ['GET', '/api/clientes', (p, b, u) => (busca(u) ? mp.buscarClientes(busca(u)) : mp.listarClientes())],
  ['POST', '/api/clientes', (p, b) => mp.cadastrarCliente(b)],
  ['DELETE', '/api/clientes/:chave', (p) => mp.excluirCliente(p.chave)],

  ['GET', '/api/vendedores', (p, b, u) => (busca(u) ? mp.buscarVendedores(busca(u)) : mp.listarVendedores())],
  ['POST', '/api/vendedores', (p, b) => mp.cadastrarVendedor(b)],
  ['DELETE', '/api/vendedores/:chave', (p) => mp.excluirVendedor(p.chave)],

  ['GET', '/api/produtos', (p, b, u) => (busca(u) ? mp.buscarProdutos(busca(u)) : mp.listarProdutos())],
  ['POST', '/api/produtos', (p, b) => mp.cadastrarProduto({ ...b, preco: num(b.preco) })],
  ['POST', '/api/produtos/:chave/estoque', (p, b) => mp.reporEstoque(p.chave, b.quantidade)],
  ['DELETE', '/api/produtos/:chave', (p) => mp.excluirProduto(p.chave)],

  ['GET', '/api/cupons', (p, b, u) => (busca(u) ? mp.buscarCupom(busca(u)) : mp.listarCupons())],
  [
    'POST',
    '/api/cupons',
    (p, b) =>
      mp.cadastrarCupom({
        ...b,
        valor: num(b.valor),
        valorMinimo: b.valorMinimo === '' ? 0 : num(b.valorMinimo),
        validade: lerData(String(b.validade ?? '')),
        cumulativo: b.cumulativo !== false && b.cumulativo !== 'false',
      }),
  ],
  ['DELETE', '/api/cupons/:codigo', (p) => mp.excluirCupom(p.codigo)],

  ['GET', '/api/pedidos', () => mp.listarPedidos()],
  ['POST', '/api/pedidos', (p, b) => mp.criarPedido(b.cliente)],
  ['GET', '/api/pedidos/:id', (p) => mp.resumoPedido(p.id)],
  ['POST', '/api/pedidos/:id/itens', (p, b) => mp.adicionarItem(p.id, b.produto, b.quantidade)],
  ['DELETE', '/api/pedidos/:id/itens/:produto', (p) => mp.removerItem(p.id, p.produto)],
  ['POST', '/api/pedidos/:id/cupons', (p, b) => mp.aplicarCupom(p.id, b.codigo)],
  ['DELETE', '/api/pedidos/:id/cupons/:codigo', (p) => mp.removerCupom(p.id, p.codigo)],
  ['POST', '/api/pedidos/:id/confirmar', (p) => mp.confirmarPedido(p.id)],
  ['POST', '/api/pedidos/:id/cancelar', (p) => mp.cancelarPedido(p.id)],

  ['GET', '/api/relatorios', () => mp.gerarRelatorios()],

  ['POST', '/api/ia/descricao', (p, b) => ia.descreverProduto(b.produto)],
  ['POST', '/api/ia/resumo', () => ia.resumirRelatorio()],
];

// Compara "/api/pedidos/:id" com "/api/pedidos/7" e devolve { id: '7' } (ou null).
function casar(padrao, caminho) {
  const a = padrao.split('/');
  const c = caminho.split('/');
  if (a.length !== c.length || !a.every((seg, i) => seg.startsWith(':') || seg === c[i])) return null;
  return Object.fromEntries(a.flatMap((seg, i) => (seg.startsWith(':') ? [[seg.slice(1), decodeURIComponent(c[i])]] : [])));
}

const lerCorpo = (req) =>
  new Promise((resolve) => {
    let texto = '';
    req.on('data', (parte) => (texto += parte));
    req.on('end', () => {
      try {
        resolve(texto ? JSON.parse(texto) : {});
      } catch {
        resolve(null);
      }
    });
  });

function enviar(res, status, objeto) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(objeto));
}

async function tratarApi(req, res, url) {
  const corpo = await lerCorpo(req);
  if (corpo === null) return enviar(res, 400, falha('JSON inválido na requisição.'));
  const achada = rotas
    .map(([metodo, padrao, funcao]) => ({ metodo, funcao, params: casar(padrao, url.pathname) }))
    .find((r) => r.metodo === req.method && r.params);
  if (!achada) return enviar(res, 404, falha('Rota não encontrada.'));
  const resposta = await achada.funcao(achada.params, corpo, url);
  return enviar(res, resposta.ok ? 200 : 400, resposta);
}

async function tratarArquivo(res, caminho) {
  const arquivo = normalize(join(PUBLICO, caminho === '/' ? 'index.html' : caminho));
  if (!arquivo.startsWith(PUBLICO)) return enviar(res, 403, falha('Acesso negado.'));
  try {
    const conteudo = await readFile(arquivo);
    res.writeHead(200, { 'Content-Type': TIPOS_ARQUIVO[extname(arquivo)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
    return res.end(conteudo);
  } catch {
    return enviar(res, 404, falha('Página não encontrada.'));
  }
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) await tratarApi(req, res, url);
    else await tratarArquivo(res, url.pathname);
  } catch {
    enviar(res, 500, falha('Erro interno do servidor.'));
  }
})
  .on('error', (erro) => {
    console.log(erro.code === 'EADDRINUSE' ? `❌ A porta ${PORTA} já está em uso. Feche o outro programa ou defina a variável PORT.` : `❌ ${erro.message}`);
  })
  .listen(PORTA, () => {
    console.log(`🛒 MercadoÁgil web rodando em http://localhost:${PORTA}  (Ctrl+C para parar)`);
    console.log(ia.configurado ? '✨ IA (Gemini) configurada.' : 'ℹ️  IA (Gemini) desligada: crie o .env com a GEMINI_API_KEY para ativar.');
  });
