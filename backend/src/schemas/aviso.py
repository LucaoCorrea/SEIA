from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.sql import func

from plugins.database import Base


class Aviso(Base):
    __tablename__ = "avisos"

    id = Column(Integer, primary_key=True, index=True)
    empresa_id = Column(Integer, ForeignKey("empresas.id"), nullable=False, index=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False, index=True)
    titulo = Column(String(150), nullable=False)
    mensagem = Column(String(2000), nullable=False)
    criado_em = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
