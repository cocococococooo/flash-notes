import json
import re
import os
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas
from app.services.ai_service import generate_note

router = APIRouter()
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")


def _replace_image_refs(content: str, images: list[models.Image]) -> str:
    """Replace [图N] markers with markdown image syntax."""

    def replacer(match):
        num = int(match.group(1)) - 1
        if 0 <= num < len(images):
            img = images[num]
            img_url = f"/uploads/{os.path.basename(img.localUri)}"
            return f"![图{num+1}]({img_url})"
        return match.group(0)

    return re.sub(r'\[图(\d+)\]', replacer, content)


def _aggregate_note_tags(note: models.Note, db: Session) -> str:
    """Merge image tags and note-level tags into a single unique list."""
    images = db.query(models.Image).filter(
        models.Image.projectId == note.projectId
    ).all()
    merged = set()
    for img in images:
        try:
            for t in json.loads(img.tags):
                merged.add(t)
        except (json.JSONDecodeError, TypeError):
            pass
    try:
        for t in json.loads(note.tags):
            merged.add(t)
    except (json.JSONDecodeError, TypeError):
        pass
    return json.dumps(list(merged), ensure_ascii=False)


@router.post("/projects/{project_id}/generate-note", response_model=schemas.NoteOut)
def create_note(project_id: int, db: Session = Depends(get_db)):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    images = db.query(models.Image).filter(
        models.Image.projectId == project_id,
        models.Image.status == models.ImageStatus.done.value,
    ).all()

    if not images:
        raise HTTPException(status_code=400, detail="No analyzed images available")

    summaries = [
        {
            "summary": img.userSummary if img.userSummary else img.aiSummary,
            "tags": img.tags,
        }
        for img in images
    ]

    content = generate_note(summaries)
    content = _replace_image_refs(content, images)

    note = db.query(models.Note).filter(models.Note.projectId == project_id).first()
    image_tags = set()
    for img in images:
        try:
            for t in json.loads(img.tags):
                image_tags.add(t)
        except (json.JSONDecodeError, TypeError):
            pass

    if note:
        note.content = content
    else:
        note = models.Note(projectId=project_id, title="默认笔记", content=content, tags=json.dumps(list(image_tags), ensure_ascii=False))
        db.add(note)

    db.commit()
    db.refresh(note)
    return note


@router.get("/notes", response_model=list[schemas.NoteListItem])
def list_all_notes(db: Session = Depends(get_db)):
    notes = (
        db.query(models.Note)
        .join(models.Project)
        .order_by(models.Note.updatedAt.desc())
        .all()
    )
    results = []
    for n in notes:
        images = db.query(models.Image).filter(
            models.Image.projectId == n.projectId
        ).all()
        image_count = len(images)
        image_urls = [
            f"/uploads/{os.path.basename(img.localUri)}"
            for img in images[:3]
        ]
        results.append(
            schemas.NoteListItem(
                id=n.id,
                projectId=n.projectId,
                projectTitle=n.project.title,
                title=n.title,
                content=n.content[:200] if n.content else "",
                tags=_aggregate_note_tags(n, db),
                imageCount=image_count,
                imageUrls=image_urls,
                updatedAt=n.updatedAt,
            )
        )
    return results


@router.get("/projects/{project_id}/note", response_model=schemas.NoteOut)
def get_note(project_id: int, db: Session = Depends(get_db)):
    note = db.query(models.Note).filter(models.Note.projectId == project_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    return note


@router.get("/notes/{note_id}", response_model=schemas.NoteOut)
def get_note_by_id(note_id: int, db: Session = Depends(get_db)):
    note = db.query(models.Note).filter(models.Note.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    return note


@router.post("/notes", response_model=schemas.NoteOut)
def create_note_direct(data: schemas.NoteCreate, db: Session = Depends(get_db)):
    project = db.query(models.Project).filter(models.Project.id == data.projectId).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    note = models.Note(projectId=data.projectId, title=data.title or "默认笔记", content=data.content or "", tags=data.tags or "[]")
    db.add(note)
    db.commit()
    db.refresh(note)
    return note


@router.put("/notes/{note_id}", response_model=schemas.NoteOut)
def update_note_by_id(note_id: int, data: schemas.NoteUpdate, db: Session = Depends(get_db)):
    note = db.query(models.Note).filter(models.Note.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    if data.title is not None:
        note.title = data.title
    if data.content is not None:
        note.content = data.content
    if data.tags is not None:
        note.tags = data.tags
    db.commit()
    db.refresh(note)
    return note


@router.put("/projects/{project_id}/note", response_model=schemas.NoteOut)
def update_note(project_id: int, data: schemas.NoteUpdate, db: Session = Depends(get_db)):
    note = db.query(models.Note).filter(models.Note.projectId == project_id).first()
    if not note:
        note = models.Note(projectId=project_id, content=data.content or "", tags=data.tags or "[]")
        db.add(note)
        db.commit()
        db.refresh(note)
        return note
    if data.title is not None:
        note.title = data.title
    if data.content is not None:
        note.content = data.content
    if data.tags is not None:
        note.tags = data.tags
    db.commit()
    db.refresh(note)
    return note
