
import { useCallback, useEffect, useMemo, useState } from "react";
import "./Produtos.css";

const API_URL = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

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
  custo: "0",
  ativo: true
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
  const [produtos, setProdutos] = useState([]);
  const [formulario, setFormulario] = useState(produtoInicial);
  const [busca, setBusca] = useState("");
  const [produtoId, setProdutoId] = useState("");
  const [produtoSelecionado, setProdutoSelecionado] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [consultando, setConsultando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  const carregarProdutos = useCallback(async () => {
    setCarregando(true);
    setErro("");

    try {
      const dados = await requisicaoAPI(`${API_URL}/listar-produtos`);
      setProdutos(Array.isArray(dados) ? dados : dados?.produtos || []);
    } catch (error) {
      setErro(error.message || "Não foi possível carregar os produtos.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregarProdutos();
  }, [carregarProdutos]);

  const produtosFiltrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");

    if (!termo) return produtos;

    return produtos.filter((produto) =>
      [
        produto.nome,
        produto.codigo_barras,
        produto.tipo_classificacao,
        produto.unidade_medida,
        produto.id
      ].some((valor) => String(valor ?? "").toLocaleLowerCase("pt-BR").includes(termo))
    );
  }, [produtos, busca]);

  const estatisticas = useMemo(() => ({
    total: produtos.length,
    ativos: produtos.filter((produto) => produto.ativo).length,
    estoqueBaixo: produtos.filter((produto) => Number(produto.quantidade || 0) <= Number(produto.estoque_minimo || 0)).length,
    valorEstoque: produtos.reduce((total, produto) => total + Number(produto.custo || 0) * Number(produto.quantidade || 0), 0)
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
    setSalvando(true);

    const dados = {
      ...formulario,
      preco: Number(formulario.preco),
      quantidade: Number(formulario.quantidade),
      estoque_minimo: Number(formulario.estoque_minimo),
      custo: Number(formulario.custo),
      descricao: formulario.descricao.trim() || null,
      imagem: formulario.imagem.trim() || null,
      codigo_barras: formulario.codigo_barras.trim() || null,
      tipo_classificacao: formulario.tipo_classificacao.trim() || null
    };

    try {
      await requisicaoAPI(`${API_URL}/produtos`, {
        method: "POST",
        body: JSON.stringify(dados)
      });

      setFormulario(produtoInicial);
      setSucesso("Produto cadastrado com sucesso.");
      await carregarProdutos();
    } catch (error) {
      setErro(error.message || "Não foi possível cadastrar o produto.");
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
      const produto = await requisicaoAPI(`${API_URL}/${encodeURIComponent(produtoId.trim())}`);
      setProdutoSelecionado(produto);
    } catch (error) {
      setErro(error.message || "Não foi possível consultar o produto.");
    } finally {
      setConsultando(false);
    }
  }

  return (
    <main className="produtos-page">
      <header className="produtos-header">
        <div>
          <span className="produtos-eyebrow">SEIA / ESTOQUE</span>
          <h1>Produtos</h1>
          <p>Gerencie seu catálogo, acompanhe os níveis de estoque e cadastre novos produtos.</p>
        </div>
        <button className="produto-btn produto-btn-secondary" type="button" onClick={carregarProdutos} disabled={carregando}>
          <span className="produto-btn-icon">↻</span>
          Atualizar lista
        </button>
      </header>

      {erro && (
        <div className="produto-alert produto-alert-error" role="alert">
          <span>!</span>
          <p>{erro}</p>
          <button type="button" onClick={() => setErro("")} aria-label="Fechar mensagem">×</button>
        </div>
      )}

      {sucesso && (
        <div className="produto-alert produto-alert-success" role="status">
          <span>✓</span>
          <p>{sucesso}</p>
          <button type="button" onClick={() => setSucesso("")} aria-label="Fechar mensagem">×</button>
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
            <small>Custo × quantidade</small>
          </div>
        </article>
      </section>

      <div className="produtos-content-grid">
        <section className="produto-panel produto-form-panel">
          <div className="produto-panel-heading">
            <div>
              <span className="produto-section-label">CATÁLOGO</span>
              <h2>Cadastrar produto</h2>
              <p>Preencha os dados do novo item.</p>
            </div>
            <span className="produto-heading-icon">＋</span>
          </div>

          <form className="produto-form" onSubmit={cadastrarProduto}>
            <div className="produto-form-group">
              <label htmlFor="nome">Nome do produto *</label>
              <input id="nome" name="nome" value={formulario.nome} onChange={atualizarCampo} placeholder="Ex.: Arroz tipo 1 - 5 kg" maxLength={150} required />
            </div>

            <div className="produto-form-row">
              <div className="produto-form-group">
                <label htmlFor="preco">Preço de venda (R$) *</label>
                <input id="preco" name="preco" type="number" min="0" step="0.01" value={formulario.preco} onChange={atualizarCampo} placeholder="0,00" required />
              </div>
              <div className="produto-form-group">
                <label htmlFor="custo">Custo (R$)</label>
                <input id="custo" name="custo" type="number" min="0" step="0.01" value={formulario.custo} onChange={atualizarCampo} />
              </div>
            </div>

            <div className="produto-form-row">
              <div className="produto-form-group">
                <label htmlFor="quantidade">Quantidade inicial *</label>
                <input id="quantidade" name="quantidade" type="number" min="0" step="0.001" value={formulario.quantidade} onChange={atualizarCampo} required />
              </div>
              <div className="produto-form-group">
                <label htmlFor="estoque_minimo">Estoque mínimo</label>
                <input id="estoque_minimo" name="estoque_minimo" type="number" min="0" step="0.001" value={formulario.estoque_minimo} onChange={atualizarCampo} />
              </div>
            </div>

            <div className="produto-form-row">
              <div className="produto-form-group">
                <label htmlFor="unidade_medida">Unidade de medida *</label>
                <select id="unidade_medida" name="unidade_medida" value={formulario.unidade_medida} onChange={atualizarCampo} required>
                  <option value="un">Unidade (un)</option>
                  <option value="kg">Quilograma (kg)</option>
                  <option value="g">Grama (g)</option>
                  <option value="l">Litro (L)</option>
                  <option value="ml">Mililitro (ml)</option>
                  <option value="pacote">Pacote</option>
                  <option value="caixa">Caixa</option>
                  <option value="dúzia">Dúzia</option>
                </select>
              </div>
              <div className="produto-form-group">
                <label htmlFor="tipo_classificacao">Categoria</label>
                <input id="tipo_classificacao" name="tipo_classificacao" value={formulario.tipo_classificacao || ""} onChange={atualizarCampo} placeholder="Ex.: Alimentos" maxLength={100} />
              </div>
            </div>

            <div className="produto-form-group">
              <label htmlFor="codigo_barras">Código de barras</label>
              <input id="codigo_barras" name="codigo_barras" value={formulario.codigo_barras || ""} onChange={atualizarCampo} placeholder="Digite ou leia o código" maxLength={100} />
            </div>

            <div className="produto-form-group">
              <label htmlFor="imagem">URL da imagem</label>
              <input id="imagem" name="imagem" type="url" value={formulario.imagem || ""} onChange={atualizarCampo} placeholder="https://..." />
            </div>

            <div className="produto-form-group">
              <label htmlFor="descricao">Descrição</label>
              <textarea id="descricao" name="descricao" value={formulario.descricao || ""} onChange={atualizarCampo} placeholder="Detalhes adicionais sobre o produto..." rows={3} maxLength={1000} />
            </div>

            <label className="produto-toggle">
              <input type="checkbox" name="ativo" checked={formulario.ativo} onChange={atualizarCampo} />
              <span className="produto-toggle-track" />
              <span>
                <strong>Produto ativo</strong>
                <small>Disponível para utilização no sistema</small>
              </span>
            </label>

            <button className="produto-btn produto-btn-primary produto-submit" type="submit" disabled={salvando}>
              {salvando ? "Cadastrando..." : "＋ Cadastrar produto"}
            </button>
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

            <div className="produto-search">
              <span aria-hidden="true">⌕</span>
              <input value={busca} onChange={(evento) => setBusca(evento.target.value)} placeholder="Buscar por nome, código ou categoria..." aria-label="Buscar produtos" />
              {busca && <button type="button" onClick={() => setBusca("")} aria-label="Limpar busca">×</button>}
            </div>

            {carregando ? (
              <div className="produto-state">
                <span className="produto-spinner" />
                <p>Carregando produtos...</p>
              </div>
            ) : produtosFiltrados.length === 0 ? (
              <div className="produto-state">
                <span className="produto-empty-icon">▦</span>
                <strong>{busca ? "Nenhum resultado encontrado" : "Nenhum produto cadastrado"}</strong>
                <p>{busca ? "Tente buscar por outro termo." : "Cadastre seu primeiro produto pelo formulário."}</p>
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
                      const estoqueBaixo = Number(produto.quantidade || 0) <= Number(produto.estoque_minimo || 0);

                      return (
                        <tr key={produto.id}>
                          <td>
                            <div className="produto-name-cell">
                              <div className="produto-avatar">{String(produto.nome || "P").charAt(0).toUpperCase()}</div>
                              <div>
                                <strong>{produto.nome}</strong>
                                <small>{produto.codigo_barras || produto.tipo_classificacao || `ID ${produto.id}`}</small>
                              </div>
                            </div>
                          </td>
                          <td className="produto-price-cell">{formatarMoeda(produto.preco)}</td>
                          <td>
                            <span className={`produto-stock ${estoqueBaixo ? "produto-stock-low" : ""}`}>
                              {formatarQuantidade(produto.quantidade)} {produto.unidade_medida || "un"}
                            </span>
                          </td>
                          <td>
                            <span className={`produto-status ${produto.ativo ? "produto-status-active" : "produto-status-inactive"}`}>
                              {produto.ativo ? "Ativo" : "Inativo"}
                            </span>
                          </td>
                          <td>
                            <button className="produto-view-btn" type="button" onClick={() => { setProdutoId(String(produto.id)); setProdutoSelecionado(produto); }} aria-label={`Consultar ${produto.nome}`} title="Ver detalhes">↗</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="produto-list-footer">
              <span>Exibindo {produtosFiltrados.length} de {produtos.length} produtos</span>
              <button type="button" onClick={carregarProdutos} disabled={carregando}>Recarregar ↻</button>
            </div>
          </section>

          <section className="produto-panel produto-lookup-panel">
            <div className="produto-panel-heading">
              <div>
                <span className="produto-section-label">CONSULTA</span>
                <h2>Buscar por ID</h2>
                <p>Consulte os dados de um produto específico na API.</p>
              </div>
              <span className="produto-heading-icon">⌕</span>
            </div>

            <form className="produto-lookup-form" onSubmit={buscarProduto}>
              <input type="number" min="1" value={produtoId} onChange={(evento) => setProdutoId(evento.target.value)} placeholder="Informe o ID do produto" aria-label="ID do produto" required />
              <button className="produto-btn produto-btn-primary" type="submit" disabled={consultando}>
                {consultando ? "Buscando..." : "Consultar"}
              </button>
            </form>

            {produtoSelecionado && (
              <div className="produto-detail">
                <div className="produto-detail-header">
                  <div className="produto-avatar produto-avatar-large">{String(produtoSelecionado.nome || "P").charAt(0).toUpperCase()}</div>
                  <div>
                    <strong>{produtoSelecionado.nome}</strong>
                    <small>ID #{produtoSelecionado.id}</small>
                  </div>
                </div>
                <div className="produto-detail-grid">
                  <div><span>Preço</span><strong>{formatarMoeda(produtoSelecionado.preco)}</strong></div>
                  <div><span>Custo</span><strong>{formatarMoeda(produtoSelecionado.custo)}</strong></div>
                  <div><span>Quantidade</span><strong>{formatarQuantidade(produtoSelecionado.quantidade)} {produtoSelecionado.unidade_medida || "un"}</strong></div>
                  <div><span>Estoque mínimo</span><strong>{formatarQuantidade(produtoSelecionado.estoque_minimo)}</strong></div>
                  <div><span>Código de barras</span><strong>{produtoSelecionado.codigo_barras || "Não informado"}</strong></div>
                  <div><span>Categoria</span><strong>{produtoSelecionado.tipo_classificacao || "Não informada"}</strong></div>
                </div>
                {produtoSelecionado.descricao && <p className="produto-detail-description">{produtoSelecionado.descricao}</p>}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
