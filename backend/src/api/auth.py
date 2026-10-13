import os
import requests

from fastapi import APIRouter, HTTPException, Depends, Body
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from firebase_admin import auth
from model.usuario import Usuario


class Auth:
    def __init__(self):
        self.router = APIRouter()
        self.api_key = os.getenv("FIREBASE_API_KEY")
        self.security = HTTPBearer()

        self.router.post("/registro")(self.registro_usuario)
        self.router.post("/login")(self.login)
 
    def registro_usuario(self, usuario: Usuario):
        try:
            novo_usuario = auth.create_user(email=usuario.email, password=usuario.password)

            return {
                "uid": novo_usuario.uid,
                "email": novo_usuario.email,
                "mensagem": "Usuário cadastrado com sucesso"
            }

        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Não foi possível criar o usuário: {e}")

    def login(self, email: str = Body(...), password: str = Body(...)):
        if not self.api_key:
            raise HTTPException(status_code=500, detail="FIREBASE_API_KEY não configurada")

        url = (f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={self.api_key}")

        dados = {
            "email": email,
            "password": password,
            "returnSecureToken": True
        }

        try:
            resposta = requests.post(url, json=dados, timeout=10)
        except requests.RequestException:
            raise HTTPException(status_code=503, detail="Não foi possível conectar ao Firebase")

        if resposta.status_code != 200:
            raise HTTPException(status_code=401, detail="Email ou senha inválidos")

        resultado = resposta.json()

        return {
            "token": resultado["idToken"],
            "uid": resultado["localId"],
            "email": resultado["email"]
        }

    def verificar_token(self, credenciais: HTTPAuthorizationCredentials = Depends(HTTPBearer())):
        try:
            usuario = auth.verify_id_token(credenciais.credentials)
            return usuario

        except Exception:
            raise HTTPException(status_code=401, detail="Token inválido ou expirado")
