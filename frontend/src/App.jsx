
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import Login from "./pages/Login";
import Cadastro from "./pages/Cadastro";
import EsqueciSenha from "./pages/EsqueciSenha";
import Dashboard from "./pages/Dashboard";
import ScanBip from "./pages/ScanBip";
import Produtos from "./pages/Produtos";
import Fornecedor from "./pages/Fornecedor";

function RotaProtegida({ children }) {
  const token = localStorage.getItem("token");

  return token ? children : <Navigate to="/" replace />;
}

function RotaPublica({ children }) {
  const token = localStorage.getItem("token");

  return token ? <Navigate to="/dashboard" replace /> : children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <RotaPublica>
              <Login />
            </RotaPublica>
          }
        />

        <Route
          path="/login"
          element={
            <RotaPublica>
              <Login />
            </RotaPublica>
          }
        />

        <Route
          path="/registro"
          element={
            <RotaPublica>
              <Cadastro />
            </RotaPublica>
          }
        />

        <Route
          path="/esqueci-senha"
          element={
            <RotaPublica>
              <EsqueciSenha />
            </RotaPublica>
          }
        />

        <Route path="/cadastro" element={<Navigate to="/registro" replace />} />

        <Route
          path="/dashboard"
          element={
            <RotaProtegida>
              <Dashboard />
            </RotaProtegida>
          }
        />

        <Route
          path="/bip"
          element={
            <RotaProtegida>
              <ScanBip />
            </RotaProtegida>
          }
        />

        <Route
          path="/produtos"
          element={
            <RotaProtegida>
              <Produtos />
            </RotaProtegida>
          }
        />

        <Route
          path="/fornecedores"
          element={
            <RotaProtegida>
              <Fornecedor />
            </RotaProtegida>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
