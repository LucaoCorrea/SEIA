import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { API_URL, logout, requisicaoAPI } from "../services/api";
import "./Movimentacoes.css";

export default function Empresa() {
  const navigate = useNavigate();
  const [empresa, setEmpresa] = useState(null);
  const [formulario, setFormulario] = useState({ nome: "", cnpj: "", cep: "" });
  const [novoUsuario, setNovoUsuario] = useState({ nome: "", email: "", senha: "", telefone: "", role: "funcionario" });
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  const carregarEmpresa = useCallback(async () => {
    try {
      const dados = await requisicaoAPI(`${API_URL}/empresas/me`);
      setEmpresa(dados);
      setFormulario({
        nome: dados.nome || "",
        cnpj: dados.cnpj || "",
        cep: dados.cep || ""
      });
      setErro("");
    } catch (error) {
      setErro(
        error.status === 403
          ? "Esta conta ainda não está vinculada a uma empresa. Solicite o acesso ao administrador do SEIA."
          : error.message || "Não foi possível carregar a empresa."
      );
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    let ativo = true;
    async function carregarInicial() {
      try {
        const dados = await requisicaoAPI(`${API_URL}/empresas/me`);
        if (ativo) {
          setEmpresa(dados);
          setFormulario({
            nome: dados.nome || "",
            cnpj: dados.cnpj || "",
            cep: dados.cep || ""
          });
          setErro("");
        }
      } catch (error) {
        if (ativo) {
          setErro(
            error.status === 403
              ? "Esta conta ainda não está vinculada a uma empresa. Solicite o acesso ao administrador do SEIA."
              : error.message || "Não foi possível carregar a empresa."
          );
        }
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

  async function salvarEmpresa(evento) {
    evento.preventDefault();
    setErro("");
    setSucesso("");
    setSalvando(true);
    try {
      const atualizada = await requisicaoAPI(`${API_URL}/empresas/me`, {
        method: "PUT",
        body: JSON.stringify({
          nome: formulario.nome.trim(),
          cnpj: formulario.cnpj.trim() || null,
          cep: formulario.cep.trim()
        })
      });
      setEmpresa(atualizada);
      setSucesso("Dados da empresa atualizados.");
    } catch (error) {
      setErro(error.message || "Não foi possível atualizar a empresa.");
    } finally {
      setSalvando(false);
    }
  }

  async function cadastrarUsuario(evento) {
    evento.preventDefault();
    setErro("");
    setSucesso("");
    setSalvando(true);
    try {
      const usuario = await requisicaoAPI(`${API_URL}/empresas/usuarios`, {
        method: "POST",
        body: JSON.stringify({
          ...novoUsuario,
          nome: novoUsuario.nome.trim(),
          email: novoUsuario.email.trim(),
          telefone: novoUsuario.telefone.trim() || null
        })
      });
      setEmpresa((atual) => ({ ...atual, usuarios: [...atual.usuarios, usuario] }));
      setNovoUsuario({ nome: "", email: "", senha: "", telefone: "", role: "funcionario" });
      setSucesso("Usuário criado. Ele já pode entrar com o e-mail e a senha inicial.");
    } catch (error) {
      setErro(error.message || "Não foi possível criar o usuário.");
    } finally {
      setSalvando(false);
    }
  }

  async function excluirEmpresa() {
    if (!window.confirm("Excluir a empresa? Esta ação só é permitida quando não há dados de estoque ou histórico.")) return;
    setErro("");
    setSalvando(true);
    try {
      const endpoint = empresa.role === "admin_seia"
        ? `${API_URL}/admin/empresas/${empresa.id}`
        : `${API_URL}/empresas/me`;
      await requisicaoAPI(endpoint, { method: "DELETE" });
      logout();
      navigate("/login", { replace: true });
    } catch (error) {
      setErro(error.message || "Não foi possível excluir a empresa.");
    } finally {
      setSalvando(false);
    }
  }

  const podeEditar = empresa && ["admin", "gerente", "admin_seia"].includes(empresa.role);

  return (
    <div className="dashboard produtos-page-layout">
      <Sidebar />
      <main className="dashboard-main produtos-page movimentacoes-page">
        <header className="produtos-header">
          <div>
            <span className="produtos-eyebrow">SEIA / CONTA</span>
            <h1>Empresa</h1>
            <p>Consulte os dados compartilhados e os usuários vinculados à sua empresa.</p>
          </div>
          <button className="produto-btn produto-btn-secondary" type="button" onClick={() => { setCarregando(true); carregarEmpresa(); }} disabled={carregando}>
            <span className="produto-btn-icon">↻</span>
            Atualizar
          </button>
        </header>

        {erro && <div className="produto-alert produto-alert-error" role="alert">{erro}</div>}
        {sucesso && <div className="produto-alert produto-alert-success" role="status">{sucesso}</div>}
        {carregando ? (
          <div className="dashboard-list-empty">Carregando dados da empresa...</div>
        ) : empresa ? (
          <>
            <section className="produto-panel movimentacao-form-panel">
              <div className="produto-panel-heading">
                <div>
                  <span className="produto-section-label">DADOS CADASTRAIS</span>
                  <h2>{empresa.nome}</h2>
                  <p>ID da empresa: #{empresa.id}</p>
                </div>
              </div>
              <form className="produto-form empresa-form" onSubmit={salvarEmpresa}>
                <div className="produto-form-group">
                  <label htmlFor="nome-empresa">Nome</label>
                  <input id="nome-empresa" name="nome" value={formulario.nome} onChange={atualizarCampo} required maxLength={150} disabled={!podeEditar} />
                </div>
                <div className="produto-form-group">
                  <label htmlFor="cnpj-empresa">CNPJ</label>
                  <input id="cnpj-empresa" name="cnpj" value={formulario.cnpj} onChange={atualizarCampo} maxLength={18} disabled={!podeEditar} />
                </div>
                <div className="produto-form-group">
                  <label htmlFor="cep-empresa">CEP</label>
                  <input id="cep-empresa" name="cep" value={formulario.cep} onChange={atualizarCampo} required maxLength={9} disabled={!podeEditar} />
                </div>
                {podeEditar && (
                  <button className="produto-btn produto-btn-primary" type="submit" disabled={salvando}>
                    {salvando ? "Salvando..." : "Salvar dados"}
                  </button>
                )}
              </form>
            </section>

            <section className="produto-panel movimentacao-history-panel">
              <div className="produto-panel-heading">
                <div>
                  <span className="produto-section-label">EQUIPE</span>
                  <h2>Usuários da empresa</h2>
                  <p>Os usuários desta lista compartilham os dados de produtos, fornecedores e estoque.</p>
                </div>
              </div>
              {podeEditar && (
                <form className="produto-form empresa-form" onSubmit={cadastrarUsuario}>
                  <div className="produto-form-group">
                    <label htmlFor="novo-usuario-nome">Nome do usuário</label>
                    <input id="novo-usuario-nome" value={novoUsuario.nome} onChange={(evento) => setNovoUsuario((atual) => ({ ...atual, nome: evento.target.value }))} required minLength={2} maxLength={150} />
                  </div>
                  <div className="produto-form-group">
                    <label htmlFor="novo-usuario-email">E-mail</label>
                    <input id="novo-usuario-email" type="email" value={novoUsuario.email} onChange={(evento) => setNovoUsuario((atual) => ({ ...atual, email: evento.target.value }))} required />
                  </div>
                  <div className="produto-form-group">
                    <label htmlFor="novo-usuario-telefone">Telefone (opcional)</label>
                    <input id="novo-usuario-telefone" value={novoUsuario.telefone} onChange={(evento) => setNovoUsuario((atual) => ({ ...atual, telefone: evento.target.value }))} maxLength={20} />
                  </div>
                  <div className="produto-form-group">
                    <label htmlFor="novo-usuario-senha">Senha inicial (mínimo 8 caracteres)</label>
                    <input id="novo-usuario-senha" type="password" value={novoUsuario.senha} onChange={(evento) => setNovoUsuario((atual) => ({ ...atual, senha: evento.target.value }))} required minLength={8} autoComplete="new-password" />
                  </div>
                  {empresa.role === "admin_seia" && (
                    <div className="produto-form-group">
                      <label htmlFor="novo-usuario-role">Perfil</label>
                      <select id="novo-usuario-role" value={novoUsuario.role} onChange={(evento) => setNovoUsuario((atual) => ({ ...atual, role: evento.target.value }))}>
                        <option value="gerente">Gerente</option>
                        <option value="funcionario">Funcionário</option>
                      </select>
                    </div>
                  )}
                  <button className="produto-btn produto-btn-primary" type="submit" disabled={salvando}>
                    {salvando ? "Criando..." : "Criar usuário"}
                  </button>
                </form>
              )}
              {empresa.usuarios.length === 0 ? (
                <div className="dashboard-list-empty">Nenhum usuário vinculado à empresa.</div>
              ) : (
                <div className="movimentacao-table-wrap">
                  <table className="movimentacao-table">
                    <thead><tr><th>Nome</th><th>E-mail</th><th>Telefone</th><th>Perfil</th></tr></thead>
                    <tbody>
                      {empresa.usuarios.map((usuario) => (
                        <tr key={usuario.id}>
                          <td><strong>{usuario.nome}</strong></td>
                          <td>{usuario.email}</td>
                          <td>{usuario.telefone || "—"}</td>
                          <td>{usuario.role}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {["admin", "admin_seia"].includes(empresa.role) && (
                <button className="produto-btn empresa-delete-button" type="button" onClick={excluirEmpresa} disabled={salvando}>
                  Excluir empresa
                </button>
              )}
            </section>
          </>
        ) : (
          <section className="produto-panel movimentacao-history-panel">
            <h2>Empresa não disponível</h2>
            <p>Se esta conta deveria pertencer a uma empresa, solicite a vinculação ao administrador global do SEIA.</p>
          </section>
        )}
      </main>
    </div>
  );
}
