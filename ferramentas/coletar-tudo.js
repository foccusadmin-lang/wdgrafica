// Coleta o catálogo completo de referência: menu (departamentos > grupos > categorias),
// produtos de cada categoria e, por produto, todas as combinações com a tabela de quantidades.
// Uso: node ferramentas/coletar-tudo.js        (retoma de onde parou; páginas ficam em cache)
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const BASE = 'https://www.givonline.com.br';
const CACHE = path.join(__dirname, 'cache');
const SAIDA = path.join(__dirname, 'coleta-tudo.json');
const MAX_COMB = 250;      // limite de combinações por produto
const PAUSA = 800;         // ms entre requisições (não sobrecarregar o site)
fs.mkdirSync(CACHE, { recursive: true });
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const num = s => parseFloat(String(s).replace(/[^\d,]/g, '').replace(',', '.'));
const limpa = s => String(s || '').replace(/\s+/g, ' ').trim();

async function get(p, ajax) {
  const f = path.join(CACHE, p.replace(/[^a-z0-9]+/gi, '_').slice(0, 180) + '.html');
  if (fs.existsSync(f)) return fs.readFileSync(f, 'utf8');
  for (let t = 0; t < 3; t++) {
    try {
      await sleep(PAUSA);
      const h = { 'User-Agent': UA, 'Accept-Language': 'pt-BR' };
      if (ajax) h['X-Requested-With'] = 'XMLHttpRequest';
      const r = await fetch(BASE + p, { headers: h });
      if (r.status === 404) { fs.writeFileSync(f, ''); return ''; }
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const txt = await r.text();
      fs.writeFileSync(f, txt);
      return txt;
    } catch (e) { console.warn('  erro', p, e.message); await sleep(4000); }
  }
  return '';
}

function parseProduto(html) {
  const c = cheerio.load(html);
  const specs = {};
  c('th[scope=row]').each((i, e) => { specs[limpa(c(e).text())] = limpa(c(e).next('td').text()); });
  const qtds = [];
  c('input[name=qtd-sku]').each((i, e) => {
    const tr = c(e).closest('tr');
    const id = ((tr.attr('onclick') || '').match(/,\s*(\d+)\)/) || [])[1];
    qtds.push([parseInt(c(e).attr('id'), 10), num(tr.find('td').eq(2).text()), id ? +id : null]);
  });
  const links = new Set();
  c('[role=group][aria-label] button[onclick], [role=group][aria-label] a[href]').each((i, e) => {
    const m = (c(e).attr('onclick') || c(e).attr('href') || '').match(/id=(\d+)/); if (m) links.add(+m[1]);
  });
  c('[aria-hidden=true] a[href*="/produto/"]').each((i, e) => { const m = c(e).attr('href').match(/id=(\d+)/); if (m) links.add(+m[1]); });
  const extras = [];
  c('.acabamento-box').each((i, e) => {
    const b = c(e), lab = b.find('.acabamento-label').clone();
    lab.find('.prazo,.preco,a').remove();
    extras.push([+b.find('input').attr('value'), limpa(lab.text()), parseInt((b.find('.prazo').text().match(/\d+/) || [0])[0], 10), num(b.find('.preco').text())]);
  });
  const img = c('img').map((i, e) => c(e).attr('src')).get().find(s => s && s.includes('/1000x1000-'));
  // figuras das opções (amostra do papel, cor, formato, acabamento)
  const opcoes = [];
  c('[role=group][aria-label]').each((i, g) => {
    const grupo = c(g).attr('aria-label');
    c(g).find('button').each((j, b) => {
      const im = c(b).find('img').attr('src');
      const rot = limpa(c(b).find('small').text() || c(b).text());
      if (im && rot && !im.startsWith('data:')) opcoes.push([grupo, rot, im]);
    });
  });
  return { nome: limpa(c('h1').first().text()), specs, qtds, links: [...links], extras, img, opcoes };
}

function listaProdutos(html) {
  const c = cheerio.load(html);
  const fams = new Map();
  c('a[href*="/produto/"]').each((i, e) => {
    const [p, q] = c(e).attr('href').replace(BASE, '').split('?');
    const s = p.replace('/produto/', '').replace(/\/$/, '');
    if (!s || s.includes('/')) return;
    const id = q && (q.match(/id=(\d+)/) || [])[1];
    if (!fams.has(s)) fams.set(s, new Set());
    if (id) fams.get(s).add(+id);
  });
  return fams;
}

