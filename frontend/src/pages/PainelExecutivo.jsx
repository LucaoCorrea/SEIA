import { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import DashboardExecutivo from "../components/DashboardExecutivo";
import { API_URL, requisicaoAPI } from "../services/api";

export default function PainelExecutivo() {
  const [dados, setDados] = useState({ produtos: [], movimentacoes: [], empresa: null });
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let ativo = true;
    async function carregar() {
      try {
        const [produtos, movimentacoes, empresa] = await Promise.all([
          requisicaoAPI(`${API_URL}/listar-produtos`),
          requisicaoAPI(`${API_URL}/dashboard/movimentacoes`),
          requisicaoAPI(`${API_URL}/empresas/me`)
        ]);
        if (!Array.isArray(produtos) || !Array.isArray(movimentacoes)) {
          throw new Error("Não foi possível carregar os dados do dashboard.");
        }
        if (ativo) setDados({ produtos, movimentacoes, empresa });
      } catch (error) {
        if (ativo) setErro(error.message || "Não foi possível carregar o dashboard.");
      } finally {
        if (ativo) setCarregando(false);
      }
    }
    carregar();
    return () => { ativo = false; };
  }, []);

  return (
    <div className="dashboard executivo-page">
      <Sidebar />
      <main className="dashboard-main">
        <header className="topbar">
          <div>
            <span className="eyebrow">SEU NEGÓCIO EM NÚMEROS</span>
            <h1>Dashboard executivo</h1>
            {dados.empresa && <p className="dashboard-company-name">{dados.empresa.nome}</p>}
          </div>
        </header>
        <DashboardExecutivo {...dados} carregando={carregando} erro={erro} />
        <footer className="footer">SEIA · Sistema de Estoque para Agro</footer>
      </main>
    </div>
  );
}

