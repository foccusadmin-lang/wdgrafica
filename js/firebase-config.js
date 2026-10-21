// Cole aqui a configuração do seu projeto Firebase
// (Console Firebase > Configurações do projeto > Seus apps > App da Web > Configuração).
// Esses valores são públicos por natureza; a segurança fica nas regras (firestore.rules).
export const firebaseConfig = {
  apiKey: "COLE_AQUI",
  authDomain: "COLE_AQUI.firebaseapp.com",
  projectId: "COLE_AQUI",
  storageBucket: "COLE_AQUI.appspot.com",
  messagingSenderId: "COLE_AQUI",
  appId: "COLE_AQUI"
};

// Depois que o site estiver no ar em wdgraficarapida.com.br (Firebase Hosting),
// troque authDomain para "wdgraficarapida.com.br" — a janela de login passa a mostrar
// o seu domínio em vez de "*.firebaseapp.com" (veja LEIA-ME.md).

// Único e-mail com acesso ao painel administrativo.
export const ADMIN_EMAIL = "grupowdoficial@gmail.com";
