
from pydantic import BaseModel, Field, field_validator


class Produto(BaseModel):
    id: int | None = None
    nome: str = Field(min_length=2, max_length=150)
    preco: float = Field(ge=0)
    quantidade: float = Field(default=0, ge=0)
    descricao: str | None = Field(default=None, max_length=1000)
    imagem: str | None = None
    codigo_barras: str | None = Field(default=None, min_length=8, max_length=14) # procura na base local
    tipo_classificacao: str | None = None
    unidade_medida: str = "un"
    estoque_minimo: float = Field(default=0, ge=0)
    custo: float | None = Field(default=None, ge=0)
    ativo: bool = True

    @field_validator("codigo_barras")
    @classmethod
    def validar_codigo_barras(cls, valor: str | None) -> str | None:
        if valor is not None and not valor.isdigit():
            raise ValueError("O código de barras deve conter apenas números")
        return valor