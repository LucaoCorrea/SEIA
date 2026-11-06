import { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import { API_URL, baixarArquivo, requisicaoAPI } from "../services/api";
import "./Movimentacoes.css";

function dataLocal(data) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function filtrosIniciais() {
  const hoje = new Date();
  const inicio = new Date(hoje);
  inicio.setDate(inicio.getDate() - 29);
  return {
    data_inicio: dataLocal(inicio),
    data_fim: dataLocal(hoje),
    produto_id: "",
    fornecedor_id: "",
    fazenda_id: "",
    lote_id: "",
    tipo: ""
  };
}

function queryString(filtros) {
  const parametros = new URLSearchParams();
  Object.entries(filtros).forEach(([chave, valor]) => {
    if (valor) parametros.set(chave, valor);
  });
  return parametros.toString();
}

function formatarQuantidade(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
}

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function formatarData(valor) {
  return valor ? new Date(valor).toLocaleString("pt-BR") : "—";
}

function listaInsight(titulo, itens, unidade = "un") {
  return (
    <article className="panel report-insight-card">
      <div className="panel-heading"><h3>{titulo}</h3></div>
      {itens.length === 0 ? (
        <p className="dashboard-list-empty">Sem dados para os filtros atuais.</p>
      ) : (
        <ol className="report-ranking">
          {itens.map((item) => (
            <li key={item.nome}>
              <span>{item.nome}</span>
              <strong>{formatarQuantidade(item.quantidade)} {unidade}</strong>
            </li>
          ))}
        </ol>
      )}
    </article>
  );
}

export default function Relatorios() {
  const [opcoes, setOpcoes] = useState({ produtos: [], fornecedores: [], fazendas: [], lotes: [] });
  const [filtros, setFiltros] = useState(filtrosIniciais);
  const [relatorio, setRelatorio] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [exportando, setExportando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let ativo = true;
    async function carregarInicial() {
      try {
        const [dadosOpcoes, dadosRelatorio] = await Promise.all([
          requisicaoAPI(`${API_URL}/relatorios/opcoes`),
          requisicaoAPI(`${API_URL}/relatorios?${queryString(filtrosIniciais())}`)
        ]);
        if (ativo) {
          setOpcoes(dadosOpcoes);
          setRelatorio(dadosRelatorio);
        }
      } catch (error) {
        if (ativo) setErro(error.message || "Não foi possível carregar o relatório.");
      } finally {
        if (ativo) setCarregando(false);
      }
    }
    carregarInicial();
    return () => {
      ativo = false;
    };
  }, []);

  async function gerarRelatorio(evento) {
    evento.preventDefault();
    setErro("");
    setCarregando(true);
    try {
      const dados = await requisicaoAPI(
        `${API_URL}/relatorios?${queryString(filtros)}`
      );
      setRelatorio(dados);
    } catch (error) {
      setErro(error.message || "Não foi possível gerar o relatório.");
    } finally {
      setCarregando(false);
    }
  }

  async function exportar() {
    setErro("");
    setExportando(true);
    try {
      await baixarArquivo(
        `${API_URL}/relatorios/exportar.xlsx?${queryString(filtros)}`,
        "relatorio_seia.xlsx"
      );
    } catch (error) {
      setErro(error.message || "Não foi possível exportar o arquivo XLSX.");
    } finally {
      setExportando(false);
    }
  }

  function atualizarFiltro(evento) {
    const { name, value } = evento.target;
    setFiltros((atuais) => {
      if (name === "fazenda_id") return { ...atuais, fazenda_id: value, lote_id: "" };
      return { ...atuais, [name]: value };
    });
  }

  function limparFiltros() {
    setFiltros({
      data_inicio: "",
      data_fim: "",
      produto_id: "",
      fornecedor_id: "",
      fazenda_id: "",
      lote_id: "",
      tipo: ""
    });
  }

  const resumo = relatorio?.resumo;
  const lotesDisponiveis = opcoes.lotes.filter(
    (lote) => !filtros.fazenda_id || String(lote.fazenda_id) === filtros.fazenda_id
  );

  return (
    <div className="dashboard produtos-page-layout">
      <Sidebar />
      <main className="dashboard-main produtos-page movimentacoes-page">
        <header className="produtos-header">
          <div>
            <span className="produtos-eyebrow">SEIA / ANÁLISES</span>
            <h1>Relatórios e insights</h1>
            <p>Analise entradas, saídas, estoque e destinos das movimentações da empresa.</p>
          </div>
          <button className="produto-btn produto-btn-primary" type="button" onClick={exportar} disabled={exportando || carregando}>
            {exportando ? "Preparando XLSX..." : "↓ Exportar XLSX"}
          </button>
        </header>

        {erro && <div className="produto-alert produto-alert-error" role="alert">{erro}</div>}

        <section className="produto-panel movimentacao-form-panel">
          <div className="produto-panel-heading">
            <div>
              <span className="produto-section-label">PERSONALIZE A CONSULTA</span>
              <h2>Filtros do relatório</h2>
            </div>
          </div>
          <form className="report-filter-form" onSubmit={gerarRelatorio}>
            <div className="produto-form-group">
              <label htmlFor="report-date-start">Data inicial</label>
              <input className="report-date-input" id="report-date-start" name="data_inicio" type="date" value={filtros.data_inicio} onChange={atualizarFiltro} />
            </div>
            <div className="produto-form-group">
              <label htmlFor="report-date-end">Data final</label>
              <input className="report-date-input" id="report-date-end" name="data_fim" type="date" value={filtros.data_fim} onChange={atualizarFiltro} />
            </div>
            <div className="produto-form-group">
              <label htmlFor="report-product">Produto</label>
              <select className="report-filter-select" id="report-product" name="produto_id" value={filtros.produto_id} onChange={atualizarFiltro}>
                <option value="">Todos os produtos</option>
                {opcoes.produtos.map((produto) => <option key={produto.id} value={produto.id}>{produto.nome}</option>)}
              </select>
            </div>
            <div className="produto-form-group">
              <label htmlFor="report-supplier">Fornecedor</label>
              <select className="report-filter-select" id="report-supplier" name="fornecedor_id" value={filtros.fornecedor_id} onChange={atualizarFiltro}>
                <option value="">Todos os fornecedores</option>
                {opcoes.fornecedores.map((fornecedor) => <option key={fornecedor.id} value={fornecedor.id}>{fornecedor.nome}</option>)}
              </select>
            </div>
            <div className="produto-form-group">
              <label htmlFor="report-farm">Fazenda de destino</label>
              <select className="report-filter-select" id="report-farm" name="fazenda_id" value={filtros.fazenda_id} onChange={atualizarFiltro}>
                <option value="">Todas as fazendas</option>
                {opcoes.fazendas.map((fazenda) => <option key={fazenda.id} value={fazenda.id}>{fazenda.nome}</option>)}
              </select>
            </div>
            <div className="produto-form-group">
              <label htmlFor="report-lot">Lote / talhão</label>
              <select className="report-filter-select" id="report-lot" name="lote_id" value={filtros.lote_id} onChange={atualizarFiltro} disabled={!lotesDisponiveis.length}>
                <option value="">Todos os lotes</option>
                {lotesDisponiveis.map((lote) => <option key={lote.id} value={lote.id}>{lote.fazenda_nome} · {lote.nome} · {lote.talhao}</option>)}
              </select>
            </div>
            <div className="produto-form-group">
              <label htmlFor="report-type">Tipo de movimentação</label>
              <select className="report-filter-select" id="report-type" name="tipo" value={filtros.tipo} onChange={atualizarFiltro}>
                <option value="">Todos os tipos</option>
                <option value="entrada">Entradas</option>
                <option value="saida">Saídas</option>
                <option value="ajuste">Ajustes</option>
              </select>
            </div>
            <div className="report-filter-actions">
              <button className="produto-btn produto-btn-primary" type="submit" disabled={carregando}>
                {carregando ? "Gerando..." : "Gerar relatório"}
              </button>
              <button className="produto-btn produto-btn-secondary" type="button" onClick={limparFiltros}>
                Limpar filtros
              </button>
            </div>
          </form>
          <p className="report-note">
            Datas, produto, fornecedor, fazenda, lote e tipo filtram as movimentações. O estoque atual é um saldo por produto, não separado por fazenda/lote; data e destino não alteram esse saldo.
          </p>
        </section>

        {carregando && !relatorio ? (
          <div className="dashboard-list-empty">Carregando dados e insights...</div>
        ) : resumo && (
          <>
            <section className="report-kpi-grid">
              <article className="report-kpi"><span>Movimentações</span><strong>{resumo.total_movimentacoes}</strong><small>No período e filtros atuais</small></article>
              <article className="report-kpi"><span>Entradas</span><strong>{formatarQuantidade(resumo.entradas)}</strong><small>Quantidade recebida</small></article>
              <article className="report-kpi"><span>Saídas</span><strong>{formatarQuantidade(resumo.saidas)}</strong><small>Quantidade destinada</small></article>
              <article className="report-kpi"><span>Estoque baixo</span><strong>{resumo.produtos_estoque_baixo}</strong><small>Produtos no mínimo ou abaixo</small></article>
              <article className="report-kpi"><span>Valor do estoque atual</span><strong>{formatarMoeda(resumo.valor_estoque_atual)}</strong><small>Produtos/fornecedor selecionados</small></article>
            </section>

            <section className="report-insights-grid">
              {listaInsight("Produtos com mais saídas", resumo.top_produtos_saida)}
              {listaInsight("Saídas por fornecedor do produto", resumo.top_fornecedores_saida)}
              {listaInsight("Destinos por fazenda", resumo.saidas_por_fazenda)}
              {listaInsight("Destinos por lote / talhão", resumo.saidas_por_lote)}
            </section>

            <section className="produto-panel movimentacao-history-panel">
              <div className="produto-panel-heading">
                <div>
                  <span className="produto-section-label">ATENÇÃO AO ESTOQUE</span>
                  <h2>Produtos no mínimo ou abaixo</h2>
                </div>
              </div>
              {!resumo.produtos_estoque_baixo_lista.length ? (
                <div className="dashboard-list-empty">Nenhum produto abaixo do estoque mínimo com os filtros atuais.</div>
              ) : (
                <div className="movimentacao-table-wrap">
                  <table className="movimentacao-table">
                    <thead><tr><th>Produto</th><th>Fornecedor</th><th>Saldo</th><th>Mínimo</th></tr></thead>
                    <tbody>
                      {resumo.produtos_estoque_baixo_lista.map((produto) => (
                        <tr key={produto.nome}>
                          <td><strong>{produto.nome}</strong></td>
                          <td>{produto.fornecedor_nome || "—"}</td>
                          <td>{formatarQuantidade(produto.quantidade)} {produto.unidade_medida}</td>
                          <td>{formatarQuantidade(produto.estoque_minimo)} {produto.unidade_medida}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="produto-panel movimentacao-history-panel">
              <div className="produto-panel-heading">
                <div>
                  <span className="produto-section-label">DETALHAMENTO</span>
                  <h2>Movimentações ({relatorio.movimentacoes.length})</h2>
                </div>
              </div>
              {!relatorio.movimentacoes.length ? (
                <div className="dashboard-list-empty">Nenhuma movimentação encontrada para os filtros selecionados.</div>
              ) : (
                <div className="movimentacao-table-wrap">
                  <table className="movimentacao-table">
                    <thead><tr><th>Data</th><th>Tipo</th><th>Produto</th><th>Fornecedor</th><th>Quantidade</th><th>Destino</th><th>Responsável</th><th>Motivo</th></tr></thead>
                    <tbody>
                      {relatorio.movimentacoes.map((item) => (
                        <tr key={item.id}>
                          <td>{formatarData(item.criado_em)}</td>
                          <td><span className={`movimentacao-badge ${item.tipo}`}>{item.tipo}</span></td>
                          <td>{item.produto_nome}</td>
                          <td>{item.fornecedor_nome || "—"}</td>
                          <td>{formatarQuantidade(item.quantidade)} {item.unidade_medida}</td>
                          <td>{item.fazenda_nome ? `${item.fazenda_nome} · ${item.lote_nome} · ${item.talhao}` : "—"}</td>
                          <td>{item.usuario_nome}</td>
                          <td>{item.motivo}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="produto-panel movimentacao-history-panel">
              <div className="produto-panel-heading">
                <div>
                  <span className="produto-section-label">POSIÇÃO ATUAL</span>
                  <h2>Estoque por produto ({relatorio.estoque_atual.length})</h2>
                </div>
              </div>
              {!relatorio.estoque_atual.length ? (
                <div className="dashboard-list-empty">Nenhum produto encontrado.</div>
              ) : (
                <div className="movimentacao-table-wrap">
                  <table className="movimentacao-table">
                    <thead><tr><th>Produto</th><th>Fornecedor</th><th>Saldo</th><th>Mínimo</th><th>Custo unitário</th><th>Valor em estoque</th></tr></thead>
                    <tbody>
                      {relatorio.estoque_atual.map((produto) => (
                        <tr key={produto.produto_id}>
                          <td><strong>{produto.produto}</strong></td>
                          <td>{produto.fornecedor || "—"}</td>
                          <td>{formatarQuantidade(produto.quantidade)} {produto.unidade_medida}</td>
                          <td>{formatarQuantidade(produto.estoque_minimo)} {produto.unidade_medida}</td>
                          <td>{formatarMoeda(produto.custo_unitario)}</td>
                          <td>{formatarMoeda(produto.valor_estoque)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
