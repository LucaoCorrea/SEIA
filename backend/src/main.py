import logging
import os
import secrets
from pathlib import Path

import firebase_admin
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from firebase_admin import credentials
from sqlalchemy import inspect, text
import uvicorn

from api.auth import Auth
from api.admin import RotasAdminSeia
from api.avisos import RotasAviso
from api.empresas import RotasEmpresa
from api.fazendas import RotasFazenda
from api.perfil_usuario import RotasPerfilUsuario
from api.fornecedores import RotasFornecedor
from api.movimentacoes import RotasMovimentacao
from api.produtos import RotasProduto
from plugins.database import Base, engine
from schemas.empresa import Empresa
from schemas.fornecedor import Fornecedor
from schemas.fazenda import Fazenda, Lote
from schemas.movimentacao import Movimentacao
from schemas.produto import Produto
from schemas.usuario import UsuarioDB
from seed import popular_dados_demo

BASE_DIR = Path(__file__).resolve().parent
logger = logging.getLogger(__name__)


def configurar_firebase():
    if firebase_admin._apps:
        return

    chave = BASE_DIR / "firebase-key.json"
    if chave.exists():
        firebase_admin.initialize_app(credentials.Certificate(str(chave)))
    else:
        firebase_admin.initialize_app()


def migrar_colunas_empresa():
    with engine.begin() as connection:
        tabelas = set(inspect(connection).get_table_names())

        for tabela in ("produtos", "fornecedores"):
            if tabela not in tabelas:
                continue
            colunas = {
                coluna["name"]
                for coluna in inspect(connection).get_columns(tabela)
            }
            if "empresa_id" not in colunas:
                connection.execute(
                    text(f"ALTER TABLE {tabela} ADD COLUMN empresa_id INTEGER REFERENCES empresas(id)")
                )
            if tabela == "fornecedores" and "cnpj" not in colunas:
                connection.execute(
                    text("ALTER TABLE fornecedores ADD COLUMN cnpj VARCHAR(18)")
                )

        for tabela in ("produtos", "fornecedores"):
            if tabela not in tabelas:
                continue
            sem_empresa = connection.execute(
                text(f"SELECT COUNT(*) FROM {tabela} WHERE empresa_id IS NULL")
            ).scalar_one()
            if not sem_empresa:
                continue

            legado_id = connection.execute(
                text("SELECT id FROM empresas WHERE legado = 1 ORDER BY id LIMIT 1")
            ).scalar_one_or_none()
            if legado_id is None:
                codigo_convite = secrets.token_urlsafe(8)
                result = connection.execute(
                    text(
                        "INSERT INTO empresas (nome, cep, codigo_convite, legado) "
                        "VALUES (:nome, :cep, :codigo_convite, 1)"
                    ),
                    {
                        "nome": "Empresa legada SEIA",
                        "cep": "00000000",
                        "codigo_convite": codigo_convite,
                    },
                )
                legado_id = result.lastrowid

            connection.execute(
                text(f"UPDATE {tabela} SET empresa_id = :empresa_id WHERE empresa_id IS NULL"),
                {"empresa_id": legado_id},
            )


