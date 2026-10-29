
const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/$/, "");

async function tratarResposta(resposta, mensagemErro) {
  const dados = await resposta.json().catch(() => ({}));

  if (!resposta.ok) {
    throw new Error(
      typeof dados.detail === "string"
        ? dados.detail
        : mensagemErro
    );
  }

  return dados;
}

export async function login(email, password) {
  const resposta = await fetch(`${API_URL}/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  const dados = await tratarResposta(
    resposta,
    "Não foi possível realizar o login."
  );

  localStorage.setItem("token", dados.token);
  localStorage.setItem("email", dados.email);

  return dados;
}

export async function cadastrar(email, password) {
  const resposta = await fetch(`${API_URL}/registro`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  return await tratarResposta(
    resposta,
    "Não foi possível realizar o cadastro."
  );
}

export function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("email");
}

export async function esqueciSenha(email) {
  const resposta = await fetch(`${API_URL}/esqueci-senha`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email }),
  });

  return await tratarResposta(
    resposta,
    "Não foi possível enviar o email de redefinição."
  );
}