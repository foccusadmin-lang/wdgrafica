// Servidor de pagamentos do Grupo WD (Firebase Functions + Mercado Pago).
// - criarPedidoPago: recalcula os preços no servidor, grava o pedido e cria a cobrança (PIX ou cartão).
// - mpWebhook: recebe o aviso do Mercado Pago, confere a assinatura e atualiza o pedido.
const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const logger = require('firebase-functions/logger');
const admin = require('firebase-admin');
const crypto = require('crypto');
const PRECOS = require('./precos.js');

admin.initializeApp();
const db = admin.firestore();
const REGIAO = 'southamerica-east1';
const SITE = 'https://wd-grafica-rapida.web.app';
const MP_ACCESS_TOKEN = defineSecret('MP_ACCESS_TOKEN');
const MP_WEBHOOK_SECRET = defineSecret('MP_WEBHOOK_SECRET');
const WEBHOOK_URL = `https://${REGIAO}-wd-grafica-rapida.cloudfunctions.net/mpWebhook`;

// ---------- catálogo (com cache em memória) ----------
const cache = new Map();
async function json(url) {
  const c = cache.get(url);
  if (c && Date.now() - c.t < 10 * 60 * 1000) return c.v;
  const r = await fetch(url);
  const v = r.ok ? await r.json() : null;
  cache.set(url, { t: Date.now(), v });
  return v;
}
async function contexto(fam) {
  if (!/^[a-z0-9-]{1,100}$/.test(fam)) return null;
  const [ajS, cfgS, indice] = await Promise.all([db.doc(`ajustes/${fam}`).get(), db.doc('config/loja').get(), json(`${SITE}/data/indice.json`)]);
  const aj = ajS.exists ? ajS.data() : null;
  if (aj && (aj.excluido || aj.ativo === false)) return null;
  let prod;
  if (aj && (aj.editado || aj.novo)) {
    const p = await db.doc(`produtos/${fam}`).get();
    prod = p.exists ? { nome: p.data().nome, vars: JSON.parse(p.data().varsJson || '[]'), final: true } : null;
  } else prod = await json(`${SITE}/data/p/${fam}.json`);
  if (!prod) return null;
  return { prod, aj, mult: (cfgS.exists && cfgS.data().mult) || indice?.mult || 2.5, servicos: indice?.servicos || [],
    nome: aj?.nome || prod.nome || indice?.fams?.[fam]?.n || fam };
}

