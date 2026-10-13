from dotenv import load_dotenv
from fastapi import FastAPI
from firebase_admin import credentials, initialize_app
import firebase_admin
import uvicorn

from api.auth import Auth


class Main:
    def __init__(self):
        load_dotenv()

        self.app = FastAPI()

        cred = credentials.Certificate("firebase-key.json")

        if not firebase_admin._apps:
            initialize_app(cred)

        auth_api = Auth()
        self.app.include_router(auth_api.router)

    def run(self):
        uvicorn.run(self.app, host="127.0.0.1", port=8000)


main = Main()
app = main.app

if __name__ == "__main__":
    main.run()