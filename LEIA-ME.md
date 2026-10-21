# Grupo WD — Gráfica Online

Site + app (instalável no celular e no computador) com catálogo, carrinho,
pedido pelo WhatsApp, login com Google e painel administrativo.

## Arquivos

| Arquivo | O que é |
|---|---|
| `index.html` | Loja (catálogo, carrinho, login do cliente, "Meus pedidos") |
| `admin.html` | Painel ADM — só entra **grupowdoficial@gmail.com** |
| `js/produtos.js` | Catálogo padrão e o **MULTIPLICADOR = 2.5** (preço final = revenda × 2,5) |
| `js/firebase-config.js` | Onde você cola a configuração do Firebase |
| `firestore.rules` | Regras de segurança do banco (quem pode ler/alterar o quê) |
| `manifest.webmanifest`, `sw.js` | Fazem o site virar app instalável |

## Ativar o login com Google (uma vez só)

Faça tudo logado como **grupowdoficial@gmail.com**:

1. Acesse https://console.firebase.google.com → **Adicionar projeto** → nome `grupo-wd`.
2. **Build → Authentication → Começar → Google → Ativar** → salve.
3. **Build → Firestore Database → Criar banco de dados** → local `southamerica-east1 (São Paulo)` → modo produção.
4. Na aba **Regras** do Firestore, apague tudo, cole o conteúdo de `firestore.rules` e clique **Publicar**.
5. **Configurações do projeto (engrenagem) → Seus apps → `</>` (Web)** → apelido `site` → registrar.
   Copie os valores do `firebaseConfig` para o arquivo `js/firebase-config.js`.
6. **Authentication → Configurações → Domínios autorizados**: adicione
   `wdgraficarapida.com.br` e `www.wdgraficarapida.com.br`. `localhost` já vem liberado.

## Publicar o site (Firebase Hosting, gratuito)

```bash
npm install -g firebase-tools
firebase login
firebase use --add
firebase deploy
```

O site fica em `https://SEU-PROJETO.web.app` e, depois do passo abaixo, em **https://wdgraficarapida.com.br**.

## Ligar o domínio wdgraficarapida.com.br

1. Console Firebase → **Hosting → Adicionar domínio personalizado** → `wdgraficarapida.com.br`.
   O Firebase mostra os registros DNS (um **TXT** de verificação e registros **A**).
2. No **Registro.br** (ou onde o domínio foi comprado) → **DNS → Editar zona** → crie exatamente os
   registros que o Firebase mostrou, para o domínio raiz (`@`).
3. Volte ao Firebase e clique **Verificar**. Repita o passo 1 para `www.wdgraficarapida.com.br`,
   marcando **Redirecionar para wdgraficarapida.com.br**.
4. A propagação do DNS e o certificado HTTPS levam de alguns minutos a 24 h.
5. Com o domínio já funcionando, deixe o login com a cara do seu domínio:
   - em `js/firebase-config.js`, troque `authDomain` para `"wdgraficarapida.com.br"`;
   - no **Google Cloud Console** (mesma conta) → **APIs e serviços → Credenciais → Cliente OAuth "Web client"**
     → **URIs de redirecionamento autorizados** → adicione `https://wdgraficarapida.com.br/__/auth/handler`;
   - rode `firebase deploy` de novo.

O site já está preparado para o domínio: link canônico, prévia ao compartilhar no WhatsApp/redes
(`og:*`), `robots.txt` (o painel ADM não aparece no Google) e `sitemap.xml`.

## Primeiro acesso ao painel

1. Abra `/admin.html` e entre com grupowdoficial@gmail.com.
2. Aba **Produtos → Importar catálogo padrão**. A partir daí, preços e produtos são editados pelo painel
   (você informa o preço de revenda; o site mostra × 2,5 automaticamente).

## Status dos pedidos

Recebido → Em produção → Pronto / enviado → Entregue (ou Cancelado).
O cliente acompanha em **Minha conta → Meus pedidos**.
