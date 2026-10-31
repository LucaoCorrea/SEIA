import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { API_URL, requisicaoAPI } from "../services/api";

async function buscarLista(endpoint, entidade) {
  const dados = await requisicaoAPI(`${API_URL}${endpoint}`);
  if (!Array.isArray(dados)) throw new Error(`Não foi possível carregar ${entidade}.`);
  return dados;
}

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function formatarQuantidade(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    maximumFractionDigits: 3
  });
}

export default function Dashboard() {
  const navigate = useNavigate();
  const email = localStorage.getItem("email") || "Usuário";
  const nome = localStorage.getItem("nome") || "Usuário";
  const [produtos, setProdutos] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [avisos, setAvisos] = useState([]);
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [empresa, setEmpresa] = useState(null);
  const [avisoFormulario, setAvisoFormulario] = useState({ titulo: "", mensagem: "" });
  const [avisoEmEdicao, setAvisoEmEdicao] = useState(null);
  const [salvandoAviso, setSalvandoAviso] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erroProdutos, setErroProdutos] = useState("");
  const [erroFornecedores, setErroFornecedores] = useState("");
  const [erroFeed, setErroFeed] = useState("");
  const [mensagemAviso, setMensagemAviso] = useState("");

  useEffect(() => {
    let ativo = true;

    async function carregarDados() {
      const [
        resultadoProdutos,
        resultadoFornecedores,
        resultadoAvisos,
        resultadoMovimentacoes,
        resultadoEmpresa
      ] = await Promise.allSettled([
        buscarLista("/listar-produtos", "os produtos"),
        buscarLista("/listar-fornecedores", "os fornecedores"),
        buscarLista("/avisos", "os avisos"),
        buscarLista("/movimentacoes?limite=100", "as movimentações"),
        requisicaoAPI(`${API_URL}/empresas/me`)
      ]);

      if (!ativo) return;

      if (resultadoProdutos.status === "fulfilled") {
        setProdutos(resultadoProdutos.value);
      } else {
        setErroProdutos(resultadoProdutos.reason?.message || "Erro ao carregar produtos.");
      }

      if (resultadoFornecedores.status === "fulfilled") {
        setFornecedores(resultadoFornecedores.value);
      } else {
        setErroFornecedores(resultadoFornecedores.reason?.message || "Erro ao carregar fornecedores.");
      }

      const errosFeed = [];
      if (resultadoAvisos.status === "fulfilled") setAvisos(resultadoAvisos.value);
      else errosFeed.push(resultadoAvisos.reason?.message || "Erro ao carregar avisos.");
      if (resultadoMovimentacoes.status === "fulfilled") setMovimentacoes(resultadoMovimentacoes.value);
      else errosFeed.push(resultadoMovimentacoes.reason?.message || "Erro ao carregar movimentações.");
      if (resultadoEmpresa.status === "fulfilled") setEmpresa(resultadoEmpresa.value);
      else errosFeed.push(resultadoEmpresa.reason?.message || "Erro ao carregar a empresa.");
      setErroFeed(errosFeed.join(" "));

      setCarregando(false);
    }

    carregarDados();

    return () => {
      ativo = false;
    };
  }, []);

  async function salvarAviso(evento) {
    evento.preventDefault();
    setMensagemAviso("");
    setErroFeed("");
    setSalvandoAviso(true);
    try {
      await requisicaoAPI(
        `${API_URL}/avisos${avisoEmEdicao ? `/${avisoEmEdicao}` : ""}`,
        {
          method: avisoEmEdicao ? "PUT" : "POST",
          body: JSON.stringify({
            titulo: avisoFormulario.titulo.trim(),
            mensagem: avisoFormulario.mensagem.trim()
          })
        }
      );
      setAvisoFormulario({ titulo: "", mensagem: "" });
      setAvisoEmEdicao(null);
      setMensagemAviso("Aviso salvo no mural da empresa.");
      const dados = await requisicaoAPI(`${API_URL}/avisos`);
      setAvisos(dados);
    } catch (error) {
      setErroFeed(error.message || "Não foi possível salvar o aviso.");
    } finally {
      setSalvandoAviso(false);
    }
  }

  async function excluirAviso(aviso) {
    if (!window.confirm(`Excluir o aviso "${aviso.titulo}"?`)) return;
    setErroFeed("");
    try {
      await requisicaoAPI(`${API_URL}/avisos/${aviso.id}`, { method: "DELETE" });
      setAvisos((atuais) => atuais.filter((item) => item.id !== aviso.id));
      if (avisoEmEdicao === aviso.id) {
        setAvisoEmEdicao(null);
        setAvisoFormulario({ titulo: "", mensagem: "" });
      }
    } catch (error) {
      setErroFeed(error.message || "Não foi possível excluir o aviso.");
    }
  }

  function editarAviso(aviso) {
    setAvisoEmEdicao(aviso.id);
    setAvisoFormulario({ titulo: aviso.titulo, mensagem: aviso.mensagem });
  }

  const produtosBaixoEstoque = produtos.filter(
    (produto) => Number(produto.quantidade || 0) <= Number(produto.estoque_minimo || 0)
  );
  const produtosRecentes = [...produtos]
    .sort((a, b) => Number(b.id) - Number(a.id))
    .slice(0, 5);
  const valorEstoque = produtos.reduce(
    (total, produto) => total + Number(produto.custo || 0),
    0
  );

  const indicadores = [
    {
      titulo: "Produtos cadastrados",
      valor: carregando ? "..." : erroProdutos ? "—" : produtos.length,
      detalhe: erroProdutos || "Itens no catálogo",
      icone: "▦"
    },
    {
      titulo: "Estoque baixo",
      valor: carregando ? "..." : erroProdutos ? "—" : produtosBaixoEstoque.length,
      detalhe: erroProdutos || "No mínimo ou abaixo dele",
      icone: "⚠"
    },
    {
      titulo: "Fornecedores",
      valor: carregando ? "..." : erroFornecedores ? "—" : fornecedores.length,
      detalhe: erroFornecedores || "Cadastros disponíveis",
      icone: "♧"
    },
    {
      titulo: "Custo do estoque",
      valor: carregando ? "..." : erroProdutos ? "—" : formatarMoeda(valorEstoque),
      detalhe: erroProdutos || "Custo unitário × quantidade",
      icone: "$"
    }
  ];

  const erroDados = [erroProdutos, erroFornecedores].filter(Boolean).join(" ");
  const feed = [
    ...avisos.map((item) => ({ ...item, categoria: "aviso" })),
    ...movimentacoes.map((item) => ({ ...item, categoria: "movimentacao" }))
  ]
    .sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em))
    .slice(0, 12);

  function formatarData(valor) {
    return new Date(valor).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  }

  return (
    <div className="dashboard">
      <Sidebar />

      <main className="dashboard-main" id="inicio">
        <header className="topbar">
          <div>
            <span className="eyebrow">SEU NEGÓCIO EM FOCO</span>
            <h1>Visão geral</h1>
            {empresa && <p className="dashboard-company-name">{empresa.nome}</p>}
          </div>

          <div className="profile">
            <div className="avatar">{nome.charAt(0).toUpperCase()}</div>
            <div>
              <strong>{nome}</strong>
              <small>{email}</small>
            </div>
          </div>
        </header>

        <section className="welcome-banner">
          <div>
            <span>PAINEL DE CONTROLE</span>
            <h2>Bem-vindo ao SEIA!</h2>
            <p>Acompanhe a gestão do seu estoque em um só lugar.</p>
            <button className="dashboard-scan-button" onClick={() => navigate("/bip")}>
              ▥ Ler código de barras
            </button>
          </div>
        </section>

        <section className="section-heading">
          <div>
            <h2>Resumo do estoque</h2>
            <p>Indicadores calculados a partir dos cadastros do sistema.</p>
          </div>
          <span className="demo-tag">DADOS DO SISTEMA</span>
        </section>

        {erroDados && <p className="dashboard-data-error" role="alert">{erroDados}</p>}

        <section className="stats-grid">
          {indicadores.map((item) => (
            <article className="stat-card" key={item.titulo}>
              <div className="stat-icon">{item.icone}</div>
              <p>{item.titulo}</p>
              <strong>{item.valor}</strong>
              <small>{item.detalhe}</small>
            </article>
          ))}
        </section>

        <section className="content-grid">
          <article className="panel" id="produtos">
            <div className="panel-heading">
              <h3>Produtos recentes</h3>
              <button className="dashboard-link" onClick={() => navigate("/produtos")}>
                Ver produtos →
              </button>
            </div>

            {carregando ? (
              <div className="dashboard-list-empty">Carregando produtos...</div>
            ) : erroProdutos ? (
              <div className="dashboard-list-empty">Não foi possível carregar os produtos.</div>
            ) : produtosRecentes.length === 0 ? (
              <div className="dashboard-list-empty">Nenhum produto cadastrado.</div>
            ) : (
              <ul className="dashboard-data-list">
                {produtosRecentes.map((produto) => (
                  <li className="dashboard-data-row" key={produto.id}>
                    <div>
                      <strong>{produto.nome}</strong>
                      <small>ID #{produto.id} · {formatarMoeda(produto.preco)}</small>
                    </div>
                    <span>
                      {formatarQuantidade(produto.quantidade)} {produto.unidade_medida || "un"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </article>

          <article className="panel" id="relatorios">
            <div className="panel-heading">
              <h3>Estoque baixo</h3>
              <button className="dashboard-link" onClick={() => navigate("/produtos")}>
                Ver produtos →
              </button>
            </div>

            {carregando ? (
              <div className="dashboard-list-empty">Calculando níveis de estoque...</div>
            ) : erroProdutos ? (
              <div className="dashboard-list-empty">Não foi possível verificar o estoque.</div>
            ) : produtosBaixoEstoque.length === 0 ? (
              <div className="dashboard-list-empty">Nenhum produto no mínimo de estoque.</div>
            ) : (
              <ul className="dashboard-data-list">
                {produtosBaixoEstoque.slice(0, 5).map((produto) => (
                  <li className="dashboard-data-row" key={produto.id}>
                    <div>
                      <strong>{produto.nome}</strong>
                      <small>Mínimo: {formatarQuantidade(produto.estoque_minimo)} {produto.unidade_medida || "un"}</small>
                    </div>
                    <span className="dashboard-stock-low">
                      {formatarQuantidade(produto.quantidade)} {produto.unidade_medida || "un"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </article>
        </section>

        <section className="dashboard-feed-section">
          <div className="section-heading">
            <div>
              <h2>Mural da empresa</h2>
              <p>Avisos e movimentações recentes com a identificação de quem realizou cada ação.</p>
            </div>
            <button className="dashboard-link" onClick={() => navigate("/movimentacoes")}>
              Ver movimentações →
            </button>
          </div>

          {(erroFeed || mensagemAviso) && (
            <p className={erroFeed ? "dashboard-data-error" : "dashboard-feed-success"} role={erroFeed ? "alert" : "status"}>
              {erroFeed || mensagemAviso}
            </p>
          )}

          <div className="dashboard-feed-grid">
            <article className="panel dashboard-feed-panel">
              <div className="panel-heading">
                <h3>Atividade recente</h3>
                <span className="dashboard-feed-count">{feed.length} itens</span>
              </div>
              {carregando ? (
                <div className="dashboard-list-empty">Carregando mural...</div>
              ) : feed.length === 0 ? (
                <div className="dashboard-list-empty">Ainda não há avisos ou movimentações nesta empresa.</div>
              ) : (
                <ul className="dashboard-feed-list">
                  {feed.map((item) => (
                    <li className="dashboard-feed-item" key={`${item.categoria}-${item.id}`}>
                      <span className={`dashboard-feed-icon ${item.categoria}`}>
                        {item.categoria === "aviso" ? "!" : item.tipo === "entrada" ? "↗" : item.tipo === "saida" ? "↘" : "↔"}
                      </span>
                      <div className="dashboard-feed-content">
                        <div className="dashboard-feed-title-row">
                          <strong>{item.categoria === "aviso" ? item.titulo : `${item.tipo} de ${item.produto_nome}`}</strong>
                          <time>{formatarData(item.criado_em)}</time>
                        </div>
                        <p>
                          {item.categoria === "aviso"
                            ? item.mensagem
                            : `${item.usuario_nome} · ${item.motivo} · saldo ${formatarQuantidade(item.saldo_posterior)}`}
                        </p>
                        {item.categoria === "aviso" && (
                          <small>Publicado por {item.usuario_nome}</small>
                        )}
                      </div>
                      {item.categoria === "aviso" && ["admin", "gerente"].includes(empresa?.role) && (
                        <div className="dashboard-feed-actions">
                          <button type="button" onClick={() => editarAviso(item)}>Editar</button>
                          <button type="button" onClick={() => excluirAviso(item)}>Excluir</button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </article>

            {["admin", "gerente"].includes(empresa?.role) && (
              <article className="panel dashboard-notice-editor">
                <div className="panel-heading">
                  <h3>{avisoEmEdicao ? "Editar aviso" : "Novo aviso"}</h3>
                </div>
                <form onSubmit={salvarAviso}>
                  <label htmlFor="aviso-titulo">Título</label>
                  <input
                    id="aviso-titulo"
                    value={avisoFormulario.titulo}
                    onChange={(evento) => setAvisoFormulario((atual) => ({ ...atual, titulo: evento.target.value }))}
                    required
                    minLength={2}
                    maxLength={150}
                  />
                  <label htmlFor="aviso-mensagem">Mensagem</label>
                  <textarea
                    id="aviso-mensagem"
                    value={avisoFormulario.mensagem}
                    onChange={(evento) => setAvisoFormulario((atual) => ({ ...atual, mensagem: evento.target.value }))}
                    required
                    minLength={2}
                    maxLength={2000}
                    rows={6}
                  />
                  <div className="dashboard-notice-actions">
                    <button className="dashboard-scan-button" type="submit" disabled={salvandoAviso}>
                      {salvandoAviso ? "Salvando..." : avisoEmEdicao ? "Atualizar aviso" : "Publicar aviso"}
                    </button>
                    {avisoEmEdicao && (
                      <button
                        className="dashboard-link"
                        type="button"
                        onClick={() => {
                          setAvisoEmEdicao(null);
                          setAvisoFormulario({ titulo: "", mensagem: "" });
                        }}
                      >
                        Cancelar edição
                      </button>
                    )}
                  </div>
                </form>
              </article>
            )}
          </div>
        </section>

        <footer className="footer">
          SEIA · Sistema de Estoque para Agro
        </footer>
      </main>
    </div>
  );
}