async function familia(slug, seeds) {
  const visit = new Set(), feitos = new Set(), vars = [], opc = {};
  let fila = [...seeds], nome = '';
  const guardaOpc = p => p.opcoes.forEach(([g, r, im]) => { opc[g] = opc[g] || {}; opc[g][r] = im; });
  if (!fila.length) {
    const h = await get('/produto/' + slug); if (!h) return null;
    const p = parseProduto(h);
    fila = p.qtds.map(q => q[2]).filter(Boolean).slice(0, 1);
    if (!fila.length && p.qtds.length) { nome = p.nome; guardaOpc(p); vars.push(variante(p)); }
  }
  while (fila.length && vars.length < MAX_COMB) {
    const id = fila.shift();
    if (visit.has(id) || feitos.has(id)) continue;
    visit.add(id);
    const h = await get(`/produto/${slug}?id=${id}`); if (!h) continue;
    const p = parseProduto(h);
    if (!p.qtds.length) continue;
    nome = nome || p.nome;
    guardaOpc(p);
    p.qtds.forEach(q => { if (!q[2]) q[2] = id; feitos.add(q[2]); });
    const v = variante(p);
    if (!vars.some(x => JSON.stringify(x.a) === JSON.stringify(v.a))) vars.push(v);
    p.links.forEach(l => { if (!visit.has(l) && !feitos.has(l)) fila.push(l); });
  }
  return vars.length ? { nome, vars, opc } : null;
}
function variante(p) {
  const a = {};
  for (const [k, v] of Object.entries(p.specs)) {
    if (/^(Prazo de produção|Acabamento Extra)$/.test(k) || !v) continue;
    a[k === 'Cor de Impressão' ? 'Cor' : k] = v;
  }
  return { a, prazo: (p.specs['Prazo de produção'] || '').replace(/\s*Verifique.*$/, ''), img: p.img,
    q: p.qtds.filter(q => q[0] > 0 && q[1] > 0).sort((x, y) => x[0] - y[0]), x: p.extras };
}

(async () => {
  const out = fs.existsSync(SAIDA) ? JSON.parse(fs.readFileSync(SAIDA, 'utf8')) : { menu: [], listas: {}, fams: {} };
  const salvar = () => fs.writeFileSync(SAIDA, JSON.stringify(out));

  // 1) menu
  if (!out.menu.length) {
    const c = cheerio.load(await get('/menu-todos-departamentos', true));
    const deps = c('.mega-dep-item').map((i, e) => ({ id: c(e).attr('data-id'), nome: limpa(c(e).text()) })).get();
    for (const d of deps) {
      const h = cheerio.load(await get('/categorias-departamento-novo?departamentoId=' + d.id, true));
      const grupos = [];
      h('.mega-grupo').each((i, g) => {
        const t = h(g).find('.mega-grupo-titulo').first();
        const tit = t.clone(); tit.find('span').remove();
        const grupo = { nome: limpa(tit.text()), slug: (t.attr('href') || '').replace(/^\//, '').split('?')[0], filhos: [] };
        h(g).find('.mega-grupo-filho').each((j, f) => {
          const x = h(f).clone(); x.find('span').remove();
          grupo.filhos.push({ nome: limpa(x.text()), slug: (h(f).attr('href') || '').replace(/^\//, '').split('?')[0] });
        });
        grupos.push(grupo);
      });
      // departamentos com lista simples de links (sem grupos)
      const simples = h('.mega-item-simples a').map((i, a) => {
        const x = h(a).clone(); x.find('span').remove();
        return { nome: limpa(x.text()), slug: (h(a).attr('href') || '').replace(/^\//, '').split('?')[0] };
      }).get();
      if (simples.length) grupos.push({ nome: grupos.length ? 'Mais produtos' : d.nome, slug: '', filhos: simples });
      out.menu.push({ ...d, grupos });
      console.log(`${d.nome}: ${grupos.length} grupos, ${grupos.reduce((a, g) => a + g.filhos.length, 0)} categorias`);
    }
    salvar();
  }

  // 2) produtos de cada categoria
  const listas = new Set(out.menu.flatMap(d => d.grupos.flatMap(g => [g.slug, ...g.filhos.map(f => f.slug)])).filter(s => s && !s.startsWith('http') && !s.includes('/')));
  const seeds = {};
  for (const s of listas) {
    const h = await get('/' + s);
    const fams = listaProdutos(h);
    out.listas[s] = [...fams.keys()];
    fams.forEach((ids, f) => { seeds[f] = seeds[f] || new Set(); ids.forEach(i => seeds[f].add(i)); });
  }
  salvar();
  const todas = Object.keys(seeds);
  console.log(`\n${listas.size} categorias, ${todas.length} produtos\n`);

  // 3) combinações e preços de cada produto
  let n = 0;
  for (const s of todas) {
    n++;
    if (out.fams[s] !== undefined) continue;
    const f = await familia(s, [...seeds[s]]);
    out.fams[s] = f;  // null = sem preço público
    console.log(`[${n}/${todas.length}] ${f ? `${f.nome}: ${f.vars.length} comb.` : s + ': sem dados'}`);
    if (n % 5 === 0) salvar();
  }
  salvar();
  console.log('FIM');
})();
