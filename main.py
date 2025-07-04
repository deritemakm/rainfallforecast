from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

app = FastAPI()

# Serve everything under /static/ from the static folder
app.mount("/", StaticFiles(directory="static", html=True), name="static")