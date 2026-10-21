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
const FAM = {};            // data/p/<produto>.json carregados
let AJUSTES = {};          // ajustes do ADM (Firestore)
let MULT = 2.5;
const P = v => Math.round(v * MULT * 100) / 100;   // preço final = referência × multiplicador
const PAI = {};            // categoria -> { dep, grupo }

/* ---------- dados ---------- */
async function carregarIndice() {
  IDX = await (await fetch('data/indice.json', { cache: 'no-cache' })).json();
  MULT = IDX.mult || 2.5;
  IDX.menu.forEach(d => {
    PAI[d.s] = { dep: d };
    d.g.forEach(g => { if (g.s) PAI[g.s] = { dep: d, grupo: g }; g.f.forEach(x => { PAI[x.s] = { dep: d, grupo: g, item: x }; }); });
  });
}
async function famData(slug) {
  if (!FAM[slug]) FAM[slug] = fetch(`data/p/${slug}.json`).then(r => r.ok ? r.json() : null).catch(() => null);
  return FAM[slug];
}
const R = slug => IDX.fams[slug];
const visivel = slug => R(slug) && AJUSTES[slug]?.ativo !== false;
const nomeFam = slug => AJUSTES[slug]?.nome || R(slug).n;
const fotoFam = slug => R(slug).img || R(slug).imgAlt || 'img/sem-foto.webp';
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
  const tag = AJUSTES[slug]?.destaque ? '<span class="tag">Mais vendido</span>' : '';
  return `<a class="card" href="#/p/${slug}?v=${p.vi}&q=${p.q}">
    <div class="ph"><img src="${esc(fotoFam(slug))}" alt="${esc(nomeFam(slug))}" loading="lazy">${tag}</div>
    <div class="bd">
      <h3>${esc(nomeFam(slug))}</h3>
      <div class="spec">${esc(p.s)}</div>
      <div class="price"><small>a partir de</small> ${brl(P(p.t))} <small>/ ${num(p.q)} un</small></div>
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
    <div class="circulos">${deps.map(d => `<a href="#/c/${d.s}"><span><img src="${esc(fotoFam(famsDe(d.s)[0]))}" alt="" loading="lazy"></span>${esc(d.n)}</a>`).join('')}</div>
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
    <div class="banner"><div><h1>${esc(c.n)}</h1><p>${esc(t.sub)}</p></div><img src="${esc(fotoFam(fams[0]))}" alt=""></div>
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
  const f = FAM[sel.slug], v = f.vars[sel.vi];
  const q = v.q.find(x => x[0] === sel.qtd) || v.q[0];
  const extras = (v.x || []).filter(x => sel.extras.has(x[0]));
  const serv = IDX.servicos.filter(s => sel.serv.has(s.id));
  const unit = P(q[1]) + extras.reduce((a, x) => a + P(x[3]), 0) + serv.reduce((a, s) => a + P(s.preco), 0);
  const dias = extras.reduce((a, x) => a + (x[2] || 0), 0);
  return { f, v, q, extras, serv, unit: Math.round(unit * 100) / 100, total: Math.round(unit * sel.n * 100) / 100, dias };
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
function desenharProduto() {
  const { f, v, q, extras, serv, unit, total, dias } = precoSel();
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
    const u = P(tot) / qt, desc = Math.round((1 - (tot / qt) / base) * 100);
    return `<tr class="${qt === sel.qtd ? 'on' : ''}" onclick="escolherQtd(${qt})">
      <td><label><input type="radio" name="qtd" ${qt === sel.qtd ? 'checked' : ''}> ${un(qt)}</label></td>
      <td><small>${brl(u < 0.01 ? 0.01 : u).replace(/(,\d{2})\d*/, '$1')}/un</small>${desc > 0 ? ` <em class="off">-${desc}%</em>` : ''}</td>
      <td><b>${brl(P(tot))}</b></td></tr>`;
  }).join('');
  const ex = (v.x || []).length ? `<div class="opc"><span>Gostaria de adicionar um acabamento extra?</span><div class="extras">${v.x.map(x =>
    `<label class="${sel.extras.has(x[0]) ? 'on' : ''}"><input type="checkbox" ${sel.extras.has(x[0]) ? 'checked' : ''} onchange="toggleExtra(${x[0]}, this.checked)">
      <span>${esc(x[1])} <small>${x[2] ? `(+ ${x[2]} dia${x[2] > 1 ? 's' : ''})` : ''}</small></span><b>+ ${brl(P(x[3]))}</b></label>`).join('')}</div></div>` : '';
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
      <div class="galeria"><img src="${esc(fotoFam(sel.slug))}" alt="${esc(nomeFam(sel.slug))}"></div>
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
    <article class="texto">${t.desc}</article>
    ${rel.length ? `<div class="sec-title"><h2>Produtos relacionados</h2></div><div class="grid">${rel.map(s => card(s)).join('')}</div>` : ''}
  </div>
  <div class="buybar"><div class="wrap">
    <div class="bb-txt"><small>${esc(nomeConfig)}</small><b>${brl(total)}</b>${sel.n > 1 ? `<small>${sel.n} × ${brl(unit)}</small>` : ''}</div>
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
  sel.vi = best; sel.qtd = qtd; sel.extras = new Set(); desenharProduto();
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
// recalcula sempre a partir do catálogo (nunca confia em preço salvo)
function itemInfo(it) {
  const f = FAM[it.fam]; if (!f || f instanceof Promise || !visivel(it.fam)) return null;
  const v = f.vars.find(x => x.q.some(q => q[2] === it.sku)) || f.vars[it.vi];
  if (!v) return null;
  const q = v.q.find(x => x[2] === it.sku) || v.q.find(x => x[0] === it.qtd); if (!q) return null;
  const extras = (v.x || []).filter(x => it.ex.includes(x[0]));
  const serv = IDX.servicos.filter(s => it.sv.includes(s.id));
  const unit = Math.round((P(q[1]) + extras.reduce((a, x) => a + P(x[3]), 0) + serv.reduce((a, s) => a + P(s.preco), 0)) * 100) / 100;
  return { unit, nome: nomeFam(it.fam), img: fotoFam(it.fam),
    spec: [...Object.values(v.a), ...extras.map(x => '+ ' + x[1]), ...serv.map(s => '+ ' + s.nome)].join(' - ') };
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
function cartTotal() { return Math.round(cart.reduce((s, it) => s + (itemInfo(it)?.unit || 0) * it.n, 0) * 100) / 100; }
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
      <img src="${esc(x.img)}" alt="">
      <div><h4>${num(it.qtd)} un — ${esc(x.nome)}</h4><small>${esc(x.spec)}</small>
        <div class="qty" style="margin-top:6px"><button onclick="chg(${i},-1)">−</button><b>${it.n}</b><button onclick="chg(${i},1)">+</button></div>
        <button class="rm" onclick="rm(${i})">Remover</button></div>
      <b>${brl(x.unit * it.n)}</b>
    </div>`; }).join('') : '<p style="color:var(--muted);text-align:center;padding:40px 0">Seu carrinho está vazio.</p>';
  $('total').textContent = brl(cartTotal());
}
function toggleCart(o) { $('drawer').classList.toggle('open', o); $('shade').classList.toggle('open', o); }

