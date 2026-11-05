import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analisar, situacao } from './dashboard.js';
import { criarPlanilha } from './exportarDashboard.js';
import ExcelJS from 'exceljs';
const produtos = [{id:1,nome:'=SUM(A1)',quantidade:2,estoque_minimo:5,preco:10,unidade_medida:'kg',tipo_classificacao:'Sementes'},{id:2,nome:'Produto B',quantidade:0,estoque_minimo:3,preco:20}];
const movimentos = [{id:1,criado_em:'2026-11-05T10:00:00',tipo:'entrada',quantidade:2},{id:2,criado_em:'2026-09-01T10:00:00',tipo:'saida',quantidade:4},{id:3,criado_em:'2026-11-04T10:00:00',tipo:'ajuste',quantidade:-1}];
test('separa saldo zero, calcula valor e reposição, filtra datas e inclui ajustes', () => {
 const a=analisar(produtos,movimentos,7,new Date('2026-11-05T12:00:00'));
 assert.equal(a.valor,20); assert.equal(a.reposicao,90); assert.equal(a.criticos.length,2); assert.equal(a.filtrados.length,2); assert.equal(a.semanas[0].entrada,1); assert.equal(a.semanas[0].ajuste,1); assert.equal(situacao(produtos[1]),'Sem estoque');
 assert.equal(analisar([],[],30).valor,0);
});
test('xlsx reabre com três abas, números preservados e texto sem fórmulas', async () => {
 const a=analisar(produtos,movimentos,7,new Date('2026-11-05T12:00:00'));
 const buffer=await criarPlanilha(produtos,a,'Empresa teste',7);
 const wb=new ExcelJS.Workbook(); await wb.xlsx.load(buffer);
 assert.equal(wb.worksheets.length,3); assert.equal(wb.getWorksheet('Estoque atual').getCell('B2').value,'=SUM(A1)'); assert.equal(wb.getWorksheet('Estoque atual').getCell('H2').value,20); assert.equal(wb.getWorksheet('Movimentações').rowCount,3); assert.equal(wb.getWorksheet('Resumo executivo').getCell('B8').value,90);
});
