# 🛒 MercadoÁgil — Microsserviço de Pedidos

> Projeto Final do **Módulo 1 · Back-end com JavaScript e Node.js**
> Desenvolvido em SQUAD · Entrega: 28/10/2026

O **MercadoÁgil** é um marketplace em que vários vendedores anunciam produtos e vários clientes compram. Este repositório contém o **serviço de pedidos**: ele recebe o "quero comprar isso", confere o estoque, aplica cupons, calcula frete, tributos e comissão, e responde com o resultado. Também gera os relatórios financeiros e o repasse aos vendedores.

Feito em **JavaScript puro**, com **Node.js**, **ES Modules**, **Programação Orientada a Objetos** e validação com **Zod**. Tem um menu interativo no terminal e, como extra, uma interface web.

---

## 📑 Sumário

- [O problema que resolvemos](#-o-problema-que-resolvemos)
- [Como instalar e rodar](#-como-instalar-e-rodar)
- [Testando o exemplo do enunciado](#-testando-o-exemplo-do-enunciado)
- [Regras de negócio](#-regras-de-negócio)
- [Resposta do serviço](#-resposta-do-serviço)
- [Estrutura de pastas](#-estrutura-de-pastas)
- [Classes e responsabilidades](#-classes-e-responsabilidades)
- [Validação com Zod](#-validação-com-zod)
- [Relatórios](#-relatórios)
- [Testes automáticos](#-testes-automáticos)
- [Integração com IA (Gemini)](#-integração-com-ia-gemini)
- [Interface web (extra)](#-interface-web-extra)
- [Decisões do SQUAD](#-decisões-do-squad)
- [Quem fez o quê](#-quem-fez-o-quê)
- [Prints do terminal](#-prints-do-terminal)

---

## 🎯 O problema que resolvemos

A equipe do MercadoÁgil registrava os pedidos numa planilha, e os mesmos erros se repetiam toda semana. Cada problema virou uma regra do sistema:

| Problema na planilha | Como o sistema resolve |
|---|---|
| Cupons aplicados errados (somados quando não podia, vencido aceito) | Validade, valor mínimo, limite de 2 cupons, cumulatividade e teto de 30% são checados em código |
| Pedido confirmado sem estoque | Estoque **tudo ou nada**: se faltar qualquer item, nada é confirmado e todos os que faltam são listados |
| Frete calculado "no olho" | Frete por região + unidades, com regra de frete grátis |
| Repasse ao vendedor feito na mão | Comissão por categoria e repasse por vendedor calculados automaticamente |
| Ninguém sabe quanto o marketplace faturou | Relatórios financeiros com somente pedidos confirmados |
| CPF dos clientes aparecendo em qualquer tela | O CPF nunca sai nas respostas (LGPD) |

---

## ▶️ Como instalar e rodar

**Requisito:** [Node.js](https://nodejs.org) versão **20 ou superior** (confira com `node -v`).

```bash
# 1. Instale a dependência (Zod)
npm install

# 2. Rode o menu no terminal
npm start

# 3. (opcional) Rode a interface web em http://localhost:3000
npm run web

# 4. (opcional) Rode os testes automáticos
npm test
```

Ao iniciar, o sistema carrega os dados de exemplo de `src/data/seed.js`: **3 clientes, 3 vendedores, 8 produtos** (eletrônicos, livros, alimentos e casa) e **4 cupons** com validade futura. Tudo fica **em memória**: ao reiniciar, volta ao estado inicial.

---

## 🧪 Testando o exemplo do enunciado

Uma cliente do **Nordeste** compra 1 **Mouse** (eletrônicos, R$ 120,00, vendedor TechBahia) e 1 **Livro de JavaScript** (livros, R$ 80,00, vendedor Livraria Sol), usando os cupons `BEMVINDO10` e `PDA15`.

**No menu do terminal:** `5` Pedidos → `1` Criar pedido (cliente `1`, Ana Souza) → `2` Adicionar item (`Mouse`, 1) e (`Livro de JavaScript`, 1) → `4` Aplicar cupom (`BEMVINDO10`) e (`PDA15`) → `6` Ver resumo.

```
Subtotal                              R$ 200,00
(-) BEMVINDO10: 10% de R$ 200,00    - R$  20,00
(-) PDA15: desconto fixo            - R$  15,00
(+) Frete: R$ 25,00 + 2 x R$ 1,50   + R$  28,00
TOTAL                                 R$ 193,00

Desconto total: R$ 35,00 (dentro do teto de 30% = R$ 60,00)
Tributos aproximados: 12% x 120,00 + 0% x 80,00 = R$ 14,40

Repasse:
TechBahia     R$ 120,00 - comissão 8% (R$ 9,60)   = R$ 110,40
Livraria Sol  R$  80,00 - comissão 15% (R$ 12,00) = R$  68,00
Comissão total do marketplace: R$ 21,60
```

Esse exemplo também é um **teste automático** (`tests/marketplace.test.js`). Sempre que mexermos nas regras de cupom, frete ou comissão, rodamos `npm test`.

---

## 📐 Regras de negócio

Todas as constantes (frete, alíquotas, comissões, teto de desconto, limite de cupons) ficam em **`src/config/regras.js`**, um só lugar para alterar.

### Estoque: tudo ou nada
- Ao confirmar, o pedido verifica **todos os itens de uma vez**.
- Se faltar qualquer item, **nada é confirmado e nada sai do estoque**. A mensagem lista **todos** os itens que faltaram: `Estoque insuficiente: Mouse (pedido 3, disponível 1)`.
- Pedido confirmado dá baixa no estoque. Pedido confirmado e depois cancelado **devolve** os itens.
- **Status:** `aberto` → `confirmado` → `cancelado`. Itens e cupons só podem ser alterados enquanto o pedido está **aberto**.

### Cupons
O cupom é do marketplace e vale para o pedido inteiro.

| Tipo | O que faz | Exemplo |
|---|---|---|
| `percentual` | Tira uma porcentagem | `BEMVINDO10` → 10% |
| `fixo` | Tira um valor em reais | `PDA15` → R$ 15,00 |
| `frete` | Zera o frete | `FRETEZERO` |

Recusamos: cupom **vencido** (mesmo que fosse válido quando foi cadastrado), subtotal **abaixo do mínimo**, cupom **repetido**, **mais de 2** cupons e cupom **não cumulativo** combinado com outro (nos dois sentidos).

#### Ordem de aplicação dos descontos
1. **Percentuais** primeiro. Se houver mais de um, cada percentual incide sobre o valor que **restou** após os descontos anteriores.
2. **Fixos** depois.
3. **Frete** por último: zera o frete e não conta no teto, pois não reduz o valor dos itens.

**Teto:** a soma dos descontos **nunca passa de 30% do subtotal**, e o total nunca fica negativo. Quando o teto corta um desconto, o resumo avisa (`limitado pelo teto de 30%`).

### Frete dinâmico
`frete = taxa da região + R$ 1,50 × unidades do pedido` (um só por pedido, mesmo com vendedores diferentes).

| Região | Norte | Nordeste | Centro-Oeste | Sudeste | Sul |
|---|---|---|---|---|---|
| Taxa | R$ 35,00 | R$ 25,00 | R$ 30,00 | R$ 20,00 | R$ 22,00 |

**Frete grátis** quando o valor **já com os descontos** é de R$ 300,00 ou mais, ou quando o pedido usa um cupom do tipo frete.

### Tributos aproximados (Lei 12.741/2012)
Informativos: aparecem no resumo, mas **não somam no total**. Calculados sobre o valor dos itens, **antes dos descontos**.

| Categoria | eletronicos | livros | alimentos | vestuario | casa |
|---|---|---|---|---|---|
| Alíquota (fictícia) | 12% | 0% | 5% | 8% | 10% |

### Comissão e repasse
A comissão incide sobre o valor dos itens **antes dos descontos**. Cupom e frete são custo do marketplace e **não diminuem o repasse**.

| Categoria | eletronicos | livros | alimentos | vestuario | casa |
|---|---|---|---|---|---|
| Comissão (fictícia) | 8% | 15% | 10% | 12% | 10% |

`repasse do vendedor = soma dos itens dele − comissão desses itens`. Só pedidos **confirmados** geram repasse.

### Outras decisões de regra
- **Dinheiro em centavos inteiros** nos cálculos, convertido para reais só na resposta. Isso evita erros como `14.399999`.
- **Foto do pedido:** ao adicionar um item, o pedido guarda nome, categoria, vendedor e preço daquele momento. Ao confirmar, o cálculo é congelado.
- **Casos extremos tratados:** pedido vazio, cupom repetido, cancelar pedido já cancelado, excluir produto que está em pedido aberto, excluir vendedor que ainda tem produtos e excluir cliente com pedido aberto.

---

## 🧩 Resposta do serviço

Um microsserviço **sempre responde**, mesmo quando algo dá errado. Todo método público do `Marketplace` devolve um objeto em vez de quebrar o programa:

```js
// deu certo
{ ok: true, dados: { id: 7, total: 193 } }

// deu errado: explica o que aconteceu
{ ok: false, erros: ['Estoque insuficiente: Mouse (pedido 3, disponível 1)'] }
```

O menu (e a interface web) só **lê essa resposta e mostra na tela**. Quem decide é o serviço.

---

## 🗂️ Estrutura de pastas

```
mercadoagil/
├── index.js                  # ponto de entrada: carrega o seed e abre o menu
├── package.json              # "type": "module"
├── .gitignore                # ignora node_modules e .env
├── .env.example              # modelo do .env (sem chave de verdade)
├── README.md
├── src/
│   ├── models/               # uma classe por arquivo
│   │   ├── Cliente.js
│   │   ├── Vendedor.js
│   │   ├── Produto.js
│   │   ├── Estoque.js        # saldo privado (#): verifica, dá baixa e devolve
│   │   ├── CupomDesconto.js  # sabe dizer se é válido
│   │   └── Pedido.js         # orquestra itens, cupons, frete, tributos, comissão e status
│   ├── schemas/              # validação com Zod
│   │   ├── clienteSchema.js
│   │   ├── vendedorSchema.js
│   │   ├── produtoSchema.js
│   │   └── cupomSchema.js
│   ├── services/
│   │   ├── Marketplace.js    # classe principal: cadastros, pedidos e relatórios
│   │   ├── AssistenteIA.js   # extras com IA: descrição de produto e resumo do relatório
│   │   ├── GeminiClient.js   # chamada à API do Gemini e tratamento de erros
│   │   └── relatorios.js     # relatório financeiro (só pedidos confirmados)
│   ├── config/
│   │   ├── regras.js         # frete, alíquotas, comissões, teto de desconto
│   │   └── env.js            # lê o .env (GEMINI_API_KEY)
│   ├── utils/
│   │   ├── dinheiro.js       # centavos, reais e formatação em R$
│   │   ├── validadores.js    # CPF e CNPJ com dígitos verificadores
│   │   └── respostas.js      # { ok, dados } / { ok, erros } e ErroNegocio
│   ├── data/
│   │   └── seed.js           # dados de exemplo
│   ├── cli/                  # menu do terminal (só lê e mostra)
│   │   ├── menu.js
│   │   ├── entrada.js
│   │   └── formatadores.js
│   └── web/                  # interface web (extra)
│       ├── servidor.js
│       └── public/           # index.html, estilo.css, app.js
└── tests/
    ├── marketplace.test.js
    └── ia.test.js
```

---

## 🏛️ Classes e responsabilidades

| Classe | Responsabilidade |
|---|---|
| `Cliente` | Nome, e-mail, CPF e região de entrega |
| `Vendedor` | Nome da loja, CNPJ e e-mail; dono dos produtos que anuncia |
| `Produto` | Id, nome, preço, categoria e o vendedor que o anuncia |
| `Estoque` | Guarda a quantidade de cada produto (saldo privado). Verifica, dá baixa e devolve |
| `CupomDesconto` | Código, tipo, valor, validade, valor mínimo e se é cumulativo. Sabe dizer se é válido |
| `Pedido` | Orquestra as regras: itens, cupons, frete, tributos, total, comissão e status. O status e o estoque só mudam por métodos (`confirmar()`, `cancelar()`) |
| `Marketplace` | Classe principal: guarda as listas, faz cadastros, cria pedidos e gera relatórios. O menu só conversa com ela |

**Manipulação de dados:** as listas são processadas com `map`, `filter`, `find`, `findIndex` e `reduce` (sem `for`/`while` para dados; o único `while` é o laço que mantém o menu aberto). Usamos **spread** para criar listas e objetos novos sem alterar o original, **desestruturação** para ler dados e **rest** para tirar o CPF antes de devolver o cliente:

```js
const semCpf = ({ cpf, ...seguro }) => seguro;
```

---

## ✅ Validação com Zod

Há schemas para **Cliente**, **Vendedor**, **Produto** e **CupomDesconto**, todos com `safeParse`. Um dado inválido devolve `{ ok: false, erros }` e **nunca derruba o programa**.

Alguns `.refine()` usados:
- **CPF** com dígitos verificadores;
- **CNPJ** com dígitos verificadores;
- **validade do cupom** precisa ser uma data futura;
- preço com no máximo 2 casas decimais;
- regras por tipo de cupom (percentual entre 1 e 100, fixo maior que zero).

Também recusamos produto de vendedor que não existe e valores como `abc` em preço ou quantidade. As mensagens são em português e específicas para cada campo.

---

## 📊 Relatórios

Consideram **somente pedidos confirmados**:

- faturamento total e quantidade de pedidos;
- ticket médio;
- valor dos itens por categoria (antes dos descontos);
- repasse por vendedor (bruto, comissão e valor a repassar);
- top 3 produtos mais vendidos (por quantidade);
- totais de descontos concedidos, tributos e comissão.

---

## 🧪 Testes automáticos

```bash
npm test
```

São **39 testes** (com `node:test`, sem dependências extras) que cobrem: o exemplo completo do enunciado, estoque tudo ou nada, cada regra de cupom (inclusive vencido e teto de 30%), frete por região e frete grátis, validação com Zod, proteção do CPF, exclusões bloqueadas, relatórios e entradas absurdas.

---

## ✨ Integração com IA (Gemini)

Duas funcionalidades extras usam a API gratuita do **Google Gemini** (via REST, sem pacotes novos):

1. **Descrição de produto:** gera um texto de venda curto a partir do nome, da categoria e da loja.
2. **Resumo do relatório:** explica o relatório financeiro em até 5 frases, só com os números reais.

Ficam no menu **Produtos → Gerar descrição com IA** e **Resumo do relatório com IA** (e nos botões ✨ da interface web).

### Como ativar
1. Crie uma chave grátis em <https://aistudio.google.com/apikey>.
2. Copie `.env.example` para **`.env`** (na raiz do projeto) e cole a chave:
   ```
   GEMINI_API_KEY=sua_chave_aqui
   ```
3. Reinicie (`npm start` ou `npm run web`). A mensagem `✨ IA (Gemini) configurada.` aparece na abertura.

Opcional: `GEMINI_MODEL` troca o modelo (padrão `gemini-3.8-flash`). O plano gratuito tem **limite de uso**; se estourar, o sistema avisa em português e o resto continua funcionando. Sem chave, a IA só fica desligada.

### Se a IA der erro
Rode **`npm run ia:teste`**: ele mostra se o `.env` foi encontrado, o tamanho e o começo da chave (nunca ela inteira) e o **motivo real** devolvido pelo Google. Causas comuns:

- **Chave copiada incompleta, com aspas ou espaço de sobra.** As chaves novas do AI Studio começam com `AQ.` (isso é normal e funciona), mas são longas: compare o tamanho mostrado com o da chave no AI Studio.
- **`.env` na pasta errada ou com nome errado** (`.env.txt`). Ele precisa ficar ao lado do `package.json`.
- **Variável do sistema com outra chave.** Ela vence a do `.env` (o sistema avisa na abertura).
- **Chave revogada.** O Google desativa chaves vazadas (por exemplo, publicadas no GitHub ou coladas em chats). Crie outra no AI Studio.

> 🔒 **A chave fica só no `.env`**, que está no `.gitignore`. **Nunca** coloque a chave no código nem suba o `.env` para o GitHub. Para o professor rodar, o `.env.example` mostra o formato.
>
> 🔒 **Privacidade:** ao Gemini vão apenas nome, categoria e loja do produto e números agregados do relatório. **Nunca CPF, e-mail ou dados de clientes.** No plano gratuito, o Google pode usar o conteúdo enviado para melhorar seus produtos (confira os termos), outro motivo para enviarmos só o necessário.

A lógica fica em `src/services/GeminiClient.js` (chamada HTTP e tratamento de erros) e `src/services/AssistenteIA.js` (monta os pedidos e responde `{ ok, dados | erros }`). Os testes (`tests/ia.test.js`) usam um Gemini falso, então rodam sem internet e sem chave.

## 🌐 Interface web (extra)

Além do terminal, há uma interface em **HTML + CSS + JavaScript**, servida por um servidor feito só com `node:http` (sem frameworks):

```bash
npm run web      # http://localhost:3000
```

Ela usa **os mesmos métodos do `Marketplace`** do menu, sem duplicar nenhuma regra. Tem as abas Clientes, Vendedores, Produtos, Cupons, Pedidos e Relatórios. Para mudar a porta, defina a variável de ambiente `PORT`.

---

## 💡 Decisões do SQUAD

1. **Dinheiro em centavos inteiros** em todo o cálculo, para evitar erros de ponto flutuante.
2. **Percentuais em sequência:** se houver dois cupons percentuais, o segundo incide sobre o valor que restou do primeiro (o enunciado não definia esse caso).
3. **Cupom de frete fora do teto de 30%:** ele não reduz o valor dos itens, apenas zera o frete.
4. **Erros de regra viram mensagens**, não exceções soltas: as classes lançam `ErroNegocio` e o `Marketplace` converte tudo em `{ ok, erros }`.
5. **Menu "burro":** não tem regra de negócio; só lê o teclado e mostra a resposta. Por isso foi simples criar a interface web depois.
6. **Regras num só lugar** (`src/config/regras.js`), para mudar alíquotas, comissões ou frete sem tocar nas classes.

---

## 👥 Quem fez o quê

> Preencham com os nomes e os links do GitHub do SQUAD.

| Integrante | GitHub | Responsabilidade |
|---|---|---|
| _Nome 1_ | [@usuario](https://github.com/usuario) | _ex.: `Pedido.js` e regras de cupom e frete_ |
| _Nome 2_ | [@usuario](https://github.com/usuario) | _ex.: `Marketplace.js` e relatórios_ |
| _Nome 3_ | [@usuario](https://github.com/usuario) | _ex.: schemas Zod e validadores de CPF/CNPJ_ |
| _Nome 4_ | [@usuario](https://github.com/usuario) | _ex.: menu CLI, seed e README_ |

---

## 📸 Prints do terminal

> Adicionem aqui as capturas de tela do sistema funcionando. Sugestão: salvar as imagens na pasta `docs/` e referenciar assim: `![Resumo do pedido](docs/resumo-pedido.png)`.

- Menu principal
- Resumo do pedido de exemplo (total de R$ 193,00)
- Erro de estoque insuficiente listando todos os itens
- Relatório financeiro
