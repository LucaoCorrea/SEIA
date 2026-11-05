export const numero = (v) => Number.isFinite(Number(v)) ? Number(v) : 0;
export const moeda = (v) => numero(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const situacao = (p) => numero(p.quantidade) <= 0 ? 'Sem estoque' : numero(p.quantidade) <= numero(p.estoque_minimo) ? 'Estoque baixo' : 'Regular';
export function analisar(produtos, movimentos, dias, agora = new Date()) {
  const inicio = new Date(agora); inicio.setHours(0, 0, 0, 0); inicio.setDate(inicio.getDate() - (dias - 1));
  const filtrados = movimentos.filter(m => { const data = new Date(m.criado_em); return data >= inicio && data <= agora; });
  const categorias = new Map();
  produtos.forEach(p => { const chave = p.tipo_classificacao || 'Sem classificação'; categorias.set(chave, (categorias.get(chave) || 0) + numero(p.quantidade) * numero(p.preco)); });
  const semanas = Array.from({ length: Math.ceil(dias / 7) }, (_, i) => {
    const de = new Date(inicio); de.setDate(de.getDate() + i * 7);
    const ate = new Date(de); ate.setDate(ate.getDate() + 7);
    const itens = filtrados.filter(m => new Date(m.criado_em) >= de && new Date(m.criado_em) < ate);
    return { nome: de.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), entrada: itens.filter(m => m.tipo === 'entrada').length, saida: itens.filter(m => m.tipo === 'saida').length, ajuste: itens.filter(m => m.tipo === 'ajuste').length };
  });
  return { filtrados, semanas, categorias: [...categorias].map(([nome, valor]) => ({ nome, valor })).sort((a,b) => b.valor-a.valor), valor: produtos.reduce((s,p) => s + numero(p.quantidade)*numero(p.preco),0), reposicao: produtos.reduce((s,p) => s + Math.max(0, numero(p.estoque_minimo)-numero(p.quantidade))*numero(p.preco),0), criticos: produtos.filter(p => situacao(p) !== 'Regular') };
}
