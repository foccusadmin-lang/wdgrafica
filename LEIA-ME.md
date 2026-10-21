# Grupo WD — Gráfica Online

Site + app (instalável no celular e no computador) com catálogo, carrinho,
pedido pelo WhatsApp, login com Google e painel administrativo.

- **Site no ar:** https://wd-grafica-rapida.web.app (e https://wdgraficarapida.com.br quando o DNS estiver ok)
- **Painel ADM:** `/admin.html` — só entra **grupowdoficial@gmail.com**
- **Projeto Firebase:** `wd-grafica-rapida` (console: https://console.firebase.google.com/project/wd-grafica-rapida)

## Arquivos

| Arquivo | O que é |
|---|---|
| `index.html` | Loja (catálogo, carrinho, login do cliente, "Meus pedidos") |
| `admin.html` | Painel ADM (pedidos, produtos, clientes) |
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
npx firebase-tools deploy
```

## Primeiro acesso ao painel

Abra `/admin.html`, entre com grupowdoficial@gmail.com. Os produtos já estão no banco: edite o
preço de revenda e o site mostra × 2,5 automaticamente.

## Status dos pedidos

Recebido → Em produção → Pronto / enviado → Entregue (ou Cancelado).
O cliente acompanha em **Minha conta → Meus pedidos**.
