import os
import uuid
import threading
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel
from app.database import get_db
from app import models, schemas
from app.services.ai_service import analyze_image
from PIL import Image as PILImage

router = APIRouter()
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}


class ProjectUpdate(BaseModel):
    title: str


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


@router.get("/projects/default", response_model=schemas.ProjectOut)
def get_or_create_default_project(db: Session = Depends(get_db)):
    default = db.query(models.Project).filter(models.Project.isDefault == 1).first()
    if default:
        return default
    existing = db.query(models.Project).filter(models.Project.title == "默认文件夹").first()
    if existing:
        existing.isDefault = 1
        db.commit()
        db.refresh(existing)
        return existing
    project = models.Project(title="默认文件夹", isDefault=1)
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@router.put("/projects/{project_id}", response_model=schemas.ProjectOut)
def rename_project(project_id: int, data: ProjectUpdate, db: Session = Depends(get_db)):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if not data.title.strip():
        raise HTTPException(status_code=400, detail="Title cannot be empty")
    project.title = data.title.strip()
    db.commit()
    db.refresh(project)
    return project


@router.delete("/projects/{project_id}", status_code=204)
def delete_project(project_id: int, db: Session = Depends(get_db)):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.isDefault:
        raise HTTPException(status_code=403, detail="Cannot delete default project")
    images = db.query(models.Image).filter(models.Image.projectId == project_id).all()
    for img in images:
        file_path = os.path.join(UPLOAD_DIR, os.path.basename(img.localUri))
        if os.path.exists(file_path):
            os.remove(file_path)
    db.delete(project)
    db.commit()


@router.post("/projects/{project_id}/images", response_model=List[schemas.ImageOut])
async def upload_images(project_id: int, noteId: int = None, files: List[UploadFile] = File(...), db: Session = Depends(get_db)):
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

        img_w = 0
        img_h = 0
        try:
            with PILImage.open(file_path) as pil_img:
                img_w, img_h = pil_img.size
        except Exception:
            pass

        image = models.Image(
            projectId=project_id,
            noteId=noteId,
            localUri=f"/uploads/{filename}",
            width=img_w,
            height=img_h,
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