def migrar_empresa_id_usuario_nullable(database_engine=engine):
    colunas = {
        coluna["name"]: coluna
        for coluna in inspect(database_engine).get_columns("usuarios")
    }
    if colunas["empresa_id"]["nullable"]:
        return

    with database_engine.connect() as connection:
        connection.exec_driver_sql("PRAGMA foreign_keys=OFF")
        connection.commit()
        try:
            with connection.begin():
                connection.exec_driver_sql(
                    """
                    CREATE TABLE usuarios_migracao (
                        id INTEGER NOT NULL PRIMARY KEY,
                        firebase_uid VARCHAR(128) NOT NULL UNIQUE,
                        nome VARCHAR(150) NOT NULL,
                        email VARCHAR(254) NOT NULL,
                        telefone VARCHAR(20),
                        role VARCHAR(20) NOT NULL,
                        empresa_id INTEGER,
                        CONSTRAINT uq_usuarios_empresa_email UNIQUE (empresa_id, email),
                        FOREIGN KEY(empresa_id) REFERENCES empresas (id)
                    )
                    """
                )
                connection.exec_driver_sql(
                    """
                    INSERT INTO usuarios_migracao
                        (id, firebase_uid, nome, email, telefone, role, empresa_id)
                    SELECT id, firebase_uid, nome, email, telefone, role, empresa_id
                    FROM usuarios
                    """
                )
                connection.exec_driver_sql("DROP TABLE usuarios")
                connection.exec_driver_sql(
                    "ALTER TABLE usuarios_migracao RENAME TO usuarios"
                )
                for indice in UsuarioDB.__table__.indexes:
                    indice.create(connection, checkfirst=True)
        finally:
            connection.exec_driver_sql("PRAGMA foreign_keys=ON")
            connection.commit()


def migrar_unicidade_por_empresa(tabela, modelo, coluna_unica):
    unique_constraints = inspect(engine).get_unique_constraints(tabela)
    colunas_unicas = [set(item["column_names"]) for item in unique_constraints]
    escopo_novo = {"empresa_id", coluna_unica}
    if escopo_novo in colunas_unicas or {coluna_unica} not in colunas_unicas:
        return

    indices = inspect(engine).get_indexes(tabela)
    colunas = [coluna.name for coluna in modelo.__table__.columns]
    colunas_sql = ", ".join(f'"{coluna}"' for coluna in colunas)
    tabela_antiga = f"{tabela}_migracao"

    with engine.connect() as connection:
        connection.exec_driver_sql("PRAGMA foreign_keys=OFF")
        connection.commit()
        try:
            with connection.begin():
                for indice in indices:
                    connection.exec_driver_sql(
                        f'DROP INDEX IF EXISTS "{indice["name"]}"'
                    )
                connection.exec_driver_sql(
                    f'ALTER TABLE "{tabela}" RENAME TO "{tabela_antiga}"'
                )
                modelo.__table__.create(connection)
                connection.execute(
                    text(
                        f'INSERT INTO "{tabela}" ({colunas_sql}) '
                        f'SELECT {colunas_sql} FROM "{tabela_antiga}"'
                    )
                )
                connection.exec_driver_sql(f'DROP TABLE "{tabela_antiga}"')
                for indice in modelo.__table__.indexes:
                    indice.create(connection, checkfirst=True)
        finally:
            connection.exec_driver_sql("PRAGMA foreign_keys=ON")
            connection.commit()


def migrar_referencia_produto_movimentacoes():
    if "movimentacoes" not in inspect(engine).get_table_names():
        return
    chave_produto = next(
        (
            chave
            for chave in inspect(engine).get_foreign_keys("movimentacoes")
            if chave["constrained_columns"] == ["produto_id"]
        ),
        None,
    )
    if chave_produto is None or chave_produto["referred_table"] == "produtos":
        return

    tabela = "movimentacoes"
    tabela_antiga = "movimentacoes_migracao"
    indices = inspect(engine).get_indexes(tabela)
    colunas = [coluna.name for coluna in Movimentacao.__table__.columns]
    colunas_sql = ", ".join(f'"{coluna}"' for coluna in colunas)

    with engine.connect() as connection:
        connection.exec_driver_sql("PRAGMA foreign_keys=OFF")
        connection.commit()
        try:
            with connection.begin():
                for indice in indices:
                    connection.exec_driver_sql(
                        f'DROP INDEX IF EXISTS "{indice["name"]}"'
                    )
                connection.exec_driver_sql(
                    f'ALTER TABLE "{tabela}" RENAME TO "{tabela_antiga}"'
                )
                Movimentacao.__table__.create(connection)
                connection.execute(
                    text(
                        f'INSERT INTO "{tabela}" ({colunas_sql}) '
                        f'SELECT {colunas_sql} FROM "{tabela_antiga}"'
                    )
                )
                connection.exec_driver_sql(f'DROP TABLE "{tabela_antiga}"')
                for indice in Movimentacao.__table__.indexes:
                    indice.create(connection, checkfirst=True)
        finally:
            connection.exec_driver_sql("PRAGMA foreign_keys=ON")
            connection.commit()


