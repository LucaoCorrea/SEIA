from sqlalchemy import Column, Float, ForeignKey, Index, Integer, String, UniqueConstraint

from plugins.database import Base


class Fazenda(Base):
    __tablename__ = "fazendas"
    __table_args__ = (
        UniqueConstraint("empresa_id", "nome", name="uq_fazendas_empresa_nome"),
        Index("uq_fazendas_empresa_codigo", "empresa_id", "codigo", unique=True),
    )

    id = Column(Integer, primary_key=True, index=True)
    empresa_id = Column(Integer, ForeignKey("empresas.id"), nullable=False, index=True)
    codigo = Column(Integer, nullable=False)
    nome = Column(String(150), nullable=False)


class Lote(Base):
    __tablename__ = "lotes"
    __table_args__ = (
        UniqueConstraint(
            "fazenda_id",
            "nome",
            "talhao",
            name="uq_lotes_fazenda_nome_talhao",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    fazenda_id = Column(Integer, ForeignKey("fazendas.id"), nullable=False, index=True)
    nome = Column(String(100), nullable=False)
    talhao = Column(String(100), nullable=False)
    area_hectares = Column(Float, nullable=False)
