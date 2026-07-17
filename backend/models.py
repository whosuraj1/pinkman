"""Database models.

Kept intentionally simple for the prototype. Uses SQLModel (SQLAlchemy + Pydantic).
"""
from datetime import datetime
from enum import Enum
from typing import Optional

from sqlmodel import Field, SQLModel


class Role(str, Enum):
    admin = "admin"
    user = "user"


class BatchStatus(str, Enum):
    assigned = "assigned"      # admin created & assigned to a user
    in_progress = "in_progress"  # user started processing
    completed = "completed"    # user clicked Done


class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(index=True, unique=True)
    full_name: str = ""
    password_hash: str = ""
    role: Role = Role.user
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Batch(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    drive_link: str = ""                 # Google Drive ZIP link with images
    assigned_user_id: Optional[int] = Field(default=None, foreign_key="user.id")
    status: BatchStatus = BatchStatus.assigned
    total_images: int = 0
    processed_images: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None


class Report(SQLModel, table=True):
    """A generated Amazon template / output file record."""
    id: Optional[int] = Field(default=None, primary_key=True)
    batch_id: Optional[int] = Field(default=None, foreign_key="batch.id")
    user_id: Optional[int] = Field(default=None, foreign_key="user.id")
    filename: str = ""
    file_path: str = ""                  # server-side path to the generated file
    created_at: datetime = Field(default_factory=datetime.utcnow)
