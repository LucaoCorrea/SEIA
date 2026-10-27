from sqlalchemy import Column, Integer, String

from plugins.database import Base


class Produto(Base):
    __tablename__ = "Produtos"

    id= Column(Integer, primary_key=True)
    nome= Column(String)
    preco= Column(float)
    quantidade= Column(float)
    descricao= Column(String)
    imagem= Column(String)
    codigo_barras= Column(String)
    tipo_classificacao= Column(String)
    unidade_medida= Column(String)
    estoque_minimo= Column(String)
    custo= Column(String)
    ativo= Column(bool)