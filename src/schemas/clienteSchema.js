import { z } from 'zod';
import { REGIOES } from '../config/regras.js';
import { apenasDigitos, validarCPF } from '../utils/validadores.js';

export const clienteSchema = z.object({
  nome: z.string({ message: 'O nome é obrigatório.' }).trim().min(2, 'O nome precisa ter pelo menos 2 letras.'),
  email: z.string({ message: 'O e-mail é obrigatório.' }).trim().email('E-mail em formato inválido.'),
  cpf: z
    .string({ message: 'O CPF é obrigatório.' })
    .transform(apenasDigitos)
    .refine(validarCPF, 'CPF inválido: informe 11 númeos com dígitos verificadores corretos.'),
  regiao: z.enum(REGIOES, { message: `Região inválida. Use: ${REGIOES.join(', ')}.` }),
  
});
