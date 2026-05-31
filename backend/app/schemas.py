from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime


class ProjectCreate(BaseModel):
    title: str


class ProjectOut(BaseModel):
    id: int
    title: str
    createdAt: datetime

    class Config:
        from_attributes = True


class ImageOut(BaseModel):
    id: int
    projectId: int
    localUri: str
    ocrText: str
    aiSummary: str
    userSummary: str
    tags: str
    status: str

    class Config:
        from_attributes = True


class ImageUpdate(BaseModel):
    userSummary: Optional[str] = None
    tags: Optional[str] = None


class NoteOut(BaseModel):
    id: int
    projectId: int
    content: str
    tags: str
    updatedAt: datetime

    class Config:
        from_attributes = True


class NoteUpdate(BaseModel):
    content: Optional[str] = None
    tags: Optional[str] = None


class NoteListItem(BaseModel):
    id: int
    projectId: int
    projectTitle: str
    content: str
    tags: str
    imageCount: int
    imageUrls: List[str]
    updatedAt: datetime

    class Config:
        from_attributes = True
