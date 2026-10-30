import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";

const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/$/, "");

async function buscarLista(endpoint, entidade) {
  const resposta = await fetch(`${API_URL}${endpoint}`);

  if (!resposta.ok) {
    throw new Error(`Não foi possível carregar ${entidade}.`);
  }

  const dados = await resposta.json();
  return Array.isArray(dados) ? dados : [];
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
  const [produtos, setProdutos] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erroProdutos, setErroProdutos] = useState("");
  const [erroFornecedores, setErroFornecedores] = useState("");

  useEffect(() => {
    let ativo = true;

    async function carregarDados() {
      const [resultadoProdutos, resultadoFornecedores] = await Promise.allSettled([
        buscarLista("/listar-produtos", "os produtos"),
        buscarLista("/listar-fornecedores", "os fornecedores")
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

      setCarregando(false);
    }

    carregarDados();

    return () => {
      ativo = false;
    };
  }, []);

  const produtosBaixoEstoque = produtos.filter(
    (produto) => Number(produto.quantidade || 0) <= Number(produto.estoque_minimo || 0)
  );
  const produtosRecentes = [...produtos]
    .sort((a, b) => Number(b.id) - Number(a.id))
    .slice(0, 5);
  const valorEstoque = produtos.reduce(
    (total, produto) => total + Number(produto.custo || 0) * Number(produto.quantidade || 0),
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

  return (
    <div className="dashboard">
      <Sidebar />

      <main className="dashboard-main" id="inicio">
        <header className="topbar">
          <div>
            <span className="eyebrow">SEU NEGÓCIO EM FOCO</span>
            <h1>Visão geral</h1>
          </div>

          <div className="profile">
            <div className="avatar">U</div>
            <div>
              <strong>Usuário</strong>
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
          <div className="banner-symbol">✳</div>
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

        <footer className="footer">
          SEIA · Sistema de Estoque para Agro
        </footer>
      </main>
    </div>
  );
}