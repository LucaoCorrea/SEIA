from pydantic import BaseModel, ConfigDict, Field, field_validator


class FazendaCreate(BaseModel):
    codigo: int = Field(ge=0)
    nome: str = Field(..., min_length=2, max_length=150)

    @field_validator("nome")
    @classmethod
    def normalizar_nome(cls, valor):
        valor = valor.strip()
        if len(valor) < 2:
            raise ValueError("Informe um nome válido para a fazenda.")
        return valor


class LoteCreate(BaseModel):
    nome: str = Field(..., min_length=1, max_length=100)
    talhao: str = Field(..., min_length=1, max_length=100)
    area_hectares: float = Field(..., gt=0)

    @field_validator("nome", "talhao")
    @classmethod
    def normalizar_texto(cls, valor):
        valor = valor.strip()
        if not valor:
            raise ValueError("O lote e o talhão são obrigatórios.")
        return valor


class LoteResponse(BaseModel):
    id: int
    fazenda_id: int
    fazenda_nome: str
    nome: str
    talhao: str
    area_hectares: float

    model_config = ConfigDict(from_attributes=True)


class FazendaResponse(BaseModel):
    id: int
    codigo: int
    nome: str
    lotes: list[LoteResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)
