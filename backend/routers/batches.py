"""Batch endpoints.

Admin: create/assign batches (with a Google Drive ZIP link).
User: list their own batches, mark a batch done.
"""
from datetime import datetime

from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from auth import get_current_user, require_admin
from database import get_session
from models import Batch, BatchStatus, Role, User

router = APIRouter(prefix="/batches", tags=["batches"])


class CreateBatchRequest(BaseModel):
    name: str
    drive_link: str
    assigned_user_id: int
    total_images: int = 0


def _serialize(b: Batch, username: str | None = None) -> dict:
    return {
        "id": b.id,
        "name": b.name,
        "drive_link": b.drive_link,
        "assigned_user_id": b.assigned_user_id,
        "assigned_username": username,
        "status": b.status,
        "total_images": b.total_images,
        "processed_images": b.processed_images,
        "created_at": b.created_at.isoformat(),
        "completed_at": b.completed_at.isoformat() if b.completed_at else None,
    }


@router.post("")
def create_batch(
    body: CreateBatchRequest,
    _: User = Depends(require_admin),
    session: Session = Depends(get_session),
):
    target = session.get(User, body.assigned_user_id)
    if not target:
        raise HTTPException(status_code=404, detail="Assigned user not found")
    batch = Batch(
        name=body.name,
        drive_link=body.drive_link,
        assigned_user_id=body.assigned_user_id,
        total_images=body.total_images,
    )
    session.add(batch)
    session.commit()
    session.refresh(batch)
    return _serialize(batch, target.username)


@router.get("")
def list_batches(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Admin sees all batches; a user sees only their own."""
    if user.role == Role.admin:
        batches = session.exec(select(Batch)).all()
    else:
        batches = session.exec(select(Batch).where(Batch.assigned_user_id == user.id)).all()

    # map user ids -> usernames for display
    users = {u.id: u.username for u in session.exec(select(User)).all()}
    return [_serialize(b, users.get(b.assigned_user_id)) for b in batches]


@router.post("/{batch_id}/done")
def mark_done(
    batch_id: int,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    batch = session.get(Batch, batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    if user.role != Role.admin and batch.assigned_user_id != user.id:
        raise HTTPException(status_code=403, detail="Not your batch")
    # Only allow Done after processing is complete.
    if batch.total_images == 0 or batch.processed_images < batch.total_images:
        raise HTTPException(status_code=400, detail="Processing not complete yet")
    batch.status = BatchStatus.completed
    batch.completed_at = datetime.utcnow()
    session.add(batch)
    session.commit()
    session.refresh(batch)
    return _serialize(batch)