async function checkout() {
  const validos = cart.filter(itemInfo);
  if (!validos.length) { toast('Seu carrinho está vazio'); return; }
  if (window.WD?.configurado && !usuario) {
    if (confirm('Entre com sua conta Google para acompanhar seu pedido em "Meus pedidos".\n\nOK = entrar com Google\nCancelar = enviar só pelo WhatsApp')) { wdEntrar(); return; }
  }
  const nome = $('cName').value.trim() || usuario?.displayName || '', obs = $('cObs').value.trim();
  const itens = validos.map(it => { const x = itemInfo(it); return {
    id: it.sku, fam: it.fam, nome: x.nome, spec: x.spec, un: un(it.qtd), qtd: it.qtd, ex: it.ex, sv: it.sv, q: it.n, preco: x.unit }; });
  const total = cartTotal();
  const win = window.open('', '_blank');
  let num6 = '';
  if (usuario) {
    try { const ref = await WD.criarPedido(usuario, { nome, obs, itens, total }); num6 = ref.id.slice(0, 6).toUpperCase(); }
    catch (e) { console.error(e); }
  }
  let msg = `Olá, Grupo WD! Gostaria de fazer um pedido${num6 ? ' (nº ' + num6 + ')' : ''}:\n\n`;
  itens.forEach(i => { msg += `• ${i.q}x ${i.un} — ${i.nome}\n   ${i.spec}\n   ${brl(i.preco * i.q)}\n`; });
  msg += `\n*Total: ${brl(total)}*`;
  if (nome) msg += `\n\nNome: ${nome}`;
  if (usuario?.email) msg += `\nE-mail: ${usuario.email}`;
  if (obs) msg += `\nObs.: ${obs}`;
  if (win) win.location = waUrl(msg); else location.href = waUrl(msg);
  if (num6) { cart = []; salvarCart(); renderCart(); toggleCart(false); toast('Pedido ' + num6 + ' registrado ✔'); }
}

