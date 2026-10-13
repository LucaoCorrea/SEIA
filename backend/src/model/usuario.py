from pydantic import BaseModel, EmailStr, Field


class Usuario(BaseModel):
    nome: str
    telefone: str | None = None
    email: EmailStr
    password: str = Field(min_length=6)