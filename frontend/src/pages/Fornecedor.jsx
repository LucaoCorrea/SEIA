import { useCallback, useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import "./Produto.css";
import "./Fornecedor.css";

const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/$/, "");

const fornecedorInicial = {
	nome: "",
	email: "",
	telefone: "",
	cnpj: ""
};

async function requisicaoAPI(url, options = {}) {
	const resposta = await fetch(url, {
		...options,
		headers: {
			...(options.body ? { "Content-Type": "application/json" } : {}),
			...options.headers
		}
	});

	if (!resposta.ok) {
		const erro = await resposta.json().catch(() => null);
		throw new Error(erro?.detail || `Erro na requisição (${resposta.status}).`);
	}

	if (resposta.status === 204) return null;

	return resposta.json();
}

export default function Fornecedor() {
	const [fornecedores, setFornecedores] = useState([]);
	const [formulario, setFormulario] = useState(fornecedorInicial);
	const [fornecedorEmEdicao, setFornecedorEmEdicao] = useState(null);
	const [carregando, setCarregando] = useState(true);
	const [salvando, setSalvando] = useState(false);
	const [excluindo, setExcluindo] = useState(null);
	const [erro, setErro] = useState("");
	const [sucesso, setSucesso] = useState("");

	const carregarFornecedores = useCallback(async () => {
		setCarregando(true);
		setErro("");

		try {
			const dados = await requisicaoAPI(`${API_URL}/listar-fornecedores`);
			setFornecedores(Array.isArray(dados) ? dados : []);
		} catch (error) {
			setErro(error.message || "Não foi possível carregar os fornecedores.");
		} finally {
			setCarregando(false);
		}
	}, []);

	useEffect(() => {
		carregarFornecedores();
	}, [carregarFornecedores]);

	function atualizarCampo(evento) {
		const { name, value } = evento.target;
		setFormulario((atual) => ({ ...atual, [name]: value }));
	}

	function iniciarEdicao(fornecedor) {
		setFormulario({
			nome: fornecedor.nome || "",
			email: fornecedor.email || "",
			telefone: fornecedor.telefone || "",
			cnpj: fornecedor.cnpj || ""
		});
		setFornecedorEmEdicao(fornecedor.id);
		setErro("");
		setSucesso("");
	}

	function cancelarEdicao() {
		setFormulario({ ...fornecedorInicial });
		setFornecedorEmEdicao(null);
		setErro("");
	}

	async function salvarFornecedor(evento) {
		evento.preventDefault();
		setErro("");
		setSucesso("");
		setSalvando(true);

		const dados = {
			nome: formulario.nome.trim(),
			email: formulario.email.trim(),
			telefone: formulario.telefone.trim() || null,
			cnpj: formulario.cnpj.trim() || null
		};

		try {
			await requisicaoAPI(
				fornecedorEmEdicao === null
					? `${API_URL}/fornecedores`
					: `${API_URL}/${fornecedorEmEdicao}`,
				{
					method: fornecedorEmEdicao === null ? "POST" : "PUT",
					body: JSON.stringify(dados)
				}
			);

			setFormulario({ ...fornecedorInicial });
			setSucesso(
				fornecedorEmEdicao === null
					? "Fornecedor cadastrado com sucesso."
					: "Fornecedor atualizado com sucesso."
			);
			setFornecedorEmEdicao(null);
			await carregarFornecedores();
		} catch (error) {
			setErro(error.message || "Não foi possível salvar o fornecedor.");
		} finally {
			setSalvando(false);
		}
	}

	async function excluirFornecedor(fornecedor) {
		if (!window.confirm(`Deseja excluir o fornecedor "${fornecedor.nome}"?`)) return;

		setErro("");
		setSucesso("");
		setExcluindo(fornecedor.id);

		try {
			await requisicaoAPI(`${API_URL}/${fornecedor.id}`, { method: "DELETE" });

			if (fornecedorEmEdicao === fornecedor.id) cancelarEdicao();
			setSucesso("Fornecedor excluído com sucesso.");
			await carregarFornecedores();
		} catch (error) {
			setErro(error.message || "Não foi possível excluir o fornecedor.");
		} finally {
			setExcluindo(null);
		}
	}

	return (
		<div className="dashboard produtos-page-layout">
			<Sidebar />

			<main className="dashboard-main produtos-page fornecedores-page">
				<header className="produtos-header">
					<div>
						<span className="produtos-eyebrow">SEIA / CADASTROS</span>
						<h1>Fornecedores</h1>
						<p>Cadastre e mantenha os contatos dos fornecedores do seu estoque.</p>
					</div>

					<button
						className="produto-btn produto-btn-secondary"
						type="button"
						onClick={carregarFornecedores}
						disabled={carregando}
					>
						<span className="produto-btn-icon">↻</span>
						Atualizar lista
					</button>
				</header>

				{erro && (
					<div className="produto-alert produto-alert-error" role="alert">
						<span>!</span>
						<p>{erro}</p>
						<button type="button" onClick={() => setErro("")} aria-label="Fechar mensagem">
							×
						</button>
					</div>
				)}

				{sucesso && (
					<div className="produto-alert produto-alert-success" role="status">
						<span>✓</span>
						<p>{sucesso}</p>
						<button type="button" onClick={() => setSucesso("")} aria-label="Fechar mensagem">
							×
						</button>
					</div>
				)}

				<div className="fornecedores-content-grid">
					<section className="produto-panel produto-form-panel">
						<div className="produto-panel-heading">
							<div>
								<span className="produto-section-label">CONTATOS</span>
								<h2>{fornecedorEmEdicao === null ? "Novo fornecedor" : "Editar fornecedor"}</h2>
								<p>
									{fornecedorEmEdicao === null
										? "Informe os dados para adicionar um fornecedor."
										: `Atualize os dados do fornecedor #${fornecedorEmEdicao}.`}
								</p>
							</div>
							<span className="produto-heading-icon">＋</span>
						</div>

						<form className="produto-form" onSubmit={salvarFornecedor}>
							<div className="produto-form-group">
								<label htmlFor="fornecedor-nome">Nome *</label>
								<input
									id="fornecedor-nome"
									name="nome"
									value={formulario.nome}
									onChange={atualizarCampo}
									maxLength={150}
									autoComplete="organization"
									required
								/>
							</div>

							<div className="produto-form-group">
								<label htmlFor="fornecedor-email">E-mail *</label>
								<input
									id="fornecedor-email"
									name="email"
									type="email"
									value={formulario.email}
									onChange={atualizarCampo}
									maxLength={150}
									autoComplete="email"
									required
								/>
							</div>

							<div className="produto-form-group">
								<label htmlFor="fornecedor-cnpj">CNPJ</label>
								<input
									id="fornecedor-cnpj"
									name="cnpj"
									value={formulario.cnpj}
									onChange={atualizarCampo}
									maxLength={18}
									inputMode="numeric"
									placeholder="00.000.000/0000-00"
								/>
							</div>

							<div className="produto-form-group">
								<label htmlFor="fornecedor-telefone">Telefone</label>
								<input
									id="fornecedor-telefone"
									name="telefone"
									type="tel"
									value={formulario.telefone}
									onChange={atualizarCampo}
									maxLength={20}
									autoComplete="tel"
								/>
							</div>

							<button
								className="produto-btn produto-btn-primary produto-submit"
								type="submit"
								disabled={salvando}
							>
								{salvando
									? "Salvando..."
									: fornecedorEmEdicao === null
										? "+ Cadastrar fornecedor"
										: "Salvar alterações"}
							</button>

							{fornecedorEmEdicao !== null && (
								<button
									className="produto-btn produto-btn-secondary"
									type="button"
									onClick={cancelarEdicao}
									disabled={salvando}
								>
									Cancelar edição
								</button>
							)}
						</form>
					</section>

					<section className="produto-panel produto-list-panel fornecedores-list-panel">
						<div className="produto-panel-heading">
							<div>
								<span className="produto-section-label">CADASTRO</span>
								<h2>Fornecedores cadastrados</h2>
								<p>Contatos disponíveis para vincular aos produtos.</p>
							</div>
							<span className="produto-count">{fornecedores.length}</span>
						</div>

						{carregando ? (
							<div className="produto-state">
								<span className="produto-spinner" />
								<p>Carregando fornecedores...</p>
							</div>
						) : fornecedores.length === 0 ? (
							<div className="produto-state">
								<span className="produto-empty-icon">♧</span>
								<strong>Nenhum fornecedor cadastrado</strong>
								<p>Adicione um fornecedor pelo formulário.</p>
							</div>
						) : (
							<div className="produto-table-wrapper">
								<table className="produto-table">
									<thead>
										<tr>
											<th>Fornecedor</th>
											<th>CNPJ</th>
											<th>E-mail</th>
											<th>Telefone</th>
											<th>Ações</th>
										</tr>
									</thead>
									<tbody>
										{fornecedores.map((fornecedor) => (
											<tr key={fornecedor.id}>
												<td>
													<div className="produto-name-cell">
														<div className="produto-avatar">
															{String(fornecedor.nome || "F").charAt(0).toUpperCase()}
														</div>
														<div>
															<strong>{fornecedor.nome}</strong>
															<small>ID #{fornecedor.id}</small>
														</div>
													</div>
												</td>
												<td>{fornecedor.cnpj || "Não informado"}</td>
												<td>{fornecedor.email}</td>
												<td>{fornecedor.telefone || "Não informado"}</td>
												<td>
													<div className="fornecedor-actions">
														<button
															className="produto-view-btn"
															type="button"
															onClick={() => iniciarEdicao(fornecedor)}
															aria-label={`Editar ${fornecedor.nome}`}
															title="Editar fornecedor"
														>
															✎
														</button>
														<button
															className="produto-view-btn fornecedor-delete-btn"
															type="button"
															onClick={() => excluirFornecedor(fornecedor)}
															disabled={excluindo === fornecedor.id}
															aria-label={`Excluir ${fornecedor.nome}`}
															title="Excluir fornecedor"
														>
															×
														</button>
													</div>
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						)}

						<div className="produto-list-footer">
							<span>{fornecedores.length} fornecedores</span>
							<button type="button" onClick={carregarFornecedores} disabled={carregando}>
								Recarregar ↻
							</button>
						</div>
					</section>
				</div>
			</main>
		</div>
	);
}
