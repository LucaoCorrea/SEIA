from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import SQLAlchemyError

from model.aviso import AvisoCreate, AvisoResponse
from plugins.database import Session
from plugins.tenant import usuario_atual
from schemas.aviso import Aviso
from schemas.usuario import UsuarioDB


class RotasAviso:
    def __init__(self):
        self.router = APIRouter()
        self.router.get("/avisos", response_model=list[AvisoResponse])(self.listar)
        self.router.post(
            "/avisos",
            status_code=status.HTTP_201_CREATED,
            response_model=AvisoResponse,
        )(self.criar)
        self.router.put("/avisos/{aviso_id}", response_model=AvisoResponse)(self.atualizar)
        self.router.delete("/avisos/{aviso_id}", status_code=status.HTTP_204_NO_CONTENT)(self.deletar)

    @staticmethod
    def _exigir_gestor(usuario):
        if usuario["role"] not in ("admin", "gerente", "admin_seia"):
            raise HTTPException(status_code=403, detail="Somente administradores e gerentes podem gerenciar avisos.")

    def listar(self, usuario: dict = Depends(usuario_atual)):
        db = Session()

        try:
            registros = (
                db.query(Aviso, UsuarioDB.nome)
                .join(UsuarioDB, UsuarioDB.id == Aviso.usuario_id)
                .filter(Aviso.empresa_id == usuario["empresa_id"])
                .order_by(Aviso.criado_em.desc(), Aviso.id.desc())
                .limit(50)
                .all()
            )
            return [
                {
                    "id": aviso.id,
                    "usuario_id": aviso.usuario_id,
                    "usuario_nome": nome,
                    "titulo": aviso.titulo,
                    "mensagem": aviso.mensagem,
                    "criado_em": aviso.criado_em,
                }
                for aviso, nome in registros
            ]
        except SQLAlchemyError:
            raise HTTPException(status_code=500, detail="Erro ao consultar avisos.")
        finally:
            db.close()

    def criar(self, dados: AvisoCreate, usuario: dict = Depends(usuario_atual)):
        self._exigir_gestor(usuario)
        db = Session()

        try:
            aviso = Aviso(
                empresa_id=usuario["empresa_id"],
                usuario_id=usuario["id"],
                titulo=dados.titulo.strip(),
                mensagem=dados.mensagem.strip(),
            )
            db.add(aviso)
            db.commit()
            db.refresh(aviso)
            return {
                "id": aviso.id,
                "usuario_id": usuario["id"],
                "usuario_nome": usuario["nome"],
                "titulo": aviso.titulo,
                "mensagem": aviso.mensagem,
                "criado_em": aviso.criado_em,
            }
        except SQLAlchemyError:
            db.rollback()
            raise HTTPException(status_code=500, detail="Erro ao criar aviso.")
        finally:
            db.close()

    def atualizar(
        self,
        aviso_id: int,
        dados: AvisoCreate,
        usuario: dict = Depends(usuario_atual),
    ):
        self._exigir_gestor(usuario)
        db = Session()

        try:
            aviso = db.query(Aviso).filter(
                Aviso.id == aviso_id,
                Aviso.empresa_id == usuario["empresa_id"],
            ).first()
            if aviso is None:
                raise HTTPException(status_code=404, detail="Aviso não encontrado.")

            aviso.titulo = dados.titulo.strip()
            aviso.mensagem = dados.mensagem.strip()
            db.commit()
            db.refresh(aviso)
            nome_autor = db.query(UsuarioDB.nome).filter(
                UsuarioDB.id == aviso.usuario_id
            ).scalar()
            return {
                "id": aviso.id,
                "usuario_id": aviso.usuario_id,
                "usuario_nome": nome_autor,
                "titulo": aviso.titulo,
                "mensagem": aviso.mensagem,
                "criado_em": aviso.criado_em,
            }
        except HTTPException:
            db.rollback()
            raise
        except SQLAlchemyError:
            db.rollback()
            raise HTTPException(status_code=500, detail="Erro ao atualizar aviso.")
        finally:
            db.close()

    def deletar(self, aviso_id: int, usuario: dict = Depends(usuario_atual)):
        self._exigir_gestor(usuario)
        db = Session()

        try:
            aviso = db.query(Aviso).filter(
                Aviso.id == aviso_id,
                Aviso.empresa_id == usuario["empresa_id"],
            ).first()
            if aviso is None:
                raise HTTPException(status_code=404, detail="Aviso não encontrado.")
            db.delete(aviso)
            db.commit()
        except HTTPException:
            db.rollback()
            raise
        except SQLAlchemyError:
            db.rollback()
            raise HTTPException(status_code=500, detail="Erro ao excluir aviso.")
        finally:
            db.close()
