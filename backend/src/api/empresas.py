import logging

from fastapi import APIRouter, Depends, HTTPException, status
from firebase_admin import auth
from firebase_admin.exceptions import FirebaseError
from google.auth.exceptions import TransportError
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import selectinload

from model.empresa import (
    EmpresaAtualizacao,
    EmpresaResponse,
    UsuarioCadastroEmpresa,
    UsuarioEmpresaResponse,
)
from plugins.database import Session
from plugins.tenant import usuario_atual
from schemas.aviso import Aviso
from schemas.empresa import Empresa
from schemas.fornecedor import Fornecedor
from schemas.fazenda import Fazenda
from schemas.movimentacao import Movimentacao
from schemas.produto import Produto
from schemas.usuario import UsuarioDB

logger = logging.getLogger(__name__)


def empresa_response(empresa, role):
    return {
        "id": empresa.id,
        "nome": empresa.nome,
        "cnpj": empresa.cnpj,
        "cep": empresa.cep,
        "usuarios": empresa.usuarios,
        "role": role,
    }


class RotasEmpresa:
    def __init__(self):
        self.router = APIRouter()
        self.router.get("/empresas/me", response_model=EmpresaResponse)(self.buscar_empresa)
        self.router.put("/empresas/me", response_model=EmpresaResponse)(self.atualizar_empresa)
        self.router.delete("/empresas/me", status_code=status.HTTP_204_NO_CONTENT)(self.deletar_empresa)
        self.router.post(
            "/empresas/usuarios",
            status_code=status.HTTP_201_CREATED,
            response_model=UsuarioEmpresaResponse,
        )(self.criar_usuario)

    @staticmethod
    def _exigir_gestor(usuario):
        if usuario["role"] not in ("admin", "gerente", "admin_seia"):
            raise HTTPException(
                status_code=403,
                detail="Somente administradores e gerentes podem alterar os dados da empresa.",
            )

    def criar_usuario(
        self,
        dados: UsuarioCadastroEmpresa,
        gestor: dict = Depends(usuario_atual),
    ):
        self._exigir_gestor(gestor)
        if dados.role == "gerente" and gestor["role"] not in ("admin", "admin_seia"):
            raise HTTPException(
                status_code=403,
                detail="Somente o administrador global pode cadastrar outro gerente.",
            )
        db = Session()
        usuario_firebase = None

        try:
            usuario_firebase = auth.create_user(
                email=str(dados.email),
                password=dados.senha,
                display_name=dados.nome,
            )
            usuario = UsuarioDB(
                firebase_uid=usuario_firebase.uid,
                nome=dados.nome,
                email=str(dados.email),
                telefone=dados.telefone or None,
                role=dados.role,
                empresa_id=gestor["empresa_id"],
            )
            db.add(usuario)
            db.commit()
            db.refresh(usuario)
            return usuario
        except auth.EmailAlreadyExistsError:
            db.rollback()
            raise HTTPException(status_code=409, detail="O email já possui uma conta SEIA/Firebase.")
        except IntegrityError:
            db.rollback()
            if usuario_firebase is not None:
                _remover_usuario_firebase(usuario_firebase.uid)
            raise HTTPException(status_code=409, detail="O usuário já está vinculado a esta empresa.")
        except (FirebaseError, TransportError):
            db.rollback()
            if usuario_firebase is not None:
                _remover_usuario_firebase(usuario_firebase.uid)
            logger.exception("Falha no Firebase ao criar usuário da empresa %s.", gestor["empresa_id"])
            raise HTTPException(
                status_code=503,
                detail=(
                    "Não foi possível provisionar a conta no Firebase. Se a rede usa inspeção HTTPS, "
                    "configure REQUESTS_CA_BUNDLE com o certificado raiz PEM da organização."
                ),
            )
        except SQLAlchemyError:
            db.rollback()
            if usuario_firebase is not None:
                _remover_usuario_firebase(usuario_firebase.uid)
            logger.exception("Falha ao criar usuário para a empresa %s.", gestor["empresa_id"])
            raise HTTPException(status_code=500, detail="Erro ao salvar o usuário da empresa.")
        finally:
            db.close()

    def buscar_empresa(self, usuario: dict = Depends(usuario_atual)):
        db = Session()

        try:
            empresa = (
                db.query(Empresa)
                .options(selectinload(Empresa.usuarios))
                .filter(Empresa.id == usuario["empresa_id"])
                .first()
            )
            if empresa is None:
                raise HTTPException(status_code=404, detail="Empresa não encontrada.")
            return empresa_response(empresa, usuario["role"])
        except HTTPException:
            raise
        except SQLAlchemyError:
            raise HTTPException(status_code=500, detail="Erro ao consultar a empresa.")
        finally:
            db.close()


    def atualizar_empresa(
        self,
        dados: EmpresaAtualizacao,
        usuario: dict = Depends(usuario_atual),
    ):
        self._exigir_gestor(usuario)
        db = Session()

        try:
            empresa = db.query(Empresa).filter(
                Empresa.id == usuario["empresa_id"]
            ).first()
            if empresa is None:
                raise HTTPException(status_code=404, detail="Empresa não encontrada.")

            empresa.nome = dados.nome.strip()
            empresa.cnpj = dados.cnpj.strip() if dados.cnpj else None
            empresa.cep = dados.cep.strip()
            db.commit()
            empresa_atualizada = (
                db.query(Empresa)
                .options(selectinload(Empresa.usuarios))
                .filter(Empresa.id == empresa.id)
                .first()
            )
            return empresa_response(empresa_atualizada, usuario["role"])
        except HTTPException:
            db.rollback()
            raise
        except IntegrityError:
            db.rollback()
            raise HTTPException(status_code=409, detail="CNPJ já cadastrado em outra empresa.")
        except SQLAlchemyError:
            db.rollback()
            raise HTTPException(status_code=500, detail="Erro ao atualizar a empresa.")
        finally:
            db.close()


    def deletar_empresa(self, usuario: dict = Depends(usuario_atual)):
        if usuario["role"] != "admin":
            raise HTTPException(status_code=403, detail="Somente o administrador pode excluir a empresa.")
        db = Session()

        try:
            empresa = db.query(Empresa).filter(
                Empresa.id == usuario["empresa_id"]
            ).first()
            if empresa is None:
                raise HTTPException(status_code=404, detail="Empresa não encontrada.")

            possui_dados = any(
                db.query(modelo.id)
                .filter(modelo.empresa_id == empresa.id)
                .first()
                is not None
                for modelo in (Produto, Fornecedor, Fazenda, Movimentacao, Aviso)
            )
            if possui_dados:
                raise HTTPException(
                    status_code=409,
                    detail="A empresa possui cadastros ou histórico e não pode ser excluída.",
                )

            db.query(UsuarioDB).filter(
                UsuarioDB.empresa_id == empresa.id
            ).delete(synchronize_session=False)
            db.delete(empresa)
            db.commit()
        except HTTPException:
            db.rollback()
            raise
        except SQLAlchemyError:
            db.rollback()
            logger.exception("Falha ao excluir empresa %s", usuario["empresa_id"])
            raise HTTPException(status_code=500, detail="Erro ao excluir a empresa.")
        finally:
            db.close()


def _remover_usuario_firebase(uid):
    try:
        auth.delete_user(uid)
    except (FirebaseError, TransportError):
        logger.exception("Não foi possível remover conta Firebase após falha ao criar usuário da empresa.")
