import { existsSync, readFileSync } from 'node:fs';

// Lê o arquivo .env (CHAVE=valor) e coloca em process.env, sem depender de pacote ou da versão do Node.
// Variáveis que já existem no sistema têm prioridade sobre o arquivo.
// Devolve { arquivoEncontrado, ignoradas }: "ignoradas" lista variáveis do .env que o sistema já definia (e que vencem).
export function carregarEnv(caminho = '.env') {
  const resultado = { arquivoEncontrado: existsSync(caminho), ignoradas: [] };
  if (!resultado.arquivoEncontrado) return resultado;
  readFileSync(caminho, 'utf8')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((linha) => linha.trim())
    .filter((linha) => linha && !linha.startsWith('#') && linha.includes('='))
    .forEach((linha) => {
      const i = linha.indexOf('=');
      const chave = linha.slice(0, i).trim();
      const valor = linha.slice(i + 1).trim().replace(/^["']|["']$/g, '');
      if (!(chave in process.env)) process.env[chave] = valor;
      else if (process.env[chave] !== valor) resultado.ignoradas = [...resultado.ignoradas, chave];
    });
  return resultado;
}
