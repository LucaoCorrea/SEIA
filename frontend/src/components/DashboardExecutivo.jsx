import { useState } from 'react';
import { analisar, moeda, situacao } from '../services/dashboard';
import { baixarPlanilha } from '../services/exportarDashboard';
import './DashboardExecutivo.css';

const cores = ['#237854', '#61a889', '#d6a44d', '#6688ad', '#a28ab4', '#c7d3c9'];
const percentual = (valor) => valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

function PizzaEstoque({ categorias, total }) {
  const [selecionado, setSelecionado] = useState(null);
  const positivas = categorias.filter(c => c.valor > 0);
  const fatias = positivas.slice(0, 5);
  if (positivas.length > 5) fatias.push({ nome: 'Outras classificações', valor: positivas.slice(5).reduce((s, c) => s + c.valor, 0) });

  const selecionada = selecionado === null ? null : fatias[selecionado];
  return total > 0 ? <div className="exec-pie-layout">
    <div className="exec-pie-wrap">
      <svg viewBox="0 0 240 240" className="exec-pie" role="group" aria-label="Distribuição do valor em estoque por classificação">
        {fatias.map((fatia, i) => {
          const inicio = fatias.slice(0, i).reduce((s, f) => s + f.valor, 0) / total * Math.PI * 2;
          const acumulado = inicio + fatia.valor / total * Math.PI * 2;
          const x1 = 120 + 108 * Math.sin(inicio), y1 = 120 - 108 * Math.cos(inicio);
          const x2 = 120 + 108 * Math.sin(acumulado), y2 = 120 - 108 * Math.cos(acumulado);
          const props = { fill: cores[i], stroke: '#fff', strokeWidth: 3, tabIndex: 0, role: 'img', 'aria-label': `${fatia.nome}: ${moeda(fatia.valor)}, ${percentual(fatia.valor / total * 100)}%`, onMouseEnter: () => setSelecionado(i), onMouseLeave: () => setSelecionado(null), onFocus: () => setSelecionado(i), onBlur: () => setSelecionado(null), style: { opacity: selecionado === null || selecionado === i ? 1 : 0.4 } };
          return fatias.length === 1 ? <circle key={fatia.nome} cx="120" cy="120" r="108" {...props}><title>{props['aria-label']}</title></circle> : <path key={fatia.nome} d={`M120 120 L${x1} ${y1} A108 108 0 ${acumulado - inicio > Math.PI ? 1 : 0} 1 ${x2} ${y2} Z`} {...props}><title>{props['aria-label']}</title></path>;
        })}
      </svg>
      <p className="exec-pie-caption" aria-live="polite">{selecionada ? `${selecionada.nome} · ${moeda(selecionada.valor)}` : 'Passe o cursor ou selecione uma fatia'}</p>
    </div>
    <ul className="exec-pie-legend">{fatias.map((fatia, i) => <li key={fatia.nome}><span className="exec-dot" style={{ background: cores[i] }} /><div><span>{fatia.nome}</span><small>{moeda(fatia.valor)}</small></div><strong>{percentual(fatia.valor / total * 100)}%</strong></li>)}</ul>
  </div> : <div className="exec-empty"><span>◔</span><strong>Sem valor em estoque</strong><p>O gráfico aparece quando há produtos com saldo e preço positivos.</p></div>;
}

