import { useLocation, useNavigate } from "react-router-dom";
import { logout } from "../services/api";

const icones = {
  painel: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  produtos: <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" /><path d="m4.5 7.7 7.5 4.2 7.5-4.2M12 12v8.5" /></>,
  fornecedores: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
  fazendas: <><path d="M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6" /><path d="M9 10h.01M15 10h.01" /></>,
  bip: <><path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2" /><path d="M7 9v6M10 8v8M13 9v6M16 8v8" /></>,
  movimentacoes: <><path d="M7 7h13l-3-3M17 17H4l3 3" /><path d="M20 7a7 7 0 0 1-7 7M4 17a7 7 0 0 1 7-7" /></>,
  relatorios: <><path d="M4 19V5M4 19h17" /><path d="m7 15 4-4 3 2 6-7" /><path d="M17 6h3v3" /></>,
  empresa: <><path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-5h6v5" /><path d="M9 9h.01M15 9h.01M9 12h.01M15 12h.01" /></>,
  sair: <><path d="M10 17l5-5-5-5M15 12H3" /><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" /></>
};

function Icone({ nome }) {
  return (
    <svg
      className="sidebar-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {icones[nome]}
    </svg>
  );
}

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
    { caminho: "/dashboard", nome: "Visão geral", icone: "painel" },
    { caminho: "/produtos", nome: "Produtos", icone: "produtos" },
    { caminho: "/fornecedores", nome: "Fornecedores", icone: "fornecedores" },
    { caminho: "/fazendas", nome: "Fazendas e lotes", icone: "fazendas" },
    { caminho: "/bip", nome: "Bip de produtos", icone: "bip" },
    { caminho: "/movimentacoes", nome: "Movimentações", icone: "movimentacoes" },
    { caminho: "/relatorios", nome: "Relatórios", icone: "relatorios" }
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
            <Icone nome="empresa" />
            Empresas SEIA
          </button>
        )}
        {menus.map((item) => (
          <button
            key={item.caminho}
            className={`menu-item ${paginaAtual === item.caminho || (item.caminho !== "/dashboard" && paginaAtual.startsWith(`${item.caminho}/`)) ? "active" : ""}`}
            onClick={() => navigate(item.caminho)}
          >
            <Icone nome={item.icone} />
            {item.nome}
          </button>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <span className="menu-label">CONTA</span>
        <button className={`menu-item ${paginaAtual === "/empresa" ? "active" : ""}`} onClick={() => navigate("/empresa")}>
          <Icone nome="empresa" />
          Empresa
        </button>
        <button className="menu-item logout" onClick={sair}>
          <Icone nome="sair" />
          Sair do sistema
        </button>
      </div>
    </aside>
  );
}