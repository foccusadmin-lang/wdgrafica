// Configuração do projeto Firebase "wd-grafica-rapida".
// Esses valores são públicos por natureza; a segurança fica nas regras (firestore.rules).
export const firebaseConfig = {
  apiKey: "AIzaSyA_6NgIEP8amAeHuTMTPtfASPrV1F8jzfY",
  authDomain: "wd-grafica-rapida.firebaseapp.com",
  projectId: "wd-grafica-rapida",
  storageBucket: "wd-grafica-rapida.firebasestorage.app",
  messagingSenderId: "303529745765",
  appId: "1:303529745765:web:ea021a831bc65f417e158c"
};

// Depois que o site estiver no ar em wdgraficarapida.com.br (Firebase Hosting),
// troque authDomain para "wdgraficarapida.com.br" — a janela de login passa a mostrar
// o seu domínio em vez de "*.firebaseapp.com" (veja LEIA-ME.md).

// Único e-mail com acesso ao painel administrativo.
export const ADMIN_EMAIL = "grupowdoficial@gmail.com";
