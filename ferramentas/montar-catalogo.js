// Monta data/catalogo.json a partir da coleta (ferramentas/coleta.json) + produtos avulsos (js/produtos.js).
// Uso: node ferramentas/montar-catalogo.js
const fs = require('fs');
const path = require('path');
const RAIZ = path.join(__dirname, '..');
const coleta = JSON.parse(fs.readFileSync(path.join(__dirname, 'coleta.json'), 'utf8'));

const NOMES_CAT = {
  'cartao-de-visita': 'Cartões de Visita',
  'adesivo': 'Adesivos e Rótulos',
  'folders-e-panfletos': 'Folhetos e Panfletos',
};
const ORDEM_ATTR = ['Material', 'Formato', 'Cor', 'Enobrecimento', 'Acabamento'];

const out = {
  geradoEm: new Date().toISOString(),
  mult: 2.5,
  servicos: [
    { id: 'arte', nome: 'Criação de Arte', preco: 45.99, icone: '🎨', cor: '#8b1fa8', desc: 'Nossa equipe cria a arte do seu material.' },
    { id: 'revisao', nome: 'Revisão de Arquivo', preco: 16.99, icone: '🔍', cor: '#f57c00', desc: 'Conferimos seu arquivo antes de imprimir.' },
  ],
  cats: [],
  fams: {},
};

// ---- categorias coletadas (com combinações e tabela de quantidades) ----
for (const c of coleta.categorias) {
  const fams = [];
  for (const slug of c.familias) {
    const f = coleta.familias[slug];
    if (!f || !f.variantes.length || out.fams[slug]) { if (out.fams[slug] && !fams.includes(slug)) fams.push(slug); continue; }
    if (fams.some(s => out.fams[s].nome === f.nome)) continue; // mesmo produto com outro endereço
    const chaves = [...new Set(f.variantes.flatMap(v => Object.keys(v.attrs)))];
    const attrs = [...ORDEM_ATTR.filter(k => chaves.includes(k)), ...chaves.filter(k => !ORDEM_ATTR.includes(k))];
    const img = fs.existsSync(path.join(RAIZ, 'img/fam', slug + '.webp')) ? `img/fam/${slug}.webp` : '';
    out.fams[slug] = {
      nome: f.nome, cat: c.slug, img, attrs,
      vars: f.variantes.map(v => ({
        a: v.attrs,
        prazo: v.prazo,
        q: v.qtds.filter(q => q[0] > 0 && q[1] > 0).sort((a, b) => a[0] - b[0]),
        x: (v.extras || []).map(x => [x.id, x.nome, x.dias, x.preco]),
      })).filter(v => v.q.length),
    };
    fams.push(slug);
  }
  out.cats.push({ slug: c.slug, nome: NOMES_CAT[c.slug] || c.nome, fams });
}

// ---- produtos avulsos das categorias ainda não coletadas ----
const src = fs.readFileSync(path.join(RAIZ, 'js/produtos.js'), 'utf8');
const AVULSOS = new Function(src + '; return PRODUTOS_PADRAO;')();
// categorias antigas que já vêm da coleta: só mantém os avulsos sem equivalente coletado
const COLETADAS = { 'Cartões de Visita': 'cartao-de-visita', 'Adesivos e Rótulos': 'adesivo', 'Folhetos e Folders': 'folders-e-panfletos' };
const MANTER = ['revista', 'rotulo-garrafa'];
const slugCat = n => n.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
for (const p of AVULSOS) {
  const coletada = COLETADAS[p.cat] && out.cats.some(c => c.slug === COLETADAS[p.cat]);
  if (coletada && !MANTER.includes(p.id)) continue;
  const cs = coletada ? COLETADAS[p.cat] : slugCat(p.cat);
  let cat = out.cats.find(c => c.slug === cs);
  if (!cat) { cat = { slug: cs, nome: p.cat, fams: [] }; out.cats.push(cat); }
  const [formato, ...resto] = p.spec.split(' - ');
  const unid = parseInt(p.un.replace(/\D/g, ''), 10) || 1;
  out.fams[p.id] = {
    nome: p.nome, cat: cs, img: `img/produtos/${p.id}.webp`, attrs: ['Formato', 'Detalhes'], tag: p.tag && p.tag !== 'Mais vendido' ? p.tag : '',
    vars: [{ a: { Formato: formato, Detalhes: resto.join(' - ') || '—' }, prazo: 'Consulte pelo WhatsApp', q: [[unid, p.base, 'L-' + p.id]], x: [] }],
  };
  cat.fams.push(p.id);
}

// imagem padrão para família sem foto própria: a de outra família da mesma categoria
for (const c of out.cats) {
  const comImg = c.fams.find(s => out.fams[s].img);
  c.fams.forEach(s => { if (!out.fams[s].img) out.fams[s].img = comImg ? out.fams[comImg].img : 'img/icon-512.png'; });
}

fs.mkdirSync(path.join(RAIZ, 'data'), { recursive: true });
fs.writeFileSync(path.join(RAIZ, 'data/catalogo.json'), JSON.stringify(out));
const nVar = Object.values(out.fams).reduce((a, f) => a + f.vars.length, 0);
const nPreco = Object.values(out.fams).reduce((a, f) => a + f.vars.reduce((b, v) => b + v.q.length, 0), 0);
console.log(`${out.cats.length} categorias, ${Object.keys(out.fams).length} produtos, ${nVar} combinações, ${nPreco} preços`);
out.cats.forEach(c => console.log(`  ${c.nome}: ${c.fams.length}`));
