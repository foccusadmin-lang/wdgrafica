/* ===== Grupo WD — loja (menu, categorias, produto, carrinho, conta) ===== */
const WHATSAPP = '5511949632186';
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const brl = v => (+v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const num = v => (+v).toLocaleString('pt-BR');
const un = q => `${num(q)} ${q === 1 ? 'unidade' : 'unidades'}`;
const waUrl = msg => `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(msg)}`;
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

let IDX = null;            // data/indice.json: menu, categorias, resumo dos produtos
const FAM = {};            // dados completos dos produtos carregados (catálogo ou editados no painel)
let AJUSTES = {};          // ajustes do ADM (Firestore)
let MULT = 2.5;
const PAI = {};            // categoria -> { dep, grupo }
const FOTOS = {};          // fotos enviadas pelo painel (cache)
const wdPronto = new Promise(ok => window.WD ? ok() : addEventListener('wd-pronto', ok, { once: true }));

/* ---------- preços (regras em js/precos.js, as mesmas do servidor) ---------- */
const ctxPreco = slug => ({ prod: FAM[slug], aj: AJUSTES[slug], mult: MULT, servicos: IDX.servicos });
const precoLinha = (slug, total) => PRECOS.linha(FAM[slug] || {}, AJUSTES[slug], MULT, total);
const P = v => PRECOS.r2(v * MULT);   // serviços e referências do catálogo
// preço "a partir de" para a vitrine (resumo do produto editado ou referência do catálogo)
function precoVitrine(slug, t) {
  const aj = AJUSTES[slug];
  const editado = aj?.editado || aj?.novo;
  const cheio = editado ? PRECOS.r2(t) : P(t);
  const pct = PRECOS.promo(aj);
  return { cheio, final: PRECOS.r2(cheio * (1 - pct / 100)), pct };
}
const htmlPreco = p => p.pct ? `<s>${brl(p.cheio)}</s> ${brl(p.final)}` : brl(p.final);

/* ---------- dados ---------- */
async function carregarIndice() {
  IDX = await (await fetch('data/indice.json', { cache: 'no-cache' })).json();
  MULT = IDX.mult || 2.5;
  IDX.menu.forEach(d => {
    PAI[d.s] = { dep: d };
    d.g.forEach(g => { if (g.s) PAI[g.s] = { dep: d, grupo: g }; g.f.forEach(x => { PAI[x.s] = { dep: d, grupo: g, item: x }; }); });
  });
}
// ajustes e configuração do painel (espera no máximo 3 s para não travar a vitrine)
async function carregarAjustes() {
  const tempo = new Promise(ok => setTimeout(() => ok(null), 3000));
  const dados = await Promise.race([tempo, wdPronto.then(() => Promise.all([WD.lerAjustes(), WD.lerConfig()])).catch(() => null)]);
  if (!dados) return;
  AJUSTES = dados[0] || {};
  if (dados[1]?.mult) MULT = dados[1].mult;
}
// incorpora produtos novos e categorias extras criados no painel
function aplicarAjustes() {
  for (const [slug, aj] of Object.entries(AJUSTES)) {
    if (aj.novo && aj.resumo && !aj.excluido) {
      IDX.fams[slug] = { n: aj.nome, img: '', p: aj.resumo.p, s: aj.resumo.s || '', c: aj.resumo.c || 1, t: aj.resumo.t || '' };
    } else if (aj.editado && aj.resumo && IDX.fams[slug]) {
      IDX.fams[slug] = { ...IDX.fams[slug], p: aj.resumo.p, s: aj.resumo.s || IDX.fams[slug].s };
    }
    for (const d of aj.deps || []) {
      if (!IDX.listas[d] || IDX.listas[d].f.includes(slug)) continue;
      IDX.listas[d].f.unshift(slug);
      const dep = PAI[d]?.dep?.s;
      if (dep && dep !== d && !IDX.listas[dep].f.includes(slug)) IDX.listas[dep].f.unshift(slug);
    }
  }
}
async function famData(slug) {
  if (!FAM[slug]) {
    const aj = AJUSTES[slug];
    FAM[slug] = (aj?.editado || aj?.novo)
      ? wdPronto.then(() => WD.lerProduto(slug)).catch(() => null)
      : fetch(`data/p/${slug}.json`).then(r => r.ok ? r.json() : null).catch(() => null);
  }
  return FAM[slug];
}
const R = slug => IDX.fams[slug];
const visivel = slug => R(slug) && AJUSTES[slug]?.ativo !== false && !AJUSTES[slug]?.excluido;
const nomeFam = slug => AJUSTES[slug]?.nome || R(slug).n;
const fotoFam = slug => (slug && (FOTOS[slug] || R(slug)?.img)) || 'img/sem-foto.webp';
// atributo para carregar a foto enviada pelo painel depois de desenhar a página
const attrFoto = slug => AJUSTES[slug]?.foto && !FOTOS[slug] ? ` data-foto="${slug}"` : '';
async function carregarFotos() {
  const imgs = [...document.querySelectorAll('img[data-foto]')];
  if (!imgs.length) return;
  await wdPronto;
  for (const slug of [...new Set(imgs.map(i => i.dataset.foto))]) {
    if (FOTOS[slug] === undefined) FOTOS[slug] = await WD.lerFoto(slug).catch(() => null);
    if (FOTOS[slug]) document.querySelectorAll(`img[data-foto="${slug}"]`).forEach(i => { i.src = FOTOS[slug]; i.removeAttribute('data-foto'); });
  }
}
new MutationObserver(() => carregarFotos()).observe(document.documentElement, { subtree: true, childList: true });
const lista = s => IDX.listas[s];
const famsDe = s => (lista(s)?.f || []).filter(visivel);

/* ---------- roteador ---------- */
function rota() {
  const h = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
  const [path, qs] = h.split('?');
  return { parts: path.split('/').filter(Boolean), params: Object.fromEntries(new URLSearchParams(qs || '')) };
}
window.addEventListener('hashchange', () => { fecharMenu(); render(); window.scrollTo(0, 0); });
let renderN = 0;
function render() {
  if (!IDX) return;
  const n = ++renderN;
  const { parts, params } = rota();
  const [tipo, slug] = parts;
  marcarNav(tipo === 'c' ? slug : tipo === 'p' ? null : '');
  if (tipo === 'c' && lista(slug)) return pgCategoria(slug, n);
  if (tipo === 'p' && R(slug) && visivel(slug)) return pgProduto(slug, params, n);
  if (tipo === 'busca') return pgBusca(slug || '');
  pgHome();
}

/* ---------- menu "Todos os Produtos" ---------- */
function montarMenu() {
  const deps = IDX.menu.filter(d => famsDe(d.s).length);
  $('megaDeps').innerHTML = deps.map((d, i) => `<button class="${i ? '' : 'on'}" data-dep="${d.s}" onmouseenter="mostrarDep('${d.s}')" onclick="mostrarDep('${d.s}', true)">${esc(d.n)}<span>›</span></button>`).join('');
  mostrarDep(deps[0]?.s);
  // atalhos na barra
  const atalhos = ['Cartões de Visita', 'Folhetos', 'Adesivos e Rótulos', 'Brindes', 'Embalagens e Sacolas', 'Ponto de Venda', 'Banners, Faixas e Placas', 'Papelaria'];
  $('cats').innerHTML = `<button class="todos" onclick="abrirMenu()">☰ Todos os Produtos</button>` +
    atalhos.map(n => deps.find(d => d.n === n)).filter(Boolean).map(d => `<a href="#/c/${d.s}" data-s="${d.s}">${esc(d.n)}</a>`).join('');
  $('footCats').innerHTML = deps.map(d => `<li><a href="#/c/${d.s}">${esc(d.n)}</a></li>`).join('');
}
function mostrarDep(s, clique) {
  const d = IDX.menu.find(x => x.s === s); if (!d) return;
  document.querySelectorAll('#megaDeps button').forEach(b => b.classList.toggle('on', b.dataset.dep === s));
  const grupos = d.g.map(g => {
    const itens = g.f.filter(x => famsDe(x.s).length);
    if (!itens.length && !(g.s && famsDe(g.s).length)) return '';
    return `<div class="mg"><a class="mg-t" href="#/c/${g.s || d.s}">${esc(g.n)}</a>${itens.map(x => `<a href="#/c/${x.s}">${esc(x.n)}</a>`).join('')}</div>`;
  }).join('');
  $('megaGrupos').innerHTML = `<a class="mg-dep" href="#/c/${d.s}">Ver tudo em ${esc(d.n)} →</a><div class="mg-cols">${grupos}</div>`;
  if (clique && matchMedia('(max-width:860px)').matches) $('mega').classList.add('nivel2');
}
function abrirMenu() { $('mega').classList.add('open'); $('shade').classList.add('open'); }
function fecharMenu() { $('mega').classList.remove('open', 'nivel2'); if (!$('drawer').classList.contains('open')) $('shade').classList.remove('open'); }
function marcarNav(s) {
  const dep = s ? (PAI[s]?.dep?.s || s) : '';
  document.querySelectorAll('#cats a').forEach(a => a.classList.toggle('on', a.dataset.s === dep));
}

/* ---------- cards ---------- */
function card(slug, alvo) {
  const r = R(slug);
  const p = alvo || { q: r.p[0], t: r.p[1], vi: r.p[2], s: r.s };
  const pr = precoVitrine(slug, p.t);
  const tag = pr.pct ? `<span class="tag promo">-${pr.pct}%</span>` : AJUSTES[slug]?.destaque ? '<span class="tag">Mais vendido</span>' : '';
  return `<a class="card" href="#/p/${slug}?v=${p.vi}&q=${p.q}">
    <div class="ph"><img src="${esc(fotoFam(slug))}"${attrFoto(slug)} alt="${esc(nomeFam(slug))}" loading="lazy">${tag}</div>
    <div class="bd">
      <h3>${esc(nomeFam(slug))}</h3>
      <div class="spec">${esc(p.s)}</div>
      <div class="price"><small>a partir de</small> ${htmlPreco(pr)} <small>/ ${num(p.q)} un</small></div>
    </div></a>`;
}

/* ---------- HOME ---------- */
const BANNERS = [
  { t: 'Cartões de visita', s: 'Do clássico ao premium, com preço na hora.', cta: 'Ver cartões', l: 'cartoes de visita', cor: 'linear-gradient(120deg,#141414,#3a2b6b)', img: 'img/fam/cartao-de-visita-em-hot-stamping.webp' },
  { t: 'Adesivos e rótulos', s: 'Sua marca em embalagens, lacres e produtos.', cta: 'Ver adesivos', l: 'adesivos e rotulos', cor: 'linear-gradient(120deg,#e6007e,#8b1fa8)', img: 'img/fam/adesivo-personalizado.webp' },
  { t: 'Folhetos e folders', s: 'Divulgação que chega na mão do cliente.', cta: 'Ver folhetos', l: 'folhetos', cor: 'linear-gradient(120deg,#00a8e1,#1d3b8a)', img: 'img/fam/folder-3-dobras.webp' },
  { t: 'Não tem a arte?', s: 'Nossa equipe cria o design do seu material.', cta: 'Falar no WhatsApp', wa: 'Olá, Grupo WD! Preciso de ajuda para criar a arte do meu material.', cor: 'linear-gradient(120deg,#c9a227,#8a6d00)', img: 'img/logo.jpg' },
];
let bannerAt = 0, bannerTimer;
function depPorNome(n) { return IDX.menu.find(d => norm(d.n) === n); }
function pgHome() {
  document.title = 'Grupo WD | Gráfica Online';
  const deps = IDX.menu.filter(d => famsDe(d.s).length);
  const maisVend = lista('mais-vendidos') ? famsDe('mais-vendidos') : [];
  const destaques = Object.keys(AJUSTES).filter(s => AJUSTES[s].destaque && visivel(s));
  const topo = [...new Set([...destaques, ...maisVend])].slice(0, 10);
  $('app').innerHTML = `
  <div class="wrap">
    <div class="carrossel" id="carrossel">
      ${BANNERS.map((b, i) => {
        const d = b.l && depPorNome(b.l);
        const href = b.wa ? waUrl(b.wa) : d ? `#/c/${d.s}` : '#/';
        return `<a class="slide ${i ? '' : 'on'}" style="background:${b.cor}" href="${href}" ${b.wa ? 'target="_blank" rel="noopener"' : ''}>
          <div><h2>${esc(b.t)}</h2><p>${esc(b.s)}</p><span class="btn btn-gold">${esc(b.cta)}</span></div>
          <img src="${b.img}" alt=""></a>`;
      }).join('')}
      <div class="dots">${BANNERS.map((b, i) => `<button class="${i ? '' : 'on'}" onclick="irBanner(${i})" aria-label="Banner ${i + 1}"></button>`).join('')}</div>
    </div>
    <div class="circulos">${deps.map(d => `<a href="#/c/${d.s}"><span><img src="${esc(fotoFam(famsDe(d.s).find(s => R(s).img)))}" alt="" loading="lazy"></span>${esc(d.n)}</a>`).join('')}</div>
  </div>
  <div class="perks"><div class="wrap">
    <div class="perk"><i style="background:#e0f6fd">🚚</i><div><b>Entrega em todo Brasil</b>Envio seguro</div></div>
    <div class="perk"><i style="background:#fde0f0">🎨</i><div><b>Criação de arte</b>Não tem arte? A gente cria</div></div>
    <div class="perk"><i style="background:#fff7cc">⚡</i><div><b>Produção rápida</b>Prazos que cabem na sua agenda</div></div>
    <div class="perk"><i style="background:#ececec">💳</i><div><b>Pix e cartão</b>Pagamento facilitado</div></div>
  </div></div>
  ${topo.length ? `<section><div class="wrap"><div class="sec-title"><h2>Mais vendidos</h2></div><div class="grid">${topo.map(s => card(s)).join('')}</div></div></section>` : ''}
  ${deps.slice(0, 8).map(d => `<section style="padding-top:0"><div class="wrap">
    <div class="sec-title"><h2>${esc(d.n)}</h2><a class="ver" href="#/c/${d.s}">Ver todos →</a></div>
    <div class="grid">${famsDe(d.s).slice(0, 5).map(s => card(s)).join('')}</div>
  </div></section>`).join('')}
  ${blocoArte()}`;
  clearInterval(bannerTimer);
  bannerTimer = setInterval(() => { if (!$('carrossel')) return clearInterval(bannerTimer); irBanner((bannerAt + 1) % BANNERS.length); }, 6000);
}
function irBanner(i) {
  bannerAt = i;
  document.querySelectorAll('#carrossel .slide').forEach((s, k) => s.classList.toggle('on', k === i));
  document.querySelectorAll('#carrossel .dots button').forEach((s, k) => s.classList.toggle('on', k === i));
}
const blocoArte = () => `<section style="padding-top:0"><div class="wrap"><div class="art">
  <div><h3>Não tem a arte pronta?</h3><p>Nossa equipe cria o design do seu material. Fale com a gente!</p></div>
  <a class="btn btn-gold" href="${waUrl('Olá, Grupo WD! Preciso de ajuda para criar a arte do meu material.')}" target="_blank" rel="noopener">Quero criar minha arte</a>
