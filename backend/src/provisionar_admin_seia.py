import argparse
import os
from pathlib import Path

import firebase_admin
from dotenv import load_dotenv
from firebase_admin import auth, credentials
from sqlalchemy.exc import SQLAlchemyError

from plugins.database import Session
from schemas.empresa import Empresa
from schemas.usuario import UsuarioDB


def configurar_firebase():
    if firebase_admin._apps:
        return

    chave = Path(__file__).resolve().parent / "firebase-key.json"
    if chave.exists():
        firebase_admin.initialize_app(credentials.Certificate(str(chave)))
    else:
        firebase_admin.initialize_app()


def provisionar_admin_seia(email):
    firebase_usuario = auth.get_user_by_email(email)

    db = Session()
    try:
        registro = db.query(UsuarioDB).filter(
            UsuarioDB.firebase_uid == firebase_usuario.uid
        ).first()
        if registro is not None:
            if registro.empresa_id is not None or registro.role != "admin_seia":
                raise ValueError(
                    "A conta já está vinculada a uma empresa e não pode ser promovida a admin global."
                )
            registro.nome = firebase_usuario.display_name or registro.nome
            registro.email = firebase_usuario.email
        else:
            db.add(
                UsuarioDB(
                    firebase_uid=firebase_usuario.uid,
                    nome=firebase_usuario.display_name or firebase_usuario.email,
                    email=firebase_usuario.email,
                    role="admin_seia",
                    empresa_id=None,
                )
            )
        db.commit()
        return firebase_usuario.email
    except SQLAlchemyError:
        db.rollback()
        raise
    finally:
        db.close()


def main():
    load_dotenv()
    parser = argparse.ArgumentParser(
        description="Registra uma conta Firebase existente como administrador global SEIA."
    )
    parser.add_argument(
        "email",
        nargs="?",
        default=os.getenv("SEIA_SUPERADMIN_EMAIL"),
        help="E-mail da conta Firebase existente (ou SEIA_SUPERADMIN_EMAIL).",
    )
    argumentos = parser.parse_args()
    if not argumentos.email:
        parser.error("Informe o email ou configure SEIA_SUPERADMIN_EMAIL no .env.")

    configurar_firebase()
    email = provisionar_admin_seia(argumentos.email.strip())
    print(f"Administrador global SEIA provisionado: {email}")


if __name__ == "__main__":
    main()
