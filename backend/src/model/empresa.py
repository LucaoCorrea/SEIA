from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class EmpresaCadastroAdmin(BaseModel):
    nome: str = Field(..., min_length=2, max_length=150)
    cnpj: str | None = Field(default=None, max_length=18)
    cep: str = Field(..., min_length=8, max_length=9)
    administrador_nome: str = Field(..., min_length=2, max_length=150)
    administrador_email: EmailStr
    administrador_senha: str = Field(..., min_length=8)
    administrador_telefone: str | None = Field(default=None, max_length=20)

    @field_validator(
        "nome",
        "cnpj",
        "cep",
        "administrador_nome",
        "administrador_email",
        "administrador_telefone",
        mode="before",
    )
    @classmethod
    def normalizar_texto(cls, valor):
        return valor.strip() if isinstance(valor, str) else valor


class EmpresaAtualizacao(BaseModel):
    nome: str = Field(..., min_length=2, max_length=150)
    cnpj: str | None = Field(default=None, max_length=18)
    cep: str = Field(..., min_length=8, max_length=9)

    @field_validator("nome", "cnpj", "cep", mode="before")
    @classmethod
    def normalizar_texto(cls, valor):
        return valor.strip() if isinstance(valor, str) else valor


class UsuarioCadastroEmpresa(BaseModel):
    nome: str = Field(..., min_length=2, max_length=150)
    email: EmailStr
    senha: str = Field(..., min_length=8)
    telefone: str | None = Field(default=None, max_length=20)
    role: Literal["gerente", "funcionario"] = "funcionario"

    @field_validator("nome", "email", "telefone", mode="before")
    @classmethod
    def normalizar_texto(cls, valor):
        return valor.strip() if isinstance(valor, str) else valor


class UsuarioEmpresaResponse(BaseModel):
    id: int
    nome: str
    email: str
    telefone: str | None
    role: str

    model_config = ConfigDict(from_attributes=True)


class EmpresaResponse(BaseModel):
    id: int
    nome: str
    cnpj: str | None
    cep: str
    usuarios: list[UsuarioEmpresaResponse] = Field(default_factory=list)
    role: str = "funcionario"
    administrador_email: EmailStr | None = None

    model_config = ConfigDict(from_attributes=True)
