from fastapi import APIRouter, File, HTTPException, UploadFile, status
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from model.fornecedor import Fornecedor as FornecedorSchema, FornecedorResponse
from schemas.fornecedor import Fornecedor as FornecedorDB
from plugins.database import Session

class RotasFornecedor:
    def __init__(self):
        self.router = APIRouter()

        self.router.post("/fornecedores", status_code=status.HTTP_201_CREATED, response_model=FornecedorResponse)(self.cadastrar_fornecedor)
        self.router.get("/listar-fornecedores", response_model=list[FornecedorResponse])(self.listar_fornecedores)
        self.router.get("/{fornecedor_id}", response_model=FornecedorResponse)(self.buscar_fornecedor)
        self.router.put("/{fornecedor_id}", response_model=FornecedorResponse)(self.atualizar_fornecedor)
        self.router.delete("/{fornecedor_id}", status_code=status.HTTP_204_NO_CONTENT)(self.deletar_fornecedor)

    def cadastrar_fornecedor(self, dados: FornecedorSchema):
        db = Session()

        try:
            novo_fornecedor = FornecedorDB(**dados.model_dump())

            db.add(novo_fornecedor)
            db.commit()
            db.refresh(novo_fornecedor)

            return novo_fornecedor

        except SQLAlchemyError:
                    db.rollback()
                    raise HTTPException(status_code=500, detail="Erro ao cadastrar fornecedor no banco de dados.")

    def listar_fornecedores(self):
        db = Session()
        fornecedores = db.query(FornecedorDB).all()
        return fornecedores

    def buscar_fornecedor(self, fornecedor_id: int):
        db = Session()
        fornecedor = db.query(FornecedorDB).filter(FornecedorDB.id == fornecedor_id).first()

        if not fornecedor:
            raise HTTPException(status_code=404, detail="Fornecedor não encontrado.")

        return fornecedor

    def atualizar_fornecedor(self, fornecedor_id: int, dados: FornecedorSchema):
        db = Session()
        fornecedor = db.query(FornecedorDB).filter(FornecedorDB.id == fornecedor_id).first()

        if not fornecedor:
            raise HTTPException(status_code=404, detail="Fornecedor não encontrado.")

        for key, value in dados.model_dump().items():
            setattr(fornecedor, key, value)

        try:
            db.commit()
            db.refresh(fornecedor)
            return fornecedor
        except SQLAlchemyError:
            db.rollback()
            raise HTTPException(status_code=500, detail="Erro ao atualizar fornecedor no banco de dados.")

    def deletar_fornecedor(self, fornecedor_id: int):
        db = Session()
        fornecedor = db.query(FornecedorDB).filter(FornecedorDB.id == fornecedor_id).first()

        if not fornecedor:
            raise HTTPException(status_code=404, detail="Fornecedor não encontrado.")

        try:
            db.delete(fornecedor)
            db.commit()
            return {"detail": "Fornecedor deletado com sucesso."}
        except SQLAlchemyError:
            db.rollback()
            raise HTTPException(status_code=500, detail="Erro ao deletar fornecedor no banco de dados.")

        