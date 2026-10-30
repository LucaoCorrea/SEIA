import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_URL, logout, requisicaoAPI } from "../services/api";
import "./Movimentacoes.css";

const formularioInicial = {
  nome: "",
  cnpj: "",
  cep: "",
  administrador_nome: "",
  administrador_email: "",
  administrador_senha: "",
  administrador_telefone: ""
};

function editarEmpresa(empresa) {
  return {
    nome: empresa.nome,
    cnpj: empresa.cnpj || "",
    cep: empresa.cep
  };
}

export default function AdminEmpresas() {
  const navigate = useNavigate();
  const [empresas, setEmpresas] = useState([]);
  const [formulario, setFormulario] = useState(formularioInicial);
  const [empresaEditada, setEmpresaEditada] = useState(null);
  const [dadosEdicao, setDadosEdicao] = useState({ nome: "", cnpj: "", cep: "" });
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  const carregarEmpresas = useCallback(async () => {
    try {
      const lista = await requisicaoAPI(`${API_URL}/admin/empresas`);
      setEmpresas(lista);
      setErro("");
    } catch (error) {
      setErro(error.message || "Não foi possível carregar as empresas.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    let ativo = true;
    async function carregarInicial() {
      try {
        const lista = await requisicaoAPI(`${API_URL}/admin/empresas`);
        if (ativo) {
          setEmpresas(lista);
          setErro("");
        }
      } catch (error) {
        if (ativo) setErro(error.message || "Não foi possível carregar as empresas.");
      } finally {
        if (ativo) setCarregando(false);
      }
    }
    carregarInicial();
    return () => {
      ativo = false;
    };
  }, []);

  function atualizarCampo(evento) {
    setFormulario((atual) => ({ ...atual, [evento.target.name]: evento.target.value }));
  }

  async function cadastrarEmpresa(evento) {
    evento.preventDefault();
    setErro("");
    setSucesso("");
    setSalvando(true);
    try {
      await requisicaoAPI(`${API_URL}/admin/empresas`, {
        method: "POST",
        body: JSON.stringify({
          ...formulario,
          nome: formulario.nome.trim(),
          cnpj: formulario.cnpj.trim() || null,
          cep: formulario.cep.trim(),
          administrador_nome: formulario.administrador_nome.trim(),
          administrador_email: formulario.administrador_email.trim(),
          administrador_telefone: formulario.administrador_telefone.trim() || null
        })
      });
      setFormulario(formularioInicial);
      setSucesso("Empresa cadastrada e conta do administrador criada.");
      await carregarEmpresas();
    } catch (error) {
      setErro(error.message || "Não foi possível cadastrar a empresa.");
    } finally {
      setSalvando(false);
    }
  }

  async function salvarEdicao(evento) {
    evento.preventDefault();
    setErro("");
    setSucesso("");
    setSalvando(true);
    try {
      const atualizada = await requisicaoAPI(`${API_URL}/admin/empresas/${empresaEditada}`, {
        method: "PUT",
        body: JSON.stringify({
          nome: dadosEdicao.nome.trim(),
          cnpj: dadosEdicao.cnpj.trim() || null,
          cep: dadosEdicao.cep.trim()
        })
      });
      setEmpresas((atuais) => atuais.map((empresa) => empresa.id === atualizada.id ? atualizada : empresa));
      setEmpresaEditada(null);
      setSucesso("Dados da empresa atualizados.");
    } catch (error) {
      setErro(error.message || "Não foi possível atualizar a empresa.");
    } finally {
      setSalvando(false);
    }
  }

  async function excluirEmpresa(empresa) {
    if (!window.confirm(`Excluir a empresa "${empresa.nome}"? Só é permitido sem dados ou histórico.`)) return;
    setErro("");
    setSucesso("");
    setSalvando(true);
    try {
      await requisicaoAPI(`${API_URL}/admin/empresas/${empresa.id}`, { method: "DELETE" });
      setEmpresas((atuais) => atuais.filter((item) => item.id !== empresa.id));
      setSucesso("Empresa excluída.");
    } catch (error) {
      setErro(error.message || "Não foi possível excluir a empresa.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <main className="admin-empresas-page produtos-page">
      <header className="produtos-header">
        <div>
          <span className="produtos-eyebrow">SEIA / ADMINISTRAÇÃO GLOBAL</span>
          <h1>Empresas</h1>
          <p>Somente o administrador global do SEIA pode cadastrar empresas e seus primeiros administradores.</p>
        </div>
        <button
          className="produto-btn produto-btn-secondary"
          type="button"
          onClick={() => {
            logout();
            navigate("/login", { replace: true });
          }}
        >
          Sair
        </button>
      </header>

      {erro && <div className="produto-alert produto-alert-error" role="alert">{erro}</div>}
      {sucesso && <div className="produto-alert produto-alert-success" role="status">{sucesso}</div>}

      <section className="produto-panel movimentacao-form-panel">
        <div className="produto-panel-heading">
          <div>
            <span className="produto-section-label">NOVO CLIENTE</span>
            <h2>Cadastrar empresa</h2>
            <p>O administrador inicial poderá criar contas de funcionários para sua equipe.</p>
          </div>
        </div>
        <form className="produto-form admin-company-form" onSubmit={cadastrarEmpresa}>
          <div className="produto-form-group">
            <label htmlFor="admin-company-name">Nome da empresa</label>
            <input id="admin-company-name" name="nome" value={formulario.nome} onChange={atualizarCampo} required minLength={2} maxLength={150} />
          </div>
          <div className="produto-form-group">
            <label htmlFor="admin-company-cnpj">CNPJ (opcional)</label>
            <input id="admin-company-cnpj" name="cnpj" value={formulario.cnpj} onChange={atualizarCampo} maxLength={18} />
          </div>
          <div className="produto-form-group">
            <label htmlFor="admin-company-cep">CEP</label>
            <input id="admin-company-cep" name="cep" value={formulario.cep} onChange={atualizarCampo} required minLength={8} maxLength={9} />
          </div>
          <div className="admin-company-divider"><strong>Administrador da empresa</strong></div>
          <div className="produto-form-group">
            <label htmlFor="admin-user-name">Nome</label>
            <input id="admin-user-name" name="administrador_nome" value={formulario.administrador_nome} onChange={atualizarCampo} required minLength={2} maxLength={150} />
          </div>
          <div className="produto-form-group">
            <label htmlFor="admin-user-email">E-mail de acesso</label>
            <input id="admin-user-email" name="administrador_email" type="email" value={formulario.administrador_email} onChange={atualizarCampo} required />
          </div>
          <div className="produto-form-group">
            <label htmlFor="admin-user-phone">Telefone (opcional)</label>
            <input id="admin-user-phone" name="administrador_telefone" value={formulario.administrador_telefone} onChange={atualizarCampo} maxLength={20} />
          </div>
          <div className="produto-form-group">
            <label htmlFor="admin-user-password">Senha inicial (mínimo 8 caracteres)</label>
            <input id="admin-user-password" name="administrador_senha" type="password" value={formulario.administrador_senha} onChange={atualizarCampo} required minLength={8} autoComplete="new-password" />
          </div>
          <button className="produto-btn produto-btn-primary" type="submit" disabled={salvando}>
            {salvando ? "Cadastrando..." : "Cadastrar empresa"}
          </button>
        </form>
      </section>

      <section className="produto-panel movimentacao-history-panel">
        <div className="produto-panel-heading">
          <div>
            <span className="produto-section-label">BASE SEIA</span>
            <h2>Empresas cadastradas</h2>
          </div>
          <button className="produto-btn produto-btn-secondary" type="button" onClick={() => { setCarregando(true); carregarEmpresas(); }} disabled={carregando}>
            Atualizar lista
          </button>
        </div>
        {carregando ? (
          <div className="dashboard-list-empty">Carregando empresas...</div>
        ) : empresas.length === 0 ? (
          <div className="dashboard-list-empty">Nenhuma empresa cadastrada.</div>
        ) : (
          <div className="movimentacao-table-wrap">
            <table className="movimentacao-table">
              <thead>
                <tr><th>Empresa</th><th>CNPJ</th><th>CEP</th><th>Administrador</th><th>Usuários</th><th>Ação</th></tr>
              </thead>
              <tbody>
                {empresas.map((empresa) => (
                  <tr key={empresa.id}>
                    <td><strong>{empresa.nome}</strong><small className="movimentacao-saldo">ID #{empresa.id}</small></td>
                    <td>{empresa.cnpj || "—"}</td>
                    <td>{empresa.cep}</td>
                    <td>{empresa.administrador_email || "—"}</td>
                    <td>{empresa.usuarios.length}</td>
                    <td className="admin-company-actions">
                      <button
                        type="button"
                        className="produto-btn produto-btn-primary"
                        onClick={() => {
                          localStorage.setItem("empresa_id", String(empresa.id));
                          navigate("/dashboard");
                        }}
                      >
                        Acessar
                      </button>
                      <button
                        type="button"
                        className="dashboard-link"
                        onClick={() => {
                          setEmpresaEditada(empresa.id);
                          setDadosEdicao(editarEmpresa(empresa));
                        }}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="dashboard-link admin-company-delete"
                        onClick={() => excluirEmpresa(empresa)}
                        disabled={salvando}
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {empresaEditada !== null && (
        <div className="admin-edit-overlay" role="presentation" onMouseDown={(evento) => {
          if (evento.target === evento.currentTarget) setEmpresaEditada(null);
        }}>
          <section className="produto-panel admin-edit-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-edit-title">
            <div className="produto-panel-heading">
              <div><span className="produto-section-label">CADASTRO SEIA</span><h2 id="admin-edit-title">Editar empresa #{empresaEditada}</h2></div>
              <button className="dashboard-link" type="button" onClick={() => setEmpresaEditada(null)}>Fechar</button>
            </div>
            <form className="produto-form" onSubmit={salvarEdicao}>
              <div className="produto-form-group">
                <label htmlFor="edit-company-name">Nome</label>
                <input id="edit-company-name" value={dadosEdicao.nome} onChange={(evento) => setDadosEdicao((atual) => ({ ...atual, nome: evento.target.value }))} required minLength={2} maxLength={150} />
              </div>
              <div className="produto-form-group">
                <label htmlFor="edit-company-cnpj">CNPJ (opcional)</label>
                <input id="edit-company-cnpj" value={dadosEdicao.cnpj} onChange={(evento) => setDadosEdicao((atual) => ({ ...atual, cnpj: evento.target.value }))} maxLength={18} />
              </div>
              <div className="produto-form-group">
                <label htmlFor="edit-company-cep">CEP</label>
                <input id="edit-company-cep" value={dadosEdicao.cep} onChange={(evento) => setDadosEdicao((atual) => ({ ...atual, cep: evento.target.value }))} required minLength={8} maxLength={9} />
              </div>
              <button className="produto-btn produto-btn-primary" type="submit" disabled={salvando}>
                {salvando ? "Salvando..." : "Salvar alterações"}
              </button>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