</div></div></section>`;

/* ---------- CATEGORIA (com filtros) ---------- */
const FILTROS = [['Produto', null], ['Material', 'Material'], ['Cor', 'Cor'], ['Formato', 'Formato'], ['Cobertura', 'Enobrecimento'], ['Acabamento', 'Acabamento'], ['Quantidade', null]];
let filtroSel = {}, filtroCat = '', ordem = 'relevancia';

function migalhas(s, final) {
  const p = PAI[s] || {};
  const partes = [`<a href="#/">Início</a>`];
  if (p.dep && p.dep.s !== s) partes.push(`<a href="#/c/${p.dep.s}">${esc(p.dep.n)}</a>`);
  if (p.grupo && p.grupo.s && p.grupo.s !== s && p.grupo.n !== p.dep.n) partes.push(`<a href="#/c/${p.grupo.s}">${esc(p.grupo.n)}</a>`);
  partes.push(final ? `<a href="#/c/${s}">${esc(lista(s).n)}</a>` : `<b>${esc(lista(s).n)}</b>`);
  if (final) partes.push(`<b>${esc(final)}</b>`);
  return `<nav class="crumbs">${partes.join(' › ')}</nav>`;
}
// categoria "principal" de um produto: evita vitrines genéricas (Oportunidades, Segmentos)
const GENERICOS = /oportunidades|neg[oó]cios e segmentos/i;
function categoriaDe(slug) {
  const cands = Object.keys(IDX.listas).filter(s => lista(s).f.includes(slug));
  const raiz = w => w.replace(/(oes|aes|s)$/, '');
  const palavras = t => new Set(norm(t).split(/[^a-z0-9]+/).filter(w => w.length > 2).map(raiz));
  const doNome = palavras(R(slug).n);
  const comuns = t => [...palavras(t)].filter(w => doNome.has(w)).length;
  const nota = s => -10 * Math.max(comuns(lista(s).n), comuns(PAI[s]?.dep?.n || '') * 0.9)
    + (s.startsWith('dep-') ? 2 : 0) + (GENERICOS.test(PAI[s]?.dep?.n || '') ? 4 : 0) + (PAI[s]?.item ? 0 : 1);
  return cands.sort((a, b) => nota(a) - nota(b))[0];
}
function textoCat(s) {
  const d = PAI[s]?.dep?.n || '';
  const k = /cart/i.test(d) ? 'cartao-de-visita' : /adesiv/i.test(d) ? 'adesivo' : /folhet/i.test(d) ? 'folders-e-panfletos' : '_padrao';
  return TEXTOS[s] || TEXTOS[k];
}

async function pgCategoria(slug, n) {
  const c = lista(slug);
  if (filtroCat !== slug) { filtroSel = {}; filtroCat = slug; }
  const t = textoCat(slug);
  document.title = `${c.n} | Grupo WD`;
  const fams = famsDe(slug);
  // subcategorias (quando é um departamento ou grupo)
  const p = PAI[slug];
  let subs = [];
  if (p && p.dep.s === slug) subs = p.dep.g.flatMap(g => g.f).filter(x => famsDe(x.s).length);
  else if (p && p.grupo && !p.item) subs = p.grupo.f.filter(x => famsDe(x.s).length);
  const topo = `${migalhas(slug)}
    <div class="banner"><div><h1>${esc(c.n)}</h1><p>${esc(t.sub)}</p></div><img src="${esc(fotoFam(fams.find(s => R(s).img)))}" alt=""></div>
    ${subs.length ? `<div class="subcats">${subs.map(x => `<a href="#/c/${x.s}">${esc(x.n)}</a>`).join('')}</div>` : ''}`;
  // mostra a lista já com os dados resumidos; filtros chegam quando os produtos carregam
  if (!fams.every(s => FAM[s] && !(FAM[s] instanceof Promise))) {
    $('app').innerHTML = `<div class="wrap">${topo}<div class="lista-hd"><span>${fams.length} produtos · carregando filtros…</span></div>
      <div class="grid">${fams.map(s => card(s)).join('')}</div></div>`;
  }
  const dados = await Promise.all(fams.map(famData));
  if (n !== renderN) return;
  fams.forEach((s, i) => { FAM[s] = dados[i]; });
  const linhas = [];
  fams.forEach(s => FAM[s] && FAM[s].vars.forEach((v, vi) => linhas.push({ s, v, vi })));
  const valor = (nome, campo, l) => nome === 'Produto' ? nomeFam(l.s) : l.v.a[campo];
  const passa = (l, ignorar) => FILTROS.every(([nome, campo]) => {
    const sel = filtroSel[nome]; if (nome === ignorar || !sel || !sel.size) return true;
    if (nome === 'Quantidade') return l.v.q.some(q => sel.has(String(q[0])));
    return sel.has(valor(nome, campo, l));
  });
  const blocos = FILTROS.map(([nome, campo]) => {
    const cont = new Map();
    linhas.filter(l => passa(l, nome)).forEach(l => {
      if (nome === 'Quantidade') l.v.q.forEach(q => cont.set(String(q[0]), (cont.get(String(q[0])) || 0) + 1));
      else { const k = valor(nome, campo, l); if (k) cont.set(k, (cont.get(k) || 0) + 1); }
    });
    const ops = [...cont.entries()].sort(nome === 'Quantidade' ? (a, b) => a[0] - b[0] : (a, b) => a[0].localeCompare(b[0], 'pt-BR', { numeric: true }));
    if (ops.length < 2 && !(filtroSel[nome]?.size)) return '';
    return `<details class="filtro" open><summary>${nome}</summary>
      ${ops.length > 8 ? `<input class="fbusca" placeholder="Buscar ${nome.toLowerCase()}" oninput="filtrarLista(this)">` : ''}
      <div class="flista">${ops.map(([k, q]) => `<label><input type="checkbox" ${filtroSel[nome]?.has(k) ? 'checked' : ''} onchange="toggleFiltro('${nome}', this.value, this.checked)" value="${esc(k)}">
        <span>${esc(nome === 'Quantidade' ? num(k) : k)}</span><em>${q}</em></label>`).join('')}</div></details>`;
  }).join('');
  const qSel = filtroSel.Quantidade?.size ? [...filtroSel.Quantidade].map(Number) : null;
  // melhor oferta de cada produto respeitando os filtros
  const alvo = s => {
    let best = null;
    linhas.filter(l => l.s === s && passa(l)).forEach(l => l.v.q.forEach(q => {
      if (qSel && !qSel.includes(q[0])) return;
      if (!best || q[1] < best.t) best = { q: q[0], t: q[1], vi: l.vi, s: resumoVar(l.v) };
    }));
    return best;
  };
  let lst = fams.map(s => [s, FAM[s] ? alvo(s) : undefined]).filter(([, a]) => a !== null);
  if (ordem === 'preco') lst.sort((a, b) => (a[1]?.t ?? R(a[0]).p[1]) - (b[1]?.t ?? R(b[0]).p[1]));
  if (ordem === 'nome') lst.sort((a, b) => nomeFam(a[0]).localeCompare(nomeFam(b[0]), 'pt-BR'));
  const ativos = Object.entries(filtroSel).flatMap(([nm, s]) => [...s].map(v => [nm, v]));

  $('app').innerHTML = `<div class="wrap">${topo}
    <div class="cat-layout">
      <aside class="filtros" id="filtros">
        <div class="filtros-hd"><b>Filtrar</b><button class="link" onclick="limparFiltros()">Limpar</button>
          <button class="fechar" onclick="$('filtros').classList.remove('open')">×</button></div>
        ${blocos || '<p class="muted" style="padding:8px">Sem filtros para esta categoria.</p>'}
      </aside>
      <div>
        <div class="lista-hd">
          <button class="btn-filtros" onclick="$('filtros').classList.add('open')">⚙️ Filtros${ativos.length ? ` (${ativos.length})` : ''}</button>
          <span>Exibindo <b>${lst.length}</b> de <b>${fams.length}</b> produtos</span>
          <label>Ordenar <select onchange="ordem=this.value;render()">
            <option value="relevancia" ${ordem === 'relevancia' ? 'selected' : ''}>Relevância</option>
            <option value="preco" ${ordem === 'preco' ? 'selected' : ''}>Menor preço</option>
            <option value="nome" ${ordem === 'nome' ? 'selected' : ''}>Nome</option></select></label>
        </div>
        ${ativos.length ? `<div class="chips">${ativos.map(([nm, v]) => `<button onclick="toggleFiltro('${nm}','${esc(v)}',false)">${esc(nm === 'Quantidade' ? num(v) + ' un' : v)} ×</button>`).join('')}</div>` : ''}
        <div class="grid">${lst.map(([s, a]) => card(s, a)).join('') || '<div class="empty">Nenhum produto com esses filtros.</div>'}</div>
      </div>
    </div>
    <article class="texto">${t.desc}</article>
  </div>${blocoArte()}`;
}
function resumoVar(v) {
  const a = v.a;
  return [a.Formato, a.Cor && a.Cor.replace(/^4x[014] - /, ''), a.Acabamento].filter(Boolean).join(' - ');
}
function toggleFiltro(nome, val, on) {
  filtroSel[nome] = filtroSel[nome] || new Set();
  on ? filtroSel[nome].add(val) : filtroSel[nome].delete(val);
  const aberto = $('filtros')?.classList.contains('open');
  Promise.resolve(render()).then(() => { if (aberto) $('filtros')?.classList.add('open'); });
}
function limparFiltros() { filtroSel = {}; render(); }
function filtrarLista(inp) {
  const t = norm(inp.value);
  inp.nextElementSibling.querySelectorAll('label').forEach(l => l.style.display = norm(l.textContent).includes(t) ? '' : 'none');
}

/* ---------- BUSCA ---------- */
function pgBusca(termo) {
  const ts = norm(termo).split(/\s+/).filter(Boolean);
  const lst = Object.keys(IDX.fams).filter(s => visivel(s) && ts.every(t => norm(nomeFam(s) + ' ' + R(s).t).includes(t)));
  document.title = `Busca: ${termo} | Grupo WD`;
  $('app').innerHTML = `<div class="wrap"><nav class="crumbs"><a href="#/">Início</a> › Busca</nav>
    <div class="sec-title" style="margin-top:16px"><h2>Resultados para "${esc(termo)}"</h2><span>${lst.length} produtos</span></div>
    <div class="grid">${lst.slice(0, 120).map(s => card(s)).join('') ||
      `<div class="empty">Nenhum produto encontrado. <a href="${waUrl('Olá! Procuro um produto que não encontrei no site: ' + termo)}" target="_blank">Peça um orçamento pelo WhatsApp</a></div>`}</div></div>`;
}

/* ---------- PRODUTO ---------- */
let sel = null; // { slug, vi, qtd, extras:Set, serv:Set, n }

async function pgProduto(slug, params, n) {
  if (!FAM[slug] || FAM[slug] instanceof Promise) $('app').innerHTML = '<div class="wrap empty">Carregando produto…</div>';
  const f = await famData(slug);
  if (n !== renderN) return;
  FAM[slug] = f;
  if (!f) { $('app').innerHTML = '<div class="wrap empty">Produto indisponível no momento.</div>'; return; }
  const vi = Math.min(+params.v || 0, f.vars.length - 1);
  if (!sel || sel.slug !== slug || sel.vi !== vi) {
    const v = f.vars[vi];
    const qtd = v.q.some(q => q[0] === +params.q) ? +params.q : (sel?.slug === slug && v.q.some(q => q[0] === sel.qtd) ? sel.qtd : v.q[0][0]);
    sel = { slug, vi, qtd, extras: new Set(), serv: new Set(), n: sel?.slug === slug ? sel.n : 1 };
  }
  desenharProduto();
}

function precoSel() {
  const f = FAM[sel.slug], v0 = f.vars[sel.vi];
  const q0 = v0.q.find(x => x[0] === sel.qtd) || v0.q[0];
  const r = PRECOS.item(ctxPreco(sel.slug), { sku: q0[2], vi: sel.vi, qtd: q0[0], ex: [...sel.extras], sv: [...sel.serv] });
  const dias = r.extras.reduce((a, x) => a + (x[2] || 0), 0);
  return { f, v: r.v, q: r.q, extras: r.extras, serv: r.serv, unit: r.unit, cheio: r.cheio, pct: r.pct,
    total: PRECOS.r2(r.unit * sel.n), totalCheio: PRECOS.r2(r.cheio * sel.n), dias };
}

// figuras das opções: foto (papel, acabamento), cor (círculos CMYK) e formato (proporção)
function figuraCor(val) {
  const m = String(val).match(/(\d)\s*[x×]\s*(\d)/);
  if (!m) return '';
  const c = d => d === '4' ? 'url(#cmyk)' : d === '0' ? 'none' : '#222';
  const s = d => d === '0' ? 'stroke="#c9cbd0" stroke-dasharray="3 3"' : '';
  return `<svg viewBox="0 0 66 34" class="fig-cor"><defs><linearGradient id="cmyk" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#00a6ec"/><stop offset=".55" stop-color="#ec008c"/><stop offset="1" stop-color="#ffe400"/></linearGradient></defs>
    <circle cx="17" cy="17" r="13" fill="${c(m[1])}" ${s(m[1])}/><circle cx="49" cy="17" r="13" fill="${c(m[2])}" ${s(m[2])}/></svg>`;
}
function figuraFormato(val) {
  const m = String(val).match(/(\d+)\s*x\s*(\d+)/);
  if (!m) return '';
  let w = +m[1], h = +m[2]; const k = 46 / Math.max(w, h); w *= k; h *= k;
  return `<svg viewBox="0 0 60 60" class="fig-fmt"><rect x="${(60 - w) / 2}" y="${(60 - h) / 2}" width="${w}" height="${h}" fill="none" stroke="#9a9ca3" stroke-dasharray="3 2"/></svg>`;
}
// fotos da combinação escolhida (troca ao mudar cor, formato, material...)
function fotosVar(v) {
  const l = [];
  if (AJUSTES[sel.slug]?.foto) l.push(FOTOS[sel.slug] || 'admin');   // foto enviada pelo painel vem primeiro
  (v.g || []).forEach(f => l.includes(f) || l.push(f));
  if (!l.length) l.push(fotoFam(sel.slug));
  return l;
}
function galeriaHtml(v, pct) {
  const l = fotosVar(v);
  const i = Math.min(sel.foto || 0, l.length - 1);
  const src = f => f === 'admin' ? fotoFam(sel.slug) : f;
  const at = f => f === 'admin' ? attrFoto(sel.slug) : '';
  return `<div class="galeria ${l.length > 1 ? 'com-thumbs' : ''}">
    ${l.length > 1 ? `<div class="thumbs">${l.map((f, k) => `<button class="${k === i ? 'on' : ''}" onclick="verFoto(${k})" aria-label="Foto ${k + 1}"><img src="${esc(src(f))}"${at(f)} alt="" loading="lazy"></button>`).join('')}</div>` : ''}
    <div class="principal">${pct ? `<span class="tag promo">-${pct}%</span>` : ''}<img src="${esc(src(l[i]))}"${at(l[i])} alt="${esc(nomeFam(sel.slug))}"></div>
  </div>`;
}
function verFoto(k) { sel.foto = k; const g = document.querySelector('.galeria'); if (g) g.outerHTML = galeriaHtml(FAM[sel.slug].vars[sel.vi], PRECOS.promo(AJUSTES[sel.slug])); }
function desenharProduto() {
  const { f, v, q, extras, serv, unit, total, totalCheio, pct, dias } = precoSel();
  const PF = x => PRECOS.base(f, MULT, x);   // preço de uma linha/extra deste produto
  const pai = categoriaDe(sel.slug);
  document.title = `${nomeFam(sel.slug)} | Grupo WD`;
  const chaves = f.attrs.filter(k => f.vars.some(x => x.a[k]));
  const grupos = chaves.map(k => {
    const vals = [...new Set(f.vars.map(x => x.a[k]).filter(Boolean))];
    const opc = f.opc?.[k] || {};
    const fig = val => {
      if (k === 'Cor') return figuraCor(val);
      if (k === 'Formato') return figuraFormato(val);
      const im = opc[val] || Object.entries(opc).find(([r]) => norm(r).startsWith(norm(val).slice(0, 12)))?.[1];
      return im ? `<img src="${esc(im)}" alt="" loading="lazy">` : '';
    };
    const comFig = vals.some(val => fig(val));
    return `<div class="opc"><span>${esc(k === 'Enobrecimento' ? 'Cobertura' : k)}</span><div class="opc-bts ${comFig ? 'cards' : ''}">${vals.map(val =>
      `<button class="${v.a[k] === val ? 'on' : ''}" onclick="escolherAttr('${esc(k)}', this.dataset.v)" data-v="${esc(val)}">${comFig ? `<i>${fig(val)}</i>` : ''}<small>${esc(val)}</small></button>`).join('')}</div></div>`;
  }).join('');
  const base = v.q[0][1] / v.q[0][0];
  const tabela = v.q.map(([qt, tot]) => {
    const l = precoLinha(sel.slug, tot);
    const u = l.final / qt, desc = Math.round((1 - (tot / qt) / base) * 100);
    return `<tr class="${qt === sel.qtd ? 'on' : ''}" onclick="escolherQtd(${qt})">
      <td><label><input type="radio" name="qtd" ${qt === sel.qtd ? 'checked' : ''}> ${un(qt)}</label></td>
      <td><small>${brl(u < 0.01 ? 0.01 : u).replace(/(,\d{2})\d*/, '$1')}/un</small>${desc > 0 ? ` <em class="off">-${desc}%</em>` : ''}</td>
      <td><b>${htmlPreco(l)}</b></td></tr>`;
  }).join('');
  const ex = (v.x || []).length ? `<div class="opc"><span>Gostaria de adicionar um acabamento extra?</span><div class="extras">${v.x.map(x =>
    `<label class="${sel.extras.has(x[0]) ? 'on' : ''}"><input type="checkbox" ${sel.extras.has(x[0]) ? 'checked' : ''} onchange="toggleExtra(${x[0]}, this.checked)">
      <span>${esc(x[1])} <small>${x[2] ? `(+ ${x[2]} dia${x[2] > 1 ? 's' : ''})` : ''}</small></span><b>+ ${brl(PF(x[3]))}</b></label>`).join('')}</div></div>` : '';
  const servicos = `<div class="servicos">${IDX.servicos.map(s => `<label class="serv ${sel.serv.has(s.id) ? 'on' : ''}" style="--cor:${s.cor}">
      <input type="checkbox" ${sel.serv.has(s.id) ? 'checked' : ''} onchange="toggleServ('${s.id}', this.checked)">
      <i>${s.icone}</i><div><b>${esc(s.nome)}</b><span>${brl(P(s.preco))}</span><small>${esc(s.desc)}</small></div></label>`).join('')}</div>`;
  const specs = [['Prazo de produção', (v.prazo || 'Consulte') + (dias ? ` (+ ${dias} dia${dias > 1 ? 's' : ''} pelos acabamentos extras)` : '')],
    ...Object.entries(v.a).map(([k, val]) => [k === 'Cor' ? 'Cor de Impressão' : k === 'Enobrecimento' ? 'Cobertura' : k, val]),
    ['Acabamento extra', extras.map(x => x[1]).join(', ') || 'Nenhum']];
  const nomeConfig = `${num(sel.qtd)} ${nomeFam(sel.slug)} - ${Object.values(v.a).join(' - ')}`;
  const rel = pai ? famsDe(pai).filter(s => s !== sel.slug).slice(0, 10) : [];
  const t = textoCat(pai || '');

  $('app').innerHTML = `<div class="wrap prod">
    ${pai ? migalhas(pai, nomeFam(sel.slug)) : ''}
    <div class="prod-grid">
      ${galeriaHtml(v, pct)}
      <div class="info">
        <h1>${esc(nomeFam(sel.slug))}</h1>
        <p class="sub">${esc(t.sub)}</p>
        ${grupos}
        ${ex}
        <div class="opc"><span>Escolha a quantidade</span>
          <table class="qtab"><thead><tr><th>Quantidade</th><th>Valor por unidade</th><th>Valor total</th></tr></thead><tbody>${tabela}</tbody></table>
          <p class="nota">O desconto é calculado sobre o valor unitário da menor quantidade disponível.</p></div>
        ${servicos}
        <h3 class="h3">Especificações do produto</h3>
        <table class="specs">${specs.map(([k, val]) => `<tr><th>${esc(k)}</th><td>${esc(val)}</td></tr>`).join('')}</table>
        <h3 class="h3">Utilize o gabarito</h3>
        <div class="gabaritos">${['Illustrator', 'Canva', 'Corel Draw', 'PDF'].map(g => `<a href="${waUrl(`Olá, Grupo WD! Pode me enviar o gabarito (${g}) de: ${nomeConfig}?`)}" target="_blank" rel="noopener"><b>${g === 'Illustrator' ? 'Ai' : g === 'Canva' ? 'Canva' : g === 'PDF' ? 'PDF' : 'CDR'}</b><small>${g}</small></a>`).join('')}</div>
        <h3 class="h3">Consultar frete e prazo de entrega</h3>
        <form class="cep" onsubmit="event.preventDefault();consultarFrete(this.cep.value)">
          <input name="cep" inputmode="numeric" maxlength="9" placeholder="Digite seu CEP: 00000-000" oninput="this.value=this.value.replace(/\\D/g,'').replace(/(\\d{5})(\\d)/,'$1-$2')">
          <button>OK</button></form>
      </div>
    </div>
    <article class="texto">${f.desc ? f.desc.split(/\n{2,}/).map(p => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('') : t.desc}</article>
    ${rel.length ? `<div class="sec-title"><h2>Produtos relacionados</h2></div><div class="grid">${rel.map(s => card(s)).join('')}</div>` : ''}
  </div>
  <div class="buybar"><div class="wrap">
    <div class="bb-txt"><small>${esc(nomeConfig)}</small><b>${pct ? `<s>${brl(totalCheio)}</s> ` : ''}${brl(total)}</b>${sel.n > 1 ? `<small>${sel.n} × ${brl(unit)}</small>` : ''}</div>
    <div class="qty"><button onclick="mudarN(-1)">−</button><b>${sel.n}</b><button onclick="mudarN(1)">+</button></div>
    <button class="btn btn-gold" onclick="addCart()">🛒 Adicionar</button>
    <button class="btn btn-wa" onclick="comprarAgora()">💬 Comprar</button>
  </div></div>`;
}
function escolherAttr(k, val) {
  const f = FAM[sel.slug], atual = f.vars[sel.vi].a;
  let best = -1, score = -1;
  f.vars.forEach((v, i) => {
    if (v.a[k] !== val) return;
    const s = Object.keys(atual).filter(x => v.a[x] === atual[x]).length;
    if (s > score) { score = s; best = i; }
  });
  if (best < 0) return;
  const v = f.vars[best];
  const qtd = v.q.some(q => q[0] === sel.qtd) ? sel.qtd : v.q.reduce((a, q) => Math.abs(q[0] - sel.qtd) < Math.abs(a[0] - sel.qtd) ? q : a)[0];
  history.replaceState(null, '', `#/p/${sel.slug}?v=${best}&q=${qtd}`);
  sel.vi = best; sel.qtd = qtd; sel.extras = new Set(); sel.foto = 0; desenharProduto();
}
function escolherQtd(q) { sel.qtd = q; history.replaceState(null, '', `#/p/${sel.slug}?v=${sel.vi}&q=${q}`); desenharProduto(); }
function toggleExtra(id, on) { on ? sel.extras.add(id) : sel.extras.delete(id); desenharProduto(); }
function toggleServ(id, on) { on ? sel.serv.add(id) : sel.serv.delete(id); desenharProduto(); }
function mudarN(d) { sel.n = Math.max(1, Math.min(99, sel.n + d)); desenharProduto(); }
function consultarFrete(cep) {
  const c = String(cep).replace(/\D/g, '');
  if (c.length !== 8) return toast('Digite um CEP válido');
  const { v } = precoSel();
  window.open(waUrl(`Olá, Grupo WD! Gostaria de saber o frete e o prazo de entrega para o CEP ${c.replace(/(\d{5})/, '$1-')}.\nProduto: ${num(sel.qtd)} ${nomeFam(sel.slug)} - ${Object.values(v.a).join(' - ')}`), '_blank');
}

