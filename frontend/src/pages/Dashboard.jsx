
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
          <button className="menu-item active" onClick={() => navigate("/dashboard")}>
            <span>▦</span> Visão geral
          </button>
          <button className="menu-item" onClick={() => navigate("/produtos")}>
            <span>▤</span> Produtos
          </button>
          <button className="menu-item" onClick={() => navigate("/bip")}>
            <span>▥</span> Bip de produtos
          </button>
          <button className="menu-item" onClick={() => navigate("/entradas")}>
            <span>↗</span> Entradas
          </button>
          <button className="menu-item" onClick={() => navigate("/saidas")}>
            <span>↘</span> Saídas
          </button>
          <button className="menu-item" onClick={() => navigate("/relatorios")}>
            <span>▥</span> Relatórios
          </button>
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
              <button className="dashboard-link" onClick={() => navigate("/produtos")}>
                Ver produtos →
              </button>
            </div>
            <div className="empty-state">
              <div className="empty-icon">▤</div>
              <strong>Nenhum produto por aqui</strong>
              <p>Os produtos cadastrados aparecerão nesta área.</p>
              <button className="dashboard-secondary-button" onClick={() => navigate("/bip")}>
                Consultar por código de barras
              </button>
            </div>
          </article>

          <article className="panel" id="relatorios">
            <div className="panel-heading">
              <h3>Atividade recente</h3>
            </div>
            <div className="empty-state">
              <div className="empty-icon">◷</div>
              <strong>Nenhuma movimentação</strong>
              <p>As entradas e saídas do estoque poderão ser acompanhadas aqui.</p>
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
