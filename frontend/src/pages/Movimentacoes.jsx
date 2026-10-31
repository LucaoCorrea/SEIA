import { useCallback, useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import { API_URL, requisicaoAPI } from "../services/api";
import "./Movimentacoes.css";

const formularioInicial = {
  produto_id: "",
  tipo: "entrada",
  destino_fazenda_id: "",
  destino_lote_id: "",
  quantidade: "",
  motivo: ""
};

function formatarQuantidade(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
}

function formatarData(valor) {
  return new Date(valor).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  });
}

export default function Movimentacoes() {
  const [produtos, setProdutos] = useState([]);
  const [fazendas, setFazendas] = useState([]);
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [formulario, setFormulario] = useState(formularioInicial);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  const buscarDados = useCallback(async () => {
    return Promise.all([
      requisicaoAPI(`${API_URL}/listar-produtos`),
      requisicaoAPI(`${API_URL}/movimentacoes?limite=200`),
      requisicaoAPI(`${API_URL}/fazendas`)
    ]);
  }, []);

  const carregarDados = useCallback(async () => {
    try {
      const [listaProdutos, listaMovimentacoes, listaFazendas] = await buscarDados();
      setProdutos(listaProdutos);
      setMovimentacoes(listaMovimentacoes);
      setFazendas(listaFazendas);
      setErro("");
    } catch (error) {
      setErro(error.message || "Não foi possível carregar o estoque.");
    } finally {
      setCarregando(false);
    }
  }, [buscarDados]);

  useEffect(() => {
    let ativo = true;

    async function carregarInicial() {
      try {
        const [listaProdutos, listaMovimentacoes, listaFazendas] = await buscarDados();
        if (!ativo) return;
        setProdutos(listaProdutos);
        setMovimentacoes(listaMovimentacoes);
        setFazendas(listaFazendas);
        setErro("");
      } catch (error) {
        if (ativo) setErro(error.message || "Não foi possível carregar o estoque.");
      } finally {
        if (ativo) setCarregando(false);
      }
    }

    carregarInicial();
    return () => {
      ativo = false;
    };
  }, [buscarDados]);

  function atualizarCampo(evento) {
    const { name, value } = evento.target;
    setFormulario((atual) => {
      if (name === "tipo" && value !== "saida") {
        return { ...atual, tipo: value, destino_fazenda_id: "", destino_lote_id: "" };
      }
      if (name === "destino_fazenda_id") {
        return { ...atual, destino_fazenda_id: value, destino_lote_id: "" };
      }
      return { ...atual, [name]: value };
    });
  }

  async function registrarMovimentacao(evento) {
    evento.preventDefault();
    setErro("");
    setSucesso("");
    setSalvando(true);

    try {
      const resultado = await requisicaoAPI(`${API_URL}/movimentacoes`, {
        method: "POST",
        body: JSON.stringify({
          produto_id: Number(formulario.produto_id),
          tipo: formulario.tipo,
          ...(formulario.tipo === "saida"
            ? { destino_lote_id: Number(formulario.destino_lote_id) }
            : {}),
          quantidade: Number(formulario.quantidade),
          motivo: formulario.motivo.trim()
        })
      });
      setFormulario(formularioInicial);
      setSucesso(
        `Movimentação registrada. Novo saldo de ${resultado.produto_nome}: ${formatarQuantidade(resultado.saldo_posterior)}.`
      );
      await carregarDados();
    } catch (error) {
      setErro(error.message || "Não foi possível registrar a movimentação.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="dashboard produtos-page-layout">
      <Sidebar />
      <main className="dashboard-main produtos-page movimentacoes-page">
        <header className="produtos-header">
          <div>
            <span className="produtos-eyebrow">SEIA / ESTOQUE</span>
            <h1>Movimentações</h1>
            <p>Registre entradas, saídas e ajustes. Cada alteração mantém o histórico da empresa.</p>
          </div>
          <button className="produto-btn produto-btn-secondary" type="button" onClick={() => { setCarregando(true); carregarDados(); }} disabled={carregando}>
            <span className="produto-btn-icon">↻</span>
            Atualizar
          </button>
        </header>

        {erro && <div className="produto-alert produto-alert-error" role="alert">{erro}</div>}
        {sucesso && <div className="produto-alert produto-alert-success" role="status">{sucesso}</div>}

        <section className="produto-panel movimentacao-form-panel">
          <div className="produto-panel-heading">
            <div>
              <span className="produto-section-label">NOVA OPERAÇÃO</span>
              <h2>Registrar movimentação</h2>
              <p>Saídas acima do saldo disponível são bloqueadas.</p>
            </div>
          </div>
          <form className="produto-form movimentacao-form" onSubmit={registrarMovimentacao}>
            <div className="produto-form-group">
              <label htmlFor="mov-produto">Produto</label>
              <select id="mov-produto" name="produto_id" value={formulario.produto_id} onChange={atualizarCampo} required>
                <option value="">Selecione um produto</option>
                {produtos.map((produto) => (
                  <option value={produto.id} key={produto.id}>
                    {produto.nome} · saldo {formatarQuantidade(produto.quantidade)} {produto.unidade_medida}
                  </option>
                ))}
              </select>
            </div>
            <div className="produto-form-group">
              <label htmlFor="mov-tipo">Tipo</label>
              <select id="mov-tipo" name="tipo" value={formulario.tipo} onChange={atualizarCampo}>
                <option value="entrada">Entrada</option>
                <option value="saida">Saída</option>
                <option value="ajuste">Ajuste de saldo</option>
              </select>
            </div>
            {formulario.tipo === "saida" && (
              <>
                <div className="produto-form-group">
                  <label htmlFor="mov-destino-fazenda">Fazenda de destino</label>
                  <select
                    id="mov-destino-fazenda"
                    name="destino_fazenda_id"
                    value={formulario.destino_fazenda_id}
                    onChange={atualizarCampo}
                    required
                  >
                    <option value="">Selecione uma fazenda</option>
                    {fazendas.map((fazenda) => (
                      <option key={fazenda.id} value={fazenda.id}>{fazenda.codigo} · {fazenda.nome}</option>
                    ))}
                  </select>
                </div>
                <div className="produto-form-group">
                  <label htmlFor="mov-destino-lote">Lote / talhão de destino</label>
                  <select
                    id="mov-destino-lote"
                    name="destino_lote_id"
                    value={formulario.destino_lote_id}
                    onChange={atualizarCampo}
                    disabled={!formulario.destino_fazenda_id}
                    required
                  >
                    <option value="">Selecione um lote</option>
                    {fazendas
                      .find((fazenda) => String(fazenda.id) === formulario.destino_fazenda_id)
                      ?.lotes.map((lote) => (
                        <option key={lote.id} value={lote.id}>
                          {lote.nome} · talhão {lote.talhao} · {formatarQuantidade(lote.area_hectares)} ha
                        </option>
                      ))}
                  </select>
                </div>
                {!fazendas.length && (
                  <p className="movimentacao-help">
                    Cadastre uma fazenda e um lote antes de registrar uma saída.
                  </p>
                )}
              </>
            )}
            <div className="produto-form-group">
              <label htmlFor="mov-quantidade">
                {formulario.tipo === "ajuste" ? "Novo saldo" : "Quantidade"}
              </label>
              <input
                id="mov-quantidade"
                name="quantidade"
                type="number"
                min={formulario.tipo === "ajuste" ? "0" : "0.001"}
                step="any"
                value={formulario.quantidade}
                onChange={atualizarCampo}
                required
              />
            </div>
            <div className="produto-form-group">
              <label htmlFor="mov-motivo">Motivo / observação</label>
              <input
                id="mov-motivo"
                name="motivo"
                value={formulario.motivo}
                onChange={atualizarCampo}
                maxLength={500}
                required
                minLength={2}
                placeholder="Ex.: recebimento de compra, venda ou conferência"
              />
            </div>
            <button className="produto-btn produto-btn-primary" type="submit" disabled={salvando || !produtos.length || (formulario.tipo === "saida" && !formulario.destino_lote_id)}>
              {salvando ? "Registrando..." : "Registrar movimentação"}
            </button>
            {!produtos.length && !carregando && <p className="movimentacao-help">Cadastre um produto antes de movimentar o estoque.</p>}
          </form>
        </section>

        <section className="produto-panel movimentacao-history-panel">
          <div className="produto-panel-heading">
            <div>
              <span className="produto-section-label">AUDITORIA</span>
              <h2>Histórico recente</h2>
              <p>Mostrando até 200 movimentações, com responsável e saldo resultante.</p>
            </div>
          </div>
          {carregando ? (
            <div className="dashboard-list-empty">Carregando histórico...</div>
          ) : movimentacoes.length === 0 ? (
            <div className="dashboard-list-empty">Ainda não há movimentações registradas.</div>
          ) : (
            <div className="movimentacao-table-wrap">
              <table className="movimentacao-table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Produto</th>
                    <th>Movimento</th>
                    <th>Destino</th>
                    <th>Quantidade / saldo</th>
                    <th>Responsável</th>
                    <th>Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {movimentacoes.map((item) => (
                    <tr key={item.id}>
                      <td>{formatarData(item.criado_em)}</td>
                      <td><strong>{item.produto_nome}</strong></td>
                      <td><span className={`movimentacao-badge ${item.tipo}`}>{item.tipo}</span></td>
                      <td>
                        {item.destino_fazenda
                          ? `${item.destino_fazenda} · ${item.destino_lote} · talhão ${item.destino_talhao}`
                          : "—"}
                      </td>
                      <td>
                        {item.tipo === "ajuste"
                          ? `${formatarQuantidade(item.saldo_anterior)} → ${formatarQuantidade(item.saldo_posterior)}`
                          : `${item.tipo === "saida" ? "−" : "+"}${formatarQuantidade(item.quantidade)}`}
                        <small className="movimentacao-saldo">Saldo: {formatarQuantidade(item.saldo_posterior)}</small>
                      </td>
                      <td>{item.usuario_nome}</td>
                      <td>{item.motivo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