// ---------- Mercado Pago ----------
async function mp(metodo, caminho, corpo, chave) {
  const r = await fetch(`https://api.mercadopago.com${caminho}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN.value()}`, 'Content-Type': 'application/json', ...(chave ? { 'X-Idempotency-Key': chave } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const dados = await r.json().catch(() => ({}));
  if (!r.ok) { logger.error('Mercado Pago', r.status, dados); throw new HttpsError('internal', 'O pagamento não pôde ser processado. Tente novamente.'); }
  return dados;
}
const STATUS_MP = { approved: 'aprovado', authorized: 'pendente', in_process: 'pendente', pending: 'pendente', in_mediation: 'pendente',
  rejected: 'recusado', cancelled: 'recusado', refunded: 'estornado', charged_back: 'estornado' };

exports.criarPedidoPago = onCall({ region: REGIAO, secrets: [MP_ACCESS_TOKEN], maxInstances: 10 }, async req => {
  const u = req.auth;
  if (!u || !u.token.email_verified) throw new HttpsError('unauthenticated', 'Entre com sua conta Google.');
  const { itens = [], obs = '', metodo, cartao } = req.data || {};
  if (!['pix', 'cartao'].includes(metodo)) throw new HttpsError('invalid-argument', 'Forma de pagamento inválida.');
  if (!Array.isArray(itens) || !itens.length || itens.length > 50) throw new HttpsError('invalid-argument', 'Carrinho vazio.');

  const cliS = await db.doc(`clientes/${u.uid}`).get();
  const cad = cliS.exists ? cliS.data().cadastro : null;
  if (!cad) throw new HttpsError('failed-precondition', 'Complete seus dados antes de pagar.');

  // recalcula cada item com as regras oficiais de preço
  const linhas = [];
  for (const it of itens) {
    const n = parseInt(it.n, 10);
    if (!(n >= 1 && n <= 99)) throw new HttpsError('invalid-argument', 'Quantidade inválida.');
    const ctx = await contexto(String(it.fam));
    const r = ctx && PRECOS.item(ctx, { sku: it.sku, vi: it.vi, qtd: it.qtd, ex: it.ex || [], sv: it.sv || [] });
    if (!r) throw new HttpsError('failed-precondition', 'Um produto do carrinho não está mais disponível. Atualize a página.');
    linhas.push({
      id: r.q[2], fam: it.fam, nome: ctx.nome, un: `${r.q[0].toLocaleString('pt-BR')} ${r.q[0] === 1 ? 'unidade' : 'unidades'}`,
      spec: [...Object.values(r.v.a), ...r.extras.map(x => '+ ' + x[1]), ...r.serv.map(s => '+ ' + s.nome)].join(' - '),
      qtd: r.q[0], ex: r.extras.map(x => x[0]), sv: r.serv.map(s => s.id), q: n, preco: r.unit,
    });
  }
  const total = PRECOS.r2(linhas.reduce((s, l) => s + l.preco * l.q, 0));
  if (!(total > 0)) throw new HttpsError('failed-precondition', 'Total inválido.');

  const ref = db.collection('pedidos').doc();
  await ref.set({
    uid: u.uid, email: u.token.email, nome: cad.nome, obs: String(obs).slice(0, 1000), itens: linhas, total, cliente: cad,
    status: 'aguardando_pagamento', pagamento: { metodo, status: 'pendente' }, criadoEm: admin.firestore.FieldValue.serverTimestamp(),
  });

  const pagador = { email: u.token.email, first_name: cad.nome.split(' ')[0], last_name: cad.nome.split(' ').slice(1).join(' ') || undefined,
    identification: { type: cad.tipo === 'PJ' ? 'CNPJ' : 'CPF', number: cad.doc } };
  const comum = { transaction_amount: total, description: `Pedido ${ref.id.slice(0, 6).toUpperCase()} - Grupo WD`,
    external_reference: ref.id, notification_url: WEBHOOK_URL, statement_descriptor: 'GRUPO WD' };
  let pg;
  if (metodo === 'pix') {
    pg = await mp('POST', '/v1/payments', { ...comum, payment_method_id: 'pix', payer: pagador,
      date_of_expiration: new Date(Date.now() + 30 * 60 * 1000).toISOString().replace('Z', '-00:00') }, ref.id);
  } else {
    if (!cartao || !cartao.token || !cartao.payment_method_id) throw new HttpsError('invalid-argument', 'Dados do cartão incompletos.');
    pg = await mp('POST', '/v1/payments', { ...comum, token: cartao.token, payment_method_id: cartao.payment_method_id,
      issuer_id: cartao.issuer_id, installments: Math.max(1, Math.min(12, parseInt(cartao.installments, 10) || 1)),
      payer: { ...pagador, identification: cartao.payer?.identification || pagador.identification } }, ref.id);
  }
  const status = STATUS_MP[pg.status] || 'pendente';
  const td = pg.point_of_interaction?.transaction_data || {};
  await ref.update({
    'pagamento.status': status, 'pagamento.mpId': String(pg.id),
    ...(metodo === 'pix' ? { 'pagamento.copiaCola': td.qr_code || '', 'pagamento.expira': pg.date_of_expiration || '' } : {}),
    ...(status === 'aprovado' ? { status: 'arte_analise' } : {}),
  });
  return { pedidoId: ref.id, status, total, qrBase64: td.qr_code_base64 || '', copiaCola: td.qr_code || '' };
});

// Aviso de pagamento do Mercado Pago (configure esta URL e a assinatura secreta no painel do Mercado Pago).
exports.mpWebhook = onRequest({ region: REGIAO, secrets: [MP_ACCESS_TOKEN, MP_WEBHOOK_SECRET], maxInstances: 10 }, async (req, res) => {
  try {
    const dataId = String(req.query['data.id'] || req.body?.data?.id || '');
    const tipo = req.query.type || req.body?.type;
    if (tipo !== 'payment' || !/^\d+$/.test(dataId)) { res.status(200).send('ignorado'); return; }
    // assinatura: x-signature = "ts=...,v1=..." ; manifesto = id:<data.id>;request-id:<x-request-id>;ts:<ts>;
    const partes = Object.fromEntries(String(req.get('x-signature') || '').split(',').map(p => p.trim().split('=')));
    const manifesto = `id:${dataId};request-id:${req.get('x-request-id') || ''};ts:${partes.ts};`;
    const esperado = crypto.createHmac('sha256', MP_WEBHOOK_SECRET.value()).update(manifesto).digest('hex');
    if (!partes.v1 || partes.v1.length !== esperado.length || !crypto.timingSafeEqual(Buffer.from(partes.v1), Buffer.from(esperado))) {
      logger.warn('Webhook com assinatura inválida'); res.status(401).send('assinatura inválida'); return;
    }
    // confirma direto na API (nunca confia só no aviso)
    const pg = await mp('GET', `/v1/payments/${dataId}`);
    const id = pg.external_reference;
    if (!id) { res.status(200).send('sem pedido'); return; }
    const ref = db.doc(`pedidos/${id}`);
    await db.runTransaction(async t => {
      const s = await t.get(ref);
      if (!s.exists) return;
      const p = s.data();
      if (Math.abs((pg.transaction_amount || 0) - p.total) > 0.01) { logger.error('Valor divergente', id, pg.transaction_amount, p.total); return; }
      const status = STATUS_MP[pg.status] || 'pendente';
      const upd = { 'pagamento.status': status, 'pagamento.mpId': String(pg.id) };
      if (status === 'aprovado' && p.status === 'aguardando_pagamento') upd.status = 'arte_analise';
      t.update(ref, upd);
    });
    res.status(200).send('ok');
  } catch (e) {
    logger.error(e);
    res.status(500).send('erro');
  }
});
