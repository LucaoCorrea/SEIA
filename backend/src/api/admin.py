import logging
import secrets

from fastapi import APIRouter, Depends, HTTPException, status
from firebase_admin import auth
from firebase_admin.exceptions import FirebaseError
from google.auth.exceptions import TransportError
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import selectinload

from model.empresa import EmpresaAtualizacao, EmpresaCadastroAdmin, EmpresaResponse
from plugins.database import Session
from plugins.tenant import administrador_seia_atual
from schemas.aviso import Aviso
from schemas.empresa import Empresa
from schemas.fornecedor import Fornecedor
from schemas.movimentacao import Movimentacao
from schemas.produto import Produto
from schemas.usuario import UsuarioDB

logger = logging.getLogger(__name__)


def remover_usuario_firebase(uid):
    try:
        auth.delete_user(uid)
    except (FirebaseError, TransportError):
        logger.exception("Não foi possível remover conta Firebase após falha no cadastro da empresa.")


class RotasAdminSeia:
    def __init__(self):
        self.router = APIRouter()
        self.router.get("/admin/empresas", response_model=list[EmpresaResponse])(self.listar_empresas)
        self.router.post(
            "/admin/empresas",
            status_code=status.HTTP_201_CREATED,
            response_model=EmpresaResponse,
        )(self.criar_empresa)
        self.router.put(
            "/admin/empresas/{empresa_id}",
            response_model=EmpresaResponse,
        )(self.atualizar_empresa)
        self.router.delete(
            "/admin/empresas/{empresa_id}",
            status_code=status.HTTP_204_NO_CONTENT,
        )(self.deletar_empresa)

    def listar_empresas(self, _: dict = Depends(administrador_seia_atual)):
        db = Session()
        try:
            empresas = (
                db.query(Empresa)
                .options(selectinload(Empresa.usuarios))
                .order_by(Empresa.nome)
                .all()
            )
            return [
                self._resposta_empresa(empresa, usuario)
                for empresa in empresas
                for usuario in [self._administrador_empresa(empresa)]
            ]
        except SQLAlchemyError:
            logger.exception("Falha ao listar empresas no painel SEIA.")
            raise HTTPException(status_code=500, detail="Erro ao listar empresas.")
        finally:
            db.close()

    def criar_empresa(
        self,
        dados: EmpresaCadastroAdmin,
        _: dict = Depends(administrador_seia_atual),
    ):
        db = Session()
        usuario_firebase = None

        try:
            usuario_firebase = auth.create_user(
                email=str(dados.administrador_email),
                password=dados.administrador_senha,
                display_name=dados.administrador_nome,
            )
            empresa = Empresa(
                nome=dados.nome,
                cnpj=dados.cnpj or None,
                cep=dados.cep,
                codigo_convite=secrets.token_urlsafe(8),
            )
            db.add(empresa)
            db.flush()
            usuario = UsuarioDB(
                firebase_uid=usuario_firebase.uid,
                nome=dados.administrador_nome,
                email=str(dados.administrador_email),
                telefone=dados.administrador_telefone or None,
                role="gerente",
                empresa_id=empresa.id,
            )
            db.add(usuario)
            db.commit()
            db.refresh(empresa)
            return self._resposta_empresa(empresa, usuario)
        except auth.EmailAlreadyExistsError:
            db.rollback()
            raise HTTPException(status_code=409, detail="O email do administrador já possui conta Firebase.")
        except IntegrityError:
            db.rollback()
            if usuario_firebase is not None:
                remover_usuario_firebase(usuario_firebase.uid)
            raise HTTPException(status_code=409, detail="CNPJ ou administrador já cadastrado.")
        except (FirebaseError, TransportError):
            db.rollback()
            if usuario_firebase is not None:
                remover_usuario_firebase(usuario_firebase.uid)
            logger.exception("Falha do Firebase ao cadastrar empresa ou conta administradora.")
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
                remover_usuario_firebase(usuario_firebase.uid)
            logger.exception("Falha no banco ao cadastrar empresa.")
            raise HTTPException(status_code=500, detail="Erro ao salvar a empresa no banco de dados.")
        finally:
            db.close()

    def atualizar_empresa(
        self,
        empresa_id: int,
        dados: EmpresaAtualizacao,
        _: dict = Depends(administrador_seia_atual),
    ):
        db = Session()
        try:
            empresa = (
                db.query(Empresa)
                .options(selectinload(Empresa.usuarios))
                .filter(Empresa.id == empresa_id)
                .first()
            )
            if empresa is None:
                raise HTTPException(status_code=404, detail="Empresa não encontrada.")

            empresa.nome = dados.nome
            empresa.cnpj = dados.cnpj or None
            empresa.cep = dados.cep
            db.commit()
            db.refresh(empresa)
            return self._resposta_empresa(empresa, self._administrador_empresa(empresa))
        except HTTPException:
            db.rollback()
            raise
        except IntegrityError:
            db.rollback()
            raise HTTPException(status_code=409, detail="CNPJ já cadastrado em outra empresa.")
        except SQLAlchemyError:
            db.rollback()
            logger.exception("Falha ao atualizar empresa %s no painel SEIA.", empresa_id)
            raise HTTPException(status_code=500, detail="Erro ao atualizar a empresa.")
        finally:
            db.close()

    def deletar_empresa(
        self,
        empresa_id: int,
        _: dict = Depends(administrador_seia_atual),
    ):
        db = Session()
        try:
            empresa = (
                db.query(Empresa)
                .options(selectinload(Empresa.usuarios))
                .filter(Empresa.id == empresa_id)
                .first()
            )
            if empresa is None:
                raise HTTPException(status_code=404, detail="Empresa não encontrada.")

            possui_dados = any(
                db.query(modelo.id)
                .filter(modelo.empresa_id == empresa.id)
                .first()
                is not None
                for modelo in (Produto, Fornecedor, Movimentacao, Aviso)
            )
            if possui_dados:
                raise HTTPException(
                    status_code=409,
                    detail="A empresa possui cadastros ou histórico e não pode ser excluída.",
                )

            usuarios_firebase = [
                usuario.firebase_uid for usuario in empresa.usuarios
            ]
            db.delete(empresa)
            db.commit()
            for uid in usuarios_firebase:
                remover_usuario_firebase(uid)
        except HTTPException:
            db.rollback()
            raise
        except SQLAlchemyError:
            db.rollback()
            logger.exception("Falha ao excluir empresa %s no painel SEIA.", empresa_id)
            raise HTTPException(status_code=500, detail="Erro ao excluir a empresa.")
        finally:
            db.close()

    @staticmethod
    def _administrador_empresa(empresa):
        return next(
            (usuario for usuario in empresa.usuarios if usuario.role in ("admin", "gerente")),
            None,
        )

    @staticmethod
    def _resposta_empresa(empresa, administrador):
        return {
            "id": empresa.id,
            "nome": empresa.nome,
            "cnpj": empresa.cnpj,
            "cep": empresa.cep,
            "usuarios": empresa.usuarios,
            "role": "admin_seia",
            "administrador_email": administrador.email if administrador else None,
        }
