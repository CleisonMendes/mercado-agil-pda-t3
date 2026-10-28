import { ErroNegocio, falha, sucesso } from '../utils/respostas.js';
import { normalizar } from '../utils/validadores.js';
import { GeminiClient } from './GeminiClient.js';

const emCentavos = (reais) => Math.round(reais * 100);
const emReais = (centavos) => centavos / 100;

// Valores "reais" do relatório, calculados AQUI (em centavos) e não pela IA, para não haver erro de conta:
//   valor sem deduções  = soma dos itens vendidos, antes de qualquer desconto
//   dedução real        = descontos de cupons concedidos (é o único valor realmente abatido)
//   frete cobrado       = o que sobra entre o faturamento e (itens - descontos)
//   faturamento real    = o que os clientes efetivamente pagaram (itens - descontos + frete)
// Tributos são só informativos (não são deduzidos nem somados) e a comissão é a parte do marketplace nos itens.
export function calcularValoresReais(relatorio) {
  const semDeducoes = relatorio.faturamentoPorCategoria.reduce((soma, c) => soma + emCentavos(c.valorItens), 0);
  const deducoes = emCentavos(relatorio.totalDescontos);
  const faturamento = emCentavos(relatorio.faturamento);
  const comissao = emCentavos(relatorio.totalComissao);
  return {
    valorSemDeducoes: emReais(semDeducoes),
    deducoesDescontos: emReais(deducoes),
    valorAposDeducoes: emReais(semDeducoes - deducoes),
    freteCobrado: emReais(faturamento - (semDeducoes - deducoes)),
    faturamentoReal: emReais(faturamento),
    comissaoMarketplace: emReais(comissao),
    repasseTotalVendedores: emReais(semDeducoes - comissao),
    tributosInformativosNaoDeduzidos: relatorio.totalTributos,
  };
}

// Destaques calculados pelo código (e não deduzidos pela IA), com aviso de EMPATE.
// As listas do relatório já vêm ordenadas do maior para o menor.
export function calcularDestaques(relatorio) {
  const [cat, cat2] = relatorio.faturamentoPorCategoria;
  const [prod, prod2] = relatorio.top3Produtos;
  const [loja, loja2] = relatorio.repassePorVendedor;
  return {
    categoriaMaiorValor: cat && { categoria: cat.categoria, valorItens: cat.valorItens, empate: cat2?.valorItens === cat.valorItens },
    produtoMaisVendido: prod && { nome: prod.nome, quantidade: prod.quantidade, empate: prod2?.quantidade === prod.quantidade },
    lojaMaiorRepasse: loja && { nomeLoja: loja.nomeLoja, repasse: loja.repasse, empate: loja2?.repasse === loja.repasse },
  };
}

// Funcionalidades extras com IA. Usa só os métodos públicos do Marketplace e responde { ok, dados | erros }.
// Privacidade: só enviamos ao Gemini nome/categoria/loja do produto e números agregados do relatório,
// nunca CPF, e-mail ou outros dados pessoais de clientes.
export class AssistenteIA {
  #marketplace;
  #gemini;

  constructor(marketplace, gemini = new GeminiClient()) {
    this.#marketplace = marketplace;
    this.#gemini = gemini;
  }

  get configurado() {
    return this.#gemini.configurado;
  }

  async #responder(funcao) {
    try {
      return sucesso(await funcao());
    } catch (erro) {
      return erro instanceof ErroNegocio ? falha(erro.erros) : falha(`Erro inesperado na IA: ${erro.message}`);
    }
  }

  // Gera a descrição de venda de um produto (busca por id ou nome).
  descreverProduto(chave) {
    return this.#responder(async () => {
      const busca = this.#marketplace.buscarProdutos(chave);
      if (!busca.ok) throw new ErroNegocio(busca.erros);

      const t = normalizar(chave);
      const exato = busca.dados.find((p) => String(p.id) === t || normalizar(p.nome) === t);
      if (!exato && busca.dados.length > 1) {
        throw new ErroNegocio('Mais de um produto encontrado. Informe o id ou o nome completo.');
      }
      const produto = exato ?? busca.dados[0];

      const descricao = await this.#gemini.gerarTexto(
        'Escreva, em português do Brasil, uma descrição de venda curta (2 a 3 frases, até 60 palavras) ' +
          'para anunciar este produto em um marketplace.\n' +
          `Produto: ${produto.nome}\nCategoria: ${produto.categoria}\nLoja: ${produto.vendedor}\n` +
          'Não invente especificações técnicas, medidas, marcas, garantias nem preços. ' +
          'Responda apenas com o texto da descrição, sem markdown e sem aspas.',
      );
      return { produtoId: produto.id, nome: produto.nome, descricao };
    });
  }

  // Resume o relatório financeiro em linguagem natural, com o valor sem deduções e o valor realmente deduzido.
  resumirRelatorio() {
    return this.#responder(async () => {
      const relatorio = this.#marketplace.gerarRelatorios();
      if (!relatorio.ok) throw new ErroNegocio(relatorio.erros);
      if (relatorio.dados.quantidadePedidos === 0) {
        throw new ErroNegocio('Ainda não há pedidos confirmados para resumir. Confirme um pedido primeiro.');
      }

      const valoresReais = calcularValoresReais(relatorio.dados);
      const destaques = calcularDestaques(relatorio.dados);

      const resumo = await this.#gemini.gerarTexto(
        'Você é analista financeiro de um marketplace. Resuma o relatório abaixo em português do Brasil, ' +
          'em no máximo 6 frases, para o dono do negócio. Use SOMENTE os números fornecidos, sem inventar valores, ' +
          'sem refazer contas e sem projeções. Valores em reais (R$ 1.234,50).\n' +
          'Seja explícito nestes três pontos, nesta ordem:\n' +
          '1) o VALOR SEM DEDUÇÕES (valorSemDeducoes): total dos itens vendidos antes de qualquer desconto;\n' +
          '2) o VALOR REAL DEDUZIDO (deducoesDescontos): somente os descontos de cupons concedidos;\n' +
          '3) o FATURAMENTO REAL (faturamentoReal): o que os clientes de fato pagaram, já com descontos e com o frete cobrado.\n' +
          'Depois cite os DESTAQUES (categoria de maior valor, produto mais vendido e loja com maior repasse) usando exatamente os dados de "DESTAQUES", ' +
          'sempre com o valor ou a quantidade correspondente. Quando "empate" for true, diga que houve empate em vez de apontar um vencedor único. ' +
          'Termine a última frase por completo. ' +
          'IMPORTANTE: os tributos (tributosInformativosNaoDeduzidos) são apenas um valor aproximado informativo: ' +
          'NÃO são deduzidos nem somados ao faturamento, e a comissão não é um desconto ao cliente. ' +
          'Não chame tributos de "dedução". Responda só com o texto, sem markdown.\n\n' +
          `VALORES REAIS (já calculados, em reais):\n${JSON.stringify(valoresReais)}\n\n` +
          `DESTAQUES (já calculados):\n${JSON.stringify(destaques)}\n\n` +
          `RELATÓRIO COMPLETO (valores em reais):\n${JSON.stringify(relatorio.dados)}`,
      );
      return { resumo, valores: valoresReais, destaques };
    });
  }
}