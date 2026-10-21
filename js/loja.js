/* ===== Grupo WD — loja (catálogo, categorias, produto, carrinho, conta) ===== */
const WHATSAPP = '5511949632186';
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const brl = v => (+v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const num = v => (+v).toLocaleString('pt-BR');
const waUrl = msg => `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(msg)}`;
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

let CAT = null;                       // catálogo (data/catalogo.json)
let AJUSTES = {};                     // ajustes do ADM por produto (Firestore)
let MULT = 2.5;
const P = v => Math.round(v * MULT * 100) / 100;   // preço final = referência × multiplicador

/* ---------- catálogo ---------- */
async function carregarCatalogo() {
  const r = await fetch('data/catalogo.json', { cache: 'no-cache' });
  CAT = await r.json();
  MULT = CAT.mult || 2.5;
}
const fam = slug => CAT.fams[slug];
const visivel = slug => fam(slug) && AJUSTES[slug]?.ativo !== false;
const nomeFam = slug => AJUSTES[slug]?.nome || fam(slug).nome;
const catsVisiveis = () => CAT.cats.filter(c => c.fams.some(visivel));
const imgFam = (f, v) => (v && v.img) || f.img || 'img/icon-512.png';
const qtdsMin = v => v.q.reduce((m, q) => (q[1] < m[1] ? q : m), v.q[0]);
// combinação/quantidade mais barata (para o "a partir de")
function maisBarato(f, filtro) {
  let best = null;
  f.vars.forEach((v, vi) => {
    if (filtro && !filtro(v)) return;
    v.q.forEach(q => { if (!best || q[1] < best.q[1]) best = { v, vi, q }; });
  });
  return best;
}
function resumoVar(v) {
  const a = v.a;
  return [a.Formato, a.Cor && a.Cor.replace(/^4x[014] - /, ''), a.Acabamento].filter(Boolean).join(' - ');
}

/* ---------- roteador ---------- */
function rota() {
  const h = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
  const [path, qs] = h.split('?');
  const parts = path.split('/').filter(Boolean);
  const params = Object.fromEntries(new URLSearchParams(qs || ''));
  return { parts, params };
}
function ir(hash) { location.hash = hash; }
window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });

function render() {
  if (!CAT) return;
  const { parts, params } = rota();
  renderNav(parts);
  const [tipo, slug] = parts;
  if (tipo === 'c' && CAT.cats.find(c => c.slug === slug)) return pgCategoria(slug);
  if (tipo === 'p' && fam(slug) && visivel(slug)) return pgProduto(slug, params);
  if (tipo === 'busca') return pgBusca(slug || '');
  pgHome();
}

function renderNav(parts) {
  const atual = parts[0] === 'c' ? parts[1] : parts[0] === 'p' && fam(parts[1]) ? fam(parts[1]).cat : '';
  $('cats').innerHTML = `<a class="${!parts.length ? 'on' : ''}" href="#/">Início</a>` +
    catsVisiveis().map(c => `<a class="${c.slug === atual ? 'on' : ''}" href="#/c/${c.slug}">${esc(c.nome)}</a>`).join('');
  $('footCats').innerHTML = catsVisiveis().map(c => `<li><a href="#/c/${c.slug}">${esc(c.nome)}</a></li>`).join('');
}

/* ---------- cards ---------- */
function card(slug, filtro, qtdFixa) {
  const f = fam(slug);
  const b = maisBarato(f, v => (!filtro || filtro(v)) && (!qtdFixa || v.q.some(q => qtdFixa.includes(q[0]))));
  if (!b) return '';
  let q = b.q;
  if (qtdFixa) q = b.v.q.filter(x => qtdFixa.includes(x[0])).sort((x, y) => x[1] - y[1])[0];
  const tag = AJUSTES[slug]?.destaque ? '<span class="tag">Mais vendido</span>' : f.tag ? `<span class="tag new">${esc(f.tag)}</span>` : '';
  return `<a class="card" href="#/p/${slug}?v=${b.vi}&q=${q[0]}">
    <div class="ph"><img src="${esc(imgFam(f))}" alt="${esc(nomeFam(slug))}" loading="lazy">${tag}</div>
    <div class="bd">
      <div class="cat">${esc(CAT.cats.find(c => c.slug === f.cat)?.nome || '')}</div>
      <h3>${esc(nomeFam(slug))}</h3>
      <div class="spec">${esc(resumoVar(b.v))}</div>
      <div class="price"><small>a partir de</small> ${brl(P(q[1]))} <small>/ ${num(q[0])} un</small></div>
    </div></a>`;
}

