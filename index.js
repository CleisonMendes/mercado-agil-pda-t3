import { carregarEnv } from './src/config/env.js';
import { iniciarMenu } from './src/cli/menu.js';
import { carregarSeed } from './src/data/seed.js';
import { AssistenteIA } from './src/services/AssistenteIA.js';
import { Marketplace } from './src/services/Marketplace.js';

const env = carregarEnv(); // lê a GEMINI_API_KEY do arquivo .env (se existir)

const marketplace = new Marketplace();
const carregados = carregarSeed(marketplace);
const assistente = new AssistenteIA(marketplace);

console.log('🛒 MercadoÁgil — serviço de pedidos');
console.log(
  `Dados de exemplo carregados: ${carregados.clientes} clientes, ${carregados.vendedores} vendedores, ` +
    `${carregados.produtos} produtos e ${carregados.cupons} cupons.`,
);
console.log(assistente.configurado ? '✨ IA (Gemini) configurada.' : 'ℹ️  IA (Gemini) desligada: crie o .env com a GEMINI_API_KEY para ativar.');
if (env.ignoradas.includes('GEMINI_API_KEY')) {
  console.log('⚠️  A GEMINI_API_KEY já existe nas variáveis do sistema e está valendo no lugar da do .env. Rode "npm run ia:teste".');
}

await iniciarMenu(marketplace, assistente);
