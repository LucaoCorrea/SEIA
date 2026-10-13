import { useNavigate } from "react-router-dom";
import { logout } from "../services/api";

export default function Dashboard() {
  const navigate = useNavigate();
  const email = localStorage.getItem("email") || "Usuário";

  function sair() {
    logout();
    navigate("/", { replace: true });
  }

  const indicadores = [
    { titulo: "Produtos cadastrados", valor: "0", icone: "▦" },
    { titulo: "Estoque baixo", valor: "0", icone: "⚠" },
    { titulo: "Entradas no mês", valor: "0", icone: "↗" },
    { titulo: "Saídas no mês", valor: "0", icone: "↘" },
  ];

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-logo small">S</div>
          <div>
            <strong>SEIA</strong>
            <small>Gestão Agro</small>
          </div>
        </div>

        <span className="menu-label">MENU PRINCIPAL</span>

        <nav>
          <a className="menu-item active" href="#inicio">
            <span>▦</span> Visão geral
          </a>
          <a className="menu-item" href="#produtos">
            <span>▤</span> Produtos
          </a>
          <a className="menu-item" href="#entradas">
            <span>↗</span> Entradas
          </a>
          <a className="menu-item" href="#saidas">
            <span>↘</span> Saídas
          </a>
          <a className="menu-item" href="#relatorios">
            <span>▥</span> Relatórios
          </a>
        </nav>

        <div className="sidebar-bottom">
          <span className="menu-label">CONTA</span>
          <button className="menu-item logout" onClick={sair}>
            <span>⇥</span> Sair do sistema
          </button>
        </div>
      </aside>

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
            <p>
              Acompanhe a gestão do seu estoque em um só lugar.
            </p>
          </div>
          <div className="banner-symbol">✳</div>
        </section>

        <section className="section-heading">
          <div>
            <h2>Resumo do estoque</h2>
            <p>Indicadores gerais da sua operação.</p>
          </div>
          <span className="demo-tag">DADOS DEMONSTRATIVOS</span>
        </section>

        <section className="stats-grid">
          {indicadores.map((item) => (
            <article className="stat-card" key={item.titulo}>
              <div className="stat-icon">{item.icone}</div>
              <p>{item.titulo}</p>
              <strong>{item.valor}</strong>
              <small>Sem dados cadastrados</small>
            </article>
          ))}
        </section>

        <section className="content-grid">
          <article className="panel" id="produtos">
            <div className="panel-heading">
              <h3>Produtos recentes</h3>
              <span>Estoque</span>
            </div>
            <div className="empty-state">
              <div className="empty-icon">▤</div>
              <strong>Nenhum produto por aqui</strong>
              <p>
                Os produtos cadastrados poderão aparecer
                nesta área quando a API estiver disponível.
              </p>
            </div>
          </article>

          <article className="panel" id="relatorios">
            <div className="panel-heading">
              <h3>Atividade recente</h3>
            </div>
            <div className="empty-state">
              <div className="empty-icon">◷</div>
              <strong>Nenhuma movimentação</strong>
              <p>
                As entradas e saídas do estoque poderão
                ser acompanhadas aqui.
              </p>
            </div>
          </article>
        </section>

        <footer className="footer">
          SEIA · Sistema de Estoque para Agro
        </footer>
      </main>
    </div>
  );
}