/* ---------- HOME ---------- */
function pgHome() {
  document.title = 'Grupo WD | Gráfica Online';
  const cats = catsVisiveis();
  $('app').innerHTML = `
  <div class="hero"><div class="wrap">
    <div>
      <h1>Sua gráfica online.<br><em>Pensou, a gente faz!</em></h1>
      <p>Cartões de visita, adesivos, folhetos, banners, brindes, embalagens e muito mais — monte do seu jeito e veja o preço na hora.</p>
      <div class="cta"><a href="#/c/${cats[0]?.slug || ''}" class="btn btn-gold">Ver produtos</a>
        <a class="btn btn-wa" href="${waUrl('Olá, Grupo WD! Gostaria de um orçamento.')}" target="_blank" rel="noopener">💬 Pedir orçamento</a></div>
    </div>
    <img class="hero-logo" src="img/logo.jpg" alt="Grupo WD">
  </div></div>
  <div class="perks"><div class="wrap">
    <div class="perk"><i style="background:#e0f6fd">🚚</i><div><b>Entrega em todo Brasil</b>Envio seguro</div></div>
    <div class="perk"><i style="background:#fde0f0">🎨</i><div><b>Criação de arte</b>Não tem arte? A gente cria</div></div>
    <div class="perk"><i style="background:#fff7cc">⚡</i><div><b>Produção rápida</b>Prazos que cabem na sua agenda</div></div>
    <div class="perk"><i style="background:#ececec">💳</i><div><b>Pix e cartão</b>Pagamento facilitado</div></div>
  </div></div>
  <section><div class="wrap">
    <div class="sec-title"><h2>Categorias</h2></div>
    <div class="cat-grid">${cats.map(c => {
      const f = fam(c.fams.find(visivel));
      return `<a class="cat-tile" href="#/c/${c.slug}"><img src="${esc(imgFam(f))}" alt="" loading="lazy"><span>${esc(c.nome)}</span></a>`;
    }).join('')}</div>
  </div></section>
  ${cats.map(c => `<section style="padding-top:0"><div class="wrap">
    <div class="sec-title"><h2>${esc(c.nome)}</h2><a class="ver" href="#/c/${c.slug}">Ver todos →</a></div>
    <div class="grid">${c.fams.filter(visivel).slice(0, 4).map(s => card(s)).join('')}</div>
  </div></section>`).join('')}
  ${blocoArte()}`;
}
const blocoArte = () => `<section style="padding-top:0"><div class="wrap"><div class="art">
  <div><h3>Não tem a arte pronta?</h3><p>Nossa equipe cria o design do seu material. Fale com a gente!</p></div>
  <a class="btn btn-gold" href="${waUrl('Olá, Grupo WD! Preciso de ajuda para criar a arte do meu material.')}" target="_blank" rel="noopener">Quero criar minha arte</a>
</div></div></section>`;

/* ---------- CATEGORIA (com filtros) ---------- */
const FILTROS = [['Produto', null], ['Material', 'Material'], ['Cor', 'Cor'], ['Formato', 'Formato'], ['Cobertura', 'Enobrecimento'], ['Acabamento', 'Acabamento'], ['Quantidade', null]];
let filtroSel = {}, filtroCat = '', ordem = 'relevancia';