/* ---------- CARRINHO ---------- */
let cart = [];
try { cart = JSON.parse(localStorage.getItem('wd-cart2')) || []; } catch (e) {}
function salvarCart() { try { localStorage.setItem('wd-cart2', JSON.stringify(cart)); } catch (e) {} }
// recalcula sempre a partir do catálogo e das regras de preço (nunca confia em preço salvo)
function itemInfo(it) {
  const f = FAM[it.fam]; if (!f || f instanceof Promise || !visivel(it.fam)) return null;
  const r = PRECOS.item(ctxPreco(it.fam), it);
  if (!r) return null;
  return { unit: r.unit, pct: r.pct, nome: nomeFam(it.fam), img: fotoFam(it.fam), a: r.v.a, prazo: r.v.prazo,
    spec: [...Object.values(r.v.a), ...r.extras.map(x => '+ ' + x[1]), ...r.serv.map(s => '+ ' + s.nome)].join(' - ') };
}
function addCart(silencioso) {
  const { q } = precoSel();
  const it = { fam: sel.slug, vi: sel.vi, sku: q[2], qtd: q[0], ex: [...sel.extras].sort(), sv: [...sel.serv].sort(), n: sel.n };
  const k = JSON.stringify([it.fam, it.sku, it.qtd, it.ex, it.sv]);
  const ja = cart.find(x => JSON.stringify([x.fam, x.sku, x.qtd, [...x.ex].sort(), [...x.sv].sort()]) === k);
  if (ja) ja.n += it.n; else cart.push(it);
  salvarCart(); renderCart();
  if (!silencioso) toast('Adicionado ao carrinho ✔');
}
function comprarAgora() { addCart(true); toggleCart(true); }
function chg(i, d) { cart[i].n += d; if (cart[i].n < 1) cart.splice(i, 1); salvarCart(); renderCart(); }
function rm(i) { cart.splice(i, 1); salvarCart(); renderCart(); }
function clearCart() { if (cart.length && confirm('Esvaziar o carrinho?')) { cart = []; salvarCart(); renderCart(); } }
function cartTotal() { return PRECOS.r2(cart.reduce((s, it) => s + (itemInfo(it)?.unit || 0) * it.n, 0)); }
async function prepararCart() {
  await Promise.all(cart.map(it => R(it.fam) ? famData(it.fam).then(f => { FAM[it.fam] = f; }) : null));
  cart = cart.filter(itemInfo); salvarCart();
}
function renderCart() {
  if (!IDX) return;
  const validos = cart.filter(itemInfo);
  $('count').textContent = validos.reduce((s, i) => s + i.n, 0);
  $('items').innerHTML = validos.length ? cart.map((it, i) => { const x = itemInfo(it); if (!x) return ''; return `
    <div class="item">
      <img src="${esc(x.img)}"${attrFoto(it.fam)} alt="">
      <div><h4>${num(it.qtd)} un — ${esc(x.nome)}</h4><small>${esc(x.spec)}</small>${x.pct ? `<small class="promo-txt">Promoção -${x.pct}%</small>` : ''}
        <div class="qty" style="margin-top:6px"><button onclick="chg(${i},-1)">−</button><b>${it.n}</b><button onclick="chg(${i},1)">+</button></div>
        <button class="rm" onclick="rm(${i})">Remover</button></div>
      <b>${brl(x.unit * it.n)}</b>
    </div>`; }).join('') : '<p style="color:var(--muted);text-align:center;padding:40px 0">Seu carrinho está vazio.</p>';
  $('total').textContent = brl(cartTotal());
}
function toggleCart(o) { $('drawer').classList.toggle('open', o); $('shade').classList.toggle('open', o); }

