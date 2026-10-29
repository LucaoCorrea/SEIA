
from sqlalchemy import Boolean, Column, Float, Integer, String

from backend.src.plugins.database import Base


class Produto(Base):
    __tablename__ = "produtos"

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String(150), nullable=False)
    preco = Column(Float, nullable=False)
    quantidade = Column(Float, nullable=False, default=0)
    descricao = Column(String(1000), nullable=True)
    imagem = Column(String, nullable=True)
    codigo_barras = Column(String(100), nullable=True, unique=True)
    tipo_classificacao = Column(String(100), nullable=True)
    unidade_medida = Column(String(30), nullable=False, default="un")
    estoque_minimo = Column(Float, nullable=False, default=0)
    custo = Column(Float, nullable=False, default=0)
    ativo = Column(Boolean, nullable=False, default=True)
