from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from model.fornecedor import Fornecedor as FornecedorSchema, FornecedorResponse
from plugins.database import Session
from plugins.tenant import usuario_atual
from schemas.fornecedor import Fornecedor as FornecedorDB
from schemas.produto import Produto


class RotasFornecedor:
    def __init__(self):
        self.router = APIRouter()

        self.router.post(
            "/fornecedores",
            status_code=status.HTTP_201_CREATED,
            response_model=FornecedorResponse,
        )(self.cadastrar_fornecedor)
        self.router.get("/listar-fornecedores", response_model=list[FornecedorResponse])(self.listar_fornecedores)
        self.router.get("/{fornecedor_id}", response_model=FornecedorResponse)(self.buscar_fornecedor)
        self.router.put("/{fornecedor_id}", response_model=FornecedorResponse)(self.atualizar_fornecedor)
        self.router.delete(
            "/{fornecedor_id}",
            status_code=status.HTTP_204_NO_CONTENT,
        )(self.deletar_fornecedor)

    def cadastrar_fornecedor(
        self,
        dados: FornecedorSchema,
        usuario: dict = Depends(usuario_atual),
    ):
        db = Session()

        try:
            novo_fornecedor = FornecedorDB(
                **dados.model_dump(),
                empresa_id=usuario["empresa_id"],
            )
            db.add(novo_fornecedor)
            db.commit()
            db.refresh(novo_fornecedor)
            return novo_fornecedor
        except IntegrityError:
            db.rollback()
            raise HTTPException(status_code=409, detail="Já existe um fornecedor com esse e-mail na empresa.")
        except SQLAlchemyError:
            db.rollback()
            raise HTTPException(status_code=500, detail="Erro ao cadastrar fornecedor no banco de dados.")
        finally:
            db.close()

    def listar_fornecedores(self, usuario: dict = Depends(usuario_atual)):
        db = Session()
        try:
            return (
                db.query(FornecedorDB)
                .filter(FornecedorDB.empresa_id == usuario["empresa_id"])
                .order_by(FornecedorDB.nome)
                .all()
            )
        except SQLAlchemyError:
            raise HTTPException(status_code=500, detail="Erro ao consultar fornecedores.")
        finally:
            db.close()

    def buscar_fornecedor(self, fornecedor_id: int, usuario: dict = Depends(usuario_atual)):
        db = Session()
        try:
            fornecedor = db.query(FornecedorDB).filter(
                FornecedorDB.id == fornecedor_id,
                FornecedorDB.empresa_id == usuario["empresa_id"],
            ).first()
            if fornecedor is None:
                raise HTTPException(status_code=404, detail="Fornecedor não encontrado.")
            return fornecedor
        except HTTPException:
            raise
        except SQLAlchemyError:
            raise HTTPException(status_code=500, detail="Erro ao consultar fornecedor.")
        finally:
            db.close()

    def atualizar_fornecedor(
        self,
        fornecedor_id: int,
        dados: FornecedorSchema,
        usuario: dict = Depends(usuario_atual),
    ):
        db = Session()
        try:
            fornecedor = db.query(FornecedorDB).filter(
                FornecedorDB.id == fornecedor_id,
                FornecedorDB.empresa_id == usuario["empresa_id"],
            ).first()
            if fornecedor is None:
                raise HTTPException(status_code=404, detail="Fornecedor não encontrado.")

            for campo, valor in dados.model_dump().items():
                setattr(fornecedor, campo, valor)
            db.commit()
            db.refresh(fornecedor)
            return fornecedor
        except HTTPException:
            db.rollback()
            raise
        except IntegrityError:
            db.rollback()
            raise HTTPException(status_code=409, detail="Já existe um fornecedor com esse e-mail na empresa.")
        except SQLAlchemyError:
            db.rollback()
            raise HTTPException(status_code=500, detail="Erro ao atualizar fornecedor.")
        finally:
            db.close()

    def deletar_fornecedor(self, fornecedor_id: int, usuario: dict = Depends(usuario_atual)):
        db = Session()
        try:
            fornecedor = db.query(FornecedorDB).filter(
                FornecedorDB.id == fornecedor_id,
                FornecedorDB.empresa_id == usuario["empresa_id"],
            ).first()
            if fornecedor is None:
                raise HTTPException(status_code=404, detail="Fornecedor não encontrado.")
            if db.query(Produto.id).filter(Produto.fornecedor_id == fornecedor.id).first():
                raise HTTPException(
                    status_code=409,
                    detail="Fornecedor vinculado a produtos não pode ser excluído.",
                )
            db.delete(fornecedor)
            db.commit()
        except HTTPException:
            db.rollback()
            raise
        except SQLAlchemyError:
            db.rollback()
            raise HTTPException(status_code=500, detail="Erro ao excluir fornecedor.")
        finally:
            db.close()