/* ---------- CHECKOUT: identificação → dados → pagamento ---------- */
let entrega = 'retirada', CONFIG = {};
let cadastro = null, passo = 1, pedidoAtual = null, pararAcompanhar = null;
const so = s => String(s || '').replace(/\D/g, '');
function cpfValido(c) {
  c = so(c); if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  const dv = n => { let s = 0; for (let i = 0; i < n; i++) s += +c[i] * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  return dv(9) === +c[9] && dv(10) === +c[10];
}
function cnpjValido(c) {
  c = so(c); if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false;
  const dv = n => { const p = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const s = p.reduce((a, w, i) => a + w * +c[i], 0) % 11; return s < 2 ? 0 : 11 - s; };
  return dv(12) === +c[12] && dv(13) === +c[13];
}
const fmtDoc = (d, t) => t === 'PJ' ? so(d).replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2}).*/, '$1.$2.$3/$4-$5') : so(d).replace(/^(\d{3})(\d{3})(\d{3})(\d{2}).*/, '$1.$2.$3-$4');
const fmtTel = t => so(t).replace(/^(\d{2})(\d{4,5})(\d{4}).*/, '($1) $2-$3');
const fmtCep = c => so(c).replace(/^(\d{5})(\d{3}).*/, '$1-$2');

