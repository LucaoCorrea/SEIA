from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import update
from sqlalchemy.exc import SQLAlchemyError

from model.movimentacao import MovimentacaoCreate, MovimentacaoResponse
from plugins.database import Session
from plugins.tenant import usuario_atual
from schemas.movimentacao import Movimentacao
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
                db.query(Movimentacao, Produto.nome, UsuarioDB.nome)
                .join(Produto, Produto.id == Movimentacao.produto_id)
                .join(UsuarioDB, UsuarioDB.id == Movimentacao.usuario_id)
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
                    "usuario_id": movimento.usuario_id,
                    "usuario_nome": nome_usuario,
                    "tipo": movimento.tipo,
                    "quantidade": movimento.quantidade,
                    "saldo_anterior": movimento.saldo_anterior,
                    "saldo_posterior": movimento.saldo_posterior,
                    "motivo": movimento.motivo,
                    "criado_em": movimento.criado_em,
                }
                for movimento, nome_produto, nome_usuario in registros
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

            saldo_anterior = float(produto.quantidade)
            if dados.tipo == "entrada":
                saldo_posterior = saldo_anterior + dados.quantidade
                quantidade_registrada = dados.quantidade
            elif dados.tipo == "saida":
                saldo_posterior = saldo_anterior - dados.quantidade
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
                .values(quantidade=saldo_posterior)
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