def migrar_destino_lote_movimentacoes():
    if "movimentacoes" not in inspect(engine).get_table_names():
        return
    colunas = {
        coluna["name"]
        for coluna in inspect(engine).get_columns("movimentacoes")
    }
    if "destino_lote_id" in colunas:
        return

    with engine.begin() as connection:
        connection.execute(
            text(
                "ALTER TABLE movimentacoes ADD COLUMN destino_lote_id "
                "INTEGER REFERENCES lotes(id)"
            )
        )


def migrar_codigo_fazenda():
    if "fazendas" not in inspect(engine).get_table_names():
        return
    colunas = {
        coluna["name"]
        for coluna in inspect(engine).get_columns("fazendas")
    }
    with engine.begin() as connection:
        if "codigo" not in colunas:
            connection.execute(text("ALTER TABLE fazendas ADD COLUMN codigo INTEGER"))
        connection.execute(
            text("UPDATE fazendas SET codigo = id WHERE codigo IS NULL")
        )
        connection.execute(
            text(
                "CREATE UNIQUE INDEX IF NOT EXISTS uq_fazendas_empresa_codigo "
                "ON fazendas (empresa_id, codigo)"
            )
        )


def migrar_custo_produtos():
    if "produtos" not in inspect(engine).get_table_names():
        return
    with engine.begin() as connection:
        connection.execute(text("UPDATE produtos SET custo = quantidade * preco"))


class Main:
    def __init__(self):
        load_dotenv()
        configurar_firebase()

        self.app = FastAPI(title="SEIA API")
        origens_permitidas = ["http://localhost:5173", "http://127.0.0.1:5173"]
        self.app.add_middleware(
            CORSMiddleware,
            allow_origins=origens_permitidas,
            allow_credentials=False,
            allow_methods=["*"],
            allow_headers=["*"],
        )

        Empresa.__table__.create(bind=engine, checkfirst=True)
        UsuarioDB.__table__.create(bind=engine, checkfirst=True)
        migrar_empresa_id_usuario_nullable()
        migrar_colunas_empresa()
        tabelas_existentes = set(inspect(engine).get_table_names())
        if "produtos" in tabelas_existentes:
            migrar_unicidade_por_empresa("produtos", Produto, "codigo_barras")
        if "fornecedores" in tabelas_existentes:
            migrar_unicidade_por_empresa("fornecedores", Fornecedor, "email")
        Base.metadata.create_all(bind=engine)
        migrar_custo_produtos()
        migrar_codigo_fazenda()
        migrar_destino_lote_movimentacoes()
        migrar_referencia_produto_movimentacoes()
        if os.getenv("SEIA_SEED_DEMO", "").strip().casefold() == "true":
            if popular_dados_demo():
                logger.info("Dados demonstrativos criados no banco vazio; nenhuma conta de usuário foi criada.")

        self.app.include_router(Auth().router)
        self.app.include_router(RotasAdminSeia().router)
        self.app.include_router(RotasProduto().router)
        self.app.include_router(RotasMovimentacao().router)
        self.app.include_router(RotasFazenda().router)
        self.app.include_router(RotasPerfilUsuario().router)
        self.app.include_router(RotasAviso().router)
        self.app.include_router(RotasEmpresa().router)
        self.app.include_router(RotasFornecedor().router)

    def run(self):
        uvicorn.run(self.app, host="127.0.0.1", port=8000)


main = Main()
app = main.app

if __name__ == "__main__":
    main.run()
