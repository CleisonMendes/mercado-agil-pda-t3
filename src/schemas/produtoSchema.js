import { z } from 'zod';
import { CATEGORIAS } from '../config/regras.js';

const temNoMaximoDuasCasas = (n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6;

export const produtoSchema = z.object({
  nome: z.string({ message: 'O nome do produto é obrigatório.' }).trim().min(2, 'O nome do produto precisa ter pelo menos 2 letras.'),
  preco: z.coerce
    .number({ message: 'Preço inválido: informe um número, ex.: 120.50.' })
    .positive('O preço precisa ser maior que zero.')
    .refine(temNoMaximoDuasCasas, 'O preço deve ter no máximo 2 casas decimais.'),
  categoria: z.enum(CATEGORIAS, { message: `Categoria inválida. Use: ${CATEGORIAS.join(', ')}.` }),
  // Id, CNPJ ou nome do vendedor; a existência é verificada pelo Marketplace.
  vendedor: z.coerce.string().trim().min(1, 'Informe o vendedor que anuncia o produto (id, CNPJ ou nome da loja).'),
  estoque: z.coerce
    .number({ message: 'Estoque inválido: informe um número inteiro.' })
    .int('O estoque precisa ser um número inteiro.')
    .nonnegative('O estoque não pode ser negativo.')
    .default(0),
});
