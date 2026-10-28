// Formato de resposta do serviço: { ok: true, dados } ou { ok: false, erros: [...] }.

// Erro de regra de negócio: carrega uma ou mais mensagens para o usuário.
export class ErroNegocio extends Error {
  constructor(erros) {
    const lista = Array.isArray(erros) ? erros : [erros];
    super(lista.join('; '));
    this.name = 'ErroNegocio';
    this.erros = lista;
  }
}

export const sucesso = (dados) => ({ ok: true, dados });
export const falha = (erros) => ({ ok: false, erros: Array.isArray(erros) ? erros : [erros] });

// Executa uma função e SEMPRE devolve uma resposta, nunca deixa o programa quebrar.
export function executar(funcao) {
  try {
    return sucesso(funcao());
  } catch (erro) {
    if (erro instanceof ErroNegocio) return falha(erro.erros);
    return falha(`Erro inesperado: ${erro.message}`);
  }
}

// Valida com Zod usando safeParse. Devolve os dados limpos ou lança ErroNegocio em português.
export function validar(schema, dados) {
  const resultado = schema.safeParse(dados);
  if (resultado.success) return resultado.data;
  throw new ErroNegocio(
    resultado.error.issues.map((i) => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message)),
  );
}
