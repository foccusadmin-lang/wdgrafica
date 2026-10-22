# Grupo WD — Gráfica Online

Site + app (instalável no celular e no computador) com catálogo, carrinho,
pedido pelo WhatsApp, login com Google e painel administrativo.

- **Site no ar:** https://wd-grafica-rapida.web.app (e https://wdgraficarapida.com.br quando o DNS estiver ok)
- **Painel ADM:** `/admin.html` — acessam **wdgraficarapidacv@gmail.com** e **grupowdoficial@gmail.com**
- **Projeto Firebase:** `wd-grafica-rapida` (console: https://console.firebase.google.com/project/wd-grafica-rapida)

## Arquivos

| Arquivo | O que é |
|---|---|
| `index.html` | Loja (catálogo, carrinho, login do cliente, "Meus pedidos") |
| `admin.html` | Painel ADM (pedidos, clientes, produtos, configurações) |
| `js/precos.js` | Regras de preço (site, painel e servidor) |
| `functions/` | Servidor de pagamento (Mercado Pago) |
| `storage.rules` | Segurança dos arquivos de arte |
| `js/produtos.js` | Catálogo padrão e o **MULTIPLICADOR = 2.5** (preço final = revenda × 2,5) |
| `js/firebase-config.js` | Configuração do app web do Firebase (valores públicos) |
| `js/wd-firebase.js` | Login Google e acesso ao banco |
| `firestore.rules` | Segurança do banco (quem pode ler/alterar o quê) |
| `firebase.json` | Hospedagem, cabeçalhos de segurança, regras e login Google |
| `manifest.webmanifest`, `sw.js` | Fazem o site virar app instalável |

## O que já está configurado no Firebase

- **Banco Firestore** em São Paulo (`southamerica-east1`), plano gratuito, com proteção contra exclusão.
- **Coleções:** `produtos` (29 itens importados), `pedidos`, `clientes`.
- **Login com Google** ativado. Domínios autorizados: `localhost`, `wd-grafica-rapida.web.app`,
  `wd-grafica-rapida.firebaseapp.com`, `wdgraficarapida.com.br`, `www.wdgraficarapida.com.br`, `foccusadmin-lang.github.io`.
- **Regras de segurança** (testadas com 24 casos no simulador oficial):
  - catálogo: todos leem; só o ADM altera, com campos e preço validados;
  - pedidos: cliente logado cria só em nome próprio, sempre com status "novo", e vê só os seus;
    só o ADM vê todos e muda **apenas o status**;
  - clientes: cada um grava só o próprio cadastro (sem poder se dar permissões); o ADM vê todos;
  - qualquer outra coleção é bloqueada.
- **Conferência de preços:** o painel avisa quando o valor de um pedido não bate com o catálogo.
- **Hospedagem** com HTTPS, cabeçalhos de segurança e painel ADM fora do Google.

## Domínio wdgraficarapida.com.br (Registro.br → DNS → Editar zona)

| Tipo | Nome | Valor |
|---|---|---|
| A | *(vazio)* | 199.36.158.100 |
| TXT | *(vazio)* | hosting-site=wd-grafica-rapida |
| CNAME | www | wd-grafica-rapida.web.app |

Apague antes os registros antigos que apontam para o Google (`A` 142.251.x.x e `CNAME www → ghs.googlehosted.com`).
O HTTPS é emitido sozinho pelo Firebase depois que o DNS propagar (alguns minutos a 24 h).

## Catálogo e preços

O catálogo (`data/catalogo.json`) traz cada produto com todas as combinações (material, formato, cor,
cobertura, acabamento), a tabela de quantidades e os acabamentos extras. O site mostra sempre
**preço de referência × 2,5** (`mult` no catálogo). Para atualizar os preços:

```bash
cd ferramentas
npm install cheerio
node coletar.js cartao-de-visita adesivo folders-e-panfletos
node montar-catalogo.js
```

Para começar do zero, apague `ferramentas/coleta.json` antes. Produtos novos precisam de uma foto
em `img/fam/<produto>.webp` (sem a marca de terceiros).

## Publicar alterações

```bash
npx firebase-tools deploy --only hosting,firestore
```

(Depois de ativar o pagamento online, use `npx firebase-tools deploy`.)

## Painel administrativo

- **Pedidos:** do mais recente para o mais antigo, com produtos, quantidades, valores, forma de pagamento,
  arte enviada e a ficha do cliente (CPF/CNPJ, RG, telefone, endereço). Botões de WhatsApp e ligação.
  Status: Aguardando pagamento → Arte em análise → Em produção → Pronto para envio/retirada → Finalizado (ou Cancelado).
  Em pedidos "combinar pelo WhatsApp", você marca o pagamento como pago manualmente.
- **Clientes:** busca por nome, CPF, CNPJ, telefone ou e-mail; histórico de compras de cada cliente.
- **Produtos:** criar, editar (nome, descrição, foto, categorias, combinações, quantidades e preços),
  promoção com % e data de validade, reajuste em lote, ocultar, excluir e restaurar o original do catálogo.
- **Configurações:** multiplicador dos preços do catálogo (padrão 2,5).

## Compra no site

1. Cliente entra com Google.
2. Preenche o cadastro (PF ou PJ, CPF/CNPJ validado, RG, telefone e endereço — o CEP preenche o endereço).
3. Escolhe a forma de pagamento: **PIX**, **cartão de crédito/débito** (quando ativados) ou **combinar pelo WhatsApp**.

As regras de preço ficam em `js/precos.js` e são as mesmas no site, no painel e no servidor de pagamento:
o servidor recalcula tudo antes de cobrar, então ninguém consegue pagar menos alterando o navegador.

## Ativar PIX, cartão e envio de arte (Mercado Pago)

O pagamento online precisa de um pequeno servidor (Firebase Functions) e do Storage para os arquivos de arte.
Os dois exigem o plano **Blaze** do Firebase (paga só o que usar; para uma loja deste porte costuma ficar
dentro da cota gratuita ou em poucos reais por mês).

1. **Plano Blaze:** https://console.firebase.google.com/project/wd-grafica-rapida/usage/details → *Modificar plano*.
2. **Storage:** Console → *Storage* → *Começar* → região `southamerica-east1`.
3. **Mercado Pago:** https://www.mercadopago.com.br/developers/panel/app → *Criar aplicação* (pagamentos online,
   checkout transparente). Em *Credenciais de produção* copie a **Public Key** e o **Access Token**.
4. **Guardar o Access Token como segredo** (ele nunca vai para o site). No terminal, na pasta do projeto:
   ```bash
   npx firebase-tools functions:secrets:set MP_ACCESS_TOKEN
   ```
5. **Webhook:** no painel do Mercado Pago → sua aplicação → *Webhooks* → *Configurar notificações*:
   URL `https://southamerica-east1-wd-grafica-rapida.cloudfunctions.net/mpWebhook`, evento **Pagamentos**.
   Copie a **assinatura secreta** e grave:
   ```bash
   npx firebase-tools functions:secrets:set MP_WEBHOOK_SECRET
   ```
6. Em `js/firebase-config.js`: `PAGAMENTO_ONLINE = true`, `MP_PUBLIC_KEY = "sua Public Key"` e `UPLOAD_ARTE = true`.
7. Publicar tudo:
   ```bash
   npx firebase-tools deploy
   ```
