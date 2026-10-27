// Interface web: só lê a resposta { ok, dados | erros } da API e desenha na tela.
const ABAS = ['Clientes', 'Vendedores', 'Produtos', 'Cupons', 'Pedidos', 'Relatórios'];
const estado = { aba: 'Pedidos', pedido: null, q: '', cfg: null };

const $ = (s) => document.querySelector(s);
const brl = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

async function api(metodo, url, corpo) {
  try {
    const r = await fetch(url, { method: metodo, headers: { 'Content-Type': 'application/json' }, body: corpo ? JSON.stringify(corpo) : undefined });
    return await r.json();
  } catch {
    return { ok: false, erros: ['Não consegui falar com o servidor. Ele está rodando (npm run web)?'] };
  }
}

let timer;
function aviso(msg, ok = true) {
  const el = $('#aviso');
  el.textContent = msg;
  el.className = ok ? 'ok' : 'erro';
  el.hidden = false;
  clearTimeout(timer);
  timer = setTimeout(() => (el.hidden = true), ok ? 2500 : 8000);
}

// ---------- pedaços de HTML ----------
const opcoes = (lista, valor = (x) => x, rotulo = (x) => x) => lista.map((x) => `<option value="${esc(valor(x))}">${esc(rotulo(x))}</option>`).join('');
const campo = (rot, nome, tipo = 'text', extra = '') => `<label>${rot}<input name="${nome}" type="${tipo}" ${extra}></label>`;
const select = (rot, nome, ops) => `<label>${rot}<select name="${nome}">${ops}</select></label>`;
const form = (url, ok, conteudo, enviar) => `<form data-u="${esc(url)}" data-ok="${esc(ok)}">${conteudo}<button>${enviar}</button></form>`;
const cartao = (titulo, corpo) => `<section class="cartao"><h2>${titulo}</h2>${corpo}</section>`;
const botao = (rot, metodo, url, ok, cls = '', confirma = '') =>
  `<button class="mini ${cls}" data-m="${metodo}" data-u="${esc(url)}" data-ok="${esc(ok)}" data-c="${esc(confirma)}">${rot}</button>`;
