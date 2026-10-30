import secrets

from sqlalchemy.exc import SQLAlchemyError

from plugins.database import Session
from schemas.empresa import Empresa
from schemas.fornecedor import Fornecedor
from schemas.produto import Produto


EMPRESAS_DEMO = (
    {
        "nome": "Fazenda Horizonte",
        "cnpj": "00.000.000/0001-01",
        "cep": "78000000",
        "fornecedores": (
            {
                "nome": "Agro Insumos Exemplo",
                "email": "contato@agro-insumos.example",
                "telefone": "(65) 3000-0001",
                "cnpj": "00.000.000/0002-02",
            },
            {
                "nome": "Sementes Campo Verde",
                "email": "vendas@sementes-campo.example",
                "telefone": "(65) 3000-0002",
                "cnpj": "00.000.000/0003-03",
            },
        ),
        "produtos": (
            {
                "nome": "Fertilizante NPK 10-10-10",
                "preco": 189.90,
                "quantidade": 40,
                "descricao": "Saco de 50 kg para adubação de culturas.",
                "codigo_barras": "DEMO-HOR-NPK-001",
                "tipo_classificacao": "Fertilizante",
                "unidade_medida": "saco",
                "estoque_minimo": 10,
                "custo": 145.00,
                "fornecedor_indice": 0,
            },
            {
                "nome": "Semente de milho híbrido",
                "preco": 520.00,
                "quantidade": 18,
                "descricao": "Saco de sementes para plantio.",
                "codigo_barras": "DEMO-HOR-SEM-002",
                "tipo_classificacao": "Semente",
                "unidade_medida": "saco",
                "estoque_minimo": 5,
                "custo": 410.00,
                "fornecedor_indice": 1,
            },
            {
                "nome": "Calcário dolomítico",
                "preco": 38.50,
                "quantidade": 75,
                "descricao": "Corretivo de solo, embalagem de 20 kg.",
                "codigo_barras": "DEMO-HOR-CAL-003",
                "tipo_classificacao": "Corretivo",
                "unidade_medida": "saco",
                "estoque_minimo": 20,
                "custo": 27.00,
                "fornecedor_indice": 0,
            },
        ),
    },
    {
        "nome": "Sítio Boa Colheita",
        "cnpj": "00.000.000/0004-04",
        "cep": "79000000",
        "fornecedores": (
            {
                "nome": "NutriSolo Demonstração",
                "email": "atendimento@nutrisolo.example",
                "telefone": "(67) 3000-0003",
                "cnpj": "00.000.000/0005-05",
            },
            {
                "nome": "Irriga Mais Exemplo",
                "email": "comercial@irrigamais.example",
                "telefone": "(67) 3000-0004",
                "cnpj": "00.000.000/0006-06",
            },
        ),
        "produtos": (
            {
                "nome": "Ureia agrícola",
                "preco": 168.00,
                "quantidade": 32,
                "descricao": "Fertilizante nitrogenado, saco de 50 kg.",
                "codigo_barras": "DEMO-BOA-URE-001",
                "tipo_classificacao": "Fertilizante",
                "unidade_medida": "saco",
                "estoque_minimo": 8,
                "custo": 132.00,
                "fornecedor_indice": 0,
            },
            {
                "nome": "Mangueira para irrigação",
                "preco": 12.90,
                "quantidade": 120,
                "descricao": "Mangueira agrícola vendida por metro.",
                "codigo_barras": "DEMO-BOA-MAN-002",
                "tipo_classificacao": "Irrigação",
                "unidade_medida": "m",
                "estoque_minimo": 30,
                "custo": 8.50,
                "fornecedor_indice": 1,
            },
            {
                "nome": "Semente de feijão carioca",
                "preco": 245.00,
                "quantidade": 14,
                "descricao": "Saco de sementes selecionadas para plantio.",
                "codigo_barras": "DEMO-BOA-SEM-003",
                "tipo_classificacao": "Semente",
                "unidade_medida": "saco",
                "estoque_minimo": 4,
                "custo": 190.00,
                "fornecedor_indice": 0,
            },
        ),
    },
)


def popular_dados_demo():
    db = Session()
    try:
        if db.query(Empresa.id).first() is not None:
            return False

        for dados_empresa in EMPRESAS_DEMO:
            fornecedores_dados = dados_empresa["fornecedores"]
            produtos_dados = dados_empresa["produtos"]
            empresa = Empresa(
                nome=dados_empresa["nome"],
                cnpj=dados_empresa["cnpj"],
                cep=dados_empresa["cep"],
                codigo_convite=secrets.token_urlsafe(8),
                legado=False,
            )
            db.add(empresa)
            db.flush()

            fornecedores = [
                Fornecedor(empresa_id=empresa.id, **dados_fornecedor)
                for dados_fornecedor in fornecedores_dados
            ]
            db.add_all(fornecedores)
            db.flush()

            for dados_produto in produtos_dados:
                dados_produto = dict(dados_produto)
                fornecedor = fornecedores[dados_produto.pop("fornecedor_indice")]
                db.add(
                    Produto(
                        empresa_id=empresa.id,
                        fornecedor_id=fornecedor.id,
                        **dados_produto,
                    )
                )

        db.commit()
        return True
    except SQLAlchemyError:
        db.rollback()
        raise
    finally:
        db.close()
