import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import Login from "./pages/Login";
import EsqueciSenha from "./pages/EsqueciSenha";
import Dashboard from "./pages/Dashboard";
import ScanBip from "./pages/ScanBip";
import Produtos from "./pages/Produtos";
import Fornecedor from "./pages/Fornecedor";
import Movimentacoes from "./pages/Movimentacoes";
import Empresa from "./pages/Empresa";
import AdminEmpresas from "./pages/AdminEmpresas";
import Fazendas from "./pages/Fazendas";
import Relatorios from "./pages/Relatorios";

function RotaProtegida({ children }) {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");

  if (!token) return <Navigate to="/login" replace />;
  if (role === "admin_seia" && !localStorage.getItem("empresa_id")) {
    return <Navigate to="/admin/empresas" replace />;
  }
  return children;
}

function RotaPublica({ children }) {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");

  return token
    ? <Navigate to={role === "admin_seia" ? "/admin/empresas" : "/dashboard"} replace />
    : children;
}

function RotaAdminSeia({ children }) {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");

  if (!token) return <Navigate to="/login" replace />;
  return role === "admin_seia" ? children : <Navigate to="/dashboard" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<RotaPublica><Login /></RotaPublica>} />
        <Route path="/esqueci-senha" element={<RotaPublica><EsqueciSenha /></RotaPublica>} />
        <Route
          path="/admin/empresas"
          element={<RotaAdminSeia><AdminEmpresas /></RotaAdminSeia>}
        />
        <Route path="/dashboard" element={<RotaProtegida><Dashboard /></RotaProtegida>} />
        <Route path="/bip" element={<RotaProtegida><ScanBip /></RotaProtegida>} />
        <Route path="/produtos" element={<RotaProtegida><Produtos /></RotaProtegida>} />
        <Route path="/fornecedores" element={<RotaProtegida><Fornecedor /></RotaProtegida>} />
        <Route path="/fazendas" element={<RotaProtegida><Fazendas /></RotaProtegida>} />
        <Route path="/relatorios" element={<RotaProtegida><Relatorios /></RotaProtegida>} />
        <Route path="/movimentacoes" element={<RotaProtegida><Movimentacoes /></RotaProtegida>} />
        <Route path="/empresa" element={<RotaProtegida><Empresa /></RotaProtegida>} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
