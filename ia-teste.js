// Diagnóstico da IA: npm run ia:teste
// Nunca imprime a chave inteira: só o tamanho e o começo, para comparar com o AI Studio.
import { carregarEnv } from './src/config/env.js';
import { GeminiClient } from './src/services/GeminiClient.js';

const env = carregarEnv();
const gemini = new GeminiClient();

console.log('--- Diagnóstico da IA (Gemini) ---');
console.log(`Arquivo .env encontrado nesta pasta: ${env.arquivoEncontrado ? 'sim' : 'NÃO (ele precisa estar na mesma pasta do package.json)'}`);
if (env.ignoradas.includes('GEMINI_API_KEY')) {
  console.log('⚠️  A GEMINI_API_KEY do sistema é DIFERENTE da do .env e está valendo no lugar dela.');
}
console.log(`Chave carregada: ${gemini.diagnostico}`);
console.log(`Modelo: ${gemini.modelo}`);

try {
  console.log('Chamando o Gemini...');
  console.log(`✅ Funcionou! Resposta: ${await gemini.gerarTexto('Responda apenas: tudo certo.')}`);
} catch (erro) {
  console.log(`❌ ${erro.message}`);
}