function pgCategoria(slug) {
  const c = CAT.cats.find(x => x.slug === slug);
  if (filtroCat !== slug) { filtroSel = {}; filtroCat = slug; }
  const t = TEXTOS[slug] || TEXTOS._padrao;
  document.title = `${c.nome} | Grupo WD`;
  const fams = c.fams.filter(visivel);
  // todas as combinações da categoria
  const linhas = [];
  fams.forEach(s => fam(s).vars.forEach(v => linhas.push({ s, v })));
  const valor = (nome, campo, l) => nome === 'Produto' ? nomeFam(l.s) : l.v.a[campo];
  const passa = (l, ignorar) => FILTROS.every(([nome, campo]) => {
    const sel = filtroSel[nome]; if (nome === ignorar || !sel || !sel.size) return true;
    if (nome === 'Quantidade') return l.v.q.some(q => sel.has(String(q[0])));
    return sel.has(valor(nome, campo, l));
  });
  // contagem por opção (considerando os outros filtros)
  const blocos = FILTROS.map(([nome, campo]) => {
    const cont = new Map();
    linhas.filter(l => passa(l, nome)).forEach(l => {
      if (nome === 'Quantidade') l.v.q.forEach(q => cont.set(String(q[0]), (cont.get(String(q[0])) || 0) + 1));
      else { const k = valor(nome, campo, l); if (k) cont.set(k, (cont.get(k) || 0) + 1); }
    });
    let ops = [...cont.entries()];
    ops.sort(nome === 'Quantidade' ? (a, b) => a[0] - b[0] : (a, b) => a[0].localeCompare(b[0], 'pt-BR', { numeric: true }));
    if (ops.length < 2 && !(filtroSel[nome]?.size)) return '';
    return `<details class="filtro" open><summary>${nome}</summary>
      ${ops.length > 8 ? `<input class="fbusca" placeholder="Buscar ${nome.toLowerCase()}" oninput="filtrarLista(this)">` : ''}
      <div class="flista">${ops.map(([k, n]) => `<label><input type="checkbox" ${filtroSel[nome]?.has(k) ? 'checked' : ''} onchange="toggleFiltro('${nome}', this.value, this.checked)" value="${esc(k)}">
        <span>${esc(nome === 'Quantidade' ? num(k) : k)}</span><em>${n}</em></label>`).join('')}</div></details>`;
  }).join('');
  const qSel = filtroSel.Quantidade?.size ? [...filtroSel.Quantidade].map(Number) : null;
  let lista = fams.filter(s => linhas.some(l => l.s === s && passa(l)));
  const filtroVar = s => v => passa({ s, v });
  if (ordem === 'preco') lista.sort((a, b) => (maisBarato(fam(a), filtroVar(a))?.q[1] || 0) - (maisBarato(fam(b), filtroVar(b))?.q[1] || 0));
  if (ordem === 'nome') lista.sort((a, b) => nomeFam(a).localeCompare(nomeFam(b), 'pt-BR'));
  const ativos = Object.entries(filtroSel).flatMap(([n, s]) => [...s].map(v => [n, v]));

  $('app').innerHTML = `<div class="wrap">
    <nav class="crumbs"><a href="#/">Início</a> › <b>${esc(c.nome)}</b></nav>
    <div class="banner"><div><h1>${esc(c.nome)}</h1><p>${esc(t.sub)}</p></div>
      <img src="${esc(imgFam(fam(fams[0])))}" alt=""></div>
    <div class="cat-layout">
      <aside class="filtros" id="filtros">
        <div class="filtros-hd"><b>Filtrar</b><button class="link" onclick="limparFiltros()">Limpar</button>
          <button class="fechar" onclick="$('filtros').classList.remove('open')">×</button></div>
        ${blocos}
      </aside>
      <div>
        <div class="lista-hd">
          <button class="btn-filtros" onclick="$('filtros').classList.add('open')">⚙️ Filtros${ativos.length ? ` (${ativos.length})` : ''}</button>
          <span>Exibindo <b>${lista.length}</b> de <b>${fams.length}</b> produtos</span>
          <label>Ordenar <select onchange="ordem=this.value;render()">
            <option value="relevancia" ${ordem === 'relevancia' ? 'selected' : ''}>Relevância</option>
            <option value="preco" ${ordem === 'preco' ? 'selected' : ''}>Menor preço</option>
            <option value="nome" ${ordem === 'nome' ? 'selected' : ''}>Nome</option></select></label>
        </div>
        ${ativos.length ? `<div class="chips">${ativos.map(([n, v]) => `<button onclick="toggleFiltro('${n}','${esc(v)}',false)">${esc(n === 'Quantidade' ? num(v) + ' un' : v)} ×</button>`).join('')}</div>` : ''}
        <div class="grid">${lista.map(s => card(s, filtroVar(s), qSel)).join('') || '<div class="empty">Nenhum produto com esses filtros.</div>'}</div>
      </div>
    </div>
    <article class="texto">${t.desc}</article>
  </div>${blocoArte()}`;
}
function toggleFiltro(nome, val, on) {
  filtroSel[nome] = filtroSel[nome] || new Set();
  on ? filtroSel[nome].add(val) : filtroSel[nome].delete(val);
  const aberto = $('filtros')?.classList.contains('open');
  render();
  if (aberto) $('filtros').classList.add('open');
}
function limparFiltros() { filtroSel = {}; render(); }
function filtrarLista(inp) {
  const t = norm(inp.value);
  inp.nextElementSibling.querySelectorAll('label').forEach(l => l.style.display = norm(l.textContent).includes(t) ? '' : 'none');
}

