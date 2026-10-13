import { useState } from "react";
import { Link } from "react-router-dom";
import { esqueciSenha } from "../services/api";

export default function EsqueciSenha() {
  const [email, setEmail] = useState("");
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();

    setErro("");
    setSucesso("");
    setCarregando(true);

    try {
      const resultado = await esqueciSenha(email);
      setSucesso(
        resultado.mensagem ||
          "Se possível, enviaremos as instruções para seu email."
      );
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
          <span>RECUPERAÇÃO DE ACESSO</span>
          <h2>Estamos aqui para ajudar.</h2>
          <p>
            Recupere o acesso à sua conta e continue
            gerenciando seu estoque com tranquilidade.
          </p>
        </div>

        <span className="brand-footer">
          SEIA • Gestão para o agronegócio
        </span>
      </section>

      <section className="auth-content">
        <form className="auth-card" onSubmit={handleSubmit}>
          <span className="eyebrow">RECUPERAÇÃO DE CONTA</span>

          <h2>Esqueceu sua senha?</h2>

          <p className="muted">
            Informe seu email e enviaremos as instruções
            para redefinir sua senha.
          </p>

          <label htmlFor="email">E-mail cadastrado</label>

          <input
            id="email"
            type="email"
            placeholder="voce@empresa.com.br"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />

          {erro && (
            <div className="alert-error" role="alert">
              {erro}
            </div>
          )}

          {sucesso && (
            <div className="alert-success" role="status">
              {sucesso}
            </div>
          )}

          <button className="btn-primary" disabled={carregando}>
            {carregando
              ? "Enviando..."
              : "Enviar email de recuperação"}
          </button>

          <p className="auth-switch">
            Lembrou sua senha? <Link to="/">Voltar ao login</Link>
          </p>
        </form>
      </section>
    </div>
  );
}