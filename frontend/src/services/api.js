export const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/$/, "");

async function tratarResposta(resposta, mensagemErro) {
  const dados = await resposta.json().catch(() => ({}));

  if (!resposta.ok) {
    const erro = new Error(
      typeof dados.detail === "string" ? dados.detail : mensagemErro
    );
    erro.status = resposta.status;
    throw erro;
  }

  return dados;
}

export async function login(email, password) {
  const resposta = await fetch(`${API_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const dados = await tratarResposta(resposta, "Não foi possível realizar o login.");
  localStorage.setItem("token", dados.token);
  localStorage.setItem("email", dados.email);
  localStorage.removeItem("empresa_id");
  if (dados.nome) localStorage.setItem("nome", dados.nome);
  if (dados.role) localStorage.setItem("role", dados.role);
  return dados;
}

export async function requisicaoAPI(url, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = localStorage.getItem("token");
  const empresaId = localStorage.getItem("empresa_id");

  if (localStorage.getItem("role") === "admin_seia" && empresaId) {
    headers.set("X-SEIA-Empresa-ID", empresaId);
  }

  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const resposta = await fetch(url, { ...options, headers });
  if (resposta.status === 204) return null;
  return tratarResposta(resposta, `Erro na requisição (${resposta.status}).`);
}

export function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("email");
  localStorage.removeItem("nome");
  localStorage.removeItem("role");
  localStorage.removeItem("empresa_id");
}

export async function esqueciSenha(email) {
  const resposta = await fetch(`${API_URL}/esqueci-senha`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });

  return tratarResposta(resposta, "Não foi possível enviar o email de redefinição.");
}
