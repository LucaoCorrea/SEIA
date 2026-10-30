
from sqlalchemy import Column, Integer, String, Float, Boolean

from plugins.database import Base


class Fornecedor(Base):
    __tablename__ = "fornecedores"

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String(150), nullable=False)
    email = Column(String(150), nullable=False, unique=True)
    telefone = Column(String(20), nullable=True)
    cnpj = Column(String(18), nullable=True)
    ativo = Column(Boolean, nullable=False, default=True)
