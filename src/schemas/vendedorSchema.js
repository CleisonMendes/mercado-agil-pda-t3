import { z } from 'zod';
import { apenasDigitos, validarCNPJ } from '../utils/validadores.js';

export const vendedorSchema = z.object({
  nomeLoja: z
    .string({ message: 'O nome da loja é obrigatório.' })
    .trim()
    .min(2, 'O nome da loja precisa ter pelo menos 2 letras.'),
  cnpj: z
    .string({ message: 'O CNPJ é obrigatório.' })
    .transform(apenasDigitos)
    .refine(validarCNPJ, 'CNPJ inválido: informe 14 números com dígitos verificadores corretos.'),
  email: z.string({ message: 'O e-mail é obrigatório.' }).trim().email('E-mail em formato inválido.'),
});
