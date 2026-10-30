import { useLocation, useNavigate } from "react-router-dom";
import { logout } from "../services/api";

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();

  const paginaAtual = location.pathname;

  function sair() {
    logout();
    navigate("/", { replace: true });
  }

  const adminSeia = localStorage.getItem("role") === "admin_seia";
  const menus = [
    { caminho: "/dashboard", nome: "Visão geral", icone: "▦" },
    { caminho: "/produtos", nome: "Produtos", icone: "▤" },
    { caminho: "/fornecedores", nome: "Fornecedores", icone: "♧" },
    { caminho: "/bip", nome: "Bip de produtos", icone: "▥" },
    { caminho: "/movimentacoes", nome: "Movimentações", icone: "↔" },
    { caminho: "/relatorios", nome: "Relatórios", icone: "▥" }
  ];

  return (
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
        {adminSeia && (
          <button
            className={`menu-item ${paginaAtual === "/admin/empresas" ? "active" : ""}`}
            onClick={() => navigate("/admin/empresas")}
          >
            <span>▦</span>
            Empresas SEIA
          </button>
        )}
        {menus.map((item) => (
          <button
            key={item.caminho}
            className={`menu-item ${paginaAtual === item.caminho || (item.caminho !== "/dashboard" && paginaAtual.startsWith(`${item.caminho}/`)) ? "active" : ""}`}
            onClick={() => navigate(item.caminho)}
          >
            <span>{item.icone}</span>
            {item.nome}
          </button>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <span className="menu-label">CONTA</span>
        <button className={`menu-item ${paginaAtual === "/empresa" ? "active" : ""}`} onClick={() => navigate("/empresa")}>
          <span>⌂</span>
          Empresa
        </button>
        <button className="menu-item logout" onClick={sair}>
          <span>⇥</span>
          Sair do sistema
        </button>
      </div>
    </aside>
  );
}