/* ---------- CONTA (Google) ---------- */
let usuario = null;
function wdEntrar() { if (window.WD) WD.entrar().catch(e => alert('Não foi possível entrar: ' + e.message)); else alert('Carregando, tente novamente em instantes.'); }
function wdSair() { $('menu').classList.remove('open'); window.WD?.sair(); }
function setUsuario(u, admin) {
  usuario = u;
  $('btnLogin').style.display = u ? 'none' : 'flex';
  $('avatar').style.display = u ? 'block' : 'none';
  if (u) {
    $('avatar').src = u.photoURL || 'img/icon-192.png';
    $('uNome').textContent = u.displayName || 'Cliente';
    $('uEmail').textContent = u.email || '';
    if (!$('cName').value) $('cName').value = u.displayName || '';
  }
  $('lnkAdmin').style.display = admin ? 'block' : 'none';
}
const STATUS = { novo: 'Recebido', producao: 'Em produção', pronto: 'Pronto / enviado', entregue: 'Entregue', cancelado: 'Cancelado' };
async function abrirMeusPedidos() {
  $('menu').classList.remove('open'); $('ovPed').classList.add('open');
  $('listaPed').innerHTML = '<p style="color:var(--muted)">Carregando...</p>';
  try {
    const l = await WD.meusPedidos(usuario);
    $('listaPed').innerHTML = l.length ? l.map(p => `<div class="ped">
      <div style="display:flex;justify-content:space-between;gap:8px"><b>Pedido ${esc(p.id.slice(0, 6).toUpperCase())}</b><span class="st st-${esc(p.status)}">${esc(STATUS[p.status] || p.status)}</span></div>
      <div style="color:var(--muted);margin:4px 0">${p.criadoEm ? new Date(p.criadoEm.seconds * 1000).toLocaleString('pt-BR') : ''}</div>
      ${(p.itens || []).map(i => `<div>${esc(i.q)}x ${esc(i.un || '')} — ${esc(i.nome)}</div>`).join('')}
      <div style="font-weight:800;margin-top:6px">${brl(p.total)}</div></div>`).join('') : '<p style="color:var(--muted)">Você ainda não fez pedidos.</p>';
  } catch (e) { $('listaPed').innerHTML = '<p>Erro ao carregar pedidos.</p>'; console.error(e); }
}
document.addEventListener('click', e => { if (!e.target.closest('#acct')) $('menu').classList.remove('open'); });

/* ---------- utilidades ---------- */
let tt; function toast(t) { const el = $('toast'); el.textContent = t; el.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => el.classList.remove('show'), 1800); }
document.addEventListener('keydown', e => { if (e.key === 'Escape') { toggleCart(false); fecharMenu(); $('ovPed').classList.remove('open'); $('filtros')?.classList.remove('open'); } });
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
carregarIndice().then(async () => { montarMenu(); render(); await prepararCart(); renderCart(); })
  .catch(e => { $('app').innerHTML = '<div class="wrap empty">Não foi possível carregar o catálogo. Tente novamente.</div>'; console.error(e); });
window.setAjustes = a => { AJUSTES = a || {}; if (IDX) { montarMenu(); render(); renderCart(); } };
