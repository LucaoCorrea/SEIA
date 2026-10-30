
from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, UniqueConstraint

from plugins.database import Base


class Fornecedor(Base):
    __tablename__ = "fornecedores"
    __table_args__ = (
        UniqueConstraint("empresa_id", "email", name="uq_fornecedores_empresa_email"),
    )

    id = Column(Integer, primary_key=True, index=True)
    empresa_id = Column(Integer, ForeignKey("empresas.id"), nullable=False, index=True)
    nome = Column(String(150), nullable=False)
    email = Column(String(150), nullable=False)
    telefone = Column(String(20), nullable=True)
    cnpj = Column(String(18), nullable=True)
    ativo = Column(Boolean, nullable=False, default=True)
