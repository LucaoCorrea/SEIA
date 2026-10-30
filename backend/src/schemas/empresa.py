from sqlalchemy import Boolean, Column, DateTime, Integer, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from plugins.database import Base


class Empresa(Base):
    __tablename__ = "empresas"

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String(150), nullable=False)
    cnpj = Column(String(18), nullable=True, unique=True)
    cep = Column(String(9), nullable=False)
    codigo_convite = Column(String(24), nullable=False, unique=True)
    legado = Column(Boolean, nullable=False, default=False)
    criado_em = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    usuarios = relationship("UsuarioDB", back_populates="empresa", cascade="all, delete-orphan")
