
from fastapi import APIRouter, File, HTTPException, UploadFile, status
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from model.produto import Produto as ProdutoSchema, ProdutoResponse
from schemas.produto import Produto as ProdutoDB
from plugins.database import Session
from plugins.scann_bip import ScanBip


class RotasProduto:
    def __init__(self):
        self.router = APIRouter()
        self.scan_bip = ScanBip()

        self.router.post("/bip-barcode")(self.produto_com_barcode)
        self.router.post("/produtos", status_code=status.HTTP_201_CREATED, response_model=ProdutoResponse)(self.cadastrar_produto)
        self.router.get("/listar-produtos", response_model=list[ProdutoResponse])(self.listar_produtos)
        self.router.get("/{produto_id}", response_model=ProdutoResponse)(self.buscar_produto)
        self.router.get("/buscar-produto-nome", response_model=list[ProdutoResponse])(self.buscar_produto_nome)
        self.router.put("/{produto_id}", response_model=ProdutoResponse)(self.atualizar_produto)
        self.router.delete("/{produto_id}", status_code=status.HTTP_204_NO_CONTENT)(self.deletar_produto)

    async def produto_com_barcode(self, file: UploadFile = File(...)):
        try:
            if file.content_type not in ["image/jpeg", "image/png", "image/webp"]:
                raise HTTPException(status_code=415, detail="Formato de imagem não suportado.")

            bytes_imagem = await file.read()

            if not bytes_imagem:
                raise HTTPException(status_code=400, detail="Imagem vazia.")

            codigo_barras = self.scan_bip.escanear_bytes_imagem(bytes_imagem)

            if not codigo_barras:
                raise HTTPException(status_code=400, detail="Nenhum código de barras detectado na imagem.")

            return {
                "status": "sucesso",
                "codigo_barras": codigo_barras,
                "mensagem": "Produto identificado"
            }

        except HTTPException:
            raise
        except Exception:
            raise HTTPException(status_code=500, detail="Erro ao processar imagem.")

    def cadastrar_produto(self, dados: ProdutoSchema):
        db = Session()

        try:
            novo_produto = ProdutoDB(**dados.model_dump())

            db.add(novo_produto)
            db.commit()
            db.refresh(novo_produto)

            return novo_produto

        except IntegrityError:
            db.rollback()
            raise HTTPException(status_code=409, detail="Código de barras já cadastrado ou conflito de integridade.")

        except SQLAlchemyError:
            db.rollback()
            raise HTTPException(status_code=500, detail="Erro ao cadastrar produto no banco de dados.")

        finally:
            db.close()

    def listar_produtos(self):
        db = Session()

        try:
            produtos = db.query(ProdutoDB).order_by(ProdutoDB.id).all()
            return produtos

        except SQLAlchemyError:
            raise HTTPException(status_code=500, detail="Erro ao consultar produtos no banco de dados.")

        finally:
            db.close()

    def buscar_produto(self, produto_id: int):
        db = Session()

        try:
            produto = db.query(ProdutoDB).filter(ProdutoDB.id == produto_id).first()

            if produto is None:
                raise HTTPException(status_code=404, detail="Produto não encontrado.")

            return produto

        except HTTPException:
            raise

        except SQLAlchemyError:
            raise HTTPException(status_code=500, detail="Erro ao consultar produto no banco de dados.")

        finally:
            db.close()

    def buscar_produto_nome(self, nome: str):
        db = Session()

        try:
            nome = nome.strip()

            if not nome:
                raise HTTPException(status_code=400, detail="Informe um nome para pesquisar.")

            produtos = db.query(ProdutoDB).filter(ProdutoDB.nome.ilike(f"%{nome}%")).order_by(ProdutoDB.nome).all()

            return produtos

        except SQLAlchemyError:
            raise HTTPException(
                status_code=500,
                detail="Erro ao consultar produtos pelo nome."
            )

        finally:
            db.close()

    def atualizar_produto(self, produto_id: int, dados: ProdutoSchema):
        db = Session()

        try:
            produto = db.query(ProdutoDB).filter(ProdutoDB.id == produto_id).first()

            if produto is None:
                raise HTTPException(status_code=404, detail="Produto não encontrado.")

            dados_atualizados = dados.model_dump(exclude_unset=True)

            for campo, valor in dados_atualizados.items():
                setattr(produto, campo, valor)

            db.commit()
            db.refresh(produto)

            return produto

        except HTTPException:
            raise

        except IntegrityError:
            db.rollback()
            raise HTTPException(status_code=409, detail="Código de barras já cadastrado ou conflito de integridade.")

        except SQLAlchemyError:
            db.rollback()
            raise HTTPException(status_code=500, detail="Erro ao atualizar produto no banco de dados.")

        finally:
            db.close()

    def deletar_produto(self, produto_id: int):
        db = Session()

        try:
            produto = db.query(ProdutoDB).filter(ProdutoDB.id == produto_id).first()

            if produto is None:
                raise HTTPException(status_code=404, detail="Produto não encontrado.")

            db.delete(produto)
            db.commit()

        except HTTPException:
            raise

        except SQLAlchemyError:
            db.rollback()
            raise HTTPException(status_code=500, detail="Erro ao excluir produto do banco de dados.")

        finally:
            db.close()
