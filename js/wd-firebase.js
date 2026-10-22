// Conexão com Firebase (login Google, banco Firestore, pagamentos e arquivos), usada pelo site e pelo painel ADM.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, signOut, onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc, deleteDoc, query, where, orderBy,
  serverTimestamp, onSnapshot, writeBatch, deleteField }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig, ADMIN_EMAILS, PAGAMENTO_ONLINE, MP_PUBLIC_KEY, UPLOAD_ARTE } from "./firebase-config.js";

export const configurado = !String(firebaseConfig.apiKey).includes("COLE_AQUI");
export { ADMIN_EMAILS, MP_PUBLIC_KEY, UPLOAD_ARTE };
export const pagamentoOnline = PAGAMENTO_ONLINE && !!MP_PUBLIC_KEY;

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
auth.languageCode = "pt";
const db = getFirestore(app);
const REGIAO = "southamerica-east1";

export const ehAdmin = u => !!u && u.emailVerified && ADMIN_EMAILS.includes(String(u.email).toLowerCase());

export async function entrar() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  try { await signInWithPopup(auth, provider); }
  catch (e) {
    // Popup bloqueado (comum em app instalado / celular): usa redirecionamento.
    if (["auth/popup-blocked", "auth/operation-not-supported-in-this-environment"].includes(e.code))
      await signInWithRedirect(auth, provider);
    else if (e.code !== "auth/popup-closed-by-user" && e.code !== "auth/cancelled-popup-request") throw e;
  }
}
export const sair = () => signOut(auth);

export function aoMudarUsuario(cb) {
  onAuthStateChanged(auth, async u => {
    if (u) {
      setDoc(doc(db, "clientes", u.uid), {
        nome: u.displayName || "", email: u.email || "", foto: u.photoURL || "", ultimoLogin: serverTimestamp()
      }, { merge: true }).catch(() => {});
    }
    cb(u);
  });
}

/* ---- cadastro do cliente ---- */
export async function meuCadastro(u) {
  const s = await getDoc(doc(db, "clientes", u.uid));
  return s.exists() ? (s.data().cadastro || null) : null;
}
export const salvarCadastro = (u, cad) =>
  updateDoc(doc(db, "clientes", u.uid), { cadastro: { ...cad, atualizadoEm: serverTimestamp() } });

/* ---- configuração da loja, ajustes e produtos editados ---- */
export async function lerConfig() {
  const s = await getDoc(doc(db, "config", "loja"));
  return s.exists() ? s.data() : {};
}
export const salvarConfig = dados => setDoc(doc(db, "config", "loja"), dados);
export async function lerAjustes() {
  const snap = await getDocs(collection(db, "ajustes"));
  return Object.fromEntries(snap.docs.map(d => [d.id, d.data()]));
}
export const salvarAjuste = (slug, dados) => setDoc(doc(db, "ajustes", slug), dados);
export const removerAjuste = slug => deleteDoc(doc(db, "ajustes", slug));
export async function lerProduto(slug) {
  const s = await getDoc(doc(db, "produtos", slug));
  if (!s.exists()) return null;
  const d = s.data();
  return { nome: d.nome, desc: d.desc || "", attrs: d.attrs || [], vars: JSON.parse(d.varsJson || "[]"), final: true };
}
export const salvarProduto = (slug, p) => setDoc(doc(db, "produtos", slug), {
  nome: p.nome, desc: p.desc || "", attrs: p.attrs, varsJson: JSON.stringify(p.vars), atualizadoEm: serverTimestamp()
});
export const removerProduto = slug => deleteDoc(doc(db, "produtos", slug));
export async function lerFoto(slug) {
  const s = await getDoc(doc(db, "fotos", slug));
  return s.exists() ? s.data().img : null;
}
export const salvarFoto = (slug, img) => setDoc(doc(db, "fotos", slug), { img });
export const removerFoto = slug => deleteDoc(doc(db, "fotos", slug));

/* ---- pedidos ---- */
// Pedido para combinar o pagamento pelo WhatsApp (gravado direto, validado pelas regras do banco).
export function criarPedido(u, pedido) {
  return addDoc(collection(db, "pedidos"), {
    ...pedido, uid: u.uid, email: u.email, status: "aguardando_pagamento",
    pagamento: { metodo: "whatsapp", status: "pendente" }, criadoEm: serverTimestamp()
  });
}
// Pedido com pagamento online: o servidor recalcula os preços e cria a cobrança no Mercado Pago.
export async function pagar(dados) {
  const { getFunctions, httpsCallable } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js");
  const fn = httpsCallable(getFunctions(app, REGIAO), "criarPedidoPago");
  return (await fn(dados)).data;
}
export const acompanharPedido = (id, cb) => onSnapshot(doc(db, "pedidos", id), s => cb(s.exists() ? { id: s.id, ...s.data() } : null));
export async function meusPedidos(u) {
  const snap = await getDocs(query(collection(db, "pedidos"), where("uid", "==", u.uid)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.criadoEm?.seconds || 0) - (a.criadoEm?.seconds || 0));
}
export async function todosPedidos() {
  const snap = await getDocs(query(collection(db, "pedidos"), orderBy("criadoEm", "desc")));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
// cada mudança de status grava a data da etapa (aparece na linha do tempo do cliente)
export const mudarStatus = (id, status) => updateDoc(doc(db, "pedidos", id), { status, ["etapas." + status]: serverTimestamp() });
export const marcarPagamento = (id, status) => updateDoc(doc(db, "pedidos", id),
  { "pagamento.status": status, ...(status === "aprovado" ? { "etapas.pago": serverTimestamp() } : {}) });
export const excluirPedido = id => deleteDoc(doc(db, "pedidos", id));

/* ---- arquivo da arte (Firebase Storage) ---- */
export async function enviarArte(u, pedidoId, arquivo, progresso) {
  const { getStorage, ref, uploadBytesResumable } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js");
  const nome = arquivo.name.replace(/[^\w.\-]+/g, "_").slice(-80);
  const caminho = `artes/${u.uid}/${pedidoId}/${Date.now()}-${nome}`;
  const tarefa = uploadBytesResumable(ref(getStorage(app), caminho), arquivo, { contentType: arquivo.type || "application/octet-stream" });
  await new Promise((ok, erro) => tarefa.on("state_changed", s => progresso?.(s.bytesTransferred / s.totalBytes), erro, ok));
  const arte = { nome: arquivo.name.slice(0, 120), caminho, tamanho: arquivo.size };
  await updateDoc(doc(db, "pedidos", pedidoId), { arte });
  return arte;
}
export async function linkArte(caminho) {
  const { getStorage, ref, getDownloadURL } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js");
  return getDownloadURL(ref(getStorage(app), caminho));
}

/* ---- clientes ---- */
export async function todosClientes() {
  const snap = await getDocs(collection(db, "clientes"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
export { writeBatch, deleteField };
