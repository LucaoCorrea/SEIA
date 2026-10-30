import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { cadastrar } from "../services/api";

export default function Cadastro() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [carregando, setCarregando] = useState(false);

  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setErro("");
    setSucesso("");

    if (password.length < 6) {
      setErro("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    if (password !== confirmarSenha) {
      setErro("As senhas não coincidem.");
      return;
    }

    setCarregando(true);

    try {
      const resultado = await cadastrar(email, password);
      setSucesso(resultado.mensagem || "Cadastro realizado!");

      setTimeout(() => navigate("/login"), 1200);
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
          <span>FAÇA PARTE</span>
          <h2>Uma gestão melhor para o seu negócio.</h2>
          <p>
            Organize seus processos e prepare sua operação
            para crescer.
          </p>
        </div>

        <span className="brand-footer">
          SEIA • Gestão para o agronegócio
        </span>
      </section>

      <section className="auth-content">
        <form className="auth-card" onSubmit={handleSubmit}>
          <span className="eyebrow">NOVO ACESSO</span>
          <h2>Crie sua conta</h2>
          <p className="muted">
            Preencha os dados para começar.
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
            placeholder="Mínimo de 6 caracteres"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            minLength={6}
            required
          />

          <label htmlFor="confirmarSenha">Confirmar senha</label>
          <input
            id="confirmarSenha"
            type="password"
            placeholder="Digite a senha novamente"
            value={confirmarSenha}
            onChange={(e) => setConfirmarSenha(e.target.value)}
            autoComplete="new-password"
            required
          />

          {erro && <div className="alert-error">{erro}</div>}
          {sucesso && <div className="alert-success">{sucesso}</div>}

          <button className="btn-primary" disabled={carregando}>
            {carregando ? "Cadastrando..." : "Criar minha conta"}
          </button>

          <p className="auth-switch">
            Já tem uma conta? <Link to="/login">Fazer login</Link>
          </p>
        </form>
      </section>
    </div>
  );
}