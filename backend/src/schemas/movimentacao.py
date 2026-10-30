from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.sql import func

from plugins.database import Base


class Movimentacao(Base):
    __tablename__ = "movimentacoes"

    id = Column(Integer, primary_key=True, index=True)
    empresa_id = Column(Integer, ForeignKey("empresas.id"), nullable=False, index=True)
    produto_id = Column(Integer, ForeignKey("produtos.id"), nullable=False, index=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False, index=True)
    tipo = Column(String(12), nullable=False)
    quantidade = Column(Float, nullable=False)
    saldo_anterior = Column(Float, nullable=False)
    saldo_posterior = Column(Float, nullable=False)
    motivo = Column(String(500), nullable=False)
    criado_em = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
