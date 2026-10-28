// Validação de CPF e CNPJ com dígitos verificadores.

export const apenasDigitos = (texto) => String(texto ?? '').replace(/\D/g, '');

export const normalizar = (texto) =>
  String(texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

const calcularDigitoCPF = (base, pesoInicial) => {
  const soma = base.split('').reduce((acc, d, i) => acc + Number(d) * (pesoInicial - i), 0);
  const resto = (soma * 10) % 11;
  return resto === 10 ? 0 : resto;
};

export function validarCPF(valor) {
  const cpf = apenasDigitos(valor);
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
  return (
    calcularDigitoCPF(cpf.slice(0, 9), 10) === Number(cpf[9]) &&
    calcularDigitoCPF(cpf.slice(0, 10), 11) === Number(cpf[10])
  );
}

const PESOS_CNPJ_1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const PESOS_CNPJ_2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

const calcularDigitoCNPJ = (base, pesos) => {
  const soma = base.split('').reduce((acc, d, i) => acc + Number(d) * pesos[i], 0);
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
};

export function validarCNPJ(valor) {
  const cnpj = apenasDigitos(valor);
  if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false;
  return (
    calcularDigitoCNPJ(cnpj.slice(0, 12), PESOS_CNPJ_1) === Number(cnpj[12]) &&
    calcularDigitoCNPJ(cnpj.slice(0, 13), PESOS_CNPJ_2) === Number(cnpj[13])
  );
}
