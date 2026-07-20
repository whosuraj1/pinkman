"""User management + progress endpoints (admin only)."""
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from auth import get_current_user, hash_password, require_admin
from database import get_session
from models import Batch, BatchStatus, Role, User

router = APIRouter(prefix="/users", tags=["users"])


class CreateUserRequest(BaseModel):
    username: str
    password: str
    full_name: str = ""
    role: Role = Role.user


@router.get("")
def list_users(_: User = Depends(require_admin), session: Session = Depends(get_session)):
    users = session.exec(select(User)).all()
    return [
        {"id": u.id, "username": u.username, "full_name": u.full_name, "role": u.role}
        for u in users
    ]


@router.post("")
def create_user(
    body: CreateUserRequest,
    _: User = Depends(require_admin),
    session: Session = Depends(get_session),
):
    existing = session.exec(select(User).where(User.username == body.username)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    user = User(
        username=body.username,
        full_name=body.full_name,
        password_hash=hash_password(body.password),
        role=body.role,
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return {"id": user.id, "username": user.username, "full_name": user.full_name, "role": user.role}


@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    current: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Delete a user (admin only). Safety rules:
    - only admins may delete
    - you cannot delete your own account
    - you cannot delete the last remaining admin
    Any batches assigned to the deleted user are unassigned (kept, not deleted).
    """
    if current.role != Role.admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    target = session.get(User, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.id == current.id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")
    if target.role == Role.admin:
        admin_count = len(session.exec(select(User).where(User.role == Role.admin)).all())
        if admin_count <= 1:
            raise HTTPException(status_code=400, detail="Cannot delete the last admin")

    # Unassign this user's batches so no records point at a deleted user.
    batches = session.exec(select(Batch).where(Batch.assigned_user_id == user_id)).all()
    for b in batches:
        b.assigned_user_id = None
        session.add(b)

    # Remove this user's API-key assignments.
    from models import UserApiKeyLink
    for l in session.exec(select(UserApiKeyLink).where(UserApiKeyLink.user_id == user_id)).all():
        session.delete(l)

    session.delete(target)
    session.commit()
    return {"deleted": user_id}


@router.get("/progress")
def all_progress(_: User = Depends(require_admin), session: Session = Depends(get_session)):
    """Per-user progress summary for the admin dashboard charts."""
    users = session.exec(select(User).where(User.role == Role.user)).all()
    result = []
    for u in users:
        batches = session.exec(select(Batch).where(Batch.assigned_user_id == u.id)).all()
        total = len(batches)
        completed = sum(1 for b in batches if b.status == BatchStatus.completed)
        in_progress = sum(1 for b in batches if b.status == BatchStatus.in_progress)
        assigned = sum(1 for b in batches if b.status == BatchStatus.assigned)
        images_done = sum(b.processed_images for b in batches)
        result.append(
            {
                "user_id": u.id,
                "username": u.username,
                "full_name": u.full_name,
                "total_batches": total,
                "completed_batches": completed,
                "in_progress_batches": in_progress,
                "assigned_batches": assigned,
                "images_processed": images_done,
                "completion_pct": round((completed / total) * 100) if total else 0,
            }
        )
    return result
