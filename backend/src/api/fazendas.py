from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from model.fazenda import FazendaCreate, FazendaResponse, LoteCreate, LoteResponse
from plugins.database import Session
from plugins.tenant import usuario_atual
from schemas.fazenda import Fazenda, Lote
from schemas.movimentacao import Movimentacao


class RotasFazenda:
    def __init__(self):
        self.router = APIRouter()
        self.router.get("/fazendas", response_model=list[FazendaResponse])(self.listar)
        self.router.post(
            "/fazendas",
            status_code=status.HTTP_201_CREATED,
            response_model=FazendaResponse,
        )(self.criar)
        self.router.post(
            "/fazendas/{fazenda_id}/lotes",
            status_code=status.HTTP_201_CREATED,
            response_model=LoteResponse,
        )(self.criar_lote)
        self.router.get("/lotes", response_model=list[LoteResponse])(self.listar_lotes)
        self.router.delete("/lotes/{lote_id}", status_code=status.HTTP_204_NO_CONTENT)(
            self.excluir_lote
        )
        self.router.delete("/fazendas/{fazenda_id}", status_code=status.HTTP_204_NO_CONTENT)(
            self.excluir
        )

    def listar(self, usuario: dict = Depends(usuario_atual)):
        db = Session()
        try:
            fazendas = (
                db.query(Fazenda)
                .filter(Fazenda.empresa_id == usuario["empresa_id"])
                .order_by(Fazenda.nome)
                .all()
            )
            return [
                {
                    "id": fazenda.id,
                    "codigo": fazenda.codigo,
                    "nome": fazenda.nome,
                    "lotes": [
                        {
                            "id": lote.id,
                            "fazenda_id": fazenda.id,
                            "fazenda_nome": fazenda.nome,
                            "nome": lote.nome,
                            "talhao": lote.talhao,
                            "area_hectares": lote.area_hectares,
                        }
                        for lote in db.query(Lote)
                        .filter(Lote.fazenda_id == fazenda.id)
                        .order_by(Lote.nome, Lote.talhao)
                        .all()
                    ],
                }
                for fazenda in fazendas
            ]
        except SQLAlchemyError:
            raise HTTPException(status_code=500, detail="Erro ao consultar fazendas.")
        finally:
            db.close()

    def listar_lotes(self, usuario: dict = Depends(usuario_atual)):
        db = Session()
        try:
            registros = (
                db.query(Lote, Fazenda.nome)
                .join(Fazenda, Fazenda.id == Lote.fazenda_id)
                .filter(Fazenda.empresa_id == usuario["empresa_id"])
                .order_by(Fazenda.nome, Lote.nome, Lote.talhao)
                .all()
            )
            return [
                {
                    "id": lote.id,
                    "fazenda_id": lote.fazenda_id,
                    "fazenda_nome": fazenda_nome,
                    "nome": lote.nome,
                    "talhao": lote.talhao,
                    "area_hectares": lote.area_hectares,
                }
                for lote, fazenda_nome in registros
            ]
        except SQLAlchemyError:
            raise HTTPException(status_code=500, detail="Erro ao consultar lotes.")
        finally:
            db.close()

    def criar(self, dados: FazendaCreate, usuario: dict = Depends(usuario_atual)):
        db = Session()
        try:
            fazenda = Fazenda(
                empresa_id=usuario["empresa_id"],
                codigo=dados.codigo,
                nome=dados.nome,
            )
            db.add(fazenda)
            db.commit()
            db.refresh(fazenda)
            return {
                "id": fazenda.id,
                "codigo": fazenda.codigo,
                "nome": fazenda.nome,
                "lotes": [],
            }
        except IntegrityError:
            db.rollback()
            raise HTTPException(
                status_code=409,
                detail="Já existe uma fazenda com esse código ou nome.",
            )
        except SQLAlchemyError:
            db.rollback()
            raise HTTPException(status_code=500, detail="Erro ao cadastrar a fazenda.")
        finally:
            db.close()

    def criar_lote(
        self,
        fazenda_id: int,
        dados: LoteCreate,
        usuario: dict = Depends(usuario_atual),
    ):
        db = Session()
        try:
            fazenda = (
                db.query(Fazenda)
                .filter(
                    Fazenda.id == fazenda_id,
                    Fazenda.empresa_id == usuario["empresa_id"],
                )
                .first()
            )
            if fazenda is None:
                raise HTTPException(status_code=404, detail="Fazenda não encontrada.")

            lote = Lote(
                fazenda_id=fazenda.id,
                nome=dados.nome,
                talhao=dados.talhao,
                area_hectares=dados.area_hectares,
            )
            db.add(lote)
            db.commit()
            db.refresh(lote)
            return {
                "id": lote.id,
                "fazenda_id": fazenda.id,
                "fazenda_nome": fazenda.nome,
                "nome": lote.nome,
                "talhao": lote.talhao,
                "area_hectares": lote.area_hectares,
            }
        except HTTPException:
            db.rollback()
            raise
        except IntegrityError:
            db.rollback()
            raise HTTPException(
                status_code=409,
                detail="Já existe esse lote e talhão cadastrados para a fazenda.",
            )
        except SQLAlchemyError:
            db.rollback()
            raise HTTPException(status_code=500, detail="Erro ao cadastrar o lote.")
        finally:
            db.close()

    def excluir_lote(self, lote_id: int, usuario: dict = Depends(usuario_atual)):
        db = Session()
        try:
            lote = (
                db.query(Lote)
                .join(Fazenda, Fazenda.id == Lote.fazenda_id)
                .filter(
                    Lote.id == lote_id,
                    Fazenda.empresa_id == usuario["empresa_id"],
                )
                .first()
            )
            if lote is None:
                raise HTTPException(status_code=404, detail="Lote não encontrado.")
            if (
                db.query(Movimentacao.id)
                .filter(Movimentacao.destino_lote_id == lote.id)
                .first()
                is not None
            ):
                raise HTTPException(
                    status_code=409,
                    detail="O lote possui movimentações vinculadas e não pode ser excluído.",
                )
            db.delete(lote)
            db.commit()
        except HTTPException:
            db.rollback()
            raise
        except SQLAlchemyError:
            db.rollback()
            raise HTTPException(status_code=500, detail="Erro ao excluir o lote.")
        finally:
            db.close()

    def excluir(self, fazenda_id: int, usuario: dict = Depends(usuario_atual)):
        db = Session()
        try:
            fazenda = (
                db.query(Fazenda)
                .filter(
                    Fazenda.id == fazenda_id,
                    Fazenda.empresa_id == usuario["empresa_id"],
                )
                .first()
            )
            if fazenda is None:
                raise HTTPException(status_code=404, detail="Fazenda não encontrada.")
            if db.query(Lote.id).filter(Lote.fazenda_id == fazenda.id).first() is not None:
                raise HTTPException(
                    status_code=409,
                    detail="Exclua os lotes vinculados antes de excluir a fazenda.",
                )
            db.delete(fazenda)
            db.commit()
        except HTTPException:
            db.rollback()
            raise
        except SQLAlchemyError:
            db.rollback()
            raise HTTPException(status_code=500, detail="Erro ao excluir a fazenda.")
        finally:
            db.close()
