import { createInterface } from 'node:readline/promises';

// Leitura do teclado. Usa o iterador assíncrono de linhas, que funciona tanto digitando
// quanto com entrada redirecionada (ex.: node index.js < comandos.txt).
const rl = createInterface({ input: process.stdin, output: process.stdout });
const linhas = rl[Symbol.asyncIterator]();

export class FimDaEntrada extends Error {}

export async function perguntar(texto) {
  rl.setPrompt(texto);
  rl.prompt();
  const { value, done } = await linhas.next();
  if (done) throw new FimDaEntrada();
  return value.trim();
}

export const fecharEntrada = () => rl.close();
