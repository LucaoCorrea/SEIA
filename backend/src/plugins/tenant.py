import logging

from fastapi import Depends, Header, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from firebase_admin import auth
from firebase_admin.exceptions import FirebaseError
from sqlalchemy.exc import SQLAlchemyError

from plugins.database import Session
from schemas.empresa import Empresa
from schemas.usuario import UsuarioDB

security = HTTPBearer()
logger = logging.getLogger(__name__)


def identidade_firebase(credenciais: HTTPAuthorizationCredentials = Depends(security),):
    try:
        return auth.verify_id_token(credenciais.credentials)
    except auth.CertificateFetchError:
        logger.exception("Falha ao consultar os certificados do Firebase para validar o token.")
        raise HTTPException(
            status_code=503,
            detail=(
                "Não foi possível validar o token com o Firebase. Se a rede usa inspeção HTTPS, "
                "configure REQUESTS_CA_BUNDLE com o certificado raiz PEM da organização."
            ),
        )
    except (FirebaseError, ValueError):
        raise HTTPException(status_code=401, detail="Token inválido ou expirado.")

def usuario_atual(
    identidade: dict = Depends(identidade_firebase),
    empresa_selecionada: int | None = Header(default=None, alias="X-SEIA-Empresa-ID"),
):
    db = Session()

    try:
        usuario = db.query(UsuarioDB).filter(
            UsuarioDB.firebase_uid == identidade["uid"]
        ).first()

        if usuario is None:
            raise HTTPException(
                status_code=403,
                detail="Conta sem vínculo no SEIA. Solicite acesso ao administrador do sistema.",
            )

        if usuario.role == "admin_seia":
            if empresa_selecionada is None:
                raise HTTPException(
                    status_code=400,
                    detail="Selecione uma empresa para acessar seus dados.",
                )
            empresa = db.query(Empresa).filter(
                Empresa.id == empresa_selecionada
            ).first()
            if empresa is None:
                raise HTTPException(status_code=404, detail="Empresa selecionada não encontrada.")
            empresa_id = empresa.id
        else:
            empresa_id = usuario.empresa_id

        return {
            "id": usuario.id,
            "firebase_uid": usuario.firebase_uid,
            "nome": usuario.nome,
            "email": usuario.email,
            "role": usuario.role,
            "empresa_id": empresa_id,
        }
    except HTTPException:
        raise
    except SQLAlchemyError:
        raise HTTPException(status_code=500, detail="Erro ao validar o usuário.")
    finally:
        db.close()

def administrador_seia_atual(identidade: dict = Depends(identidade_firebase)):
    email_identidade = str(identidade.get("email", "")).strip().casefold()

    db = Session()
    try:
        usuario = db.query(UsuarioDB).filter(
            UsuarioDB.firebase_uid == identidade["uid"],
            UsuarioDB.role == "admin_seia",
            UsuarioDB.empresa_id.is_(None),
        ).first()
        if usuario is None or usuario.email.casefold() != email_identidade:
            raise HTTPException(status_code=403, detail="Acesso restrito ao administrador global do SEIA.")
    except HTTPException:
        raise
    except SQLAlchemyError:
        logger.exception("Falha ao consultar o cadastro de administradores globais.")
        raise HTTPException(status_code=500, detail="Erro ao validar o administrador global.")
    finally:
        db.close()

    return {
        "id": usuario.id,
        "firebase_uid": usuario.firebase_uid,
        "email": email_identidade,
        "role": "admin_seia",
    }
