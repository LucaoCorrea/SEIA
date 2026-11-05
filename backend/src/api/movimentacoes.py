from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import update
from sqlalchemy.exc import SQLAlchemyError

from model.movimentacao import MovimentacaoCreate, MovimentacaoResponse
from plugins.database import Session
from plugins.tenant import usuario_atual
from schemas.movimentacao import Movimentacao
from schemas.fazenda import Fazenda, Lote
from schemas.produto import Produto
from schemas.usuario import UsuarioDB


class RotasMovimentacao:
    def __init__(self):
        self.router = APIRouter()
        self.router.get("/movimentacoes", response_model=list[MovimentacaoResponse])(self.listar)
        self.router.post("/movimentacoes", status_code=status.HTTP_201_CREATED,  response_model=MovimentacaoResponse,)(self.criar)

    def listar(self, limite: int = Query(default=100, ge=1, le=500), usuario: dict = Depends(usuario_atual),):
        db = Session()

        try:
            registros = (
                db.query(
                    Movimentacao,
                    Produto.nome,
                    UsuarioDB.nome,
                    Fazenda.nome,
                    Lote.nome,
                    Lote.talhao,
                    Lote.area_hectares,
                )
                .join(Produto, Produto.id == Movimentacao.produto_id)
                .join(UsuarioDB, UsuarioDB.id == Movimentacao.usuario_id)
                .outerjoin(Lote, Lote.id == Movimentacao.destino_lote_id)
                .outerjoin(Fazenda, Fazenda.id == Lote.fazenda_id)
                .filter(Movimentacao.empresa_id == usuario["empresa_id"])
                .order_by(Movimentacao.criado_em.desc(), Movimentacao.id.desc())
                .limit(limite)
                .all()
            )
            return [
                {
                    "id": movimento.id,
                    "produto_id": movimento.produto_id,
                    "produto_nome": nome_produto,
                    "destino_lote_id": movimento.destino_lote_id,
                    "destino_fazenda": nome_fazenda,
                    "destino_lote": nome_lote,
                    "destino_talhao": talhao,
                    "destino_area_hectares": area_hectares,
                    "usuario_id": movimento.usuario_id,
                    "usuario_nome": nome_usuario,
                    "tipo": movimento.tipo,
                    "quantidade": movimento.quantidade,
                    "saldo_anterior": movimento.saldo_anterior,
                    "saldo_posterior": movimento.saldo_posterior,
                    "motivo": movimento.motivo,
                    "criado_em": movimento.criado_em,
                }
                for (
                    movimento,
                    nome_produto,
                    nome_usuario,
                    nome_fazenda,
                    nome_lote,
                    talhao,
                    area_hectares,
                ) in registros
            ]
        except SQLAlchemyError:
            raise HTTPException(status_code=500, detail="Erro ao consultar movimentações.")
        finally:
            db.close()

    def criar(self, dados: MovimentacaoCreate, usuario: dict = Depends(usuario_atual),):
        db = Session()

        try:
            produto = (
                db.query(Produto)
                .filter(
                    Produto.id == dados.produto_id,
                    Produto.empresa_id == usuario["empresa_id"],
                )
                .first()
            )
            if produto is None:
                raise HTTPException(status_code=404, detail="Produto não encontrado.")

            lote_destino = None
            fazenda_destino = None
            if dados.destino_lote_id is not None:
                registro_destino = (
                    db.query(Lote, Fazenda)
                    .join(Fazenda, Fazenda.id == Lote.fazenda_id)
                    .filter(
                        Lote.id == dados.destino_lote_id,
                        Fazenda.empresa_id == usuario["empresa_id"],
                    )
                    .first()
                )
                if registro_destino is None:
                    raise HTTPException(
                        status_code=404,
                        detail="Lote de destino não encontrado para esta empresa.",
                    )
                lote_destino, fazenda_destino = registro_destino

            saldo_anterior = float(produto.quantidade)
            if dados.tipo == "entrada":
                saldo_posterior = saldo_anterior + dados.quantidade
                quantidade_registrada = dados.quantidade
            elif dados.tipo == "saida":
                saldo_posterior = saldo_anterior - float(dados.quantidade)
                quantidade_registrada = dados.quantidade
                if saldo_posterior < 0:
                    raise HTTPException(
                        status_code=409,
                        detail="A saída não pode deixar o estoque negativo.",
                    )
            else:
                saldo_posterior = dados.quantidade
                quantidade_registrada = saldo_posterior - saldo_anterior
                if quantidade_registrada == 0:
                    raise HTTPException(
                        status_code=400,
                        detail="O novo saldo precisa ser diferente do saldo atual.",
                    )

            atualizado = db.execute(
                update(Produto)
                .where(
                    Produto.id == produto.id,
                    Produto.empresa_id == usuario["empresa_id"],
                    Produto.quantidade == saldo_anterior,
                )
                .values(
                    quantidade=saldo_posterior,
                    custo=saldo_posterior * float(produto.preco),
                )
            )
            if atualizado.rowcount != 1:
                db.rollback()
                raise HTTPException(
                    status_code=409,
                    detail="O estoque foi alterado por outra operação. Atualize e tente novamente.",
                )

            movimento = Movimentacao(
                empresa_id=usuario["empresa_id"],
                produto_id=produto.id,
                destino_lote_id=lote_destino.id if lote_destino else None,
                usuario_id=usuario["id"],
                tipo=dados.tipo,
                quantidade=quantidade_registrada,
                saldo_anterior=saldo_anterior,
                saldo_posterior=saldo_posterior,
                motivo=dados.motivo.strip(),
            )
            db.add(movimento)
            db.commit()
            db.refresh(movimento)
            return {
                "id": movimento.id,
                "produto_id": produto.id,
                "produto_nome": produto.nome,
                "destino_lote_id": lote_destino.id if lote_destino else None,
                "destino_fazenda": fazenda_destino.nome if fazenda_destino else None,
                "destino_lote": lote_destino.nome if lote_destino else None,
                "destino_talhao": lote_destino.talhao if lote_destino else None,
                "destino_area_hectares": (
                    lote_destino.area_hectares if lote_destino else None
                ),
                "usuario_id": usuario["id"],
                "usuario_nome": usuario["nome"],
                "tipo": movimento.tipo,
                "quantidade": movimento.quantidade,
                "saldo_anterior": movimento.saldo_anterior,
                "saldo_posterior": movimento.saldo_posterior,
                "motivo": movimento.motivo,
                "criado_em": movimento.criado_em,
            }
        except HTTPException:
            db.rollback()
            raise
        except SQLAlchemyError:
            db.rollback()
            raise HTTPException(status_code=500, detail="Erro ao registrar movimentação.")
        finally:
            db.close()
