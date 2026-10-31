"""Endpoints para editar e remover usuários da empresa autenticada."""

import logging

from fastapi import APIRouter, Depends, HTTPException, Response, status
from firebase_admin import auth
from firebase_admin.exceptions import FirebaseError
from google.auth.exceptions import TransportError
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from model.empresa import UsuarioAtualizacaoEmpresa, UsuarioEmpresaResponse
from plugins.database import Session
from plugins.tenant import usuario_atual
from schemas.usuario import UsuarioDB

logger = logging.getLogger(__name__)


class RotasPerfilUsuario:
    """Mantém o cadastro local e a conta Firebase sincronizados."""

    def __init__(self):
        self.router = APIRouter()
        self.router.put(
            "/empresas/usuarios/{usuario_id}",
            response_model=UsuarioEmpresaResponse,
        )(self.atualizar_usuario)
        self.router.delete(
            "/empresas/usuarios/{usuario_id}",
            status_code=status.HTTP_204_NO_CONTENT,
        )(self.excluir_usuario)

    @staticmethod
    def _exigir_gestor(usuario):
        """Restringe o gerenciamento de usuários a perfis administrativos."""
        if usuario["role"] not in ("admin", "gerente", "admin_seia"):
            raise HTTPException(
                status_code=403,
                detail="Somente administradores e gerentes podem gerenciar usuários.",
            )

    def atualizar_usuario(
        self,
        usuario_id: int,
        dados: UsuarioAtualizacaoEmpresa,
        gestor: dict = Depends(usuario_atual),
    ):
        self._exigir_gestor(gestor)
        db = Session()
        uid = None
        usuario_alterado = None
        dados_anteriores = None

        try:
            usuario_alterado = (
                db.query(UsuarioDB)
                .filter(
                    UsuarioDB.id == usuario_id,
                    UsuarioDB.empresa_id == gestor["empresa_id"],
                )
                .first()
            )
            if usuario_alterado is None:
                raise HTTPException(status_code=404, detail="Usuário não encontrado nesta empresa.")

            if (
                dados.role != usuario_alterado.role
                and gestor["role"] not in ("admin", "admin_seia")
            ):
                raise HTTPException(
                    status_code=403,
                    detail="Somente administradores podem alterar o cargo de um usuário.",
                )
            if dados.role == "admin" and usuario_alterado.role != "admin":
                raise HTTPException(
                    status_code=403,
                    detail="Não é permitido atribuir o cargo de administrador por esta operação.",
                )

            email_existente = (
                db.query(UsuarioDB.id)
                .filter(
                    UsuarioDB.empresa_id == gestor["empresa_id"],
                    UsuarioDB.email == str(dados.email),
                    UsuarioDB.id != usuario_alterado.id,
                )
                .first()
            )
            if email_existente is not None:
                raise HTTPException(status_code=409, detail="Este e-mail já está vinculado a outro usuário.")

            uid = usuario_alterado.firebase_uid
            # O perfil Firebase é atualizado antes do banco e restaurado se o commit falhar.
            dados_anteriores = {
                "email": usuario_alterado.email,
                "display_name": usuario_alterado.nome,
            }
            auth.update_user(
                uid,
                email=str(dados.email),
                display_name=dados.nome,
            )

            usuario_alterado.nome = dados.nome
            usuario_alterado.email = str(dados.email)
            usuario_alterado.telefone = dados.telefone or None
            usuario_alterado.role = dados.role
            db.commit()
            db.refresh(usuario_alterado)
            return usuario_alterado
        except HTTPException:
            db.rollback()
            raise
        except auth.EmailAlreadyExistsError:
            db.rollback()
            raise HTTPException(status_code=409, detail="O e-mail já possui uma conta SEIA/Firebase.")
        except auth.UserNotFoundError:
            db.rollback()
            raise HTTPException(status_code=404, detail="A conta Firebase deste usuário não foi encontrada.")
        except IntegrityError:
            db.rollback()
            if uid and dados_anteriores:
                _restaurar_perfil_firebase(uid, dados_anteriores)
            raise HTTPException(status_code=409, detail="Este e-mail já está vinculado a outro usuário.")
        except (FirebaseError, TransportError):
            db.rollback()
            logger.exception("Falha ao atualizar usuário %s no Firebase.", usuario_id)
            raise HTTPException(
                status_code=503,
                detail="Não foi possível atualizar a conta no Firebase. Tente novamente.",
            )
        except SQLAlchemyError:
            db.rollback()
            if uid and dados_anteriores:
                _restaurar_perfil_firebase(uid, dados_anteriores)
            logger.exception("Falha ao salvar usuário %s no banco.", usuario_id)
            raise HTTPException(status_code=500, detail="Erro ao atualizar o usuário.")
        finally:
            db.close()

    def excluir_usuario(
        self,
        usuario_id: int,
        gestor: dict = Depends(usuario_atual),
    ):
        self._exigir_gestor(gestor)
        if usuario_id == gestor["id"]:
            raise HTTPException(status_code=400, detail="Não é possível excluir a própria conta.")

        db = Session()
        try:
            usuario = (
                db.query(UsuarioDB)
                .filter(
                    UsuarioDB.id == usuario_id,
                    UsuarioDB.empresa_id == gestor["empresa_id"],
                )
                .first()
            )
            if usuario is None:
                raise HTTPException(status_code=404, detail="Usuário não encontrado nesta empresa.")

            try:
                auth.delete_user(usuario.firebase_uid)
            except auth.UserNotFoundError:
                logger.warning(
                    "Conta Firebase do usuário %s já não existe; removendo o vínculo local.",
                    usuario_id,
                )
            except (FirebaseError, TransportError):
                logger.exception("Falha ao excluir usuário %s do Firebase.", usuario_id)
                raise HTTPException(
                    status_code=503,
                    detail="Não foi possível excluir a conta no Firebase. Tente novamente.",
                )

            db.delete(usuario)
            db.commit()
        except HTTPException:
            db.rollback()
            raise
        except SQLAlchemyError:
            db.rollback()
            logger.exception(
                "Falha ao remover usuário %s do banco após excluir a conta Firebase.",
                usuario_id,
            )
            raise HTTPException(
                status_code=500,
                detail=(
                    "A conta Firebase foi excluída, mas não foi possível remover o vínculo "
                    "no banco de dados. Solicite suporte para reconciliar o cadastro."
                ),
            )
        finally:
            db.close()


def _restaurar_perfil_firebase(uid, dados_anteriores):
    """Desfaz a alteração remota quando a gravação local não é concluída."""
    try:
        auth.update_user(uid, **dados_anteriores)
    except (FirebaseError, TransportError):
        logger.exception("Não foi possível restaurar o perfil Firebase após falha ao salvar usuário.")