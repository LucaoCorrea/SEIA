import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { API_URL, requisicaoAPI } from "../services/api";
import "./Produto.css";

const produtoInicial = {
  nome: "",
  preco: "",
  quantidade: "0",
  descricao: "",
  imagem: "",
  codigo_barras: "",
  tipo_classificacao: "",
  unidade_medida: "un",
  estoque_minimo: "0",
  fornecedor_id: "",
  ativo: true
};

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function formatarQuantidade(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    maximumFractionDigits: 3
  });
}

export default function Produtos() {
  const location = useLocation();
  const [produtos, setProdutos] = useState([]);
  const [produtosFiltrados, setProdutosFiltrados] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [formulario, setFormulario] = useState(produtoInicial);
  const [busca, setBusca] = useState("");
  const [produtoId, setProdutoId] = useState("");
  const [produtoSelecionado, setProdutoSelecionado] = useState(null);
  const [produtoEmEdicao, setProdutoEmEdicao] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [carregandoFornecedores, setCarregandoFornecedores] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [consultando, setConsultando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  const carregarProdutos = useCallback(async () => {
    try {
      const dados = await requisicaoAPI(`${API_URL}/listar-produtos`);
      const lista = Array.isArray(dados) ? dados : dados?.produtos || [];

      setProdutos(lista);
      setProdutosFiltrados(lista);
      setErro("");
    } catch (error) {
      setErro(error.message || "Não foi possível carregar os produtos.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    let ativo = true;
    async function carregarProdutosIniciais() {
      try {
        const dados = await requisicaoAPI(`${API_URL}/listar-produtos`);
        if (!ativo) return;
        const lista = Array.isArray(dados) ? dados : dados?.produtos || [];
        setProdutos(lista);
        setProdutosFiltrados(lista);
        setErro("");
      } catch (error) {
        if (ativo) setErro(error.message || "Não foi possível carregar os produtos.");
      } finally {
        if (ativo) setCarregando(false);
      }
    }

    carregarProdutosIniciais();
    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    let ativo = true;
    async function carregarFornecedoresIniciais() {
      try {
        const dados = await requisicaoAPI(`${API_URL}/listar-fornecedores`);
        if (!ativo) return;
        setFornecedores(Array.isArray(dados) ? dados : []);
        setErro("");
      } catch (error) {
        if (ativo) setErro(error.message || "Não foi possível carregar os fornecedores.");
      } finally {
        if (ativo) setCarregandoFornecedores(false);
      }
    }

    carregarFornecedoresIniciais();
    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    let ativo = true;
    async function aplicarEstadoDaNavegacao() {
      await Promise.resolve();
      if (!ativo) return;
      const codigoBarras = location.state?.codigo_barras;
      const id = location.state?.produtoId;

      if (codigoBarras) {
        setFormulario((atual) => ({ ...atual, codigo_barras: codigoBarras }));
      }

      if (id) {
        setProdutoId(String(id));
        try {
          const produto = await requisicaoAPI(`${API_URL}/buscar/${encodeURIComponent(id)}`);
          if (ativo) setProdutoSelecionado(produto);
        } catch (error) {
          if (ativo) setErro(error.message || "Não foi possível consultar o produto.");
        }
      }
    }
    aplicarEstadoDaNavegacao();
    return () => {
      ativo = false;
    };
  }, [location.state]);

  const estatisticas = useMemo(() => ({
    total: produtos.length,
    ativos: produtos.filter((produto) => produto.ativo).length,
    estoqueBaixo: produtos.filter(
      (produto) => Number(produto.quantidade || 0) <= Number(produto.estoque_minimo || 0)
    ).length,
    valorEstoque: produtos.reduce(
      (total, produto) => total + Number(produto.custo || 0),
      0
    )
  }), [produtos]);

  function atualizarCampo(evento) {
    const { name, value, type, checked } = evento.target;

    setFormulario((atual) => ({
      ...atual,
      [name]: type === "checkbox" ? checked : value
    }));
  }

  async function cadastrarProduto(evento) {
    evento.preventDefault();
    setErro("");
    setSucesso("");

    if (!formulario.fornecedor_id) {
      setErro("Selecione um fornecedor para o produto.");
      return;
    }

    setSalvando(true);

    const dados = {
      ...formulario,
      preco: Number(formulario.preco),
      quantidade: Number(formulario.quantidade),
      estoque_minimo: Number(formulario.estoque_minimo),
      fornecedor_id: Number(formulario.fornecedor_id),
      descricao: formulario.descricao.trim() || null,
      imagem: formulario.imagem.trim() || null,
      codigo_barras: formulario.codigo_barras.trim() || null,
      tipo_classificacao: formulario.tipo_classificacao.trim() || null
    };

    try {
      await requisicaoAPI(
        produtoEmEdicao === null
          ? `${API_URL}/produtos`
          : `${API_URL}/atualizar/${produtoEmEdicao}`,
        {
        method: produtoEmEdicao === null ? "POST" : "PUT",
        body: JSON.stringify(dados)
        }
      );

      setFormulario({ ...produtoInicial });
      setProdutoEmEdicao(null);
      setBusca("");
      setSucesso(
        produtoEmEdicao === null
          ? "Produto cadastrado com sucesso."
          : "Produto atualizado com sucesso."
      );
      await carregarProdutos();
    } catch (error) {
      setErro(error.message || "Não foi possível salvar o produto.");
    } finally {
      setSalvando(false);
    }
  }

  async function buscarProdutosPorNome(evento) {
    evento.preventDefault();

    const nome = busca.trim();

    if (!nome) {
      setProdutosFiltrados(produtos);
      return;
    }

    setErro("");
    setSucesso("");
    setConsultando(true);

    try {
      const dados = await requisicaoAPI(
        `${API_URL}/buscar-produto-nome?nome=${encodeURIComponent(nome)}`
      );

      const lista = Array.isArray(dados) ? dados : dados ? [dados] : [];
      setProdutosFiltrados(lista);
    } catch (error) {
      setProdutosFiltrados([]);
      setErro(error.message || "Não foi possível buscar os produtos.");
    } finally {
      setConsultando(false);
    }
  }

  function limparBusca() {
    setBusca("");
    setProdutosFiltrados(produtos);
    setErro("");
  }

  function editarProduto(produto) {
    setFormulario({
      ...produtoInicial,
      nome: produto.nome || "",
      preco: String(produto.preco ?? ""),
      quantidade: String(produto.quantidade ?? 0),
      descricao: produto.descricao || "",
      imagem: produto.imagem || "",
      codigo_barras: produto.codigo_barras || "",
      tipo_classificacao: produto.tipo_classificacao || "",
      unidade_medida: produto.unidade_medida || "un",
      estoque_minimo: String(produto.estoque_minimo ?? 0),
      fornecedor_id: String(produto.fornecedor_id ?? ""),
      ativo: produto.ativo ?? true,
    });
    setProdutoEmEdicao(produto.id);
    setProdutoSelecionado(null);
  }

  function cancelarEdicao() {
    setFormulario({ ...produtoInicial });
    setProdutoEmEdicao(null);
  }

  async function deletarProduto(produto) {
    if (!window.confirm(`Deseja excluir o produto "${produto.nome}"?`)) return;

    setErro("");
    setSucesso("");
    setSalvando(true);

    try {
      await requisicaoAPI(`${API_URL}/deletar/${produto.id}`, {
        method: "DELETE"
      });

      if (produtoEmEdicao === produto.id) cancelarEdicao();
      setSucesso("Produto excluído com sucesso.");
      await carregarProdutos();
    } catch (error) {
      setErro(error.message || "Não foi possível excluir o produto.");
    } finally {
      setSalvando(false);
    }
  }

  async function buscarProduto(evento) {
    evento.preventDefault();

    if (!produtoId.trim()) {
      setErro("Informe o ID do produto para consultar.");
      return;
    }

    setErro("");
    setSucesso("");
    setProdutoSelecionado(null);
    setConsultando(true);

    try {
      const produto = await requisicaoAPI(
        `${API_URL}/buscar/${encodeURIComponent(produtoId.trim())}`
      );

      setProdutoSelecionado(produto);
    } catch (error) {
      setErro(error.message || "Não foi possível consultar o produto.");
    } finally {
      setConsultando(false);
    }
  }

  return (
    <div className="dashboard produtos-page-layout">
      <Sidebar />

      <main className="dashboard-main produtos-page">
        <header className="produtos-header">
          <div>
            <span className="produtos-eyebrow">SEIA / ESTOQUE</span>
            <h1>Produtos</h1>
            <p>Gerencie seu catálogo, acompanhe os níveis de estoque e cadastre novos produtos.</p>
          </div>

          <button
            className="produto-btn produto-btn-secondary"
            type="button"
            onClick={() => {
              setCarregando(true);
              carregarProdutos();
            }}
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

        <section className="produtos-stats">
          <article className="produto-stat-card">
            <div className="produto-stat-icon produto-stat-green">▦</div>
            <div>
              <span>Produtos cadastrados</span>
              <strong>{estatisticas.total}</strong>
              <small>Itens no catálogo</small>
            </div>
          </article>

          <article className="produto-stat-card">
            <div className="produto-stat-icon produto-stat-blue">✓</div>
            <div>
              <span>Produtos ativos</span>
              <strong>{estatisticas.ativos}</strong>
              <small>Disponíveis no sistema</small>
            </div>
          </article>

          <article className="produto-stat-card">
            <div className="produto-stat-icon produto-stat-orange">!</div>
            <div>
              <span>Estoque baixo</span>
              <strong>{estatisticas.estoqueBaixo}</strong>
              <small>No mínimo ou abaixo dele</small>
            </div>
          </article>

          <article className="produto-stat-card">
            <div className="produto-stat-icon produto-stat-purple">$</div>
            <div>
              <span>Valor de custo em estoque</span>
              <strong>{formatarMoeda(estatisticas.valorEstoque)}</strong>
              <small>Quantidade × preço</small>
            </div>
          </article>
        </section>

        <div className="produtos-content-grid">
          <section className="produto-panel produto-form-panel">
            <div className="produto-panel-heading">
              <div>
                <span className="produto-section-label">CATÁLOGO</span>
                <h2>{produtoEmEdicao === null ? "Cadastrar produto" : "Editar produto"}</h2>
                <p>
                  {produtoEmEdicao === null
                    ? "Preencha os dados do novo item."
                    : `Atualize os dados do produto #${produtoEmEdicao}.`}
                </p>
              </div>
              
            </div>

            <form className="produto-form" onSubmit={cadastrarProduto}>
              <div className="produto-form-group">
                <label htmlFor="nome">Nome do produto *</label>
                <input
                  id="nome"
                  name="nome"
                  value={formulario.nome}
                  onChange={atualizarCampo}
                  placeholder="Ex.:  Calcário Puro..."
                  maxLength={150}
                  required
                />
              </div>

              <div className="produto-form-row">
                <div className="produto-form-group">
                  <label htmlFor="preco">Preço de venda (R$) *</label>
                  <input
                    id="preco"
                    name="preco"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formulario.preco}
                    onChange={atualizarCampo}
                    placeholder="0,00"
                    required
                  />
                </div>

                <div className="produto-form-group">
                  <label htmlFor="custo-calculado">Custo (quantidade × preço)</label>
                  <input
                    id="custo-calculado"
                    type="text"
                    value={formatarMoeda(
                      Number(formulario.quantidade || 0) * Number(formulario.preco || 0)
                    )}
                    readOnly
                  />
                </div>
              </div>

              <div className="produto-form-row">
                <div className="produto-form-group">
                  <label htmlFor="quantidade">
                    {produtoEmEdicao === null ? "Quantidade inicial *" : "Estoque atual"}
                  </label>
                  <input
                    id="quantidade"
                    name="quantidade"
                    type="number"
                    min="0"
                    step="0.001"
                    value={formulario.quantidade}
                    onChange={atualizarCampo}
                    required={produtoEmEdicao === null}
                    disabled={produtoEmEdicao !== null}
                  />
                  {produtoEmEdicao !== null && (
                    <small>Altere o estoque pela página de movimentações para manter o histórico.</small>
                  )}
                </div>

                <div className="produto-form-group">
                  <label htmlFor="estoque_minimo">Estoque mínimo</label>
                  <input
                    id="estoque_minimo"
                    name="estoque_minimo"
                    type="number"
                    min="0"
                    step="0.001"
                    value={formulario.estoque_minimo}
                    onChange={atualizarCampo}
                  />
                </div>
              </div>

              <div className="produto-form-row">
                <div className="produto-form-group">
                  <label htmlFor="unidade_medida">Unidade de medida *</label>
                  <select
                    id="unidade_medida"
                    name="unidade_medida"
                    value={formulario.unidade_medida}
                    onChange={atualizarCampo}
                    required
                  >
                    <option value="un">Unidade (un)</option>
                    <option value="kg">Quilograma (kg)</option>
                    <option value="g">Grama (g)</option>
                    <option value="l">Litro (L)</option>
                    <option value="ml">Mililitro (ml)</option>
                    <option value="pacote">Tonelada (t)</option>
                    <option value="caixa">Caixa</option>
                    <option value="dúzia">Dúzia</option>
                  </select>
                </div>

                <div className="produto-form-group">
                  <label htmlFor="tipo_classificacao">Categoria</label>
                  <input
                    id="tipo_classificacao"
                    name="tipo_classificacao"
                    value={formulario.tipo_classificacao}
                    onChange={atualizarCampo}
                    placeholder="Ex.: Corretivo, Fertilizante..."
                    maxLength={100}
                  />
                </div>
              </div>

              <div className="produto-form-group">
                <label htmlFor="fornecedor_id">Fornecedor *</label>
                <select
                  id="fornecedor_id"
                  name="fornecedor_id"
                  value={formulario.fornecedor_id}
                  onChange={atualizarCampo}
                  required
                  disabled={carregandoFornecedores || fornecedores.length === 0}
                >
                  <option value="">
                    {carregandoFornecedores
                      ? "Carregando fornecedores..."
                      : fornecedores.length === 0
                        ? "Nenhum fornecedor cadastrado"
                        : "Selecione um fornecedor"}
                  </option>
                  {fornecedores.map((fornecedor) => (
                    <option key={fornecedor.id} value={fornecedor.id}>
                      {fornecedor.nome}
                    </option>
                  ))}
                </select>
                {fornecedores.length === 0 && !carregandoFornecedores && (
                  <Link to="/fornecedores">Cadastrar fornecedor</Link>
                )}
              </div>

              <div className="produto-form-group">
                <label htmlFor="codigo_barras">Código de barras</label>
                <input
                  id="codigo_barras"
                  name="codigo_barras"
                  value={formulario.codigo_barras}
                  onChange={atualizarCampo}
                  placeholder="Digite ou leia o código"
                  maxLength={100}
                />
              </div>

              <div className="produto-form-group">
                <label htmlFor="imagem">URL da imagem</label>
                <input
                  id="imagem"
                  name="imagem"
                  type="url"
                  value={formulario.imagem}
                  onChange={atualizarCampo}
                  placeholder="https://..."
                />
              </div>

              <div className="produto-form-group">
                <label htmlFor="descricao">Descrição</label>
                <textarea
                  id="descricao"
                  name="descricao"
                  value={formulario.descricao}
                  onChange={atualizarCampo}
                  placeholder="Detalhes adicionais sobre o produto..."
                  rows={3}
                  maxLength={1000}
                />
              </div>

              <label className="produto-toggle">
                <input
                  type="checkbox"
                  name="ativo"
                  checked={formulario.ativo}
                  onChange={atualizarCampo}
                />
                <span className="produto-toggle-track" />
                <span>
                  <strong>Produto ativo</strong>
                  <small>Disponível para utilização no sistema</small>
                </span>
              </label>

              <button
                className="produto-btn produto-btn-primary produto-submit"
                type="submit"
                disabled={salvando}
              >
                {salvando
                  ? "Salvando..."
                  : produtoEmEdicao === null
                    ? "＋ Cadastrar produto"
                    : "Salvar alterações"}
              </button>
              {produtoEmEdicao !== null && (
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

          <div className="produtos-right-column">
            <section className="produto-panel produto-list-panel">
              <div className="produto-panel-heading">
                <div>
                  <span className="produto-section-label">INVENTÁRIO</span>
                  <h2>Produtos cadastrados</h2>
                  <p>Consulte os itens armazenados no sistema.</p>
                </div>
                <span className="produto-count">{produtos.length}</span>
              </div>

              <form className="produto-search" onSubmit={buscarProdutosPorNome}>
                <span aria-hidden="true">⌕</span>

                <input
                  value={busca}
                  onChange={(evento) => setBusca(evento.target.value)}
                  placeholder="Buscar produto pelo nome..."
                  aria-label="Buscar produtos pelo nome"
                />

                {busca && (
                  <button type="button" onClick={limparBusca} aria-label="Limpar busca">
                    ×
                  </button>
                )}

                <button type="submit" disabled={consultando}>
                  {consultando ? "Buscando..." : "Buscar"}
                </button>
              </form>

              {carregando ? (
                <div className="produto-state">
                  <span className="produto-spinner" />
                  <p>Carregando produtos...</p>
                </div>
              ) : produtosFiltrados.length === 0 ? (
                <div className="produto-state">
                  <span className="produto-empty-icon">▦</span>
                  <strong>
                    {busca ? "Nenhum resultado encontrado" : "Nenhum produto cadastrado"}
                  </strong>
                  <p>
                    {busca
                      ? "Tente buscar por outro nome."
                      : "Cadastre seu primeiro produto pelo formulário."}
                  </p>
                </div>
              ) : (
                <div className="produto-table-wrapper">
                  <table className="produto-table">
                    <thead>
                      <tr>
                        <th>Produto</th>
                        <th>Preço</th>
                        <th>Estoque</th>
                        <th>Status</th>
                        <th>Ação</th>
                      </tr>
                    </thead>

                    <tbody>
                      {produtosFiltrados.map((produto) => {
                        const estoqueBaixo =
                          Number(produto.quantidade || 0) <= Number(produto.estoque_minimo || 0);

                        return (
                          <tr key={produto.id}>
                            <td>
                              <div className="produto-name-cell">
                                <div className="produto-avatar">
                                  {String(produto.nome || "P").charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <strong>{produto.nome}</strong>
                                  <small>
                                    {produto.codigo_barras ||
                                      produto.tipo_classificacao ||
                                      `ID ${produto.id}`}
                                  </small>
                                </div>
                              </div>
                            </td>

                            <td className="produto-price-cell">
                              {formatarMoeda(produto.preco)}
                            </td>

                            <td>
                              <span className={`produto-stock ${estoqueBaixo ? "produto-stock-low" : ""}`}>
                                {formatarQuantidade(produto.quantidade)} {produto.unidade_medida || "un"}
                              </span>
                            </td>

                            <td>
                              <span
                                className={`produto-status ${
                                  produto.ativo ? "produto-status-active" : "produto-status-inactive"
                                }`}
                              >
                                {produto.ativo ? "Ativo" : "Inativo"}
                              </span>
                            </td>

                            <td>
                              <button
                                className="produto-view-btn"
                                type="button"
                                onClick={() => {
                                  setProdutoId(String(produto.id));
                                  setProdutoSelecionado(produto);
                                }}
                                aria-label={`Consultar ${produto.nome}`}
                                title="Ver detalhes"
                              >
                                ↗
                              </button>
                              <button
                                className="produto-view-btn"
                                type="button"
                                onClick={() => editarProduto(produto)}
                                aria-label={`Editar ${produto.nome}`}
                                title="Editar produto"
                              >
                                ✎
                              </button>
                              <button
                                className="produto-view-btn"
                                type="button"
                                onClick={() => deletarProduto(produto)}
                                aria-label={`Excluir ${produto.nome}`}
                                title="Excluir produto"
                                disabled={salvando}
                              >
                                ×
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="produto-list-footer">
                <span>
                  Exibindo {produtosFiltrados.length} de {produtos.length} produtos
                </span>
                <button type="button" onClick={carregarProdutos} disabled={carregando}>
                  Recarregar ↻
                </button>
              </div>
            </section>

            <section className="produto-panel produto-lookup-panel">
              <div className="produto-panel-heading">
                <div>
                  <span className="produto-section-label">CONSULTA</span>
                  <h2>Buscar por ID</h2>
                  <p>Consulte os dados de um produto específico na API.</p>
                </div>
                
              </div>

              <form className="produto-lookup-form" onSubmit={buscarProduto}>
                <input
                  type="number"
                  min="1"
                  value={produtoId}
                  onChange={(evento) => setProdutoId(evento.target.value)}
                  placeholder="Informe o ID do produto"
                  aria-label="ID do produto"
                  required
                />

                <button
                  className="produto-btn produto-btn-primary"
                  type="submit"
                  disabled={consultando}
                >
                  {consultando ? "Buscando..." : "Consultar"}
                </button>
              </form>

              {produtoSelecionado && (
                <div className="produto-detail">
                  <div className="produto-detail-header">
                    <div className="produto-avatar produto-avatar-large">
                      {String(produtoSelecionado.nome || "P").charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <strong>{produtoSelecionado.nome}</strong>
                      <small>ID #{produtoSelecionado.id}</small>
                    </div>
                  </div>

                  <div className="produto-detail-grid">
                    <div>
                      <span>Preço</span>
                      <strong>{formatarMoeda(produtoSelecionado.preco)}</strong>
                    </div>
                    <div>
                      <span>Custo</span>
                      <strong>{formatarMoeda(produtoSelecionado.custo)}</strong>
                    </div>
                    <div>
                      <span>Quantidade</span>
                      <strong>
                        {formatarQuantidade(produtoSelecionado.quantidade)}{" "}
                        {produtoSelecionado.unidade_medida || "un"}
                      </strong>
                    </div>
                    <div>
                      <span>Estoque mínimo</span>
                      <strong>{formatarQuantidade(produtoSelecionado.estoque_minimo)}</strong>
                    </div>
                    <div>
                      <span>Código de barras</span>
                      <strong>{produtoSelecionado.codigo_barras || "Não informado"}</strong>
                    </div>
                    <div>
                      <span>Categoria</span>
                      <strong>{produtoSelecionado.tipo_classificacao || "Não informada"}</strong>
                    </div>
                  </div>

                  {produtoSelecionado.descricao && (
                    <p className="produto-detail-description">
                      {produtoSelecionado.descricao}
                    </p>
                  )}
                </div>
              )}
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}