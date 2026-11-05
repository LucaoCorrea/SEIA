import { numero, situacao } from './dashboard.js';
export async function criarPlanilha(produtos, analise, empresa, dias) {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook(); wb.creator = 'SEIA'; wb.created = new Date();
  const resumo = wb.addWorksheet('Resumo executivo');
  resumo.addRows([['SEIA — Visão executiva', empresa || 'Empresa'], ['Gerado em', new Date().toLocaleString('pt-BR')], ['Período das movimentações', `Últimos ${dias} dias`], ['Estoque', 'Posição atual (não histórica)'], ['Valor do estoque (R$)', analise.valor], ['Produtos cadastrados', produtos.length], ['Produtos em atenção', analise.criticos.length], ['Reposição até o mínimo (R$)', analise.reposicao], ['Movimentações no período', analise.filtrados.length]]);
  const estoque = wb.addWorksheet('Estoque atual');
  estoque.addRow(['ID','Produto','Classificação','Unidade','Quantidade','Estoque mínimo','Preço unitário (R$)','Valor em estoque (R$)','Situação']);
  produtos.forEach(p => estoque.addRow([p.id,p.nome,p.tipo_classificacao || 'Sem classificação',p.unidade_medida,numero(p.quantidade),numero(p.estoque_minimo),numero(p.preco),numero(p.quantidade)*numero(p.preco),situacao(p)]));
  const mov = wb.addWorksheet('Movimentações');
  mov.addRow(['ID','Data','Produto','Tipo','Quantidade','Saldo anterior','Saldo posterior','Responsável','Motivo','Fazenda','Lote']);
  analise.filtrados.forEach(m => mov.addRow([m.id,new Date(m.criado_em).toLocaleString('pt-BR'),m.produto_nome,m.tipo,numero(m.quantidade),numero(m.saldo_anterior),numero(m.saldo_posterior),m.usuario_nome,m.motivo,m.destino_fazenda || '',m.destino_lote || '']));
  [resumo,estoque,mov].forEach(ws => {
    ws.views = [{ state:'frozen', ySplit:1 }];
    ws.getRow(1).font = { bold:true,color:{argb:'FFFFFFFF'} }; ws.getRow(1).fill = {type:'pattern',pattern:'solid',fgColor:{argb:'FF206441'}};
    ws.columns.forEach(col => { col.width = 25; });
  });
  estoque.autoFilter = { from:'A1', to:`I${estoque.rowCount}` }; mov.autoFilter = {from:'A1',to:`K${mov.rowCount}`};
  [7,8].forEach(c => estoque.getColumn(c).numFmt = '"R$" #,##0.00');
  [5,8].forEach(r => resumo.getCell(r,2).numFmt = '"R$" #,##0.00');
  return wb.xlsx.writeBuffer();
}
export async function baixarPlanilha(...args) {
  const buffer = await criarPlanilha(...args);
  const url = URL.createObjectURL(new Blob([buffer], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const a = document.createElement('a'); a.href=url; a.download=`SEIA-dashboard-${new Date().toISOString().slice(0,10)}.xlsx`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url),1000);
}

