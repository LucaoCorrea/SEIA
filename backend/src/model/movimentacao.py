from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class MovimentacaoCreate(BaseModel):
    produto_id: int = Field(gt=0)
    tipo: Literal["entrada", "saida", "ajuste"]
    quantidade: float = Field(ge=0)
    motivo: str = Field(..., min_length=2, max_length=500)

    @field_validator("motivo")
    @classmethod
    def normalizar_motivo(cls, valor):
        valor = valor.strip()
        if len(valor) < 2:
            raise ValueError("Informe um motivo para a movimentação.")
        return valor

    @model_validator(mode="after")
    def validar_quantidade(self):
        if self.tipo != "ajuste" and self.quantidade <= 0:
            raise ValueError("A quantidade deve ser maior que zero.")
        return self


class MovimentacaoResponse(BaseModel):
    id: int
    produto_id: int
    produto_nome: str
    usuario_id: int
    usuario_nome: str
    tipo: str
    quantidade: float
    saldo_anterior: float
    saldo_posterior: float
    motivo: str
    criado_em: datetime

    model_config = ConfigDict(from_attributes=True)
