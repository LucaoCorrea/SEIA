from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class AvisoCreate(BaseModel):
    titulo: str = Field(..., min_length=2, max_length=150)
    mensagem: str = Field(..., min_length=2, max_length=2000)

    @field_validator("titulo", "mensagem")
    @classmethod
    def normalizar_texto(cls, valor):
        valor = valor.strip()
        if len(valor) < 2:
            raise ValueError("Informe ao menos dois caracteres.")
        return valor


class AvisoResponse(BaseModel):
    id: int
    usuario_id: int
    usuario_nome: str
    titulo: str
    mensagem: str
    criado_em: datetime

    model_config = ConfigDict(from_attributes=True)
