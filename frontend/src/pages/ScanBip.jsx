import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { API_URL, requisicaoAPI } from "../services/api";
import "./ScanBip.css";

function DadosGS1({ resultado }) {
  const dados = [
    ["GTIN", resultado.gtin],
    ["Lote", resultado.lote_gs1],
    [
      "Validade",
      resultado.validade_gs1
        ? new Date(`${resultado.validade_gs1}T00:00:00`).toLocaleDateString("pt-BR")
        : null
    ],
    ["Número de série", resultado.numero_serie_gs1]
  ].filter(([, valor]) => valor);

  if (!dados.length) return null;

  return (
    <>
      {resultado.gtin_valido === false && (
        <p className="scan-gs1-warning" role="status">
          O código tem formato GTIN, mas o dígito verificador não confere.
        </p>
      )}
      <dl className="scan-gs1-data">
        {dados.map(([rotulo, valor]) => (
          <div key={rotulo}>
            <dt>{rotulo}</dt>
            <dd>{valor}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}

export default function ScanBip() {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const fileRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const cameraFrameRef = useRef(0);

  const [codigo, setCodigo] = useState("");
  const [resultado, setResultado] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [cameraAtiva, setCameraAtiva] = useState(false);
  const [cameraIniciando, setCameraIniciando] = useState(false);
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
      const leitura = await requisicaoAPI(`${API_URL}/bip/consultar`, {
        method: "POST",
        body: JSON.stringify({ codigo_barras: codigoLimpo })
      });

      setResultado({
        ...leitura.produto,
        codigo_barras: leitura.codigo_barras,
        encontrado: leitura.encontrado,
        tipo_codigo: leitura.tipo_codigo,
        gtin: leitura.gtin,
        gtin_valido: leitura.gtin_valido,
        lote_gs1: leitura.lote,
        validade_gs1: leitura.validade,
        numero_serie_gs1: leitura.numero_serie
      });
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

  function pararCamera() {
    if (cameraFrameRef.current) {
      cancelAnimationFrame(cameraFrameRef.current);
      cameraFrameRef.current = 0;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraAtiva(false);
  }

  async function iniciarCamera() {
    setErro("");
    const BarcodeDetectorApi = globalThis.BarcodeDetector;
    if (!BarcodeDetectorApi || !navigator.mediaDevices?.getUserMedia) {
      setErro("A leitura ao vivo não está disponível neste navegador. Use o leitor USB ou envie uma foto do código.");
      return;
    }

    setCameraIniciando(true);
    try {
      const formatosDisponiveis = await BarcodeDetectorApi.getSupportedFormats();
      const formatosAceitos = [
        "code_128",
        "data_matrix",
        "ean_13",
        "ean_8",
        "itf",
        "qr_code",
        "upc_a",
        "upc_e"
      ].filter((formato) => formatosDisponiveis.includes(formato));
      if (!formatosAceitos.length) {
        throw new Error("Este navegador não oferece formatos de código compatíveis para leitura ao vivo.");
      }

      const detector = new BarcodeDetectorApi({ formats: formatosAceitos });
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" } }
      });
      streamRef.current = stream;
      if (!videoRef.current) throw new Error("Não foi possível iniciar a prévia da câmera.");
      videoRef.current.srcObject = stream;
      setCameraAtiva(true);
      await new Promise((resolve) => requestAnimationFrame(resolve));
      await videoRef.current.play();

      const lerQuadro = async () => {
        if (!videoRef.current || streamRef.current !== stream) return;
        try {
          const codigosLidos = await detector.detect(videoRef.current);
          const codigoLido = codigosLidos.find((item) => item.rawValue)?.rawValue;
          if (codigoLido) {
            pararCamera();
            await consultarCodigo(codigoLido);
            return;
          }
          cameraFrameRef.current = requestAnimationFrame(lerQuadro);
        } catch (erroLeitura) {
          pararCamera();
          setErro(
            erroLeitura.message
              ? `Não foi possível interpretar o código pela câmera: ${erroLeitura.message}`
              : "Não foi possível interpretar o código pela câmera. Tente aproximar e enquadrar melhor, ou use uma foto/leitor USB."
          );
        }
      };
      cameraFrameRef.current = requestAnimationFrame(lerQuadro);
    } catch (erroCamera) {
      pararCamera();
      setErro(erroCamera.message || "Não foi possível acessar a câmera.");
    } finally {
      setCameraIniciando(false);
    }
  }

  useEffect(() => () => {
    if (cameraFrameRef.current) cancelAnimationFrame(cameraFrameRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

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
          <div className="scan-intro-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2" />
              <path d="M7 9v6M10 8v8M13 9v6M16 8v8" />
            </svg>
          </div>
        </section>

        <section className="scan-layout">
          <article className="panel scan-panel">
            <div className="panel-heading">
              <h3>Consultar produto</h3>
              <span className="scan-status"><span /> {cameraAtiva ? "Câmera ativa" : cameraIniciando ? "Iniciando câmera" : "Pronto para ler"}</span>
            </div>

            <div className="scanner-illustration">
              <div className="scanner-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2" />
                  <path d="M7 9v6M10 8v8M13 9v6M16 8v8" />
                </svg>
              </div>
              <p>PRONTO PARA LER</p>
              <small>Leia GTIN/EAN ou etiquetas GS1 com leitor USB, câmera ou digitando o código.</small>
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
                  placeholder="Bipe ou digite GTIN / código GS1..."
                  autoComplete="off"
                  autoFocus
                />

                <button type="submit" disabled={carregando}>
                  {carregando ? "Consultando..." : "Consultar"}
                </button>
              </div>
            </form>

            <div className="scan-divider"><span>OU USE A CÂMERA</span></div>

            <div className={`scan-camera-preview ${cameraAtiva ? "active" : ""}`}>
                <video ref={videoRef} autoPlay muted playsInline aria-label="Prévia da câmera para leitura" />
                <div className="scan-camera-target" aria-hidden="true" />
                <button className="scan-camera-stop" type="button" onClick={pararCamera}>Fechar câmera</button>
            </div>

            <div className="scan-camera-actions">
              {!cameraAtiva && (
                <button className="upload-button scan-camera-button" type="button" onClick={iniciarCamera} disabled={carregando || cameraIniciando}>
                  <span aria-hidden="true">⌖</span> {cameraIniciando ? "Abrindo câmera..." : "Abrir câmera ao vivo"}
                </button>
              )}
              <button
                className="upload-button"
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={carregando || cameraAtiva}
              >
                <span aria-hidden="true">↑</span> Enviar foto do código
              </button>
            </div>

            <p className="scan-gs1-help">
              O sistema reconhece GTIN/EAN e dados GS1 de produto, lote, validade e número de série, quando presentes no código.
            </p>

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
                <h2>{resultado.tipo_codigo === "GS1" ? "Produto GS1 não cadastrado" : "Código não encontrado"}</h2>
                <p>
                  {resultado.gtin
                    ? "O código foi lido, mas o GTIN não está associado a um produto desta empresa."
                    : "Este código ainda não está associado a um produto desta empresa."}
                </p>

                <div className="product-code">
                  <small>{resultado.gtin ? "GTIN" : "CÓDIGO LIDO"}</small>
                  <strong>{resultado.codigo_barras}</strong>
                </div>

                <DadosGS1 resultado={resultado} />

                <button
                  className="register-button"
                  onClick={() =>
                    navigate("/produtos", {
                      state: { codigo_barras: resultado.gtin || resultado.codigo_barras }
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

                  <DadosGS1 resultado={resultado} />

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