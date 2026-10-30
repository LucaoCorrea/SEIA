import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { API_URL, requisicaoAPI } from "../services/api";
import "./ScanBip.css";

export default function ScanBip() {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const fileRef = useRef(null);

  const [codigo, setCodigo] = useState("");
  const [resultado, setResultado] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  const email = localStorage.getItem("email") || "Usuário";
  const nome = localStorage.getItem("nome") || "Usuário";

  async function consultarCodigo(valor = codigo) {
    const codigoLimpo = valor.trim();

    if (!codigoLimpo) {
      setErro("Informe ou leia um código de barras.");
      inputRef.current?.focus();
      return;
    }

    setCodigo(codigoLimpo);
    setResultado(null);
    setErro("");
    setCarregando(true);

    try {
      const produtos = await requisicaoAPI(`${API_URL}/listar-produtos`);

      const produto = (Array.isArray(produtos) ? produtos : []).find(
        (item) => String(item.codigo_barras || "").trim() === codigoLimpo
      );

      setResultado(
        produto
          ? { ...produto, encontrado: true }
          : { codigo_barras: codigoLimpo, encontrado: false }
      );
    } catch (erroConsulta) {
      setErro(erroConsulta.message || "Erro ao consultar o estoque.");
    } finally {
      setCarregando(false);
      inputRef.current?.focus();
    }
  }

  async function escanearImagem(evento) {
    const arquivo = evento.target.files?.[0];

    if (!arquivo) return;

    setResultado(null);
    setErro("");
    setCarregando(true);

    try {
      const formulario = new FormData();
      formulario.append("file", arquivo);

      const dados = await requisicaoAPI(`${API_URL}/bip-barcode`, {
        method: "POST",
        body: formulario
      });

      const codigoLido = dados.codigo_barras;

      if (!codigoLido) {
        throw new Error("Nenhum código de barras foi identificado na imagem.");
      }

      setCodigo(codigoLido);
      await consultarCodigo(codigoLido);
    } catch (erroLeitura) {
      setErro(erroLeitura.message || "Erro ao ler a imagem.");
    } finally {
      setCarregando(false);
      evento.target.value = "";
      inputRef.current?.focus();
    }
  }

  return (
    <div className="dashboard scan-page">
      <Sidebar />

      <main className="dashboard-main scan-main">
        <header className="topbar">
          <div>
            <span className="eyebrow">GESTÃO INTELIGENTE DE ESTOQUE</span>
            <h1>Leitor de produtos</h1>
          </div>

          <div className="profile">
            <div className="avatar">{nome.charAt(0).toUpperCase()}</div>
            <div>
              <strong>{nome}</strong>
              <small>{email}</small>
            </div>
          </div>
        </header>

        <section className="scan-intro">
          <div>
            <span className="scan-tag">LEITURA DE CÓDIGO DE BARRAS</span>
            <h2>Identifique seu produto</h2>
            <p>Bipe o código ou envie uma imagem para consultar o estoque.</p>
          </div>
          <div className="scan-intro-icon">▥</div>
        </section>

        <section className="scan-layout">
          <article className="panel scan-panel">
            <div className="panel-heading">
              <h3>Consultar produto</h3>
              <span className="scan-status"><span /> Pronto para ler</span>
            </div>

            <div className="scanner-illustration">
              <div className="scanner-icon">▥</div>
              <div className="scanner-lines">
                {Array.from({ length: 12 }).map((_, index) => (
                  <span key={index} />
                ))}
              </div>
              <p>AGUARDANDO LEITURA</p>
              <small>Utilize um leitor USB ou digite o código abaixo.</small>
            </div>

            <form
              className="scan-form"
              onSubmit={(evento) => {
                evento.preventDefault();
                consultarCodigo();
              }}
            >
              <label htmlFor="codigo-barras">Código de barras</label>

              <div className="scan-input-group">
                <span>▥</span>
                <input
                  ref={inputRef}
                  id="codigo-barras"
                  value={codigo}
                  onChange={(evento) => setCodigo(evento.target.value)}
                  placeholder="Bipe ou digite o código..."
                  autoComplete="off"
                  autoFocus
                />

                <button type="submit" disabled={carregando}>
                  {carregando ? "Consultando..." : "Consultar"}
                </button>
              </div>
            </form>

            <div className="scan-divider"><span>OU</span></div>

            <button
              className="upload-button"
              onClick={() => fileRef.current?.click()}
              disabled={carregando}
            >
              <span>↑</span> Enviar imagem do código de barras
            </button>

            <input
              ref={fileRef}
              className="hidden-file"
              type="file"
              accept="image/*"
              capture="environment"
              onChange={escanearImagem}
            />

            {carregando && <div className="scan-feedback">Processando leitura...</div>}
            {erro && <div className="scan-error">{erro}</div>}
          </article>

          <article className="panel result-panel">
            <div className="panel-heading">
              <h3>Resultado da leitura</h3>
            </div>

            {!resultado && !carregando && (
              <div className="empty-state">
                <div className="empty-icon">▤</div>
                <strong>Nenhum produto consultado</strong>
                <p>Quando um código for lido, as informações do produto aparecerão aqui.</p>
              </div>
            )}

            {carregando && (
              <div className="empty-state">
                <div className="scanner-loading">◌</div>
                <strong>Consultando produto</strong>
                <p>Aguarde enquanto verificamos o código no estoque.</p>
              </div>
            )}

            {resultado && !resultado.encontrado && (
              <div className="product-result">
                <div className="result-icon">!</div>
                <span className="result-label">PRODUTO NÃO CADASTRADO</span>
                <h2>Código não encontrado</h2>
                <p>Este código ainda não está na base local do SEIA.</p>

                <div className="product-code">
                  <small>CÓDIGO LIDO</small>
                  <strong>{resultado.codigo_barras}</strong>
                </div>

                <button
                  className="register-button"
                  onClick={() =>
                    navigate("/produtos", {
                      state: { codigo_barras: resultado.codigo_barras }
                    })
                  }
                >
                  + Cadastrar produto
                </button>
              </div>
            )}

            {resultado?.encontrado && (
              <div className="product-result">
                {resultado.imagem ? (
                  <img className="product-image" src={resultado.imagem} alt={resultado.nome} />
                ) : (
                  <div className="result-icon">▤</div>
                )}

                <span className="result-label">PRODUTO IDENTIFICADO</span>
                <h2>{resultado.nome}</h2>

                <div className="product-code">
                  <small>CÓDIGO DE BARRAS</small>
                  <strong>{resultado.codigo_barras || codigo}</strong>
                </div>

                <div className="product-details">
                  <div>
                    <small>Preço</small>
                    <strong>
                      {Number(resultado.preco || 0).toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL"
                      })}
                    </strong>
                  </div>

                  <div>
                    <small>Estoque atual</small>
                    <strong>{resultado.quantidade ?? 0} {resultado.unidade_medida || "un"}</strong>
                  </div>

                  <div>
                    <small>Categoria</small>
                    <strong>{resultado.tipo_classificacao || "Não informada"}</strong>
                  </div>
                </div>

                <button
                  className="register-button"
                  onClick={() =>
                    navigate("/produtos", {
                      state: { produtoId: resultado.id }
                    })
                  }
                >
                  Ver produto
                </button>
              </div>
            )}
          </article>
        </section>

        <footer className="footer">
          SEIA · Sistema de Estoque para Agro
        </footer>
      </main>
    </div>
  );
}