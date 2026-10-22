// Extrai a galeria de fotos de cada combinação a partir das páginas salvas (cache)
const fs=require('fs');
const col=JSON.parse(fs.readFileSync('coleta-tudo.json','utf8'));
const idx=JSON.parse(fs.readFileSync('../data/indice.json','utf8'));
const chave=p=>'cache/'+p.replace(/[^a-z0-9]+/gi,'_').slice(0,180)+'.html';
const out={};let nVar=0,semPag=0;const unicas=new Set();
for(const [slug,f] of Object.entries(col.fams)){
  if(!f||!idx.fams[slug])continue;
  out[slug]=f.vars.filter(v=>v.q.length).map(v=>{
    nVar++;
    const id=((v.img||'').match(/_(\d+)(?:_\d+)?\.webp/)||[])[1];
    const arq=id&&chave(`/produto/${slug}?id=${id}`);
    if(!arq||!fs.existsSync(arq)){semPag++;return v.img?[v.img.split('?')[0].replace(/.*\/v2\/132\/1000x1000-/,'').replace(/\.webp$/,'')]:[];}
    const h=fs.readFileSync(arq,'utf8');
    const nomes=[...new Set([...h.matchAll(/img\/sku\/132\/(\d+)\/([^"'\s]+?)\.(?:png|jpe?g|webp)/g)].filter(m=>m[1]===id).map(m=>m[2]))];
    nomes.forEach(n=>unicas.add(n));
    return nomes;
  });
}
fs.writeFileSync('galerias.json',JSON.stringify(out));
const tam=Object.values(out).flat().map(g=>g.length);
console.log('combinações',nVar,'sem página',semPag,'fotos únicas',unicas.size,'média por combinação',(tam.reduce((a,b)=>a+b,0)/tam.length).toFixed(1),'máx',Math.max(...tam));
