from sqlalchemy import Column, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import relationship

from plugins.database import Base


class UsuarioDB(Base):
    __tablename__ = "usuarios"
    __table_args__ = (UniqueConstraint("empresa_id", "email", name="uq_usuarios_empresa_email"),)

    id = Column(Integer, primary_key=True, index=True)
    firebase_uid = Column(String(128), nullable=False, unique=True)
    nome = Column(String(150), nullable=False)
    email = Column(String(254), nullable=False)
    telefone = Column(String(20), nullable=True)
    role = Column(String(20), nullable=False, default="funcionario")
    empresa_id = Column(Integer, ForeignKey("empresas.id"), nullable=True, index=True)

    empresa = relationship("Empresa", back_populates="usuarios")
