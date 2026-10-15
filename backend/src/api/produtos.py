# incluir rotas CRUD para produtos
import os
import requests

from fastapi import APIRouter, File, HTTPException, UploadFile

from backend.src.plugins.scann_bip import ScanBip


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