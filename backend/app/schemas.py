from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime


class ProjectCreate(BaseModel):
    title: str


class ProjectOut(BaseModel):
    id: int
    title: str
    isDefault: int = 0
    createdAt: datetime

    class Config:
        from_attributes = True


class ImageOut(BaseModel):
    id: int
    projectId: int
    noteId: Optional[int] = None
    localUri: str
    width: int = 0
    height: int = 0
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
    title: str = "默认笔记"
    content: str
    tags: str
    updatedAt: datetime

    class Config:
        from_attributes = True


class NoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    tags: Optional[str] = None


class NoteCreate(BaseModel):
    projectId: int
    title: Optional[str] = "默认笔记"
    content: Optional[str] = ""
    tags: Optional[str] = "[]"


class NoteListItem(BaseModel):
    id: int
    projectId: int
    projectTitle: str
    title: str = "默认笔记"
    content: str
    tags: str
    imageCount: int
    imageUrls: List[str]
    updatedAt: datetime

    class Config:
        from_attributes = True