/* ---------- BUSCA ---------- */
function pgBusca(termo) {
  const t = norm(termo);
  const lista = Object.keys(CAT.fams).filter(s => visivel(s) &&
    norm(nomeFam(s) + ' ' + CAT.cats.find(c => c.slug === fam(s).cat)?.nome + ' ' + fam(s).vars.map(v => Object.values(v.a).join(' ')).join(' ')).includes(t));
  document.title = `Busca: ${termo} | Grupo WD`;
  $('app').innerHTML = `<div class="wrap"><nav class="crumbs"><a href="#/">Início</a> › Busca</nav>
    <div class="sec-title" style="margin-top:16px"><h2>Resultados para "${esc(termo)}"</h2><span>${lista.length} produtos</span></div>
    <div class="grid">${lista.map(s => card(s)).join('') ||
      `<div class="empty">Nenhum produto encontrado. <a href="${waUrl('Olá! Procuro um produto que não encontrei no site: ' + termo)}" target="_blank">Peça um orçamento pelo WhatsApp</a></div>`}</div></div>`;
}

/* ---------- PRODUTO ---------- */
let sel = null; // { slug, vi, qtd, extras:Set, serv:Set, n }

function pgProduto(slug, params) {
  const f = fam(slug);
  const vi = Math.min(+params.v || 0, f.vars.length - 1);
  if (!sel || sel.slug !== slug || sel.vi !== vi) {
    const v = f.vars[vi];
    const qtd = v.q.some(q => q[0] === +params.q) ? +params.q : (sel?.slug === slug && v.q.some(q => q[0] === sel.qtd) ? sel.qtd : v.q[0][0]);
    sel = { slug, vi, qtd, extras: new Set(), serv: new Set(), n: sel?.slug === slug ? sel.n : 1 };
  }
  desenharProduto();
}

function precoSel() {
  const f = fam(sel.slug), v = f.vars[sel.vi];
  const q = v.q.find(x => x[0] === sel.qtd) || v.q[0];
  const extras = (v.x || []).filter(x => sel.extras.has(x[0]));
  const serv = CAT.servicos.filter(s => sel.serv.has(s.id));
  const unit = P(q[1]) + extras.reduce((a, x) => a + P(x[3]), 0) + serv.reduce((a, s) => a + P(s.preco), 0);
  const dias = extras.reduce((a, x) => a + (x[2] || 0), 0);
  return { f, v, q, extras, serv, unit: Math.round(unit * 100) / 100, total: Math.round(unit * sel.n * 100) / 100, dias };
}

