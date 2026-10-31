import { useCallback, useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import { API_URL, requisicaoAPI } from "../services/api";
import "./Produto.css";
import "./Fazendas.css";

const fazendaInicial = { codigo: "", nome: "" };
const loteInicial = { nome: "", talhao: "", area_hectares: "" };

function formatarArea(valor) {
  return Number(valor).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
}

function normalizarBusca(valor) {
  return String(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

export default function Fazendas() {
  const [fazendas, setFazendas] = useState([]);
  const [busca, setBusca] = useState("");
  const [fazendaFormulario, setFazendaFormulario] = useState(fazendaInicial);
  const [loteFormulario, setLoteFormulario] = useState(loteInicial);
  const [fazendaSelecionada, setFazendaSelecionada] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const termoBusca = normalizarBusca(busca);
  const fazendasFiltradas = termoBusca
    ? fazendas
      .map((fazenda) => {
        const fazendaCorresponde = normalizarBusca(`${fazenda.codigo} ${fazenda.nome}`)
          .includes(termoBusca);
        const lotes = fazendaCorresponde
          ? fazenda.lotes
          : fazenda.lotes.filter((lote) => {
            const codigoArea = `${fazenda.codigo}-${lote.nome}-${lote.talhao}`;
            return normalizarBusca(codigoArea).includes(termoBusca)
              || normalizarBusca(
              `${lote.nome} ${lote.talhao} ${lote.area_hectares} ${formatarArea(lote.area_hectares)}`
              ).includes(termoBusca);
          });
        return { ...fazenda, lotes };
      })
      .filter((fazenda) =>
        normalizarBusca(`${fazenda.codigo} ${fazenda.nome}`).includes(termoBusca)
        || fazenda.lotes.length > 0
      )
    : fazendas;

  const carregarFazendas = useCallback(async () => {
    try {
      const lista = await requisicaoAPI(`${API_URL}/fazendas`);
      setFazendas(lista);
      setErro("");
    } catch (error) {
      setErro(error.message || "Não foi possível carregar as fazendas.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregarFazendas();
  }, [carregarFazendas]);

  async function cadastrarFazenda(evento) {
    evento.preventDefault();
    setErro("");
    setSucesso("");
    setSalvando(true);
    try {
      const nova = await requisicaoAPI(`${API_URL}/fazendas`, {
        method: "POST",
        body: JSON.stringify({
          codigo: Number(fazendaFormulario.codigo),
          nome: fazendaFormulario.nome.trim()
        })
      });
      setFazendaFormulario(fazendaInicial);
      setFazendaSelecionada(String(nova.id));
      setSucesso("Fazenda cadastrada com sucesso.");
      await carregarFazendas();
    } catch (error) {
      setErro(error.message || "Não foi possível cadastrar a fazenda.");
    } finally {
      setSalvando(false);
    }
  }

  async function cadastrarLote(evento) {
    evento.preventDefault();
    setErro("");
    setSucesso("");
    setSalvando(true);
    try {
      await requisicaoAPI(`${API_URL}/fazendas/${fazendaSelecionada}/lotes`, {
        method: "POST",
        body: JSON.stringify({
          nome: loteFormulario.nome.trim(),
          talhao: loteFormulario.talhao.trim(),
          area_hectares: Number(loteFormulario.area_hectares)
        })
      });
      setLoteFormulario(loteInicial);
      setSucesso("Lote cadastrado com sucesso.");
      await carregarFazendas();
    } catch (error) {
      setErro(error.message || "Não foi possível cadastrar o lote.");
    } finally {
      setSalvando(false);
    }
  }

  async function excluirLote(lote) {
    if (!window.confirm(`Excluir o lote "${lote.nome}" (talhão ${lote.talhao})?`)) return;
    setErro("");
    setSucesso("");
    try {
      await requisicaoAPI(`${API_URL}/lotes/${lote.id}`, { method: "DELETE" });
      setSucesso("Lote excluído com sucesso.");
      await carregarFazendas();
    } catch (error) {
      setErro(error.message || "Não foi possível excluir o lote.");
    }
  }

  async function excluirFazenda(fazenda) {
    if (!window.confirm(`Excluir a fazenda "${fazenda.nome}"?`)) return;
    setErro("");
    setSucesso("");
    try {
      await requisicaoAPI(`${API_URL}/fazendas/${fazenda.id}`, { method: "DELETE" });
      if (fazendaSelecionada === String(fazenda.id)) setFazendaSelecionada("");
      setSucesso("Fazenda excluída com sucesso.");
      await carregarFazendas();
    } catch (error) {
      setErro(error.message || "Não foi possível excluir a fazenda.");
    }
  }

  return (
    <div className="dashboard produtos-page-layout">
      <Sidebar />
      <main className="dashboard-main produtos-page fazendas-page">
        <header className="produtos-header">
          <div>
            <span className="produtos-eyebrow">SEIA / CADASTROS</span>
            <h1>Fazendas e lotes</h1>
            <p>Cadastre as áreas da empresa para informar o destino das saídas de produtos.</p>
          </div>
          <button
            className="produto-btn produto-btn-secondary"
            type="button"
            onClick={() => { setCarregando(true); carregarFazendas(); }}
            disabled={carregando}
          >
            <span className="produto-btn-icon">↻</span>
            Atualizar lista
          </button>
        </header>

        {erro && <div className="produto-alert produto-alert-error" role="alert">{erro}</div>}
        {sucesso && <div className="produto-alert produto-alert-success" role="status">{sucesso}</div>}

        <div className="fazendas-form-grid">
          <section className="produto-panel produto-form-panel">
            <div className="produto-panel-heading">
              <div>
                <span className="produto-section-label">PROPRIEDADE</span>
                <h2>Nova fazenda</h2>
                <p>A fazenda fica vinculada à empresa atualmente selecionada.</p>
              </div>
            </div>
            <form className="produto-form" onSubmit={cadastrarFazenda}>
              <div className="produto-form-group">
                <label htmlFor="fazenda-codigo">Código da fazenda</label>
                <input
                  id="fazenda-codigo"
                  type="number"
                  min="0"
                  step="1"
                  value={fazendaFormulario.codigo}
                  onChange={(evento) => setFazendaFormulario({ ...fazendaFormulario, codigo: evento.target.value })}
                  required
                />
              </div>
              <div className="produto-form-group">
                <label htmlFor="fazenda-nome">Nome da fazenda</label>
                <input
                  id="fazenda-nome"
                  value={fazendaFormulario.nome}
                  onChange={(evento) => setFazendaFormulario({ ...fazendaFormulario, nome: evento.target.value })}
                  maxLength={150}
                  required
                />
              </div>
              <button className="produto-btn produto-btn-primary" type="submit" disabled={salvando}>
                {salvando ? "Salvando..." : "Cadastrar fazenda"}
              </button>
            </form>
          </section>

          <section className="produto-panel produto-form-panel">
            <div className="produto-panel-heading">
              <div>
                <span className="produto-section-label">ÁREA DE PRODUÇÃO</span>
                <h2>Novo lote</h2>
                <p>Informe o lote, o talhão e sua área em hectares.</p>
              </div>
            </div>
            <form className="produto-form" onSubmit={cadastrarLote}>
              <div className="produto-form-group">
                <label htmlFor="lote-fazenda">Fazenda</label>
                <select
                  id="lote-fazenda"
                  value={fazendaSelecionada}
                  onChange={(evento) => setFazendaSelecionada(evento.target.value)}
                  required
                >
                  <option value="">Selecione uma fazenda</option>
                  {fazendas.map((fazenda) => (
                    <option key={fazenda.id} value={fazenda.id}>{fazenda.codigo} · {fazenda.nome}</option>
                  ))}
                </select>
              </div>
              <div className="produto-form-group">
                <label htmlFor="lote-nome">Lote</label>
                <input
                  id="lote-nome"
                  value={loteFormulario.nome}
                  onChange={(evento) => setLoteFormulario({ ...loteFormulario, nome: evento.target.value })}
                  maxLength={100}
                  required
                />
              </div>
              <div className="produto-form-group">
                <label htmlFor="lote-talhao">Talhão</label>
                <input
                  id="lote-talhao"
                  value={loteFormulario.talhao}
                  onChange={(evento) => setLoteFormulario({ ...loteFormulario, talhao: evento.target.value })}
                  maxLength={100}
                  required
                />
              </div>
              <div className="produto-form-group">
                <label htmlFor="lote-area">Área (hectares)</label>
                <input
                  id="lote-area"
                  type="number"
                  min="0.001"
                  step="any"
                  value={loteFormulario.area_hectares}
                  onChange={(evento) => setLoteFormulario({ ...loteFormulario, area_hectares: evento.target.value })}
                  required
                />
              </div>
              <button
                className="produto-btn produto-btn-primary"
                type="submit"
                disabled={salvando || !fazendas.length}
              >
                {salvando ? "Salvando..." : "Cadastrar lote"}
              </button>
              {!fazendas.length && !carregando && (
                <p className="movimentacao-help">Cadastre uma fazenda antes de adicionar lotes.</p>
              )}
            </form>
          </section>
        </div>

        <section className="produto-panel fazendas-list-panel">
          <div className="produto-panel-heading">
            <div>
              <span className="produto-section-label">CADASTROS DA EMPRESA</span>
              <h2>Fazendas e áreas cadastradas</h2>
            </div>
          </div>
          <div className="fazendas-search">
            <label htmlFor="buscar-area">Buscar área</label>
            <div className="fazendas-search-controls">
              <input
                id="buscar-area"
                type="search"
                value={busca}
                onChange={(evento) => setBusca(evento.target.value)}
                placeholder="Código, fazenda, lote, talhão ou hectares"
                aria-describedby="fazendas-search-hint"
              />
              {busca && (
                <button type="button" onClick={() => setBusca("")}>
                  Limpar
                </button>
              )}
            </div>
            <p id="fazendas-search-hint">
              Pesquise pelo código composto fazenda-lote-talhão (ex.: 12-3-4), ou por nome e área.
            </p>
          </div>
          {carregando ? (
            <div className="dashboard-list-empty">Carregando fazendas...</div>
          ) : !fazendas.length ? (
            <div className="dashboard-list-empty">Nenhuma fazenda cadastrada.</div>
          ) : !fazendasFiltradas.length ? (
            <div className="dashboard-list-empty">Nenhuma fazenda ou área corresponde à busca.</div>
          ) : (
            <div className="fazendas-list">
              {fazendasFiltradas.map((fazenda) => (
                <article className="fazenda-card" key={fazenda.id}>
                  <div className="fazenda-card-heading">
                    <h3>{fazenda.codigo} · {fazenda.nome}</h3>
                    <button
                      className="fazenda-delete-button"
                      type="button"
                      onClick={() => excluirFazenda(fazenda)}
                    >
                      Excluir fazenda
                    </button>
                  </div>
                  {!fazenda.lotes.length ? (
                    <p className="fazenda-sem-lotes">Nenhum lote cadastrado nesta fazenda.</p>
                  ) : (
                    <div className="movimentacao-table-wrap">
                      <table className="movimentacao-table">
                        <thead>
                          <tr><th>Código</th><th>Lote</th><th>Talhão</th><th>Área</th><th /></tr>
                        </thead>
                        <tbody>
                          {fazenda.lotes.map((lote) => (
                            <tr key={lote.id}>
                              <td>{fazenda.codigo}-{lote.nome}-{lote.talhao}</td>
                              <td>{lote.nome}</td>
                              <td>{lote.talhao}</td>
                              <td>{formatarArea(lote.area_hectares)} ha</td>
                              <td>
                                <button
                                  className="fazenda-delete-button"
                                  type="button"
                                  onClick={() => excluirLote(lote)}
                                >
                                  Excluir lote
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
