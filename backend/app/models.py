import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import relationship
from app.database import Base
import enum


class ImageStatus(str, enum.Enum):
    processing = "processing"
    done = "done"
    failed = "failed"


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    isDefault = Column(Integer, default=0)
    createdAt = Column(DateTime, default=datetime.datetime.utcnow)

    images = relationship("Image", back_populates="project", cascade="all, delete-orphan")
    notes = relationship("Note", back_populates="project", cascade="all, delete-orphan")


class Image(Base):
    __tablename__ = "images"

    id = Column(Integer, primary_key=True, index=True)
    projectId = Column(Integer, ForeignKey("projects.id"), nullable=False)
    noteId = Column(Integer, ForeignKey("notes.id"), nullable=True)
    localUri = Column(String(512), nullable=False)
    width = Column(Integer, default=0)
    height = Column(Integer, default=0)
    ocrText = Column(Text, default="")
    aiSummary = Column(Text, default="")
    userSummary = Column(Text, default="")
    tags = Column(Text, default="[]")
    status = Column(String(20), default=ImageStatus.processing.value)

    project = relationship("Project", back_populates="images")
    note = relationship("Note")


class Note(Base):
    __tablename__ = "notes"

    id = Column(Integer, primary_key=True, index=True)
    projectId = Column(Integer, ForeignKey("projects.id"), nullable=False)
    title = Column(String(255), default="默认笔记")
    content = Column(Text, default="")
    tags = Column(Text, default="[]")
    updatedAt = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    project = relationship("Project", back_populates="notes")


class ShareLink(Base):
    __tablename__ = "share_links"

    id = Column(Integer, primary_key=True, index=True)
    noteId = Column(Integer, ForeignKey("notes.id"), nullable=False)
    token = Column(String(64), unique=True, nullable=False, index=True)
    createdAt = Column(DateTime, default=datetime.datetime.utcnow)
    expiresAt = Column(DateTime, nullable=True)

    note = relationship("Note")
