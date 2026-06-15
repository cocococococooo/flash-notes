import os
import threading
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app import models, schemas

router = APIRouter()


@router.get("/projects/{project_id}/images", response_model=List[schemas.ImageOut])
def list_images(project_id: int, noteId: int = None, db: Session = Depends(get_db)):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    query = db.query(models.Image).filter(models.Image.projectId == project_id)
    if noteId is not None:
        query = query.filter(models.Image.noteId == noteId)
    return query.all()


@router.put("/images/{image_id}", response_model=schemas.ImageOut)
def update_image(image_id: int, data: schemas.ImageUpdate, db: Session = Depends(get_db)):
    image = db.query(models.Image).filter(models.Image.id == image_id).first()
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")
    if data.userSummary is not None:
        image.userSummary = data.userSummary
    if data.tags is not None:
        image.tags = data.tags
    db.commit()
    db.refresh(image)
    return image


@router.post("/images/{image_id}/re-analyze", response_model=schemas.ImageOut)
def reanalyze_image(image_id: int, db: Session = Depends(get_db)):
    image = db.query(models.Image).filter(models.Image.id == image_id).first()
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")

    upload_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
    file_path = os.path.join(upload_dir, os.path.basename(image.localUri))
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Image file not found on disk")

    image.status = models.ImageStatus.processing.value
    image.ocrText = ""
    image.aiSummary = ""
    db.commit()
    db.refresh(image)

    threading.Thread(target=_reanalyze_task, args=(image.id, file_path), daemon=True).start()

    return image


def _reanalyze_task(image_id: int, file_path: str):
    from app.database import SessionLocal
    from app.services.ai_service import analyze_image
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
