import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { login } from "../services/api";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setErro("");
    setCarregando(true);

    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (error) {
      setErro(error.message);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="auth-page">
      <section className="auth-brand">
        <div className="brand-logo">S</div>
        <h1>SEIA</h1>
        <p>Sistema de Estoque para Agro</p>

        <div className="brand-message">
          <span>GESTÃO INTELIGENTE</span>
          <h2>O controle do seu estoque começa aqui.</h2>
          <p>
            Mais organização, eficiência e controle para
            o dia a dia do agronegócio.
          </p>
        </div>

        <span className="brand-footer">
          SEIA • Gestão para o agronegócio
        </span>
      </section>

      <section className="auth-content">
        <form className="auth-card" onSubmit={handleSubmit}>
          <span className="eyebrow">BEM-VINDO DE VOLTA</span>
          <h2>Acesse sua conta</h2>
          <p className="muted">
            Entre para gerenciar seu estoque.
          </p>

          <label htmlFor="email">E-mail</label>
          <input
            id="email"
            type="email"
            placeholder="voce@empresa.com.br"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />

          <label htmlFor="password">Senha</label>
          <input
            id="password"
            type="password"
            placeholder="Digite sua senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />

        <div className="forgot-password">
          <Link to="/esqueci-senha" className="forgot-password-link">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>

            <span>Esqueci minha senha</span>

            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
          </Link>
        </div>

          {erro && <div className="alert-error">{erro}</div>}

          <button className="btn-primary" disabled={carregando}>
            {carregando ? "Entrando..." : "Entrar no sistema"}
          </button>

          <p className="auth-switch">
            Ainda não tem uma conta?{" "}
            <Link to="/cadastro">Criar conta</Link>
          </p>
        </form>
      </section>
    </div>
  );
}