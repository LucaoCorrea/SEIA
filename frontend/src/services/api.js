const API_URL = import.meta.env.VITE_API_URL;

export async function login(email, password) {
  const resposta = await fetch(`${API_URL}/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  const dados = await resposta.json();

  if (!resposta.ok) {
    throw new Error(
      typeof dados.detail === "string"
        ? dados.detail
        : "Não foi possível realizar o login."
    );
  }

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

  const dados = await resposta.json();

  if (!resposta.ok) {
    throw new Error(
      typeof dados.detail === "string"
        ? dados.detail
        : "Não foi possível realizar o cadastro."
    );
  }

  return dados;
}

export function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("email");
}