// "Minha conta" e "Endereços": mesmo formulário, fora do checkout
async function abrirConta(endereco) {
  $('menu').classList.remove('open'); $('ovPed').classList.add('open');
  $('listaPed').innerHTML = '<p class="muted">Carregando seus dados…</p>';
  await wdPronto;
  cadastro = await WD.meuCadastro(usuario).catch(() => null);
  $('listaPed').innerHTML = `<h4 style="margin-bottom:10px">${endereco ? 'Meu endereço' : 'Meus dados'}</h4>${formCadastro('Salvar')}`;
  aposSalvar = () => { $('listaPed').insertAdjacentHTML('afterbegin', '<p class="ok-msg">✔ Dados atualizados</p>'); };
  if (endereco) setTimeout(() => $('fCad').cep.scrollIntoView({ block: 'center' }), 50);
}
async function checkout() {
  aposSalvar = () => irPasso(3);
  if (!cart.filter(itemInfo).length) { toast('Seu carrinho está vazio'); return; }
  toggleCart(false);
  $('ovCheck').classList.add('open');
  if (!usuario) return irPasso(1);
  await wdPronto;
  $('ckCorpo').innerHTML = '<p class="muted">Carregando seus dados…</p>';
  [cadastro, CONFIG] = await Promise.all([WD.meuCadastro(usuario).catch(e => { console.error(e); return null; }), WD.lerConfig().catch(() => ({}))]);
  irPasso(cadastro ? 3 : 2);
}
function fecharCheckout() {
  aposSalvar = () => irPasso(3);
  $('ovCheck').classList.remove('open');
  if (pararAcompanhar) { pararAcompanhar(); pararAcompanhar = null; }
}
function resumoCarrinho() {
  return `<div class="ck-resumo">${cart.filter(itemInfo).map(it => { const x = itemInfo(it);
    return `<div><span>${it.n}x ${num(it.qtd)} un — ${esc(x.nome)}</span><b>${brl(x.unit * it.n)}</b></div>`; }).join('')}
    <div class="ck-total"><span>Total</span><b>${brl(cartTotal())}</b></div></div>`;
}
function irPasso(p) {
  passo = p;
  document.querySelectorAll('#ckPassos li').forEach((li, i) => { li.classList.toggle('on', i + 1 === p); li.classList.toggle('ok', i + 1 < p); });
  const c = $('ckCorpo');
  if (p === 1) {
    c.innerHTML = `<p>Entre com sua conta Google para salvar seus dados e acompanhar o pedido.</p>
      <button class="btn btn-gold" style="width:100%;justify-content:center" onclick="wdEntrar()">Entrar com Google</button>`;
  } else if (p === 2) {
    c.innerHTML = formCadastro('Continuar para o pagamento');
  } else if (p === 3) {
    const d = cadastro, e = d.endereco;
    const online = window.WD?.pagamentoOnline;
    c.innerHTML = PASSO3(d, e, online);
  }
}
let aposSalvar = () => irPasso(3);
function formCadastro(textoBotao) {
    const d = cadastro || {}, e = d.endereco || {};
    const tipo = d.tipo || 'PF';
    return `<form id="fCad" class="ck-form" onsubmit="event.preventDefault();salvarDados()" novalidate>
      <div class="ck-tipo">
        <label><input type="radio" name="tipo" value="PF" ${tipo === 'PF' ? 'checked' : ''} onchange="trocarTipo()"> Pessoa física</label>
        <label><input type="radio" name="tipo" value="PJ" ${tipo === 'PJ' ? 'checked' : ''} onchange="trocarTipo()"> Pessoa jurídica</label></div>
      <label class="w"><span id="lNome">${tipo === 'PJ' ? 'Razão social' : 'Nome completo'}</span><input name="nome" value="${esc(d.nome || usuario?.displayName || '')}" required maxlength="150" autocomplete="name"></label>
      <label><span id="lDoc">${tipo === 'PJ' ? 'CNPJ' : 'CPF'}</span><input name="doc" value="${esc(d.doc ? fmtDoc(d.doc, tipo) : '')}" inputmode="numeric" required oninput="this.value=fmtDoc(this.value, tipoAtual())"></label>
      <label><span id="lRg">${tipo === 'PJ' ? 'RG do responsável (opcional)' : 'RG'}</span><input name="rg" value="${esc(d.rg || '')}" maxlength="20"></label>
      <label><span>Telefone / WhatsApp</span><input name="telefone" value="${esc(d.telefone ? fmtTel(d.telefone) : '')}" inputmode="tel" required oninput="this.value=fmtTel(this.value)" autocomplete="tel"></label>
      <label><span>E-mail</span><input value="${esc(usuario.email)}" disabled></label>
      <label><span>CEP</span><input name="cep" value="${esc(e.cep ? fmtCep(e.cep) : '')}" inputmode="numeric" required oninput="this.value=fmtCep(this.value);if(so(this.value).length===8)buscarCep(this.value)" autocomplete="postal-code"></label>
      <label class="w"><span>Endereço</span><input name="logradouro" value="${esc(e.logradouro || '')}" required maxlength="150" autocomplete="address-line1"></label>
      <label><span>Número</span><input name="numero" value="${esc(e.numero || '')}" required maxlength="20"></label>
      <label><span>Complemento</span><input name="complemento" value="${esc(e.complemento || '')}" maxlength="80"></label>
      <label><span>Bairro</span><input name="bairro" value="${esc(e.bairro || '')}" required maxlength="80"></label>
      <label><span>Cidade</span><input name="cidade" value="${esc(e.cidade || '')}" required maxlength="80"></label>
      <label><span>UF</span><input name="uf" value="${esc(e.uf || '')}" required maxlength="2" oninput="this.value=this.value.toUpperCase().replace(/[^A-Z]/g,'')"></label>
      <p class="ck-erro" id="ckErro"></p>
      <p class="ck-lgpd">Usamos seus dados só para produzir, entregar e emitir a documentação do seu pedido. Eles ficam protegidos e só você e a equipe do Grupo WD têm acesso.</p>
      <button class="btn btn-gold w" style="justify-content:center">${textoBotao}</button>
    </form>`;
}
function PASSO3(d, e, online) {
    return `${resumoCarrinho()}
      <div class="ck-dados"><b>${esc(d.nome)}</b> · ${d.tipo === 'PJ' ? 'CNPJ' : 'CPF'} ${esc(fmtDoc(d.doc, d.tipo))} · ${esc(fmtTel(d.telefone))}<br>
        ${esc(e.logradouro)}, ${esc(e.numero)}${e.complemento ? ' - ' + esc(e.complemento) : ''} · ${esc(e.bairro)} · ${esc(e.cidade)}/${esc(e.uf)} · ${esc(fmtCep(e.cep))}
        <button class="link" onclick="irPasso(2)">Alterar</button></div>
      <h4 class="ck-h">Entrega</h4>
      <div class="ck-entrega">
        <label class="${entrega === 'retirada' ? 'on' : ''}"><input type="radio" name="entrega" value="retirada" ${entrega === 'retirada' ? 'checked' : ''} onchange="entrega=this.value;irPasso(3)">
          <span><b>Retirar no balcão Grupo WD</b><small>${esc(CONFIG.balcao || 'Endereço do balcão informado pelo WhatsApp')}</small></span><em>Grátis</em></label>
        <label class="${entrega === 'entrega' ? 'on' : ''}"><input type="radio" name="entrega" value="entrega" ${entrega === 'entrega' ? 'checked' : ''} onchange="entrega=this.value;irPasso(3)">
          <span><b>Receber no meu endereço</b><small>${esc(e.logradouro)}, ${esc(e.numero)} · ${esc(e.cidade)}/${esc(e.uf)}</small></span><em>Frete a combinar</em></label>
      </div>
      <label class="ck-obs"><span>Observações do pedido (opcional)</span><textarea id="ckObs" rows="2" maxlength="1000" placeholder="Ex.: prazo, detalhes da arte, retirada..."></textarea></label>
      <h4 class="ck-h">Forma de pagamento</h4>
      <div class="ck-metodos">
        <button ${online ? '' : 'disabled'} onclick="pagarPix()"><i>⚡</i><b>PIX</b><small>${online ? 'QR Code na hora, aprovação imediata' : 'Em breve'}</small></button>
        <button ${online ? '' : 'disabled'} onclick="pagarCartao()"><i>💳</i><b>Cartão de crédito ou débito</b><small>${online ? 'Pagamento seguro pelo Mercado Pago' : 'Em breve'}</small></button>
        <button onclick="pedirWhatsApp()"><i>💬</i><b>Combinar pelo WhatsApp</b><small>Registramos o pedido e você fala com a gente</small></button>
      </div>
      <div id="ckPag"></div>`;
}
const tipoAtual = () => document.querySelector('#fCad [name=tipo]:checked')?.value || 'PF';
function trocarTipo() {
  const pj = tipoAtual() === 'PJ', f = $('fCad');
  $('lNome').textContent = pj ? 'Razão social' : 'Nome completo';
  $('lDoc').textContent = pj ? 'CNPJ' : 'CPF';
  $('lRg').textContent = pj ? 'RG do responsável (opcional)' : 'RG';
  f.doc.value = fmtDoc(f.doc.value, tipoAtual());
}
async function buscarCep(cep) {
  try {
    const r = await (await fetch(`https://viacep.com.br/ws/${so(cep)}/json/`)).json();
    if (r.erro) return;
    const f = $('fCad');
    if (!f.logradouro.value) f.logradouro.value = r.logradouro || '';
    if (!f.bairro.value) f.bairro.value = r.bairro || '';
    f.cidade.value = r.localidade || f.cidade.value; f.uf.value = r.uf || f.uf.value;
    (f.logradouro.value ? f.numero : f.logradouro).focus();
  } catch (e) {}
}
async function salvarDados() {
  const f = $('fCad'), tipo = tipoAtual(), erro = m => { $('ckErro').textContent = m; };
  const cad = {
    tipo, nome: f.nome.value.trim(), doc: so(f.doc.value), rg: f.rg.value.trim(), telefone: so(f.telefone.value),
    endereco: { cep: so(f.cep.value), logradouro: f.logradouro.value.trim(), numero: f.numero.value.trim(), complemento: f.complemento.value.trim(),
      bairro: f.bairro.value.trim(), cidade: f.cidade.value.trim(), uf: f.uf.value.trim().toUpperCase() } };
  if (cad.nome.length < 3) return erro('Preencha o nome completo.');
  if (tipo === 'PF' ? !cpfValido(cad.doc) : !cnpjValido(cad.doc)) return erro(tipo === 'PF' ? 'CPF inválido.' : 'CNPJ inválido.');
  if (tipo === 'PF' && cad.rg.length < 4) return erro('Preencha o RG.');
  if (cad.telefone.length < 10) return erro('Telefone inválido (com DDD).');
  const e = cad.endereco;
  if (e.cep.length !== 8 || !e.logradouro || !e.numero || !e.bairro || !e.cidade || !/^[A-Z]{2}$/.test(e.uf)) return erro('Preencha o endereço completo.');
  const bt = f.querySelector('button'); bt.disabled = true; bt.textContent = 'Salvando…';
  try { await WD.salvarCadastro(usuario, cad); cadastro = await WD.meuCadastro(usuario) || cad; toast('Dados salvos ✔'); aposSalvar(); }
  catch (x) {
    console.error(x); bt.disabled = false; bt.textContent = 'Tentar novamente';
    erro(x.code === 'permission-denied' ? 'Algum dado não foi aceito. Confira CPF/CNPJ, telefone com DDD e o endereço completo.' : 'Não foi possível salvar agora (' + (x.code || 'erro') + '). Tente novamente.');
  }
}
const dadosEntrega = () => entrega === 'retirada' ? { tipo: 'retirada', local: String(CONFIG.balcao || '').slice(0, 300) } : { tipo: 'entrega' };
const itensPedido = () => cart.filter(itemInfo).map(it => ({ fam: it.fam, sku: it.sku, vi: it.vi, qtd: it.qtd, ex: it.ex, sv: it.sv, n: it.n }));
function msgWhats(num6, itens, total, obs) {
  let m = `Olá, Grupo WD! Fiz o pedido nº ${num6} pelo site:\n\n`;
  itens.forEach(i => { m += `• ${i.q}x ${i.un} — ${i.nome}\n   ${i.spec}\n   ${brl(i.preco * i.q)}\n`; });
  m += `\n*Total: ${brl(total)}*\n\nNome: ${cadastro.nome}\n${entrega === 'retirada' ? 'Retirada no balcão Grupo WD' : 'Entrega no endereço cadastrado'}`;
  if (obs) m += `\nObs.: ${obs}`;
  return m;
}
async function pedirWhatsApp() {
  const obs = $('ckObs').value.trim();
  const itens = cart.filter(itemInfo).map(it => { const x = itemInfo(it); return {
    id: it.sku, fam: it.fam, nome: x.nome, spec: x.spec, un: un(it.qtd), qtd: it.qtd, ex: it.ex, sv: it.sv, q: it.n, preco: x.unit,
    a: x.a, prazo: x.prazo || '', img: x.img }; });
  const total = cartTotal();
  const win = window.open('', '_blank');
  try {
    const ref = await WD.criarPedido(usuario, { nome: cadastro.nome, obs, itens, total, entrega: dadosEntrega(), cliente: await WD.meuCadastro(usuario) });
    const num6 = ref.id.slice(0, 6).toUpperCase();
    if (win) win.location = waUrl(msgWhats(num6, itens, total, obs)); else location.href = waUrl(msgWhats(num6, itens, total, obs));
    concluir(ref.id, num6, 'Pedido registrado! Continue a conversa no WhatsApp para combinar o pagamento.');
  } catch (e) { console.error(e); win?.close(); toast('Não foi possível registrar o pedido. Tente novamente.'); }
}
async function pagarPix() {
  $('ckPag').innerHTML = '<p class="muted">Gerando o PIX…</p>';
  try {
    const r = await WD.pagar({ itens: itensPedido(), obs: $('ckObs').value.trim(), metodo: 'pix', entrega: dadosEntrega() });
    $('ckPag').innerHTML = `<div class="pix">
      <h4>Pague com PIX — ${brl(r.total)}</h4>
      ${r.qrBase64 ? `<img src="data:image/png;base64,${esc(r.qrBase64)}" alt="QR Code PIX">` : ''}
      <label><span>PIX copia e cola</span><textarea readonly rows="3" id="pixCod">${esc(r.copiaCola || '')}</textarea></label>
      <button class="btn btn-gold" onclick="navigator.clipboard.writeText($('pixCod').value);toast('Código copiado ✔')">Copiar código</button>
      <p class="muted">Pedido nº ${esc(r.pedidoId.slice(0, 6).toUpperCase())}. Assim que o pagamento for confirmado, esta tela atualiza sozinha.</p></div>`;
    acompanhar(r.pedidoId);
  } catch (e) { console.error(e); $('ckPag').innerHTML = `<p class="ck-erro">${esc(e.message || 'Não foi possível gerar o PIX.')} Você pode combinar pelo WhatsApp.</p>`; }
}
let mpCarregado = null;
async function pagarCartao() {
  $('ckPag').innerHTML = '<div id="mpCartao"></div><p class="muted" id="mpMsg">Carregando pagamento seguro…</p>';
  mpCarregado = mpCarregado || new Promise((ok, erro) => { const s = document.createElement('script'); s.src = 'https://sdk.mercadopago.com/js/v2'; s.onload = ok; s.onerror = erro; document.head.appendChild(s); });
  try {
    await mpCarregado;
    const mp = new MercadoPago(WD.MP_PUBLIC_KEY, { locale: 'pt-BR' });
    await mp.bricks().create('cardPayment', 'mpCartao', {
      initialization: { amount: cartTotal(), payer: { email: usuario.email, identification: { type: cadastro.tipo === 'PJ' ? 'CNPJ' : 'CPF', number: cadastro.doc } } },
      customization: { paymentMethods: { types: { included: ['credit_card', 'debit_card'] }, maxInstallments: 12 } },
      callbacks: {
        onReady: () => { $('mpMsg').textContent = 'Os dados do cartão vão direto para o Mercado Pago, com segurança — não ficam no nosso site.'; },
        onSubmit: async dados => {
          const r = await WD.pagar({ itens: itensPedido(), obs: $('ckObs').value.trim(), metodo: 'cartao', cartao: dados, entrega: dadosEntrega() });
          if (r.status === 'aprovado') concluir(r.pedidoId, r.pedidoId.slice(0, 6).toUpperCase(), 'Pagamento aprovado! Seu pedido já está com a nossa equipe.');
          else if (r.status === 'pendente') { $('mpMsg').textContent = 'Pagamento em análise. Avisaremos quando for aprovado.'; acompanhar(r.pedidoId); }
          else throw new Error('Pagamento recusado. Confira os dados ou tente outro cartão.');
        },
        onError: e => { console.error(e); $('mpMsg').textContent = 'Não foi possível processar o cartão.'; },
      },
    });
  } catch (e) { console.error(e); $('ckPag').innerHTML = '<p class="ck-erro">O pagamento com cartão está indisponível agora. Tente o PIX ou combine pelo WhatsApp.</p>'; }
}
function acompanhar(id) {
  if (pararAcompanhar) pararAcompanhar();
  pararAcompanhar = WD.acompanharPedido(id, p => {
    if (p?.pagamento?.status === 'aprovado') concluir(id, id.slice(0, 6).toUpperCase(), 'Pagamento confirmado! Seu pedido já está com a nossa equipe.');
  });
}
function concluir(id, num6, texto) {
  if (pararAcompanhar) { pararAcompanhar(); pararAcompanhar = null; }
  pedidoAtual = id;
  cart = []; salvarCart(); renderCart();
  document.querySelectorAll('#ckPassos li').forEach(li => { li.classList.remove('on'); li.classList.add('ok'); });
  const arte = window.WD?.UPLOAD_ARTE;
  $('ckCorpo').innerHTML = `<div class="ck-ok"><div class="ck-check">✔</div><h3>Pedido nº ${esc(num6)}</h3><p>${esc(texto)}</p>
    ${arte ? `<label class="ck-arte"><span>Envie o arquivo da arte (PDF, AI, CDR, PNG ou JPG — até 60 MB)</span><input type="file" id="arqArte" onchange="enviarArte(this.files[0])"><small id="arteMsg"></small></label>`
      : `<p class="muted">Tem o arquivo da arte? Envie pelo WhatsApp informando o nº do pedido.</p>`}
    <div class="ck-acoes"><a class="btn btn-wa" target="_blank" rel="noopener" href="${waUrl(`Olá, Grupo WD! Sobre o pedido nº ${num6}:`)}">💬 Falar no WhatsApp</a>
    <button class="btn btn-light" onclick="fecharCheckout();abrirMeusPedidos()">Ver meus pedidos</button></div></div>`;
}
async function enviarArte(arq) {
  if (!arq) return;
  if (arq.size > 60 * 1024 * 1024) { $('arteMsg').textContent = 'Arquivo maior que 60 MB. Envie pelo WhatsApp.'; return; }
  try {
    await WD.enviarArte(usuario, pedidoAtual, arq, p => { $('arteMsg').textContent = `Enviando… ${Math.round(p * 100)}%`; });
    $('arteMsg').textContent = 'Arte enviada ✔';
  } catch (e) { console.error(e); $('arteMsg').textContent = 'Não foi possível enviar. Mande pelo WhatsApp.'; }
}

