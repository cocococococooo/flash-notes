import os
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
from app.routes import projects, images, notes, shares

Base.metadata.create_all(bind=engine)

app = FastAPI(title="闪记 API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

upload_dir = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(upload_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=upload_dir), name="uploads")

app.include_router(projects.router, tags=["Projects"])
app.include_router(images.router, tags=["Images"])
app.include_router(notes.router, tags=["Notes"])
app.include_router(shares.router, tags=["Shares"])


@app.get("/")
def root():
    return {"message": "闪记 API is running"}
