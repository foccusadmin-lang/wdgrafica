// Conexão com Firebase (login Google + banco Firestore), usada pelo site e pelo painel ADM.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, signOut, onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, doc, getDocs, addDoc, setDoc, updateDoc, deleteDoc, query, where, orderBy, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig, ADMIN_EMAIL } from "./firebase-config.js";

export const configurado = !String(firebaseConfig.apiKey).includes("COLE_AQUI");
export { ADMIN_EMAIL };

let auth = null, db = null;
if (configurado) {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  auth.languageCode = "pt";
  db = getFirestore(app);
}

export const ehAdmin = u => !!u && u.emailVerified && u.email?.toLowerCase() === ADMIN_EMAIL;

export async function entrar() {
  if (!configurado) { alert("Login ainda não configurado. Preencha js/firebase-config.js."); return; }
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
export const sair = () => auth && signOut(auth);

export function aoMudarUsuario(cb) {
  if (!configurado) { cb(null); return; }
  onAuthStateChanged(auth, async u => {
    if (u) {
      setDoc(doc(db, "clientes", u.uid), {
        nome: u.displayName || "", email: u.email || "", foto: u.photoURL || "", ultimoLogin: serverTimestamp()
      }, { merge: true }).catch(() => {});
    }
    cb(u);
  });
}

/* ---- ajustes do catálogo (ADM: ocultar, renomear, destacar produtos) ---- */
export async function lerAjustes() {
  if (!configurado) return {};
  const snap = await getDocs(collection(db, "ajustes"));
  return Object.fromEntries(snap.docs.map(d => [d.id, d.data()]));
}
export const salvarAjuste = (slug, dados) => setDoc(doc(db, "ajustes", slug), dados);
export const removerAjuste = slug => deleteDoc(doc(db, "ajustes", slug));

/* ---- pedidos ---- */
export function criarPedido(u, pedido) {
  return addDoc(collection(db, "pedidos"), {
    ...pedido, uid: u.uid, email: u.email, status: "novo", criadoEm: serverTimestamp()
  });
}
export async function meusPedidos(u) {
  const snap = await getDocs(query(collection(db, "pedidos"), where("uid", "==", u.uid)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.criadoEm?.seconds || 0) - (a.criadoEm?.seconds || 0));
}
export async function todosPedidos() {
  const snap = await getDocs(query(collection(db, "pedidos"), orderBy("criadoEm", "desc")));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
export const mudarStatus = (id, status) => updateDoc(doc(db, "pedidos", id), { status });
export const excluirPedido = id => deleteDoc(doc(db, "pedidos", id));

/* ---- clientes ---- */
export async function todosClientes() {
  const snap = await getDocs(collection(db, "clientes"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
