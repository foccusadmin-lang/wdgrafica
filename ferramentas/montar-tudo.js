// Monta o catálogo do site a partir de ferramentas/coleta-tudo.json:
//   data/indice.json      menu, categorias e resumo de cada produto (leve, carregado em todas as páginas)
//   data/p/<produto>.json combinações, tabela de quantidades e extras de um produto
//   img/opc/*.webp        figuras das opções (papel, acabamento...)
// Uso: node ferramentas/montar-tudo.js   (depois de coletar-tudo.js)
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const RAIZ = path.join(__dirname, '..');
const coleta = JSON.parse(fs.readFileSync(path.join(__dirname, 'coleta-tudo.json'), 'utf8'));
const ORDEM_ATTR = ['Material', 'Formato', 'Cor', 'Enobrecimento', 'Acabamento'];
const MULT = 2.5;

const GAL = fs.existsSync(path.join(__dirname, 'galerias.json')) ? JSON.parse(fs.readFileSync(path.join(__dirname, 'galerias.json'), 'utf8')) : {};
const FG = fs.existsSync(path.join(__dirname, 'fotos-galeria.json')) ? JSON.parse(fs.readFileSync(path.join(__dirname, 'fotos-galeria.json'), 'utf8')) : {};
const temFoto = s => fs.existsSync(path.join(RAIZ, 'img/fam', s + '.webp'));
const fams = Object.fromEntries(Object.entries(coleta.fams).filter(([, f]) => f && f.vars && f.vars.some(v => v.q.length)));

// ---- figuras das opções: baixa uma vez para img/opc ----
const OPC_DIR = path.join(RAIZ, 'img/opc');
fs.mkdirSync(OPC_DIR, { recursive: true });
// figuras com marca de terceiros (revisadas manualmente) não são usadas
const BLOQ = new Set(fs.existsSync(path.join(__dirname, 'opc-bloqueadas.json')) ? JSON.parse(fs.readFileSync(path.join(__dirname, 'opc-bloqueadas.json'), 'utf8')) : []);
const opcMapa = fs.existsSync(path.join(__dirname, 'opc-mapa.json')) ? JSON.parse(fs.readFileSync(path.join(__dirname, 'opc-mapa.json'), 'utf8')) : {};
async function figura(url) {
  const base = url.split('?')[0];
  if (opcMapa[base]) return BLOQ.has(opcMapa[base].replace('img/opc/', '')) ? '' : opcMapa[base];
  const nome = crypto.createHash('md5').update(base).digest('hex').slice(0, 12) + '.webp';
  if (BLOQ.has(nome)) return '';
  const destino = path.join(OPC_DIR, nome);
  if (!fs.existsSync(destino)) {
    const r = await fetch(url.replace('/366x366-', '/200x200-')).catch(() => null);
    const ok = r && r.ok ? r : await fetch(url).catch(() => null);
    if (!ok || !ok.ok) return '';
    fs.writeFileSync(destino, Buffer.from(await ok.arrayBuffer()));
    await new Promise(r => setTimeout(r, 150));
  }
  return (opcMapa[base] = 'img/opc/' + nome);
}

