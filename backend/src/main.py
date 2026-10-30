from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from api.auth import Auth
from api.fornecedores import RotasFornecedor
from schemas.produto import Produto 
from plugins.database import Base, engine
from api.produtos import RotasProduto


class Main:
    def __init__(self):
        load_dotenv()

        self.app = FastAPI(title="SEIA API")

        origens_permitidas = ["http://localhost:5173", "http://127.0.0.1:5173",]

        self.app.add_middleware(CORSMiddleware, allow_origins=origens_permitidas, allow_credentials=False, allow_methods=["*"], allow_headers=["*"],)

        Base.metadata.create_all(bind=engine)

        auth_api = Auth()
        produto_api = RotasProduto()

        self.app.include_router(auth_api.router)
        self.app.include_router(produto_api.router)
        self.app.include_router(RotasFornecedor().router)  # Adicione esta linha para incluir as rotas do fornecedor

    def run(self):
        uvicorn.run(self.app, host="127.0.0.1", port=8000)

main = Main()
app = main.app

if __name__ == "__main__":
    main.run()