const tabela = (cab, linhas) =>
  linhas.length
    ? `<div class="rolar"><table><thead><tr>${cab.map((c) => `<th>${c}</th>`).join('')}</tr></thead><tbody>${linhas.map((l) => `<tr>${l.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`
    : '<p class="vazio">Nada por aqui ainda.</p>';
const barraBusca = (dica) =>
  `<form class="busca" data-busca><input name="q" value="${esc(estado.q)}" placeholder="${dica}"><button>Buscar</button>${estado.q ? '<button type="button" class="mini" data-limpar>Limpar</button>' : ''}</form>`;
const st = (s) => `<span class="st ${s}">${s}</span>`;

const listar = async (entidade) => {
  const r = await api('GET', `/api/${entidade}${estado.q ? `?q=${encodeURIComponent(estado.q)}` : ''}`);
  return r.ok ? [].concat(r.dados) : [];
};

// ---------- telas ----------
const telas = {
  async Clientes() {
    const lista = await listar('clientes');
    const novo = form('/api/clientes', 'Cliente cadastrado!', campo('Nome', 'nome') + campo('E-mail', 'email', 'email') + campo('CPF', 'cpf', 'text', 'placeholder="000.000.000-00"') + select('Região', 'regiao', opcoes(estado.cfg.regioes)), 'Cadastrar');
    const linhas = lista.map((c) => [c.id, esc(c.nome), esc(c.email), c.regiao, botao('Excluir', 'DELETE', `/api/clientes/${c.id}`, 'Cliente excluído', 'perigo', 'Excluir este cliente?')]);
    return cartao('Novo cliente', novo) + cartao('Clientes', barraBusca('CPF, id ou nome') + tabela(['ID', 'Nome', 'E-mail', 'Região', ''], linhas));
  },

  async Vendedores() {
    const lista = await listar('vendedores');
    const novo = form('/api/vendedores', 'Vendedor cadastrado!', campo('Nome da loja', 'nomeLoja') + campo('CNPJ', 'cnpj', 'text', 'placeholder="00.000.000/0000-00"') + campo('E-mail', 'email', 'email'), 'Cadastrar');
    const linhas = lista.map((v) => [v.id, esc(v.nomeLoja), esc(v.cnpj), esc(v.email), botao('Excluir', 'DELETE', `/api/vendedores/${v.id}`, 'Vendedor excluído', 'perigo', 'Excluir este vendedor?')]);
    return cartao('Novo vendedor', novo) + cartao('Vendedores', barraBusca('CNPJ, id ou nome da loja') + tabela(['ID', 'Loja', 'CNPJ', 'E-mail', ''], linhas));
  },

  async Produtos() {
    const [lista, vend] = await Promise.all([listar('produtos'), api('GET', '/api/vendedores')]);
    const novo = form(
      '/api/produtos',
      'Produto cadastrado!',
      select('Vendedor', 'vendedor', opcoes(vend.dados ?? [], (v) => v.id, (v) => v.nomeLoja)) + campo('Nome', 'nome') + campo('Preço (R$)', 'preco', 'text', 'placeholder="120,00"') + select('Categoria', 'categoria', opcoes(estado.cfg.categorias)) + campo('Estoque inicial', 'estoque', 'number', 'min="0" value="0"'),
      'Cadastrar',
    );
    const linhas = lista.map((p) => [
      p.id, esc(p.nome), brl(p.preco), p.categoria, esc(p.vendedor), p.estoque,
      `<form data-u="/api/produtos/${p.id}/estoque" data-ok="Estoque atualizado"><input name="quantidade" type="number" min="1" value="10"><button class="mini">Repor</button></form>`,
      `<button class="mini" data-ia="descricao" data-p="${p.id}">✨ Descrever</button>`,
      botao('Excluir', 'DELETE', `/api/produtos/${p.id}`, 'Produto excluído', 'perigo', 'Excluir este produto?'),
    ]);
    return cartao('Novo produto', novo) + cartao('Produtos e estoque', barraBusca('id ou nome') + tabela(['ID', 'Produto', 'Preço', 'Categoria', 'Loja', 'Estoque', 'Repor', 'IA', ''], linhas));
  },

  async Cupons() {
    const lista = await listar('cupons');
    const novo = form(
      '/api/cupons',
      'Cupom cadastrado!',
      campo('Código', 'codigo') + select('Tipo', 'tipo', opcoes(estado.cfg.tipos)) + campo('Valor (% ou R$; 0 no frete)', 'valor', 'text', 'value="0"') + campo('Validade', 'validade', 'date') + campo('Mínimo do pedido (R$)', 'valorMinimo', 'text', 'value="0"') + select('Cumulativo', 'cumulativo', '<option value="true">Sim</option><option value="false">Não (só sozinho)</option>'),
      'Cadastrar',
    );
    const valorTxt = (c) => (c.tipo === 'percentual' ? `${c.valor}%` : c.tipo === 'fixo' ? brl(c.valor) : 'frete grátis');
    const linhas = lista.map((c) => [esc(c.codigo), c.tipo, valorTxt(c), brl(c.valorMinimo), c.cumulativo ? 'sim' : 'não', new Date(c.validade).toLocaleDateString('pt-BR'), c.vencido ? 'VENCIDO' : 'válido', botao('Excluir', 'DELETE', `/api/cupons/${encodeURIComponent(c.codigo)}`, 'Cupom excluído', 'perigo', 'Excluir este cupom?')]);
    return cartao('Novo cupom', novo) + cartao('Cupons', barraBusca('código') + tabela(['Código', 'Tipo', 'Valor', 'Mínimo', 'Cumulativo', 'Validade', 'Situação', ''], linhas));
  },

  async Pedidos() {
    const [cli, lst, prod, cup] = await Promise.all([api('GET', '/api/clientes'), api('GET', '/api/pedidos'), api('GET', '/api/produtos'), api('GET', '/api/cupons')]);
    const detalhe = estado.pedido ? await api('GET', `/api/pedidos/${estado.pedido}`) : null;
    const novo = form('/api/pedidos', 'Pedido criado! Adicione itens.', select('Cliente', 'cliente', opcoes(cli.dados, (c) => c.id, (c) => `${c.nome} (${c.regiao})`)), 'Criar pedido');
    const linhas = lst.dados.map((p) => [p.id, esc(p.cliente), st(p.status), p.itens, brl(p.total), `<button class="mini" data-abrir="${p.id}">Abrir</button>`]);
    return (detalhe?.ok ? detalhePedido(detalhe.dados, prod.dados, cup.dados) : '') + cartao('Novo pedido', novo) + cartao('Pedidos', tabela(['Nº', 'Cliente', 'Status', 'Itens', 'Total', ''], linhas));
  },

  async Relatórios() {
    const r = await api('GET', '/api/relatorios');
    if (!r.ok) return cartao('Relatórios', esc(r.erros.join(' ')));
    const d = r.dados;
    const n = (rot, val) => `<div><b>${val}</b><span>${rot}</span></div>`;
    return (
      `<p class="nota">Somente pedidos confirmados. <button class="mini" data-ia="resumo">✨ Resumo com IA</button></p><div class="numeros">${n('Faturamento total', brl(d.faturamento)) + n('Pedidos confirmados', d.quantidadePedidos) + n('Ticket médio', brl(d.ticketMedio)) + n('Descontos concedidos', brl(d.totalDescontos)) + n('Tributos aprox.', brl(d.totalTributos)) + n('Comissão', brl(d.totalComissao))}</div>` +
      cartao('Valor dos itens por categoria (antes dos descontos)', tabela(['Categoria', 'Valor'], d.faturamentoPorCategoria.map((c) => [c.categoria, brl(c.valorItens)]))) +
      cartao('Repasse por vendedor', tabela(['Vendedor', 'Bruto', 'Comissão', 'A repassar'], d.repassePorVendedor.map((v) => [esc(v.nomeLoja), brl(v.bruto), brl(v.comissao), `<b>${brl(v.repasse)}</b>`]))) +
      cartao('Top 3 produtos mais vendidos', tabela(['#', 'Produto', 'Quantidade'], d.top3Produtos.map((p, i) => [i + 1, esc(p.nome), p.quantidade])))
    );
  },
};

function detalhePedido(p, produtos, cupons) {
  const aberto = p.status === 'aberto';
  const base = `/api/pedidos/${p.id}`;
  const acoesAdd = aberto
    ? `<div class="grade">${form(`${base}/itens`, 'Item adicionado', select('Produto', 'produto', opcoes(produtos, (x) => x.id, (x) => `${x.nome} — ${brl(x.preco)} (estoque ${x.estoque})`)) + campo('Qtd', 'quantidade', 'number', 'min="1" value="1"'), 'Adicionar item')}${form(`${base}/cupons`, 'Cupom aplicado', select('Cupom', 'codigo', opcoes(cupons.filter((c) => !c.vencido), (x) => x.codigo, (x) => x.codigo)), 'Aplicar cupom')}</div>`
    : '';
  const itens = tabela(
    ['Produto', 'Loja', 'Categoria', 'Qtd', 'Preço', 'Total', ''],
    p.itens.map((i) => [esc(i.nome), esc(i.nomeLoja), i.categoria, i.quantidade, brl(i.precoUnitario), brl(i.total), aberto ? botao('Remover', 'DELETE', `${base}/itens/${i.produtoId}`, 'Item removido') : '']),
  );
  const descontos = p.cupons
    .map((c) => `<dt>Cupom ${esc(c.codigo)} ${aberto ? botao('✕', 'DELETE', `${base}/cupons/${encodeURIComponent(c.codigo)}`, 'Cupom removido') : ''}</dt><dd>${c.tipo === 'frete' ? 'frete grátis' : `− ${brl(c.desconto)}${c.limitadoPeloTeto ? ' (limitado pelo teto de 30%)' : ''}`}</dd>`)
    .join('');
  const totais = `<dl class="totais"><dt>Subtotal</dt><dd>${brl(p.subtotal)}</dd>${descontos}<dt>Frete</dt><dd>${p.freteGratis ? `Grátis (${esc(p.motivoFreteGratis)})` : brl(p.frete)}</dd><dt class="total">Total</dt><dd class="total">${brl(p.total)}</dd></dl>`;
  const nota = `<p class="nota">Tributos aproximados (informativo): ${brl(p.tributos)} · Comissão do marketplace: ${brl(p.comissao)} · Descontos: ${brl(p.descontoTotal)} (teto ${brl(p.tetoDesconto)})</p>`;
  const repasses = tabela(['Vendedor', 'Bruto', 'Comissão', 'Repasse'], p.repasses.map((r) => [esc(r.nomeLoja), brl(r.bruto), brl(r.comissao), `<b>${brl(r.repasse)}</b>`]));
  const acoes = `<div class="acoes">${aberto ? botao('Confirmar pedido', 'POST', `${base}/confirmar`, 'Pedido confirmado! Estoque atualizado.') : ''}${p.status !== 'cancelado' ? botao('Cancelar pedido', 'POST', `${base}/cancelar`, 'Pedido cancelado.', 'perigo', 'Cancelar este pedido?') : ''}</div>`;
  return cartao(`Pedido #${p.id} · ${esc(p.cliente.nome)} (${p.cliente.regiao}) ${st(p.status)}`, acoesAdd + itens + totais + nota + repasses + acoes);
}

