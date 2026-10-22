// Configuração do projeto Firebase "wd-grafica-rapida".
// Esses valores são públicos por natureza; a segurança fica nas regras (firestore.rules / storage.rules).
export const firebaseConfig = {
  apiKey: "AIzaSyA_6NgIEP8amAeHuTMTPtfASPrV1F8jzfY",
  authDomain: "wd-grafica-rapida.firebaseapp.com",
  projectId: "wd-grafica-rapida",
  storageBucket: "wd-grafica-rapida.firebasestorage.app",
  messagingSenderId: "303529745765",
  appId: "1:303529745765:web:ea021a831bc65f417e158c"
};

// Depois que o site estiver no ar em wdgraficarapida.com.br (Firebase Hosting),
// troque authDomain para "wdgraficarapida.com.br" (veja LEIA-ME.md).

// Contas com acesso ao painel administrativo (também conferidas nas regras do banco).
export const ADMIN_EMAILS = ["wdgraficarapidacv@gmail.com", "grupowdoficial@gmail.com"];

// ---- Pagamento online (Mercado Pago) ----
// Fica desligado até: plano Blaze ativo + credenciais do Mercado Pago + funções publicadas (veja LEIA-ME.md).
// A Public Key é pública (começa com APP_USR- ou TEST-); o Access Token NUNCA vai aqui — ele fica como segredo no servidor.
export const PAGAMENTO_ONLINE = false;
export const MP_PUBLIC_KEY = "";

// Envio do arquivo da arte junto com o pedido (usa o Firebase Storage, disponível no plano Blaze).
export const UPLOAD_ARTE = false;
