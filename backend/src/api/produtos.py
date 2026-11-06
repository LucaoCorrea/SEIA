import logging

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import update
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from model.barcode import ConsultaCodigoBarras
from model.produto import Produto as ProdutoSchema, ProdutoResponse
from plugins.barcode_gs1 import interpretar_codigo_barras
from plugins.database import Session
from plugins.scann_bip import ScanBip
from plugins.tenant import usuario_atual
from schemas.fornecedor import Fornecedor as FornecedorDB
from schemas.movimentacao import Movimentacao as MovimentacaoDB
from schemas.produto import Produto as ProdutoDB

logger = logging.getLogger(__name__)


class RotasProduto:
    def __init__(self):
        self.router = APIRouter()
        self.scan_bip = ScanBip()

        self.router.get("/buscar-produto-nome", response_model=list[ProdutoResponse])(self.buscar_produto_nome)
        self.router.post("/bip/consultar")(self.consultar_codigo_barras)
        self.router.post("/bip-barcode")(self.produto_com_barcode)
        self.router.post(
            "/produtos",
            status_code=status.HTTP_201_CREATED,
            response_model=ProdutoResponse,
        )(self.cadastrar_produto)
        self.router.get("/listar-produtos", response_model=list[ProdutoResponse])(self.listar_produtos)
        self.router.get("/buscar/{produto_id}", response_model=ProdutoResponse)(self.buscar_produto)
        self.router.put("/atualizar/{produto_id}", response_model=ProdutoResponse)(self.atualizar_produto)
        self.router.delete("/deletar/{produto_id}", status_code=status.HTTP_204_NO_CONTENT)(self.deletar_produto)

    def consultar_codigo_barras(
        self,
        dados: ConsultaCodigoBarras,
        usuario: dict = Depends(usuario_atual),
    ):
        try:
            leitura = interpretar_codigo_barras(dados.codigo_barras)
        except ValueError as erro:
            raise HTTPException(status_code=400, detail=str(erro))

        db = Session()
        try:
            produto = None
            for codigo in leitura["codigos_consulta"]:
                produto = db.query(ProdutoDB).filter(
                    ProdutoDB.empresa_id == usuario["empresa_id"],
                    ProdutoDB.codigo_barras == codigo,
                ).first()
                if produto:
                    break

            leitura.pop("codigos_consulta")
            return {
                **leitura,
                "encontrado": produto is not None,
                "produto": (
                    ProdutoResponse.model_validate(produto).model_dump()
                    if produto is not None else None
                ),
            }
        except SQLAlchemyError:
            logger.exception("Falha ao consultar produto por código de barras.")
            raise HTTPException(status_code=500, detail="Erro ao consultar produto por código de barras.")
        finally:
            db.close()

    async def produto_com_barcode(
        self,
        file: UploadFile = File(...),
        usuario: dict = Depends(usuario_atual),
    ):
        if file.content_type not in ["image/jpeg", "image/png", "image/webp"]:
            raise HTTPException(status_code=415, detail="Formato de imagem não suportado.")
        bytes_imagem = await file.read()
        if not bytes_imagem:
            raise HTTPException(status_code=400, detail="Imagem vazia.")
        try:
            codigo_barras = self.scan_bip.escanear_bytes_imagem(bytes_imagem)
        except Exception:
            logger.exception("Falha ao processar imagem de código de barras.")
            raise HTTPException(status_code=500, detail="Erro ao processar imagem.")
        if not codigo_barras:
            raise HTTPException(status_code=400, detail="Nenhum código de barras detectado na imagem.")
        return {
            "status": "sucesso",
            "codigo_barras": codigo_barras,
            "mensagem": "Produto identificado",
        }

    def cadastrar_produto(self, dados: ProdutoSchema, usuario: dict = Depends(usuario_atual)):
        db = Session()

        try:
            fornecedor = db.query(FornecedorDB).filter(
                FornecedorDB.id == dados.fornecedor_id,
                FornecedorDB.empresa_id == usuario["empresa_id"],
            ).first()
            if fornecedor is None:
                raise HTTPException(status_code=404, detail="Fornecedor não encontrado nesta empresa.")

            novo_produto = ProdutoDB(
                **dados.model_dump(exclude={"custo"}),
                empresa_id=usuario["empresa_id"],
                custo=float(dados.quantidade) * float(dados.preco),
            )
            db.add(novo_produto)
            db.flush()

            if novo_produto.quantidade > 0:
                db.add(
                    MovimentacaoDB(
                        empresa_id=usuario["empresa_id"],
                        produto_id=novo_produto.id,
                        usuario_id=usuario["id"],
                        tipo="entrada",
                        quantidade=novo_produto.quantidade,
                        saldo_anterior=0,
                        saldo_posterior=novo_produto.quantidade,
                        motivo="Saldo inicial do cadastro do produto",
                    )
                )

            db.commit()
            db.refresh(novo_produto)
            return novo_produto
        except HTTPException:
            db.rollback()
            raise
        except IntegrityError:
            db.rollback()
            raise HTTPException(status_code=409, detail="Código de barras já cadastrado nesta empresa.")
        except SQLAlchemyError:
            db.rollback()
            raise HTTPException(status_code=500, detail="Erro ao cadastrar produto no banco de dados.")
        finally:
            db.close()

    def listar_produtos(self, usuario: dict = Depends(usuario_atual)):
        db = Session()
        try:
            return (
                db.query(ProdutoDB)
                .filter(ProdutoDB.empresa_id == usuario["empresa_id"])
                .order_by(ProdutoDB.id)
                .all()
            )
        except SQLAlchemyError:
            raise HTTPException(status_code=500, detail="Erro ao consultar produtos no banco de dados.")
        finally:
            db.close()

    def buscar_produto(self, produto_id: int, usuario: dict = Depends(usuario_atual)):
        db = Session()
        try:
            produto = db.query(ProdutoDB).filter(
                ProdutoDB.id == produto_id,
                ProdutoDB.empresa_id == usuario["empresa_id"],
            ).first()
            if produto is None:
                raise HTTPException(status_code=404, detail="Produto não encontrado.")
            return produto
        except HTTPException:
            raise
        except SQLAlchemyError:
            raise HTTPException(status_code=500, detail="Erro ao consultar produto no banco de dados.")
        finally:
            db.close()

    def buscar_produto_nome(self, nome: str, usuario: dict = Depends(usuario_atual)):
        db = Session()
        try:
            nome = nome.strip()
            if not nome:
                raise HTTPException(status_code=400, detail="Informe um nome para pesquisar.")
            return (
                db.query(ProdutoDB)
                .filter(
                    ProdutoDB.empresa_id == usuario["empresa_id"],
                    ProdutoDB.nome.ilike(f"%{nome}%"),
                )
                .order_by(ProdutoDB.nome)
                .all()
            )
        except HTTPException:
            raise
        except SQLAlchemyError:
            raise HTTPException(status_code=500, detail="Erro ao consultar produtos pelo nome.")
        finally:
            db.close()

    def atualizar_produto(
        self,
        produto_id: int,
        dados: ProdutoSchema,
        usuario: dict = Depends(usuario_atual),
    ):
        db = Session()

        try:
            produto = db.query(ProdutoDB).filter(
                ProdutoDB.id == produto_id,
                ProdutoDB.empresa_id == usuario["empresa_id"],
            ).first()
            if produto is None:
                raise HTTPException(status_code=404, detail="Produto não encontrado.")

            dados_atualizados = dados.model_dump(exclude_unset=True)
            if (
                "quantidade" in dados_atualizados
                and float(dados_atualizados["quantidade"]) != float(produto.quantidade)
            ):
                raise HTTPException(
                    status_code=409,
                    detail="Altere o estoque pela página de movimentações.",
                )

            fornecedor_id = dados_atualizados.get("fornecedor_id", produto.fornecedor_id)
            fornecedor = db.query(FornecedorDB).filter(
                FornecedorDB.id == fornecedor_id,
                FornecedorDB.empresa_id == usuario["empresa_id"],
            ).first()
            if fornecedor is None:
                raise HTTPException(status_code=404, detail="Fornecedor não encontrado nesta empresa.")

            for campo, valor in dados_atualizados.items():
                if campo not in ("quantidade", "custo"):
                    setattr(produto, campo, valor)
            produto.custo = float(produto.quantidade) * float(produto.preco)
            db.commit()
            db.refresh(produto)
            return produto
        except HTTPException:
            db.rollback()
            raise
        except IntegrityError:
            db.rollback()
            raise HTTPException(status_code=409, detail="Código de barras já cadastrado nesta empresa.")
        except SQLAlchemyError:
            db.rollback()
            raise HTTPException(status_code=500, detail="Erro ao atualizar produto no banco de dados.")
        finally:
            db.close()

    def deletar_produto(self, produto_id: int, usuario: dict = Depends(usuario_atual)):
        db = Session()

        try:
            produto = db.query(ProdutoDB).filter(
                ProdutoDB.id == produto_id,
                ProdutoDB.empresa_id == usuario["empresa_id"],
            ).first()
            if produto is None:
                raise HTTPException(status_code=404, detail="Produto não encontrado.")
            if db.query(MovimentacaoDB.id).filter(
                MovimentacaoDB.produto_id == produto.id
            ).first():
                raise HTTPException(
                    status_code=409,
                    detail="Produto possui histórico de movimentações e não pode ser excluído.",
                )
            db.delete(produto)
            db.commit()
        except HTTPException:
            db.rollback()
            raise
        except SQLAlchemyError:
            db.rollback()
            raise HTTPException(status_code=500, detail="Erro ao excluir produto do banco de dados.")
        finally:
            db.close()
