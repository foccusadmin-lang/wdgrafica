// Catálogo padrão do Grupo WD (usado até o ADM importar os produtos para o banco).
// base = preço de revenda (referência). O site exibe base x MULTIPLICADOR.
const MULTIPLICADOR = 2.5;           // preço final = preço base (revenda) x 2,5

const PRODUTOS_PADRAO = [
  {id:'cv-brilho', cat:'Cartões de Visita', nome:'Cartão de Visita em Couché Brilho', spec:'88x48mm - Colorido Frente - Verniz Total Brilho - Refile', base:43.99, un:'500 unidades', tag:'Mais vendido'},
  {id:'cv-verniz', cat:'Cartões de Visita', nome:'Cartão de Visita Fosco com Laminação Fosca e Verniz Localizado', spec:'88x48mm - Colorido Frente e Verso - Refile', base:88.99, un:'100 unidades', tag:'Mais vendido'},
  {id:'cv-hot-vermelho', cat:'Cartões de Visita', nome:'Cartão de Visita Hot Stamping Vermelho', spec:'88x48mm - Laminação Soft Touch - Colorido Frente e Verso - Refile', base:83.99, un:'100 unidades'},
  {id:'cv-hot-arcoiris', cat:'Cartões de Visita', nome:'Cartão de Visita Hot Stamping Arco-Íris', spec:'88x48mm - Laminação Soft Touch - Colorido Frente e Verso - Refile', base:83.99, un:'100 unidades'},
  {id:'cv-hot-azul', cat:'Cartões de Visita', nome:'Cartão de Visita Hot Stamping Azul', spec:'88x48mm - Laminação Soft Touch - Colorido Frente e Verso - Refile', base:83.99, un:'100 unidades'},

  {id:'adesivo-vinil', cat:'Adesivos e Rótulos', nome:'Adesivo em Vinil', spec:'50x50mm - Colorido Frente - Meio-Corte Personalizado', base:30.99, un:'50 unidades'},
  {id:'adesivo-personalizado', cat:'Adesivos e Rótulos', nome:'Adesivo Personalizado', spec:'50x50mm - Corte Especial - Colorido Frente', base:24.99, un:'100 unidades', tag:'Lançamento'},
  {id:'cartela-adesivos', cat:'Adesivos e Rótulos', nome:'Cartela de Adesivos', spec:'148x210mm - Cartela - Colorido Frente', base:64.99, un:'50 unidades', tag:'Lançamento'},
  {id:'adesivo-folha', cat:'Adesivos e Rótulos', nome:'Adesivo em Folha', spec:'98x98mm - Colorido Frente - Cartela Meio-Corte', base:54.99, un:'100 unidades'},
  {id:'lacre', cat:'Adesivos e Rótulos', nome:'Adesivo Lacre de Segurança Delivery', spec:'50x50mm - Redondo - Colorido Frente - Laminação Brilho', base:80.99, un:'100 unidades', tag:'Lançamento'},
  {id:'rotulo-garrafa', cat:'Adesivos e Rótulos', nome:'Rótulo para Garrafa Plástica', spec:'200x40mm - 500ml - BOPP Transparente - Hot Stamping Dourado', base:92.99, un:'100 unidades', tag:'Lançamento'},
  {id:'dtf-uv', cat:'Adesivos e Rótulos', nome:'DTF UV', spec:'210x297mm (A4) - com Branco - Entregue em Folha', base:25.99, un:'1 unidade'},

  {id:'folheto', cat:'Folhetos e Folders', nome:'Folheto em Couché Brilho', spec:'100x140mm - Colorido Frente - Refile', base:99.99, un:'1.000 unidades', tag:'Mais vendido'},
  {id:'folder', cat:'Folhetos e Folders', nome:'Folder 2 Dobras', spec:'200x95mm - Colorido Frente e Verso - Modelo Carteira', base:408.99, un:'500 unidades'},
  {id:'revista', cat:'Folhetos e Folders', nome:'Revista Impressa', spec:'100x148mm - 8 Páginas - Colorido Frente e Verso - Grampo Canoa', base:77.99, un:'10 unidades'},

  {id:'wind-p', cat:'Comunicação Visual', nome:'Wind Banner Kit Completo - P', spec:'650x1900mm - Dupla-Face Costurado - Base Plástica - Haste Curva', base:153.99, un:'1 unidade'},
  {id:'wind-m', cat:'Comunicação Visual', nome:'Wind Banner Kit Completo - M', spec:'650x2450mm - Dupla-Face Costurado - Base Plástica - Haste Curva', base:174.99, un:'1 unidade'},
  {id:'mobile', cat:'Comunicação Visual', nome:'Móbile para PDV', spec:'300x300mm - Redondo - Colorido Frente e Verso - Fio de Nylon', base:133.99, un:'5 unidades'},
  {id:'wobbler', cat:'Comunicação Visual', nome:'Wobbler Promocional para PDV', spec:'150x300mm - Redondo - Haste Inclusa - Colorido Frente', base:412.99, un:'100 unidades'},
  {id:'cubo', cat:'Comunicação Visual', nome:'Cubo Promocional', spec:'100x100x100mm - Colorido Frente - Verniz Brilho', base:237.99, un:'50 unidades'},

  {id:'display-chao', cat:'Expositores', nome:'Display de Chão', spec:'300x1078mm - 3 Níveis - Polionda - Colorido Frente', base:203.99, un:'1 unidade'},
  {id:'prateleira', cat:'Expositores', nome:'Prateleira Expositora', spec:'304x902mm - 5 Prateleiras - Polionda - Colorido Frente', base:264.99, un:'1 unidade'},
  {id:'display-expositor', cat:'Expositores', nome:'Display Expositor', spec:'500x1500mm - 3 Prateleiras - Polionda - Colorido Frente', base:362.99, un:'1 unidade'},
  {id:'estante', cat:'Expositores', nome:'Estante Expositora', spec:'404x804mm - 3 Prateleiras - Polionda - Colorido Frente', base:276.99, un:'1 unidade'},

  {id:'pasta', cat:'Papelaria', nome:'Pasta com Orelha', spec:'220x310mm - Colorido Frente - Faca Padrão', base:97.99, un:'10 unidades'},
  {id:'envelope', cat:'Papelaria', nome:'Envelope Saco', spec:'200x280mm - Sulfite 90g - Colorido Frente', base:696.99, un:'500 unidades'},
  {id:'agenda', cat:'Papelaria', nome:'Agenda 2027', spec:'148x210mm - Agenda Diária - Capa Dura - Wire-o Branco', base:49.99, un:'1 unidade', tag:'Lançamento'},
  {id:'sacola', cat:'Papelaria', nome:'Sacola para Eventos em Papel Duplex', spec:'490x140mm - Colorido Frente - Alça Gorgurão', base:2229.99, un:'125 unidades'},

  {id:'chaveiro', cat:'Brindes', nome:'Chaveiro de Metal Abridor', spec:'60x30mm - Gravação a Laser - Modelo Caminhão', base:118.99, un:'25 unidades'},
];
