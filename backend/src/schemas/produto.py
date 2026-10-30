
from sqlalchemy import Boolean, Column, Float, ForeignKey, Integer, String, UniqueConstraint

from plugins.database import Base


class Produto(Base):
    __tablename__ = "produtos"
    __table_args__ = (
        UniqueConstraint("empresa_id", "codigo_barras", name="uq_produtos_empresa_codigo_barras"),
    )

    id = Column(Integer, primary_key=True, index=True)
    empresa_id = Column(Integer, ForeignKey("empresas.id"), nullable=False, index=True)
    nome = Column(String(150), nullable=False)
    preco = Column(Float, nullable=False)
    quantidade = Column(Float, nullable=False, default=0)
    descricao = Column(String(1000), nullable=True)
    imagem = Column(String, nullable=True)
    codigo_barras = Column(String(100), nullable=True)
    tipo_classificacao = Column(String(100), nullable=True)
    unidade_medida = Column(String(30), nullable=False, default="un")
    estoque_minimo = Column(Float, nullable=False, default=0)
    custo = Column(Float, nullable=False, default=0)
    fornecedor_id = Column(Integer, nullable=False)
    ativo = Column(Boolean, nullable=False, default=True)