function desenharProduto() {
  const { f, v, q, extras, serv, unit, total, dias } = precoSel();
  const c = CAT.cats.find(x => x.slug === f.cat);
  document.title = `${nomeFam(sel.slug)} | Grupo WD`;
  const chaves = f.attrs.filter(k => f.vars.some(x => x.a[k]));
  const grupos = chaves.map(k => {
    const vals = [...new Set(f.vars.map(x => x.a[k]).filter(Boolean))];
    return `<div class="opc"><span>${esc(k === 'Enobrecimento' ? 'Cobertura' : k)}</span><div class="opc-bts">${vals.map(val =>
      `<button class="${v.a[k] === val ? 'on' : ''}" onclick="escolherAttr('${esc(k)}', this.dataset.v)" data-v="${esc(val)}">${esc(val)}</button>`).join('')}</div></div>`;
  }).join('');
  const base = v.q[0][1] / v.q[0][0];
  const tabela = v.q.map(([qt, tot]) => {
    const un = P(tot) / qt, desc = Math.round((1 - (tot / qt) / base) * 100);
    return `<tr class="${qt === sel.qtd ? 'on' : ''}" onclick="escolherQtd(${qt})">
      <td><label><input type="radio" name="qtd" ${qt === sel.qtd ? 'checked' : ''}> ${num(qt)} ${qt === 1 ? "unidade" : "unidades"}</label></td>
      <td><small>${brl(un).replace(/(,\d{2})\d*/, '$1')}/un</small>${desc > 0 ? ` <em class="off">-${desc}%</em>` : ''}</td>
      <td><b>${brl(P(tot))}</b></td></tr>`;
  }).join('');
  const ex = (v.x || []).length ? `<div class="opc"><span>Gostaria de adicionar um acabamento extra?</span><div class="extras">${v.x.map(x =>
    `<label class="${sel.extras.has(x[0]) ? 'on' : ''}"><input type="checkbox" ${sel.extras.has(x[0]) ? 'checked' : ''} onchange="toggleExtra(${x[0]}, this.checked)">
      <span>${esc(x[1])} <small>${x[2] ? `(+ ${x[2]} dia${x[2] > 1 ? 's' : ''})` : ''}</small></span><b>+ ${brl(P(x[3]))}</b></label>`).join('')}</div></div>` : '';
  const servicos = `<div class="servicos">${CAT.servicos.map(s => `<label class="serv ${sel.serv.has(s.id) ? 'on' : ''}" style="--cor:${s.cor}">
      <input type="checkbox" ${sel.serv.has(s.id) ? 'checked' : ''} onchange="toggleServ('${s.id}', this.checked)">
      <i>${s.icone}</i><div><b>${esc(s.nome)}</b><span>${brl(P(s.preco))}</span><small>${esc(s.desc)}</small></div></label>`).join('')}</div>`;
  const specs = [['Prazo de produção', (v.prazo || 'Consulte') + (dias ? ` (+ ${dias} dia${dias > 1 ? 's' : ''} pelos acabamentos extras)` : '')],
    ...Object.entries(v.a).map(([k, val]) => [k === 'Cor' ? 'Cor de Impressão' : k, val]),
    ['Acabamento extra', extras.map(x => x[1]).join(', ') || 'Nenhum']];
  const nomeConfig = `${num(sel.qtd)} ${nomeFam(sel.slug)} - ${Object.values(v.a).join(' - ')}`;
  const rel = c.fams.filter(s => s !== sel.slug && visivel(s)).slice(0, 8);
  const t = TEXTOS[f.cat] || TEXTOS._padrao;

  $('app').innerHTML = `<div class="wrap prod">
    <nav class="crumbs"><a href="#/">Início</a> › <a href="#/c/${c.slug}">${esc(c.nome)}</a> › <b>${esc(nomeFam(sel.slug))}</b></nav>
    <div class="prod-grid">
      <div class="galeria"><img src="${esc(imgFam(f, v))}" alt="${esc(nomeFam(sel.slug))}"></div>
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
        <div class="ajuda">
          <a class="btn btn-light" href="${waUrl(`Olá, Grupo WD! Pode me enviar o gabarito de: ${nomeConfig}?`)}" target="_blank" rel="noopener">📐 Solicitar gabarito</a>
          <form class="cep" onsubmit="event.preventDefault();consultarFrete(this.cep.value)">
            <input name="cep" inputmode="numeric" maxlength="9" placeholder="Digite seu CEP" oninput="this.value=this.value.replace(/\\D/g,'').replace(/(\\d{5})(\\d)/,'$1-$2')">
            <button>Consultar frete</button></form>
        </div>
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
  const f = fam(sel.slug), atual = f.vars[sel.vi].a;
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
  const f = fam(it.fam); if (!f || !visivel(it.fam)) return null;
  const v = f.vars.find(x => x.q.some(q => q[2] === it.sku)) || f.vars[it.vi];
  if (!v) return null;
  const q = v.q.find(x => x[2] === it.sku) || v.q.find(x => x[0] === it.qtd); if (!q) return null;
  const extras = (v.x || []).filter(x => it.ex.includes(x[0]));
  const serv = CAT.servicos.filter(s => it.sv.includes(s.id));
  const unit = Math.round((P(q[1]) + extras.reduce((a, x) => a + P(x[3]), 0) + serv.reduce((a, s) => a + P(s.preco), 0)) * 100) / 100;
  return { f, v, q, extras, serv, unit, nome: nomeFam(it.fam),
    spec: [...Object.values(v.a), ...extras.map(x => '+ ' + x[1]), ...serv.map(s => '+ ' + s.nome)].join(' - '), img: imgFam(f, v) };
}
function addCart(silencioso) {
  const { v, q } = precoSel();
  const it = { fam: sel.slug, vi: sel.vi, sku: q[2], qtd: q[0], ex: [...sel.extras], sv: [...sel.serv], n: sel.n };
  const k = JSON.stringify([it.fam, it.sku, it.qtd, it.ex.sort(), it.sv.sort()]);
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
function renderCart() {
  if (!CAT) return;
  cart = cart.filter(itemInfo);
  $('count').textContent = cart.reduce((s, i) => s + i.n, 0);
  $('items').innerHTML = cart.length ? cart.map((it, i) => { const x = itemInfo(it); return `
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
  if (!cart.length) { toast('Seu carrinho está vazio'); return; }
  if (window.WD?.configurado && !usuario) {
    if (confirm('Entre com sua conta Google para acompanhar seu pedido em "Meus pedidos".\n\nOK = entrar com Google\nCancelar = enviar só pelo WhatsApp')) { wdEntrar(); return; }
  }
  const nome = $('cName').value.trim() || usuario?.displayName || '', obs = $('cObs').value.trim();
  const itens = cart.map(it => { const x = itemInfo(it); return {
    id: it.sku, fam: it.fam, nome: x.nome, spec: x.spec, un: `${num(it.qtd)} ${it.qtd === 1 ? "unidade" : "unidades"}`, qtd: it.qtd, ex: it.ex, sv: it.sv, q: it.n, preco: x.unit }; });
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
document.addEventListener('keydown', e => { if (e.key === 'Escape') { toggleCart(false); $('ovPed').classList.remove('open'); $('filtros')?.classList.remove('open'); } });
function doSearch(e) {
  e?.preventDefault();
  const t = $('q').value.trim();
  if (t) ir('#/busca/' + encodeURIComponent(t));
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
carregarCatalogo().then(() => { render(); renderCart(); })
  .catch(e => { $('app').innerHTML = '<div class="wrap empty">Não foi possível carregar o catálogo. Tente novamente.</div>'; console.error(e); });
window.setAjustes = a => { AJUSTES = a || {}; render(); renderCart(); };
