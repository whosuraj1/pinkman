"""Batch endpoints.

Admin: create/assign batches (with a Google Drive ZIP link).
User: list their own batches, mark a batch done.
"""
import os
from typing import List, Dict, Optional, Union
from datetime import datetime

from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from sqlmodel import Session, select

from auth import get_current_user, require_admin
from database import get_session
from models import Batch, BatchStatus, Role, User

router = APIRouter(prefix="/batches", tags=["batches"])

# Where users' uploaded completed templates are stored on the server.
COMPLETED_DIR = "completed_uploads"


class CreateBatchRequest(BaseModel):
    name: str
    drive_link: str
    assigned_user_id: int
    total_images: int = 0


def _serialize(b: Batch, username: Optional[str] = None) -> dict:
    return {
        "id": b.id,
        "name": b.name,
        "drive_link": b.drive_link,
        "assigned_user_id": b.assigned_user_id,
        "assigned_username": username,
        "status": b.status,
        "total_images": b.total_images,
        "processed_images": b.processed_images,
        "has_template": b.has_template,
        "completed_filename": b.completed_filename,
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


def _owned_batch_or_404(batch_id: int, user: User, session: Session) -> Batch:
    batch = session.get(Batch, batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    if user.role != Role.admin and batch.assigned_user_id != user.id:
        raise HTTPException(status_code=403, detail="Not your batch")
    return batch


@router.post("/{batch_id}/upload-completed")
async def upload_completed(
    batch_id: int,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Step 4 of the workflow: the user uploads their completed Amazon template
    (with the image URLs pasted in). This must happen before Done is allowed."""
    batch = _owned_batch_or_404(batch_id, user, session)
    if not batch.has_template:
        raise HTTPException(status_code=400, detail="This batch has no generated template yet")

    os.makedirs(COMPLETED_DIR, exist_ok=True)
    safe_orig = os.path.basename(file.filename or "completed.xlsx")
    stored = f"batch_{batch_id}_completed_{safe_orig}"
    path = os.path.join(COMPLETED_DIR, stored)
    with open(path, "wb") as out:
        out.write(await file.read())

    batch.completed_file_path = path
    batch.completed_filename = safe_orig
    session.add(batch)
    session.commit()
    session.refresh(batch)
    return _serialize(batch)


@router.get("/{batch_id}/completed-file")
def download_completed(
    batch_id: int,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Re-download the uploaded completed file. Allowed for admin and the owner."""
    batch = _owned_batch_or_404(batch_id, user, session)
    if not batch.completed_file_path or not os.path.exists(batch.completed_file_path):
        raise HTTPException(status_code=404, detail="No completed file uploaded")
    return FileResponse(
        batch.completed_file_path,
        filename=batch.completed_filename or "completed.xlsx",
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


@router.post("/{batch_id}/done")
def mark_done(
    batch_id: int,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    batch = _owned_batch_or_404(batch_id, user, session)
    # New rule: Done is the FINAL step and requires the completed file to be uploaded.
    if not batch.completed_file_path:
        raise HTTPException(
            status_code=400,
            detail="Upload the completed template file before marking Done",
        )
    batch.status = BatchStatus.completed
    batch.completed_at = datetime.utcnow()
    session.add(batch)
    session.commit()
    session.refresh(batch)
    return _serialize(batch)
