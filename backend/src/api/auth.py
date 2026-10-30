import logging
import os

import requests
from fastapi import APIRouter, Body, HTTPException
from sqlalchemy.exc import SQLAlchemyError

from plugins.database import Session
from schemas.usuario import UsuarioDB

logger = logging.getLogger(__name__)


class Auth:
    def __init__(self):
        self.router = APIRouter()
        self.api_key = os.getenv("FIREBASE_API_KEY")

        self.router.post("/login")(self.login)
        self.router.post("/esqueci-senha")(self.esqueci_senha)

    def login(self, email: str = Body(...), password: str = Body(...)):
        if not self.api_key:
            raise HTTPException(status_code=500, detail="FIREBASE_API_KEY não configurada.")

        url = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={self.api_key}"
        try:
            resposta = requests.post(
                url,
                json={"email": email, "password": password, "returnSecureToken": True},
                timeout=10,
            )
        except requests.RequestException:
            logger.exception("Falha de rede/TLS ao autenticar no Firebase.")
            raise HTTPException(
                status_code=503,
                detail=(
                    "Não foi possível conectar ao Firebase. Se a rede usa inspeção HTTPS, "
                    "configure REQUESTS_CA_BUNDLE com o certificado raiz PEM da organização."
                ),
            )

        if resposta.status_code != 200:
            raise HTTPException(status_code=401, detail="Email ou senha inválidos.")

        resultado = resposta.json()
        db = Session()
        try:
            usuario_db = db.query(UsuarioDB).filter(
                UsuarioDB.firebase_uid == resultado["localId"]
            ).first()
        except SQLAlchemyError:
            logger.exception("Falha ao consultar o usuário após o login Firebase.")
            raise HTTPException(status_code=500, detail="Erro ao consultar vínculo da conta.")
        finally:
            db.close()

        if usuario_db is None:
            raise HTTPException(
                status_code=403,
                detail="Conta sem vínculo no SEIA. Solicite acesso ao administrador do sistema.",
            )
        if usuario_db.role == "admin_seia":
            return {
                "token": resultado["idToken"],
                "uid": resultado["localId"],
                "email": resultado["email"],
                "nome": usuario_db.nome,
                "role": "admin_seia",
                "empresa_configurada": True,
            }

        return {
            "token": resultado["idToken"],
            "uid": resultado["localId"],
            "email": resultado["email"],
            "nome": usuario_db.nome,
            "role": usuario_db.role,
            "empresa_configurada": True,
        }

    def esqueci_senha(self, email: str = Body(...)):
        if not self.api_key:
            raise HTTPException(status_code=500, detail="FIREBASE_API_KEY não configurada.")

        url = f"https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key={self.api_key}"
        try:
            resposta = requests.post(
                url,
                json={"requestType": "PASSWORD_RESET", "email": email},
                timeout=10,
            )
        except requests.RequestException:
            logger.exception("Falha de rede/TLS ao solicitar redefinição no Firebase.")
            raise HTTPException(
                status_code=503,
                detail=(
                    "Não foi possível conectar ao Firebase. Se a rede usa inspeção HTTPS, "
                    "configure REQUESTS_CA_BUNDLE com o certificado raiz PEM da organização."
                ),
            )

        if resposta.status_code != 200:
            raise HTTPException(
                status_code=400,
                detail="Não foi possível enviar o email de redefinição de senha.",
            )

        return {"mensagem": "Email de redefinição de senha enviado com sucesso."}
