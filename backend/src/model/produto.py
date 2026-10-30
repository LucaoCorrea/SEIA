from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class Produto(BaseModel):
    nome: str = Field(..., max_length=150)
    preco: float
    quantidade: float = 0
    descricao: Optional[str] = Field(default=None, max_length=1000)
    imagem: Optional[str] = None
    codigo_barras: Optional[str] = Field(default=None, max_length=100)
    tipo_classificacao: Optional[str] = Field(default=None, max_length=100)
    unidade_medida: str = Field(default="un", max_length=30)
    estoque_minimo: float = 0
    custo: float = 0
    fornecedor_id: int
    ativo: bool = True


class ProdutoResponse(Produto):
    id: int

    model_config = ConfigDict(from_attributes=True)