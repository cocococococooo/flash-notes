from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app import models, schemas

router = APIRouter()


@router.get("/projects/{project_id}/images", response_model=List[schemas.ImageOut])
def list_images(project_id: int, db: Session = Depends(get_db)):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return db.query(models.Image).filter(models.Image.projectId == project_id).all()


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
