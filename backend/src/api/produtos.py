import os
from typing import Optional

from fastapi import APIRouter, FastAPI, File, HTTPException, UploadFile, status, Response
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from backend.src.model.produto import Produto
from backend.src.plugins.database import Session
from backend.src.plugins.scann_bip import ScanBip

app = FastAPI()

class RotasProduto:
    def __init__(self):
            self.router = APIRouter()
            self.api_key = os.getenv("FIREBASE_API_KEY")

            self.router.post("/bip-barcode")(self.produto_com_barcode)
            self.routar.post("/produtos", status_code=status.HTTP_201_CREATED)(self.cadastrar_produto)
            self.router.get("/listar-produtos")(self.listar_produtos)
            self.router.get("/{produto_id}")(self.buscar_produto)

    async def produto_com_barcode(self, file: UploadFile = File(...)):
        try:
            bytes_imagem = await file.read()
            codigo_barras = self.scan_bip.escanear_bytes_imagem(bytes_imagem)
            
            if not codigo_barras:
                raise HTTPException(status_code=400, detail="Nenhum código de barras detectado na imagem.")
            
            return {
                "status": "sucesso",
                "codigo_barras": codigo_barras,
                "mensagem": "Produto identificado"
            }
        
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    def cadastrar_produto(dados: Produto):

            db = Session()

            try:
                novo_produto = Produto(
                    nome=dados.nome,
                    preco=dados.preco,
                    quantidade=dados.quantidade,
                    descricao=dados.descricao,
                    imagem=dados.imagem,
                    codigo_barras=dados.codigo_barras,
                    tipo_classificacao=dados.tipo_classificacao,
                    unidade_medida=dados.unidade_medida,
                    estoque_minimo=dados.estoque_minimo,
                    custo=dados.custo,
                    ativo=dados.ativo
                )

                db.add(novo_produto)
                db.commit()
                db.refresh(novo_produto)
                db.close()
            except Exception as e:
                db.rollback()
                db.close()
                raise HTTPException(status_code=400, detail=str(e))

    def listar_produtos(self):
        db = Session()
        
        try:
            produtos = db.query(Produto).order_by(Produto.id).all()
            return [self._serializar_produto(produto) for produto in produtos]
        except SQLAlchemyError:
              raise HTTPException(status_code=500, detail="Erro ao consultar produtos no banco de dados.")
        finally:
            db.close()

    def buscar_produto(self, produto_id: int):
        db = Session()

        try:
            produto = db.query(Produto).filter(Produto.id == produto_id).first()

            if produto is None:
                raise HTTPException(status_code=404, detail="Produto não encontrado.")

            return self._serializar_produto(produto)
        except HTTPException:
            raise
        except SQLAlchemyError:
            raise HTTPException(status_code=500, detail="Erro ao consultar produto no banco de dados.")
        finally:
            db.close()

    # Criar rotas de Atualizar por produto_id, deletar por produto_id
    # As rotas devem ser colocadas no __init__ para preservar 
    # o conceito de classe