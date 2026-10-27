import { z } from 'zod';
import { TIPOS_CUPOM } from '../config/regras.js';

export const cupomSchema = z
  .object({
    codigo: z
      .string({ message: 'O código do cupom é obrigatório.' })
      .trim()
      .min(3, 'O código precisa ter pelo menos 3 letras.')
      .toUpperCase(),
    tipo: z.enum(TIPOS_CUPOM, { message: `Tipo inválido. Use: ${TIPOS_CUPOM.join(', ')}.` }),
    valor: z.coerce
      .number({ message: 'Valor inválido: informe um número (use 0 para cupom de frete).' })
      .nonnegative('O valor do cupom não pode ser negativo.'),
    validade: z.coerce
      .date({ message: 'Data de validade inválida.' })
      .refine((data) => data > new Date(), { message: 'A validade do cupom precisa ser uma data futura.' }),
    valorMinimo: z.coerce
      .number({ message: 'Valor mínimo inválido: informe um número.' })
      .nonnegative('O valor mínimo não pode ser negativo.')
      .default(0),
    cumulativo: z.boolean({ message: 'Informe se o cupom é cumulativo (true/false).' }).default(true),
  })
  .refine((c) => c.tipo !== 'percentual' || (c.valor > 0 && c.valor <= 100), {
    message: 'Cupom percentual precisa ter valor entre 1 e 100.',
    path: ['valor'],
  })
  .refine((c) => c.tipo !== 'fixo' || c.valor > 0, {
    message: 'Cupom de desconto fixo precisa ter valor maior que zero.',
    path: ['valor'],
  });
