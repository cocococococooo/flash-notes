import os
import uuid
import threading
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app import models, schemas
from app.services.ai_service import analyze_image

router = APIRouter()
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}


@router.post("/projects", response_model=schemas.ProjectOut)
def create_project(data: schemas.ProjectCreate, db: Session = Depends(get_db)):
    project = models.Project(title=data.title)
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@router.get("/projects", response_model=List[schemas.ProjectOut])
def list_projects(db: Session = Depends(get_db)):
    return db.query(models.Project).order_by(models.Project.createdAt.desc()).all()


@router.delete("/projects/{project_id}", status_code=204)
def delete_project(project_id: int, db: Session = Depends(get_db)):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    images = db.query(models.Image).filter(models.Image.projectId == project_id).all()
    for img in images:
        if os.path.exists(img.localUri):
            os.remove(img.localUri)
    db.delete(project)
    db.commit()


@router.post("/projects/{project_id}/images", response_model=List[schemas.ImageOut])
async def upload_images(project_id: int, files: List[UploadFile] = File(...), db: Session = Depends(get_db)):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    created_images = []
    for file in files[:20]:
        ext = os.path.splitext(file.filename or ".jpg")[1].lower()
        if ext not in ALLOWED_EXTENSIONS:
            continue
        filename = f"{uuid.uuid4().hex}{ext}"
        file_path = os.path.join(UPLOAD_DIR, filename)
        content = await file.read()
        with open(file_path, "wb") as f:
            f.write(content)

        image = models.Image(
            projectId=project_id,
            localUri=file_path,
            status=models.ImageStatus.processing.value,
        )
        db.add(image)
        db.commit()
        db.refresh(image)
        created_images.append(image)

        threading.Thread(target=_analyze_image_task, args=(image.id, file_path), daemon=True).start()

    return created_images


def _analyze_image_task(image_id: int, file_path: str):
    from app.database import SessionLocal
    db = SessionLocal()
    try:
        result = analyze_image(file_path)
        img = db.query(models.Image).filter(models.Image.id == image_id).first()
        if img:
            img.ocrText = result["ocr_text"]
            img.aiSummary = result["ai_summary"]
            img.tags = result["tags"]
            img.status = models.ImageStatus.done.value
            db.commit()
    except Exception as e:
        img = db.query(models.Image).filter(models.Image.id == image_id).first()
        if img:
            img.status = models.ImageStatus.failed.value
            db.commit()
    finally:
        db.close()
