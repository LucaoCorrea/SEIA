from pydantic import BaseModel, EmailStr, Field, field_validator


class Usuario(BaseModel):
    nome: str = Field(..., min_length=2, max_length=150)
    telefone: str | None = None
    email: EmailStr
    password: str = Field(min_length=6)
    empresa_nome: str | None = Field(default=None, max_length=150)
    empresa_cnpj: str | None = Field(default=None, max_length=18)
    empresa_cep: str | None = Field(default=None, max_length=9)
    codigo_convite: str | None = Field(default=None, max_length=24)

    @field_validator("nome")
    @classmethod
    def normalizar_nome(cls, valor):
        valor = valor.strip()
        if not valor:
            raise ValueError("Informe seu nome.")
        return valor