// ---------- núcleo ----------
async function consultarIA(tipo, produto) {
  const caixa = $('#ia-saida');
  caixa.hidden = false;
  caixa.innerHTML = '<p class="vazio">⏳ Consultando a IA...</p>';
  const r = tipo === 'descricao' ? await api('POST', '/api/ia/descricao', { produto }) : await api('POST', '/api/ia/resumo');
  const titulo = r.ok && r.dados.nome ? `✨ Descrição gerada: ${esc(r.dados.nome)}` : '✨ Resposta da IA';
  const texto = r.ok ? esc(r.dados.descricao ?? r.dados.resumo) : `❌ ${esc(r.erros.join(' '))}`;
  caixa.innerHTML = `<h2>${titulo} <button class="mini" onclick="this.closest('section').hidden = true">Fechar</button></h2><p style="white-space:pre-wrap">${texto}</p>${r.ok ? '<p class="nota">Texto gerado por IA (Gemini): revise antes de usar.</p>' : ''}`;
  caixa.scrollIntoView({ behavior: 'smooth' });
}

async function renderizar() {
  $('#abas').innerHTML = ABAS.map((a) => `<button class="${a === estado.aba ? 'ativa' : ''}" data-aba="${a}">${a}</button>`).join('');
  try {
    $('#tela').innerHTML = await telas[estado.aba]();
  } catch (erro) {
    $('#tela').innerHTML = `<p class="vazio">Não foi possível montar a tela: ${esc(erro.message)}</p>`;
  }
}

async function resultado(r, msgOk) {
  aviso(r.ok ? msgOk : r.erros.join('\n'), r.ok);
  if (r.ok) await renderizar();
}

document.addEventListener('click', async (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  const { aba, abrir, limpar, m, u, ok, c, ia, p } = b.dataset;
  if (aba) { estado.aba = aba; estado.q = ''; return renderizar(); }
  if (ia) return consultarIA(ia, p);
  if (abrir) { estado.pedido = Number(abrir); return renderizar(); }
  if (limpar !== undefined) { estado.q = ''; return renderizar(); }
  if (m) {
    if (c && !confirm(c)) return;
    await resultado(await api(m, u), ok);
  }
});

document.addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  if (f.dataset.busca !== undefined) { estado.q = f.q.value.trim(); return renderizar(); }
  const r = await api('POST', f.dataset.u, Object.fromEntries(new FormData(f)));
  if (r.ok && f.dataset.u === '/api/pedidos') estado.pedido = r.dados.id;
  await resultado(r, f.dataset.ok);
});

estado.cfg = (await api('GET', '/api/config')).dados;
await renderizar();