/* ---------- CONTA (Google) ---------- */
let usuario = null;
function wdEntrar() { wdPronto.then(() => WD.entrar()).catch(e => alert('Não foi possível entrar: ' + e.message)); }
function wdSair() { $('menu').classList.remove('open'); window.WD?.sair(); }
function setUsuario(u, admin) {
  usuario = u;
  $('btnLogin').style.display = u ? 'none' : 'flex';
  $('avatar').style.display = u ? 'flex' : 'none';
  if (u) {
    $('avatarImg').src = u.photoURL || 'img/icon-192.png';
    $('olaNome').textContent = 'Olá, ' + String(u.displayName || 'Cliente').split(' ')[0];
    $('uNome').textContent = u.displayName || 'Cliente';
    $('uEmail').textContent = u.email || '';
  }
  $('lnkAdmin').style.display = admin ? 'block' : 'none';
  // login feito durante o checkout: segue para os dados
  if (u && $('ovCheck').classList.contains('open') && passo === 1) checkout();
}
const STATUS = { aguardando_pagamento: 'Aguardando pagamento', arte_analise: 'Arte em análise', producao: 'Em produção',
  pronto: 'Pronto para envio/retirada', finalizado: 'Finalizado', cancelado: 'Cancelado',
  novo: 'Aguardando pagamento', entregue: 'Finalizado' };
