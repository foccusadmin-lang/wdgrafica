// Coleta o catálogo de referência (preço de revenda) por categoria.
// node ferramentas/coletar.js cartao-de-visita adesivo folders-e-panfletos  (depois: node ferramentas/montar-catalogo.js)
const SAIDA = require('path').join(__dirname, 'coleta.json');
const fs = require('fs');
const cheerio = require('cheerio');
const BASE = 'https://www.givonline.com.br';
const CACHE = __dirname + '/cache/';
fs.mkdirSync(CACHE, { recursive: true });
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const num = s => parseFloat(String(s).replace(/[^\d,]/g, '').replace(',', '.'));

async function get(path) {
  const f = CACHE + path.replace(/[^a-z0-9]+/gi, '_') + '.html';
  if (fs.existsSync(f)) return fs.readFileSync(f, 'utf8');
  for (let tent = 0; tent < 3; tent++) {
    try {
      await sleep(900);
      const r = await fetch(BASE + path, { headers: { 'User-Agent': UA, 'Accept-Language': 'pt-BR' } });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const t = await r.text();
      fs.writeFileSync(f, t);
      return t;
    } catch (e) { console.warn('  erro', path, e.message); await sleep(3000); }
  }
  return null;
}

function parseProduto(html) {
  const c = cheerio.load(html);
  const specs = {};
  c('th[scope=row]').each((i, e) => { specs[c(e).text().trim()] = c(e).next('td').text().replace(/\s+/g, ' ').trim(); });
  const qtds = [];
  c('input[name=qtd-sku]').each((i, e) => {
    const tr = c(e).closest('tr');
    const id = ((tr.attr('onclick') || '').match(/,\s*(\d+)\)/) || [])[1];
    const tds = tr.find('td');
    qtds.push([parseInt(c(e).attr('id'), 10), num(tds.eq(2).text()), id ? +id : null]);
  });
  const links = new Set();
  c('[role=group][aria-label] button[onclick], [role=group][aria-label] a[href]').each((i, e) => {
    const m = (c(e).attr('onclick') || c(e).attr('href') || '').match(/id=(\d+)/); if (m) links.add(+m[1]);
  });
  c('a[href*="/produto/"]').each((i, e) => { // links ocultos de variação (mesma família)
    if (c(e).closest('[aria-hidden=true]').length) { const m = c(e).attr('href').match(/id=(\d+)/); if (m) links.add(+m[1]); }
  });
  const extras = [];
  c('.acabamento-box').each((i, e) => {
    const b = c(e), lab = b.find('.acabamento-label').clone();
    lab.find('.prazo,.preco,a').remove();
    extras.push({ id: +b.find('input').attr('value'), nome: lab.text().replace(/\s+/g, ' ').trim(),
      dias: parseInt((b.find('.prazo').text().match(/\d+/) || [0])[0], 10), preco: num(b.find('.preco').text()) });
  });
  const img = c('img').map((i, e) => c(e).attr('src')).get().find(s => s && s.includes('/1000x1000-'));
  const grupos = c('[role=group][aria-label]').map((i, e) => c(e).attr('aria-label')).get();
  return { nome: c('h1').first().text().trim(), specs, qtds, links: [...links], extras, img, grupos };
}

async function categoria(slug) {
  const html = await get('/' + slug);
  if (!html) { console.warn('categoria não encontrada', slug); return null; }
  const c = cheerio.load(html);
  const nome = c('h1').first().text().trim() || slug;
  const fams = new Map();
  c('a[href*="/produto/"]').each((i, e) => {
    const [p, q] = c(e).attr('href').replace(BASE, '').split('?');
    const s = p.replace('/produto/', '');
    const id = q && (q.match(/id=(\d+)/) || [])[1];
    if (!fams.has(s)) fams.set(s, new Set());
    if (id) fams.get(s).add(+id);
  });
  return { slug, nome, fams };
}

async function familia(slug, seeds) {
  const visit = new Set(), feitos = new Set(), variantes = [];
  let fila = [...seeds];
  if (!fila.length) { // sem id: abre a página "padrão" da família
    const h = await get('/produto/' + slug); if (!h) return null;
    const p = parseProduto(h); fila = p.qtds.map(q => q[2]).filter(Boolean).slice(0, 1);
  }
  let nome = '', grupos = [];
  while (fila.length && variantes.length < 400) {
    const id = fila.shift();
    if (visit.has(id) || feitos.has(id)) continue;
    visit.add(id);
    const h = await get(`/produto/${slug}?id=${id}`); if (!h) continue;
    const p = parseProduto(h);
    if (!p.qtds.length) continue;
    p.qtds.forEach(q => { if (!q[2]) q[2] = id; }); // a linha selecionada é a própria página
    nome = nome || p.nome; if (p.grupos.length > grupos.length) grupos = p.grupos;
    p.qtds.forEach(q => q[2] && feitos.add(q[2]));
    const s = p.specs;
    const attrs = {};
    for (const [k, v] of Object.entries(s)) {
      if (/^(Prazo de produção|Acabamento Extra)$/.test(k) || !v) continue;
      attrs[k === 'Cor de Impressão' ? 'Cor' : k] = v;
    }
    const chave = JSON.stringify(attrs);
    if (!variantes.some(v => JSON.stringify(v.attrs) === chave)) {
      variantes.push({ attrs, prazo: (s['Prazo de produção'] || '').replace(/\s*Verifique.*$/, ''), img: p.img, qtds: p.qtds, extras: p.extras });
    }
    p.links.forEach(l => { if (!visit.has(l) && !feitos.has(l)) fila.push(l); });
  }
  return { slug, nome, grupos, variantes };
}

(async () => {
  const cats = process.argv.slice(2);
  const out = fs.existsSync(SAIDA) ? JSON.parse(fs.readFileSync(SAIDA, 'utf8')) : { categorias: [], familias: {} };
  for (const cs of cats) {
    const cat = await categoria(cs); if (!cat) continue;
    console.log(`\n== ${cat.nome}: ${cat.fams.size} produtos`);
    const lista = [];
    for (const [s, ids] of cat.fams) {
      if (out.familias[s]) { lista.push(s); console.log('  (já coletado)', s); continue; }
      const f = await familia(s, [...ids]);
      if (!f || !f.variantes.length) { console.log('  sem dados', s); continue; }
      out.familias[s] = f; lista.push(s);
      console.log(`  ${f.nome}: ${f.variantes.length} combinações, ${f.variantes.reduce((a, v) => a + v.qtds.length, 0)} preços`);
      fs.writeFileSync(SAIDA, JSON.stringify(out));
    }
    out.categorias = out.categorias.filter(x => x.slug !== cs).concat([{ slug: cs, nome: cat.nome, familias: lista }]);
    fs.writeFileSync(SAIDA, JSON.stringify(out));
  }
  console.log('\nFIM');
})();