export default function DashboardExecutivo({ produtos, movimentacoes, empresa, carregando, erro }) {
  const [dias, setDias] = useState(30);
  const [exportando, setExportando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const dados = analisar(produtos, movimentacoes, dias);
  const max = Math.max(1, ...dados.semanas.flatMap(s => [s.entrada, s.saida, s.ajuste]));
  const regulares = produtos.filter(p => situacao(p) === 'Regular').length;
  const indicadores = [
    { titulo: 'Valor em estoque', valor: moeda(dados.valor), detalhe: 'Capital na posição atual', icone: 'R$', destaque: true },
    { titulo: 'Produtos no catálogo', valor: produtos.length, detalhe: 'Itens cadastrados na empresa', icone: '▦' },
    { titulo: 'Produtos em atenção', valor: dados.criticos.length, detalhe: 'No mínimo ou sem estoque', icone: '!' },
    { titulo: 'Movimentações', valor: dados.filtrados.length, detalhe: `Registros nos últimos ${dias} dias`, icone: '↔' }
  ];
  async function exportar() {
    setExportando(true); setMensagem('');
    try { await baixarPlanilha(produtos, dados, empresa?.nome, dias); setMensagem('Planilha gerada. Confira os downloads do navegador.'); }
    catch { setMensagem('Não foi possível gerar a planilha. Tente novamente.'); }
    finally { setExportando(false); }
  }
  return <section className="executivo" aria-label="Dashboard executivo">
    <div className="executivo-heading"><div><span className="exec-live"><i /> INTELIGÊNCIA DO ESTOQUE</span><h2>Os números que movem seu negócio.</h2><p>Uma visão clara do estoque para apoiar suas próximas decisões.</p></div><div className="executivo-actions"><label>Período das movimentações<select value={dias} onChange={e => setDias(Number(e.target.value))}><option value={7}>Últimos 7 dias</option><option value={30}>Últimos 30 dias</option><option value={90}>Últimos 90 dias</option></select></label><button className="exec-export" disabled={carregando || Boolean(erro) || exportando} onClick={exportar}>{exportando ? 'Gerando Excel...' : '↓ Exportar Excel'}</button></div></div>
    {mensagem && <p className="exec-message" role="status">{mensagem}</p>}
    {carregando ? <div className="exec-empty" role="status">Carregando análise executiva...</div> : erro ? <p role="alert" className="dashboard-data-error">Análise indisponível: {erro}</p> : <>
      <div className="exec-kpis">{indicadores.map(item => <article className={`exec-kpi ${item.destaque ? 'exec-kpi-featured' : ''}`} key={item.titulo}><div><span>{item.titulo}</span><span className="exec-kpi-icon" aria-hidden="true">{item.icone}</span></div><strong>{item.valor}</strong><small>{item.detalhe}</small></article>)}</div>
      <div className="executivo-grid">
        <article className="panel executivo-chart"><div className="exec-chart-heading"><div><span className="exec-overline">COMPOSIÇÃO DO ESTOQUE</span><h3>Onde está seu capital?</h3></div><span className="exec-badge">Posição atual</span></div><p>Participação de cada classificação no valor total em estoque.</p><PizzaEstoque categorias={dados.categorias} total={dados.valor} /></article>
        <article className="panel executivo-chart"><div className="exec-chart-heading"><div><span className="exec-overline">CONTROLE E PREVENÇÃO</span><h3>Saúde do estoque</h3></div><span className="exec-badge">{produtos.length ? `${percentual(regulares / produtos.length * 100)}% regular` : 'Sem produtos'}</span></div><p>Disponibilidade dos produtos em relação ao estoque mínimo.</p>{['Regular', 'Estoque baixo', 'Sem estoque'].map((nome, i) => { const total = produtos.filter(p => situacao(p) === nome).length; return <div className={`executivo-bar status-${i}`} key={nome}><div><span><i className="exec-dot" />{nome}</span><strong>{total} <small>produtos</small></strong></div><progress aria-label={nome} value={total} max={Math.max(1, produtos.length)} /></div>; })}<div className="exec-health-note">Sem estoque: saldo zero. Estoque baixo: saldo positivo até o mínimo.</div></article>
        <article className="panel executivo-chart"><div className="exec-chart-heading"><div><span className="exec-overline">DISTRIBUIÇÃO FINANCEIRA</span><h3>Valor por classificação</h3></div></div><p>Compare o capital alocado em cada grupo de produtos.</p><div className="exec-category-list">{dados.categorias.length ? dados.categorias.map(c => <div className="executivo-bar" key={c.nome}><div><span>{c.nome}</span><strong>{moeda(c.valor)}</strong></div><progress aria-label={c.nome} value={c.valor} max={Math.max(1, ...dados.categorias.map(c => c.valor))} /></div>) : <div className="exec-empty">Nenhum produto cadastrado.</div>}</div></article>
        <article className="panel executivo-chart"><div className="exec-chart-heading"><div><span className="exec-overline">ATIVIDADE NO PERÍODO</span><h3>Ritmo das movimentações</h3></div><span className="exec-badge">{dias} dias</span></div><p>Número de registros por semana, a partir do início do período.</p><div className="executivo-legend"><span>● Entradas</span><span>● Saídas</span><span>● Ajustes</span></div>{!dados.filtrados.length ? <div className="exec-empty"><span>↔</span><strong>Nenhuma movimentação</strong><p>Selecione outro período para consultar o histórico.</p></div> : <div className="executivo-columns">{dados.semanas.map(s => <div className="executivo-week" key={s.nome}><div>{['entrada', 'saida', 'ajuste'].map(tipo => <div key={tipo} className={`executivo-column ${tipo}`} style={{ height: `${s[tipo] / max * 135 + 2}px` }} title={`${s.nome} · ${tipo}: ${s[tipo]}`}><span>{s[tipo]}</span></div>)}</div><small>{s.nome}</small></div>)}</div>}<small>Contagem de registros; quantidades de unidades distintas não são somadas.</small></article>
      </div>
      <div className="executivo-insight"><span className="exec-insight-icon" aria-hidden="true">{dados.criticos.length ? '!' : '✓'}</span><div><span className="exec-overline">PRÓXIMA DECISÃO</span><strong>{dados.criticos.length ? `${dados.criticos.length} produtos precisam de atenção` : produtos.length ? 'Estoque dentro dos níveis mínimos' : 'Cadastre seu primeiro produto'}</strong><p>Reposição estimada até o mínimo: <b>{moeda(dados.reposicao)}</b>. Preços atuais, sem frete.</p></div><span className="exec-badge">Planejamento de compras</span></div>
    </>}
  </section>;
}