const PAGTO = { pix: 'PIX', cartao: 'Cartão', whatsapp: 'Combinar pelo WhatsApp' };
const STATUS_ANTIGO = { novo: 'aguardando_pagamento', entregue: 'finalizado' };
const ORDEM_ST = ['aguardando_pagamento', 'arte_analise', 'producao', 'pronto', 'finalizado'];
const dtTs = t => t?.seconds ? new Date(t.seconds * 1000) : null;
const dataCurta = d => d ? d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
function somarDiasUteis(d, n) { const x = new Date(d); while (n > 0) { x.setDate(x.getDate() + 1); if (x.getDay() % 6) n--; } return x; }
const diasPrazo = t => parseInt((String(t || '').match(/(\d+)\s*dias?\s*út/i) || [])[1] || 0, 10);
let pedidosCache = [];
function etapas(p) {
  const retirada = p.entrega?.tipo !== 'entrega';
  return [
    ['aguardando_pagamento', 'Pedido recebido', dtTs(p.criadoEm)],
    ['pago', 'Pagamento confirmado', dtTs(p.etapas?.pago)],
    ['arte_analise', 'Arquivo em análise', dtTs(p.etapas?.arte_analise)],
    ['producao', 'Produzindo', dtTs(p.etapas?.producao)],
    ['pronto', retirada ? 'Disponível para retirada' : 'Preparando para envio', dtTs(p.etapas?.pronto)],
    ['finalizado', retirada ? 'Retirado' : 'Entregue', dtTs(p.etapas?.finalizado)],
  ];
}
function trilha(p) {
  const st = STATUS_ANTIGO[p.status] || p.status;
  if (st === 'cancelado') return '<p class="cancelado">Pedido cancelado</p>';
  const pago = p.pagamento?.status === 'aprovado';
  const passo = { aguardando_pagamento: pago ? 1 : 0, arte_analise: 2, producao: 3, pronto: 4, finalizado: 5 }[st] ?? 0;
  return `<ol class="trilha">${etapas(p).map(([k, nome, d], i) => `<li class="${i < passo ? 'ok' : i === passo ? 'atual' : ''}">
    <i>${i < passo ? '✓' : ''}</i><b>${esc(nome)}</b><small>${i <= passo && d ? esc(dataCurta(d)) : ''}</small></li>`).join('')}</ol>`;
}
function previsao(p) {
  const dias = Math.max(0, ...(p.itens || []).map(i => diasPrazo(i.prazo)));
  if (!dias) return '';
  const base = dtTs(p.etapas?.pago) || (p.pagamento?.status === 'aprovado' ? dtTs(p.criadoEm) : null);
  const ret = p.entrega?.tipo !== 'entrega';
  const prev = base ? somarDiasUteis(base, dias) : null;
  return `Produção: ${dias} dia${dias > 1 ? 's' : ''} út${dias > 1 ? 'eis' : 'il'}${ret ? '' : ' + frete'}${prev ? ` · Previsão ${ret ? 'para retirada' : 'de envio'}: <b>${prev.toLocaleDateString('pt-BR')}</b>` : ' · o prazo começa após a confirmação do pagamento e a aprovação da arte'}`;
}
async function abrirMeusPedidos() {
  $('menu').classList.remove('open'); $('ovPed').classList.add('open');
  $('listaPed').innerHTML = '<p style="color:var(--muted)">Carregando...</p>';
  try {
    pedidosCache = await WD.meusPedidos(usuario);
    if (!CONFIG.balcao) CONFIG = await WD.lerConfig().catch(() => ({}));
    $('listaPed').innerHTML = pedidosCache.length ? pedidosCache.map((p, i) => `<button class="ped-linha" onclick="verPedido(${i})">
      <span><b>Pedido ${esc(p.id.slice(0, 6).toUpperCase())}</b><small>${dtTs(p.criadoEm)?.toLocaleDateString('pt-BR') || ''} · ${(p.itens || []).length} item(ns)</small></span>
      <span class="st st-${esc(STATUS_ANTIGO[p.status] || p.status)}">${esc(STATUS[p.status] || p.status)}</span><b>${brl(p.total)}</b><em>›</em></button>`).join('')
      : '<p style="color:var(--muted)">Você ainda não fez pedidos.</p>';
  } catch (e) { $('listaPed').innerHTML = '<p>Erro ao carregar pedidos.</p>'; console.error(e); }
}
function verPedido(i) {
  const p = pedidosCache[i], pg = p.pagamento || { metodo: 'whatsapp', status: 'pendente' };
  const num6 = p.id.slice(0, 6).toUpperCase(), ret = p.entrega?.tipo !== 'entrega', e = p.cliente?.endereco;
  const soma = (p.itens || []).reduce((s, x) => s + x.preco * x.q, 0);
  $('listaPed').innerHTML = `<button class="link" onclick="abrirMeusPedidos()">‹ Meus pedidos</button>
    <div class="pd-hd"><div><h4>Pedido ${esc(num6)}</h4><small>Emitido em ${esc(dtTs(p.criadoEm)?.toLocaleString('pt-BR') || '')}</small></div>
      <span class="st ${pg.status === 'aprovado' ? 'st-pronto' : 'st-aguardando_pagamento'}">${pg.status === 'aprovado' ? '✓ Pagamento confirmado' : 'Aguardando pagamento'}</span></div>
    <h5 class="pd-sec">Itens do pedido</h5>
    ${(p.itens || []).map((x, k) => `<div class="pd-item">
      <div class="pd-top"><img src="${esc(x.img || (R(x.fam) ? fotoFam(x.fam) : 'img/sem-foto.webp'))}" alt=""><div><small>Item ${k + 1} de ${p.itens.length}${x.id ? ' · SKU ' + esc(x.id) : ''}</small><b>${esc(x.nome)}</b></div>
        <div class="pd-val"><small>${x.q > 1 ? x.q + ' × ' : ''}${esc(x.un || '')}</small><b>${brl(x.preco * x.q)}</b></div></div>
      ${x.a ? `<dl class="pd-attrs">${Object.entries(x.a).map(([a, v]) => `<dt>${esc(a === 'Enobrecimento' ? 'Cobertura' : a === 'Cor' ? 'Cores' : a)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>` : `<p class="muted">${esc(x.spec || '')}</p>`}
      ${p.arte && k === 0 ? `<p class="pd-arq">📎 ${esc(p.arte.nome)}</p>` : ''}
      ${trilha(p)}
      ${x.prazo ? `<p class="pd-prazo">${previsao({ ...p, itens: [x] })}</p>` : ''}
    </div>`).join('')}
    <h5 class="pd-sec">${ret ? 'Informações de retirada' : 'Endereço de entrega'}</h5>
    <div class="pd-box">${ret
      ? `Você escolheu retirar seu pedido no nosso balcão:<br><b>Grupo WD</b><br>${esc(p.entrega?.local || CONFIG.balcao || 'Endereço informado pelo WhatsApp')}
         ${CONFIG.horario ? `<p style="margin-top:8px"><b>Horário de funcionamento</b><br>${esc(CONFIG.horario).replace(/\n/g, '<br>')}</p>` : ''}
         <p class="muted" style="margin-top:6px">Outra pessoa vai retirar? Avise pelo WhatsApp informando o nome e o documento dela.</p>`
      : e ? `${esc(e.logradouro)}, ${esc(e.numero)}${e.complemento ? ' - ' + esc(e.complemento) : ''}<br>${esc(e.bairro)} · ${esc(e.cidade)}/${esc(e.uf)} · CEP ${esc(fmtCep(e.cep))}<p class="muted" style="margin-top:6px">O valor e o prazo do frete são combinados pelo WhatsApp.</p>` : '—'}</div>
    <h5 class="pd-sec">Totais</h5>
    <div class="pd-box pd-tot"><div><span>Valor dos itens</span><span>${brl(soma)}</span></div>
      <div><span>${ret ? 'Retirada no balcão' : 'Frete'}</span><span>${ret ? brl(0) : 'a combinar'}</span></div>
      <div class="t"><span>Total</span><span>${brl(p.total)}</span></div></div>
    <h5 class="pd-sec">Pagamento</h5>
    <div class="pd-box pd-pg"><span><b>${pg.metodo === 'whatsapp' ? 'Combinado pelo WhatsApp' : 'Pago com ' + esc(PAGTO[pg.metodo] || pg.metodo)}</b><br><small>${dtTs(p.etapas?.pago || p.criadoEm)?.toLocaleDateString('pt-BR') || ''}</small></span>
      <span class="st ${pg.status === 'aprovado' ? 'st-pronto' : 'st-aguardando_pagamento'}">${pg.status === 'aprovado' ? 'Pagamento confirmado' : 'Pendente'}</span></div>
    <h5 class="pd-sec">Prazo de entrega</h5>
    <div class="pd-box pd-passos">
      <div><i>1</i><b>Início da contagem</b><p>O prazo começa a contar depois que o pagamento é confirmado e a arte é aprovada.</p></div>
      <div><i>2</i><b>Produção</b><p>Cada produto tem seu próprio prazo de produção, mostrado em cada item acima.</p></div>
      <div><i>3</i><b>${ret ? 'Retirada' : 'Envio e entrega'}</b><p>${ret ? 'Avisamos quando o pedido estiver disponível no balcão.' : 'Depois da produção, o pedido é enviado e você recebe o rastreio pelo WhatsApp.'}</p></div>
    </div>
    <a class="btn btn-wa" style="margin-top:14px" target="_blank" rel="noopener" href="${waUrl(`Olá, Grupo WD! Preciso de ajuda com o pedido nº ${num6}.`)}">💬 Solicitar atendimento</a>`;
}
document.addEventListener('click', e => { if (!e.target.closest('#acct')) $('menu').classList.remove('open'); });

/* ---------- utilidades ---------- */
let tt; function toast(t) { const el = $('toast'); el.textContent = t; el.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => el.classList.remove('show'), 1800); }
document.addEventListener('keydown', e => { if (e.key === 'Escape') { toggleCart(false); fecharCheckout(); fecharMenu(); $('ovPed').classList.remove('open'); $('filtros')?.classList.remove('open'); } });
function doSearch(e) {
  e?.preventDefault();
  const t = $('q').value.trim();
  if (t) location.hash = '#/busca/' + encodeURIComponent(t);
}

/* ---------- app instalável ---------- */
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
let installEvt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; $('btnInstall').style.display = 'flex'; });
window.addEventListener('appinstalled', () => { $('btnInstall').style.display = 'none'; toast('App instalado ✔'); });
function installApp() { if (installEvt) { installEvt.prompt(); installEvt = null; $('btnInstall').style.display = 'none'; } }

/* ---------- início ---------- */
['waTop', 'waFloat'].forEach(id => $(id).href = waUrl('Olá, Grupo WD! Gostaria de um orçamento.'));
$('year').textContent = new Date().getFullYear();
Promise.all([carregarIndice(), carregarAjustes()]).then(async () => { aplicarAjustes(); montarMenu(); render(); await prepararCart(); renderCart(); })
  .catch(e => { $('app').innerHTML = '<div class="wrap empty">Não foi possível carregar o catálogo. Tente novamente.</div>'; console.error(e); });

