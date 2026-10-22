/* Regras de preço do Grupo WD — usadas pelo site, pelo painel ADM e pelo servidor de pagamento.
   Assim o valor mostrado ao cliente é exatamente o valor cobrado. */
(function (raiz) {
  const r2 = v => Math.round(v * 100) / 100;

  // promoção ativa (percentual) de um produto
  function promo(aj, agora) {
    const p = aj && aj.promo;
    if (!p || !(p.pct > 0 && p.pct < 100)) return 0;
    if (p.ate && p.ate < (agora || Date.now())) return 0;
    return p.pct;
  }

  // preço de uma linha da tabela (produto do catálogo usa referência × multiplicador;
  // produto editado no painel guarda o preço final)
  const base = (prod, mult, v) => prod.final ? r2(v) : r2(v * mult);

  // ctx: { prod: {vars, final}, aj, mult, servicos, agora }
  // it:  { sku, vi, qtd, ex: [ids], sv: [ids] }
  function item(ctx, it) {
    const { prod, aj, mult, servicos, agora } = ctx;
    if (!prod || !prod.vars) return null;
    let v = null, q = null;
    for (const x of prod.vars) {
      const y = x.q.find(z => String(z[2]) === String(it.sku));
      if (y) { v = x; q = y; break; }
    }
    if (!q && it.vi != null) { v = prod.vars[it.vi]; q = v && v.q.find(z => z[0] === it.qtd); }
    if (!q) return null;
    const extras = (v.x || []).filter(x => (it.ex || []).includes(x[0]));
    const serv = (servicos || []).filter(s => (it.sv || []).includes(s.id));
    const pct = promo(aj, agora);
    const cheioProd = base(prod, mult, q[1]) + extras.reduce((a, x) => a + base(prod, mult, x[3]), 0);
    const prodFinal = r2(cheioProd * (1 - pct / 100));
    const servTotal = serv.reduce((a, s) => a + r2(s.preco * mult), 0);
    return { v, q, extras, serv, pct, unit: r2(prodFinal + servTotal), cheio: r2(cheioProd + servTotal) };
  }

  // preço final de uma quantidade (sem extras/serviços) — para tabelas e vitrines
  function linha(prod, aj, mult, total, agora) {
    const cheio = base(prod, mult, total);
    const pct = promo(aj, agora);
    return { cheio, final: r2(cheio * (1 - pct / 100)), pct };
  }

  const api = { r2, promo, base, item, linha };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.PRECOS = api;
})(typeof window !== 'undefined' ? window : globalThis);
