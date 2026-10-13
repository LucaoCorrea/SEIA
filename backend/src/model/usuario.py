from typing import Literal
from pydantic import BaseModel, EmailStr, Field


class Usuario(BaseModel):
    nome: str
    telefone: str | None = None
    email: EmailStr
    password: str = Field(min_length=6)
    role: Literal["admin", "gerente", "funcionario"] = "funcionario"