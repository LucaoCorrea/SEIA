# incluir rotas CRUD para produtos
import os
import requests
from pydantic import BaseModel
from model.produto import Produto 
from plugins.database import Base, Session, engine
from pydantic import BaseModel

from fastapi import APIRouter, File, HTTPException, UploadFile, FastAPI, status
from pydantic import BaseModel

from backend.src.plugins.scann_bip import ScanBip

app = FastAPI()

class RotasProduto:
  def __init__(self):
        self.router = APIRouter()
        self.api_key = os.getenv("FIREBASE_API_KEY")

        self.router.post("/bip-barcode")(self.produto_com_barcode)


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

class ProdutoPayload(BaseModel):
    nome: str
    preco: float
    quantidade: float
    descricao: str | None
    imagem: str | None 
    codigo_barras: str | None 
    tipo_classificacao: str | None 
    unidade_medida: str 
    estoque_minimo: float
    custo: float | None
    ativo: bool

@app.post("/produtos", status_code=status.HTTP_201_CREATED)
def cadastrar_produto(dados: ProdutoPayload):

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