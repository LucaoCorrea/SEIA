from pydantic import BaseModel, Field


class ConsultaCodigoBarras(BaseModel):
    codigo_barras: str = Field(min_length=1, max_length=512)
