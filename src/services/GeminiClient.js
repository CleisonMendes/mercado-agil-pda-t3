import { ErroNegocio } from '../utils/respostas.js';

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// Cliente mínimo da API do Gemini (REST, sem pacotes). A chave vem do .env, nunca do código.
export class GeminiClient {
  #chave;
  #modelo;
  #fetch;

  constructor({
    chave = process.env.GEMINI_API_KEY,
    modelo = process.env.GEMINI_MODEL || 'gemini-3.8-flash',
    fetchFn = (...args) => globalThis.fetch(...args),
  } = {}) {
    this.#chave = String(chave ?? '').trim();
    this.#modelo = modelo;
    this.#fetch = fetchFn;
  }

  get configurado() {
    return this.#chave !== '' && this.#chave !== 'cole_sua_chave_aqui';
  }

  get modelo() {
    return this.#modelo;
  }

  // Diagnóstico SEGURO: nunca devolve a chave, só o tamanho e o começo (para comparar com o AI Studio).
  get diagnostico() {
    return this.#chave ? `chave com ${this.#chave.length} caracteres, começando com "${this.#chave.slice(0, 3)}"` : 'sem chave';
  }

  async gerarTexto(prompt) {
    if (!this.configurado) {
      throw new ErroNegocio('IA não configurada: crie o arquivo .env com GEMINI_API_KEY=sua_chave (veja o .env.example) e reinicie o programa.');
    }
    let resposta;
    try {
      resposta = await this.#fetch(`${BASE}/${this.#modelo}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.#chave },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 8192 },
        }),
        signal: AbortSignal.timeout(30000),
      });
    } catch {
      throw new ErroNegocio('Não consegui falar com o Gemini. Verifique sua internet e tente de novo.');
    }

    const corpo = await resposta.json().catch(() => ({}));
    if (!resposta.ok) throw new ErroNegocio(this.#explicarErro(resposta.status, corpo));

    // O limite de saída inclui o "raciocínio" do modelo: se estourar, o texto vem pela metade. Nunca mostramos texto cortado.
    if (corpo.candidates?.[0]?.finishReason === 'MAX_TOKENS') {
      throw new ErroNegocio('A resposta da IA veio cortada (limite de tamanho). Clique de novo para gerar outra.');
    }

    const texto = (corpo.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('').trim();
    if (!texto) throw new ErroNegocio('O Gemini não devolveu texto (a resposta pode ter sido bloqueada). Tente de novo.');
    return texto;
  }

  #explicarErro(status, corpo) {
    const detalhe = corpo?.error?.message ?? '';
    if (/api key/i.test(detalhe) || status === 401 || status === 403) {
      return `Chave da API recusada pelo Gemini (erro ${status}). Motivo informado pelo Google: "${detalhe.slice(0, 250) || 'sem detalhe'}". Rode "npm run ia:teste" para diagnosticar.`;
    }
    if (status === 404) return `Modelo "${this.#modelo}" não encontrado. Defina outro em GEMINI_MODEL no .env.`;
    if (status === 429) return 'Limite do plano gratuito do Gemini atingido. Espere um pouco e tente de novo.';
    if (status >= 500) return 'O Gemini está instável no momento. Tente de novo em instantes.';
    return `O Gemini recusou o pedido (erro ${status}). ${detalhe}`.trim();
  }
}