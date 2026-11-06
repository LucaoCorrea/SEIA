from datetime import date, datetime, time, timedelta
from io import BytesIO

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.worksheet.table import Table, TableStyleInfo
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError

from plugins.database import Session
from plugins.tenant import usuario_atual
from schemas.fazenda import Fazenda, Lote
from schemas.fornecedor import Fornecedor
from schemas.movimentacao import Movimentacao
from schemas.produto import Produto
from schemas.usuario import UsuarioDB


class FiltrosRelatorio:
    def __init__(
        self,
        data_inicio: date | None = Query(default=None),
        data_fim: date | None = Query(default=None),
        produto_id: int | None = Query(default=None, gt=0),
        fornecedor_id: int | None = Query(default=None, gt=0),
        fazenda_id: int | None = Query(default=None, gt=0),
        lote_id: int | None = Query(default=None, gt=0),
        tipo: str | None = Query(default=None, pattern="^(entrada|saida|ajuste)$"),
    ):
        self.data_inicio = data_inicio
        self.data_fim = data_fim
        self.produto_id = produto_id
        self.fornecedor_id = fornecedor_id
        self.fazenda_id = fazenda_id
        self.lote_id = lote_id
        self.tipo = tipo


class RotasRelatorio:
    COLUNAS_MOVIMENTACAO = [
        "movimentacao_id",
        "empresa_id",
        "criado_em",
        "tipo",
        "produto_id",
        "produto",
        "fornecedor_id",
        "fornecedor",
        "quantidade",
        "unidade_medida",
        "saldo_anterior",
        "saldo_posterior",
        "fazenda_id",
        "fazenda",
        "lote_id",
        "lote",
        "talhao",
        "area_hectares",
        "usuario_id",
        "responsavel",
        "motivo",
    ]

    def __init__(self):
        self.router = APIRouter()
        self.router.get("/relatorios/opcoes")(self.opcoes)
        self.router.get("/relatorios")(self.gerar)
        self.router.get("/relatorios/exportar.xlsx")(self.exportar_xlsx)

    @staticmethod
    def _validar_filtros(filtros):
        if filtros.data_inicio and filtros.data_fim and filtros.data_inicio > filtros.data_fim:
            raise HTTPException(
                status_code=400,
                detail="A data inicial não pode ser posterior à data final.",
            )
        if filtros.lote_id and filtros.fazenda_id is None:
            raise HTTPException(
                status_code=400,
                detail="Informe a fazenda para filtrar por lote.",
            )

    @staticmethod
    def _query_movimentacoes(db, empresa_id, filtros):
        fazendas_empresa = select(Fazenda.id).where(Fazenda.empresa_id == empresa_id)
        consulta = (
            db.query(
                Movimentacao,
                Produto.nome.label("produto_nome"),
                Produto.unidade_medida.label("unidade_medida"),
                Produto.fornecedor_id.label("fornecedor_id"),
                Fornecedor.nome.label("fornecedor_nome"),
                Fazenda.id.label("fazenda_id"),
                Fazenda.nome.label("fazenda_nome"),
                Lote.nome.label("lote_nome"),
                Lote.talhao.label("talhao"),
                Lote.area_hectares.label("area_hectares"),
                UsuarioDB.nome.label("usuario_nome"),
            )
            .join(
                Produto,
                (Produto.id == Movimentacao.produto_id)
                & (Produto.empresa_id == empresa_id),
            )
            .outerjoin(
                Fornecedor,
                (Fornecedor.id == Produto.fornecedor_id)
                & (Fornecedor.empresa_id == empresa_id),
            )
            .outerjoin(
                Lote,
                (Lote.id == Movimentacao.destino_lote_id)
                & (Lote.fazenda_id.in_(fazendas_empresa)),
            )
            .outerjoin(
                Fazenda,
                (Fazenda.id == Lote.fazenda_id)
                & (Fazenda.empresa_id == empresa_id),
            )
            .join(UsuarioDB, UsuarioDB.id == Movimentacao.usuario_id)
            .filter(Movimentacao.empresa_id == empresa_id)
        )

        if filtros.data_inicio:
            consulta = consulta.filter(
                Movimentacao.criado_em >= datetime.combine(filtros.data_inicio, time.min)
            )
        if filtros.data_fim:
            consulta = consulta.filter(
                Movimentacao.criado_em
                < datetime.combine(filtros.data_fim + timedelta(days=1), time.min)
            )
        if filtros.produto_id:
            consulta = consulta.filter(Produto.id == filtros.produto_id)
        if filtros.fornecedor_id:
            consulta = consulta.filter(Fornecedor.id == filtros.fornecedor_id)
        if filtros.fazenda_id:
            consulta = consulta.filter(Fazenda.id == filtros.fazenda_id)
        if filtros.lote_id:
            consulta = consulta.filter(Lote.id == filtros.lote_id)
        if filtros.tipo:
            consulta = consulta.filter(Movimentacao.tipo == filtros.tipo)

        return consulta.order_by(Movimentacao.criado_em.desc(), Movimentacao.id.desc())

    @staticmethod
    def _linha(registro):
        (
            movimento,
            produto_nome,
            unidade_medida,
            fornecedor_id,
            fornecedor_nome,
            fazenda_id,
            fazenda_nome,
            lote_nome,
            talhao,
            area_hectares,
            usuario_nome,
        ) = registro
        return {
            "id": movimento.id,
            "empresa_id": movimento.empresa_id,
            "usuario_id": movimento.usuario_id,
            "criado_em": movimento.criado_em,
            "tipo": movimento.tipo,
            "produto_id": movimento.produto_id,
            "produto_nome": produto_nome,
            "unidade_medida": unidade_medida,
            "fornecedor_id": fornecedor_id,
            "fornecedor_nome": fornecedor_nome,
            "quantidade": movimento.quantidade,
            "saldo_anterior": movimento.saldo_anterior,
            "saldo_posterior": movimento.saldo_posterior,
            "fazenda_id": fazenda_id,
            "fazenda_nome": fazenda_nome,
            "lote_id": movimento.destino_lote_id,
            "lote_nome": lote_nome,
            "talhao": talhao,
            "area_hectares": area_hectares,
            "usuario_nome": usuario_nome,
            "motivo": movimento.motivo,
        }

    @staticmethod
    def _query_estoque(db, empresa_id, filtros):
        consulta = (
            db.query(Produto, Fornecedor.nome.label("fornecedor_nome"))
            .outerjoin(
                Fornecedor,
                (Fornecedor.id == Produto.fornecedor_id)
                & (Fornecedor.empresa_id == empresa_id),
            )
            .filter(Produto.empresa_id == empresa_id)
        )
        if filtros.produto_id:
            consulta = consulta.filter(Produto.id == filtros.produto_id)
        if filtros.fornecedor_id:
            consulta = consulta.filter(Produto.fornecedor_id == filtros.fornecedor_id)
        return consulta.order_by(Produto.nome).all()

    @staticmethod
    def _montar_resumo(estoque, linhas):
        entradas = sum(float(linha["quantidade"]) for linha in linhas if linha["tipo"] == "entrada")
        saidas = sum(float(linha["quantidade"]) for linha in linhas if linha["tipo"] == "saida")
        ajustes = sum(float(linha["quantidade"]) for linha in linhas if linha["tipo"] == "ajuste")

        saidas_por_produto = {}
        saidas_por_fornecedor = {}
        saidas_por_fazenda = {}
        saidas_por_lote = {}
        for linha in linhas:
            if linha["tipo"] != "saida":
                continue
            quantidade = float(linha["quantidade"])
            saidas_por_produto[linha["produto_nome"]] = (
                saidas_por_produto.get(linha["produto_nome"], 0) + quantidade
            )
            if linha["fornecedor_nome"]:
                saidas_por_fornecedor[linha["fornecedor_nome"]] = (
                    saidas_por_fornecedor.get(linha["fornecedor_nome"], 0) + quantidade
                )
            if linha["fazenda_nome"]:
                saidas_por_fazenda[linha["fazenda_nome"]] = (
                    saidas_por_fazenda.get(linha["fazenda_nome"], 0) + quantidade
                )
            if linha["lote_nome"]:
                chave_lote = f'{linha["lote_nome"]} · {linha["talhao"] or "Sem talhão"}'
                saidas_por_lote[chave_lote] = saidas_por_lote.get(chave_lote, 0) + quantidade

        baixos = [
            item for item in estoque
            if float(item[0].quantidade or 0) <= float(item[0].estoque_minimo or 0)
        ]
        valor_estoque = sum(
            float(produto.quantidade or 0) * float(produto.custo or 0)
            for produto, _ in estoque
        )

        def ranking(valores, maximo=5):
            return [
                {"nome": nome, "quantidade": quantidade}
                for nome, quantidade in sorted(
                    valores.items(), key=lambda item: (-item[1], item[0])
                )[:maximo]
            ]

        return {
            "total_movimentacoes": len(linhas),
            "entradas": entradas,
            "saidas": saidas,
            "ajustes": ajustes,
            "produtos_no_estoque": len(estoque),
            "produtos_estoque_baixo": len(baixos),
            "valor_estoque_atual": valor_estoque,
            "top_produtos_saida": ranking(saidas_por_produto),
            "top_fornecedores_saida": ranking(saidas_por_fornecedor),
            "saidas_por_fazenda": ranking(saidas_por_fazenda),
            "saidas_por_lote": ranking(saidas_por_lote),
            "produtos_estoque_baixo_lista": [
                {
                    "nome": produto.nome,
                    "quantidade": produto.quantidade,
                    "estoque_minimo": produto.estoque_minimo,
                    "unidade_medida": produto.unidade_medida,
                    "fornecedor_nome": fornecedor_nome,
                }
                for produto, fornecedor_nome in baixos
            ],
        }

    def opcoes(self, usuario: dict = Depends(usuario_atual)):
        db = Session()
        try:
            produtos = db.query(Produto).filter(
                Produto.empresa_id == usuario["empresa_id"]
            ).order_by(Produto.nome).all()
            fornecedores = db.query(Fornecedor).filter(
                Fornecedor.empresa_id == usuario["empresa_id"]
            ).order_by(Fornecedor.nome).all()
            fazendas = db.query(Fazenda).filter(
                Fazenda.empresa_id == usuario["empresa_id"]
            ).order_by(Fazenda.nome).all()
            lotes = (
                db.query(Lote, Fazenda.nome)
                .join(Fazenda, Fazenda.id == Lote.fazenda_id)
                .filter(Fazenda.empresa_id == usuario["empresa_id"])
                .order_by(Fazenda.nome, Lote.nome, Lote.talhao)
                .all()
            )
            return {
                "produtos": [{"id": item.id, "nome": item.nome} for item in produtos],
                "fornecedores": [{"id": item.id, "nome": item.nome} for item in fornecedores],
                "fazendas": [{"id": item.id, "nome": item.nome} for item in fazendas],
                "lotes": [
                    {
                        "id": lote.id,
                        "nome": lote.nome,
                        "talhao": lote.talhao,
                        "fazenda_id": lote.fazenda_id,
                        "fazenda_nome": fazenda_nome,
                    }
                    for lote, fazenda_nome in lotes
                ],
            }
        except SQLAlchemyError:
            raise HTTPException(status_code=500, detail="Erro ao carregar opções do relatório.")
        finally:
            db.close()

    def gerar(
        self,
        filtros: FiltrosRelatorio = Depends(),
        usuario: dict = Depends(usuario_atual),
    ):
        self._validar_filtros(filtros)
        db = Session()
        try:
            linhas = [
                self._linha(registro)
                for registro in self._query_movimentacoes(db, usuario["empresa_id"], filtros).all()
            ]
            estoque = self._query_estoque(db, usuario["empresa_id"], filtros)
            return {
                "filtros": {
                    "data_inicio": filtros.data_inicio,
                    "data_fim": filtros.data_fim,
                    "produto_id": filtros.produto_id,
                    "fornecedor_id": filtros.fornecedor_id,
                    "fazenda_id": filtros.fazenda_id,
                    "lote_id": filtros.lote_id,
                    "tipo": filtros.tipo,
                },
                "resumo": self._montar_resumo(
                    estoque, linhas
                ),
                "movimentacoes": linhas,
                "estoque_atual": [
                    {
                        "produto_id": produto.id,
                        "produto": produto.nome,
                        "fornecedor": fornecedor_nome,
                        "quantidade": produto.quantidade,
                        "estoque_minimo": produto.estoque_minimo,
                        "unidade_medida": produto.unidade_medida,
                        "custo_unitario": produto.custo,
                        "valor_estoque": float(produto.quantidade or 0)
                        * float(produto.custo or 0),
                    }
                    for produto, fornecedor_nome in estoque
                ],
            }
        except SQLAlchemyError:
            raise HTTPException(status_code=500, detail="Erro ao gerar relatório.")
        finally:
            db.close()

    @staticmethod
    def _adicionar_tabela(worksheet, nome):
        tabela = Table(displayName=nome, ref=worksheet.dimensions)
        tabela.tableStyleInfo = TableStyleInfo(
            name="TableStyleMedium4",
            showFirstColumn=False,
            showLastColumn=False,
            showRowStripes=True,
            showColumnStripes=False,
        )
        worksheet.add_table(tabela)
        worksheet.freeze_panes = "A2"
        worksheet.sheet_view.showGridLines = False
        worksheet.row_dimensions[1].height = 32
        for cell in worksheet[1]:
            cell.alignment = Alignment(vertical="center", wrap_text=True)

    @staticmethod
    def _formatar_coluna(worksheet, indice, formato):
        for linha in range(2, worksheet.max_row + 1):
            worksheet.cell(row=linha, column=indice).number_format = formato

    def exportar_xlsx(
        self,
        filtros: FiltrosRelatorio = Depends(),
        usuario: dict = Depends(usuario_atual),
    ):
        self._validar_filtros(filtros)
        db = Session()
        try:
            registros = self._query_movimentacoes(
                db, usuario["empresa_id"], filtros
            ).all()
            linhas = [self._linha(registro) for registro in registros]
            estoque = self._query_estoque(db, usuario["empresa_id"], filtros)
            resumo = self._montar_resumo(estoque, linhas)

            workbook = Workbook()
            workbook.properties.title = "Relatório de estoque e movimentações"
            workbook.properties.subject = "Dados e indicadores para análise"
            workbook.properties.creator = "SEIA"

            resumo_sheet = workbook.active
            resumo_sheet.title = "Resumo"
            resumo_sheet.sheet_view.showGridLines = False
            resumo_sheet.merge_cells("A1:E1")
            resumo_sheet["A1"] = "Relatório de estoque e movimentações"
            resumo_sheet["A1"].font = Font(bold=True, color="FFFFFF", size=16)
            resumo_sheet["A1"].fill = PatternFill("solid", fgColor="145A38")
            resumo_sheet["A1"].alignment = Alignment(vertical="center")
            resumo_sheet.row_dimensions[1].height = 34
            resumo_sheet.merge_cells("A2:E2")
            resumo_sheet["A2"] = (
                "Movimentações respeitam o período e os filtros selecionados. "
                "O estoque atual é consolidado por produto, não por fazenda ou lote."
            )
            resumo_sheet["A2"].font = Font(italic=True, color="526057", size=10)
            resumo_sheet["A2"].alignment = Alignment(wrap_text=True, vertical="center")
            resumo_sheet.row_dimensions[2].height = 30

            resumo_sheet.append([])
            cabecalho = ["indicador", "valor", None, "filtro", "selecionado"]
            for coluna, valor in enumerate(cabecalho, start=1):
                resumo_sheet.cell(4, coluna, valor)
            indicadores = [
                ("total_movimentacoes", resumo["total_movimentacoes"]),
                ("entradas_quantidade", resumo["entradas"]),
                ("saidas_quantidade", resumo["saidas"]),
                ("ajustes_quantidade_registrada", resumo["ajustes"]),
                ("produtos_no_estoque", resumo["produtos_no_estoque"]),
                ("produtos_no_minimo_ou_abaixo", resumo["produtos_estoque_baixo"]),
                ("valor_estoque_atual", resumo["valor_estoque_atual"]),
            ]
            filtros_exportados = [
                ("data_inicio", filtros.data_inicio.isoformat() if filtros.data_inicio else "Todas"),
                ("data_fim", filtros.data_fim.isoformat() if filtros.data_fim else "Todas"),
                ("produto_id", filtros.produto_id if filtros.produto_id else "Todos"),
                ("fornecedor_id", filtros.fornecedor_id if filtros.fornecedor_id else "Todos"),
                ("fazenda_id", filtros.fazenda_id if filtros.fazenda_id else "Todas"),
                ("lote_id", filtros.lote_id if filtros.lote_id else "Todos"),
                ("tipo", filtros.tipo if filtros.tipo else "Todos"),
            ]
            for linha, (nome, valor) in enumerate(indicadores, start=5):
                resumo_sheet.cell(linha, 1, nome)
                resumo_sheet.cell(linha, 2, valor)
            for linha, (nome, valor) in enumerate(filtros_exportados, start=5):
                resumo_sheet.cell(linha, 4, nome)
                resumo_sheet.cell(linha, 5, valor)

            for coluna, largura in {"A": 34, "B": 20, "C": 4, "D": 22, "E": 28}.items():
                resumo_sheet.column_dimensions[coluna].width = largura
            for celula in resumo_sheet[4]:
                celula.font = Font(bold=True, color="FFFFFF")
                celula.fill = PatternFill("solid", fgColor="197447")
                celula.alignment = Alignment(vertical="center", wrap_text=True)
            for linha in range(5, 12):
                for coluna in (1, 2, 4, 5):
                    resumo_sheet.cell(linha, coluna).fill = PatternFill(
                        "solid", fgColor="F2F7F3"
                    )
                    resumo_sheet.cell(linha, coluna).alignment = Alignment(
                        vertical="center"
                    )
            resumo_sheet["B11"].number_format = '"R$" #,##0.00'
            resumo_sheet.freeze_panes = "A5"

            def adicionar_insight(coluna, linha_inicio, titulo, itens, chave):
                resumo_sheet.cell(linha_inicio, coluna, titulo)
                resumo_sheet.cell(linha_inicio, coluna).font = Font(
                    bold=True, color="145A38", size=11
                )
                resumo_sheet.cell(linha_inicio + 1, coluna, chave)
                resumo_sheet.cell(linha_inicio + 1, coluna + 1, "quantidade")
                for celula in resumo_sheet[linha_inicio + 1][coluna - 1:coluna + 1]:
                    celula.font = Font(bold=True, color="FFFFFF")
                    celula.fill = PatternFill("solid", fgColor="197447")
                for numero, item in enumerate(itens, start=linha_inicio + 2):
                    resumo_sheet.cell(numero, coluna, item["nome"])
                    resumo_sheet.cell(numero, coluna + 1, item["quantidade"])
                    resumo_sheet.cell(numero, coluna + 1).number_format = "#,##0.000"

            adicionar_insight(
                1, 14, "Maiores saídas por produto", resumo["top_produtos_saida"], "produto"
            )
            adicionar_insight(
                4, 14, "Saídas por fornecedor", resumo["top_fornecedores_saida"], "fornecedor"
            )
            adicionar_insight(
                1, 24, "Saídas por fazenda", resumo["saidas_por_fazenda"], "fazenda"
            )
            adicionar_insight(
                4, 24, "Saídas por lote/talhão", resumo["saidas_por_lote"], "lote_talhao"
            )

            movimentos_sheet = workbook.create_sheet("Movimentacoes")
            movimentos_sheet.append(self.COLUNAS_MOVIMENTACAO)
            for linha in linhas:
                criado_em = linha["criado_em"]
                if criado_em and criado_em.tzinfo:
                    criado_em = criado_em.replace(tzinfo=None)
                movimentos_sheet.append(
                    [
                        linha["id"],
                        linha.get("empresa_id", usuario["empresa_id"]),
                        criado_em,
                        linha["tipo"],
                        linha["produto_id"],
                        linha["produto_nome"],
                        linha["fornecedor_id"],
                        linha["fornecedor_nome"],
                        linha["quantidade"],
                        linha["unidade_medida"],
                        linha["saldo_anterior"],
                        linha["saldo_posterior"],
                        linha["fazenda_id"],
                        linha["fazenda_nome"],
                        linha["lote_id"],
                        linha["lote_nome"],
                        linha["talhao"],
                        linha["area_hectares"],
                        linha.get("usuario_id"),
                        linha["usuario_nome"],
                        linha["motivo"],
                    ]
                )
            self._adicionar_tabela(movimentos_sheet, "TabelaMovimentacoes")
            movimentos_sheet.freeze_panes = "F2"
            larguras_movimentacoes = [
                17, 13, 21, 14, 13, 28, 14, 26, 16, 18, 16, 16, 13, 25, 13,
                24, 18, 16, 13, 26, 42,
            ]
            for indice, largura in enumerate(larguras_movimentacoes, start=1):
                coluna = movimentos_sheet.cell(1, indice).column_letter
                movimentos_sheet.column_dimensions[coluna].width = largura
            self._formatar_coluna(movimentos_sheet, 3, "dd/mm/yyyy hh:mm")
            for indice in (9, 11, 12):
                self._formatar_coluna(movimentos_sheet, indice, "#,##0.000")
            self._formatar_coluna(movimentos_sheet, 18, "#,##0.00")

            estoque_sheet = workbook.create_sheet("EstoqueAtual")
            estoque_sheet.append(
                [
                    "empresa_id",
                    "produto_id",
                    "produto",
                    "fornecedor_id",
                    "fornecedor",
                    "quantidade",
                    "estoque_minimo",
                    "unidade_medida",
                    "custo_unitario",
                    "valor_estoque",
                    "abaixo_ou_no_minimo",
                ]
            )
            for produto, fornecedor_nome in estoque:
                quantidade = float(produto.quantidade or 0)
                estoque_minimo = float(produto.estoque_minimo or 0)
                estoque_sheet.append(
                    [
                        usuario["empresa_id"],
                        produto.id,
                        produto.nome,
                        produto.fornecedor_id,
                        fornecedor_nome,
                        quantidade,
                        estoque_minimo,
                        produto.unidade_medida,
                        float(produto.custo or 0),
                        quantidade * float(produto.custo or 0),
                        quantidade <= estoque_minimo,
                    ]
                )
            self._adicionar_tabela(estoque_sheet, "TabelaEstoqueAtual")
            estoque_sheet.freeze_panes = "C2"
            for coluna, largura in {
                "A": 13, "B": 13, "C": 30, "D": 14, "E": 28, "F": 17,
                "G": 18, "H": 18, "I": 17, "J": 19, "K": 24,
            }.items():
                estoque_sheet.column_dimensions[coluna].width = largura
            for indice in (6, 7):
                self._formatar_coluna(estoque_sheet, indice, "#,##0.000")
            for indice in (9, 10):
                self._formatar_coluna(estoque_sheet, indice, '"R$" #,##0.00')

            dicionario = workbook.create_sheet("Dicionario")
            dicionario.append(["aba", "campo", "descricao", "tipo"])
            campos = [
                ("Movimentacoes", "movimentacao_id", "Identificador único do evento de estoque.", "inteiro"),
                ("Movimentacoes", "empresa_id", "Empresa proprietária do registro.", "inteiro"),
                ("Movimentacoes", "criado_em", "Data e hora registradas para a movimentação.", "data/hora"),
                ("Movimentacoes", "tipo", "Categoria do evento: entrada, saida ou ajuste.", "categoria"),
                ("Movimentacoes", "produto_id / produto", "Identificador e nome do produto movimentado.", "inteiro / texto"),
                ("Movimentacoes", "fornecedor_id / fornecedor", "Fornecedor cadastrado no produto no momento da exportação.", "inteiro / texto"),
                ("Movimentacoes", "quantidade", "Quantidade do evento; use o campo tipo para interpretar a operação.", "decimal"),
                ("Movimentacoes", "saldo_anterior / saldo_posterior", "Saldo global do produto antes e depois do evento, não por lote.", "decimal"),
                ("Movimentacoes", "fazenda_id / fazenda", "Destino da movimentação, quando informado.", "inteiro / texto"),
                ("Movimentacoes", "lote_id / lote / talhao", "Lote e talhão de destino, quando informados.", "inteiro / texto"),
                ("Movimentacoes", "area_hectares", "Área cadastrada para o lote de destino.", "decimal"),
                ("Movimentacoes", "usuario_id / responsavel", "Usuário que realizou a movimentação.", "inteiro / texto"),
                ("Movimentacoes", "motivo", "Motivo ou observação informada no lançamento.", "texto"),
                ("EstoqueAtual", "quantidade / estoque_minimo", "Saldo atual e limite mínimo cadastrados no produto.", "decimal"),
                ("EstoqueAtual", "custo_unitario / valor_estoque", "Custo atual e quantidade multiplicada pelo custo.", "moeda"),
                ("EstoqueAtual", "abaixo_ou_no_minimo", "Verdadeiro quando o saldo atual é menor ou igual ao mínimo.", "booleano"),
                ("Resumo", "indicadores", "Agregados das movimentações filtradas e valor do estoque atual.", "misto"),
                ("Resumo", "filtros", "Parâmetros usados na exportação; 'Todos' indica ausência de filtro.", "misto"),
            ]
            for campo in campos:
                dicionario.append(campo)
            self._adicionar_tabela(dicionario, "TabelaDicionario")
            for coluna, largura in {"A": 20, "B": 34, "C": 88, "D": 20}.items():
                dicionario.column_dimensions[coluna].width = largura
            for linha in range(2, dicionario.max_row + 1):
                dicionario.cell(linha, 3).alignment = Alignment(
                    wrap_text=True, vertical="top"
                )

            buffer = BytesIO()
            workbook.save(buffer)
            buffer.seek(0)
            return StreamingResponse(
                buffer,
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                headers={
                    "Content-Disposition": 'attachment; filename="relatorio_seia.xlsx"'
                },
            )
        except SQLAlchemyError:
            raise HTTPException(status_code=500, detail="Erro ao exportar relatório.")
        finally:
            db.close()