(async () => {
  const P = fs.existsSync(path.join(RAIZ, 'data/p')) ? null : fs.mkdirSync(path.join(RAIZ, 'data/p'), { recursive: true });
  // limpa arquivos de produtos que não existem mais
  for (const f of fs.readdirSync(path.join(RAIZ, 'data/p'))) if (!fams[f.replace('.json', '')]) fs.unlinkSync(path.join(RAIZ, 'data/p', f));

  const resumo = {};
  for (const [slug, f] of Object.entries(fams)) {
    const chaves = [...new Set(f.vars.flatMap(v => Object.keys(v.a)))];
    const attrs = [...ORDEM_ATTR.filter(k => chaves.includes(k)), ...chaves.filter(k => !ORDEM_ATTR.includes(k))];
    const opc = {};
    for (const [g, vals] of Object.entries(f.opc || {})) {
      const k = g === 'Cor de Impressão' ? 'Cor' : g;
      opc[k] = {};
      for (const [rot, url] of Object.entries(vals)) { const loc = await figura(url); if (loc) opc[k][rot] = loc; }
    }
    // galeria de cada combinação: só fotos revisadas e liberadas (sem marca de terceiros)
    const gals = GAL[slug] || [];
    const vars = f.vars.filter(v => v.q.length).map((v, vi) => {
      const g = [...new Set((gals[vi] || []).filter(n => FG[n] && (FG[n].s === 'ok' || FG[n].s === 'limpa') && fs.existsSync(path.join(RAIZ, 'img/g', FG[n].c + '.webp')))
        .map(n => 'img/g/' + FG[n].c + '.webp'))];
      return { a: v.a, prazo: v.prazo, q: v.q, x: v.x || [], ...(g.length ? { g } : {}) };
    });
    fs.writeFileSync(path.join(RAIZ, 'data/p', slug + '.json'), JSON.stringify({ nome: f.nome, attrs, vars, opc }));
    // "a partir de": menor total entre todas as combinações
    let min = null;
    vars.forEach((v, vi) => v.q.forEach(q => { if (!min || q[1] < min.q[1]) min = { vi, q, v }; }));
    resumo[slug] = {
      n: f.nome,
      img: temFoto(slug) ? `img/fam/${slug}.webp` : '',
      p: [min.q[0], min.q[1], min.vi],
      s: [min.v.a.Formato, min.v.a.Cor && min.v.a.Cor.replace(/^4x[014] - /, ''), min.v.a.Acabamento].filter(Boolean).join(' - '),
      c: vars.length,
      t: [...new Set(vars.flatMap(v => Object.values(v.a)))].join(' ').slice(0, 400), // termos para busca
    };
  }
  fs.writeFileSync(path.join(__dirname, 'opc-mapa.json'), JSON.stringify(opcMapa));

  // ---- menu: só categorias com produtos disponíveis ----
  const listas = {};
  const menu = [];
  for (const d of coleta.menu) {
    const grupos = [];
    for (const g of d.grupos) {
      const fil = g.filhos.filter(x => (coleta.listas[x.slug] || []).some(s => resumo[s]));
      const doGrupo = (coleta.listas[g.slug] || []).filter(s => resumo[s]);
      if (!fil.length && !doGrupo.length) continue;
      if (doGrupo.length) listas[g.slug] = { n: g.nome, f: [...new Set(doGrupo)] };
      fil.forEach(x => { listas[x.slug] = { n: x.nome, f: [...new Set(coleta.listas[x.slug].filter(s => resumo[s]))] }; });
      grupos.push({ n: g.nome, s: doGrupo.length ? g.slug : '', f: fil.map(x => ({ n: x.nome, s: x.slug })) });
    }
    if (!grupos.length) continue;
    // página do departamento = união dos produtos dos grupos
    const ds = 'dep-' + d.id;
    const todos = [...new Set(grupos.flatMap(g => [...(listas[g.s]?.f || []), ...g.f.flatMap(x => listas[x.s].f)]))];
    listas[ds] = { n: d.nome, f: todos };
    menu.push({ n: d.nome, s: ds, g: grupos });
  }
  // produtos com foto primeiro (mantém a ordem original dentro de cada grupo)
  for (const l of Object.values(listas)) l.f.sort((a, b) => (resumo[b].img ? 1 : 0) - (resumo[a].img ? 1 : 0));
  // produto sem foto própria: usa a foto de outro produto da mesma categoria (ou o logo)
  for (const l of Object.values(listas)) {
    const comFoto = l.f.find(s => resumo[s].img);
    l.f.forEach(s => { if (!resumo[s].img && comFoto) resumo[s].imgAlt = resumo[comFoto].img; });
  }

  const indice = {
    geradoEm: new Date().toISOString(),
    mult: MULT,
    servicos: [
      { id: 'arte', nome: 'Criação de Arte', preco: 45.99, icone: '🎨', cor: '#8b1fa8', desc: 'Nossa equipe cria a arte do seu material.' },
      { id: 'revisao', nome: 'Revisão de Arquivo', preco: 16.99, icone: '🔍', cor: '#f57c00', desc: 'Conferimos seu arquivo antes de imprimir.' },
    ],
    menu, listas, fams: resumo,
  };
  fs.writeFileSync(path.join(RAIZ, 'data/indice.json'), JSON.stringify(indice));
  const nComb = Object.values(resumo).reduce((a, r) => a + r.c, 0);
  console.log(`${menu.length} departamentos, ${Object.keys(listas).length} categorias, ${Object.keys(resumo).length} produtos, ${nComb} combinações`);
  console.log(`índice: ${(fs.statSync(path.join(RAIZ, 'data/indice.json')).size / 1024).toFixed(0)} KB · sem foto própria: ${Object.values(resumo).filter(r => !r.img).length}`);
})();
