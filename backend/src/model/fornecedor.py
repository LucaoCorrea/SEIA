from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class Fornecedor(BaseModel):
    nome: str = Field(..., max_length=150)
    email: str = Field(..., max_length=150)
    telefone: Optional[str] = Field(default=None, max_length=20)
    cnpj: Optional[str] = Field(default=None, max_length=18)


class FornecedorResponse(Fornecedor):
    id: int
    model_config = ConfigDict(from_attributes=True)