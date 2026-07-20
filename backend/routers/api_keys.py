"""Admin API-key management endpoints: model name + CRUD + enable/disable + rotation.

All endpoints are admin-only. Keys are never returned in full (only masked).
"""
from typing import List, Dict, Optional, Union

from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from auth import require_admin
from database import get_session
from models import ApiKey, User, UserApiKeyLink
from services.gemini_keys import get_model_name, set_model_name, summarize, assigned_key_ids

router = APIRouter(prefix="/api-keys", tags=["api-keys"])


class ApiKeyCreate(BaseModel):
    label: str = ""
    key_value: str
    daily_quota: int = 0
    enabled: bool = True


class ApiKeyUpdate(BaseModel):
    label: Optional[str] = None
    key_value: Optional[str] = None   # blank/None = keep existing
    daily_quota: Optional[int] = None
    enabled: Optional[bool] = None


class ModelUpdate(BaseModel):
    model: str


class AssignmentUpdate(BaseModel):
    key_ids: List[int]


@router.get("")
def list_keys(_: User = Depends(require_admin), session: Session = Depends(get_session)):
    keys = session.exec(select(ApiKey).order_by(ApiKey.id)).all()
    links = session.exec(select(UserApiKeyLink)).all()
    users = {u.id: u.username for u in session.exec(select(User)).all()}
    # map key_id -> [usernames]
    by_key: Dict[int, List[str]] = {}
    for l in links:
        by_key.setdefault(l.apikey_id, []).append(users.get(l.user_id, f"user{l.user_id}"))
    result = []
    for k in keys:
        s = summarize(k)
        s["assigned_users"] = sorted(by_key.get(k.id, []))
        result.append(s)
    return {"model": get_model_name(session), "keys": result}


@router.get("/assignments/{user_id}")
def get_assignments(user_id: int, _: User = Depends(require_admin), session: Session = Depends(get_session)):
    return {"user_id": user_id, "key_ids": assigned_key_ids(session, user_id)}


@router.put("/assignments/{user_id}")
def set_assignments(
    user_id: int,
    body: AssignmentUpdate,
    _: User = Depends(require_admin),
    session: Session = Depends(get_session),
):
    target = session.get(User, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    # replace this user's links with the provided set
    existing = session.exec(select(UserApiKeyLink).where(UserApiKeyLink.user_id == user_id)).all()
    for l in existing:
        session.delete(l)
    valid_ids = {k.id for k in session.exec(select(ApiKey)).all()}
    for kid in body.key_ids:
        if kid in valid_ids:
            session.add(UserApiKeyLink(user_id=user_id, apikey_id=kid))
    session.commit()
    return {"user_id": user_id, "key_ids": assigned_key_ids(session, user_id)}


@router.put("/settings/model")
def update_model(body: ModelUpdate, _: User = Depends(require_admin), session: Session = Depends(get_session)):
    set_model_name(session, body.model)
    return {"model": get_model_name(session)}


@router.post("")
def add_key(body: ApiKeyCreate, _: User = Depends(require_admin), session: Session = Depends(get_session)):
    if not body.key_value.strip():
        raise HTTPException(status_code=400, detail="Key value is required")
    k = ApiKey(
        label=body.label.strip() or "Key",
        key_value=body.key_value.strip(),
        daily_quota=max(0, body.daily_quota),
        enabled=body.enabled,
    )
    session.add(k)
    session.commit()
    session.refresh(k)
    return summarize(k)


@router.put("/{key_id}")
def update_key(key_id: int, body: ApiKeyUpdate, _: User = Depends(require_admin), session: Session = Depends(get_session)):
    k = session.get(ApiKey, key_id)
    if not k:
        raise HTTPException(status_code=404, detail="Key not found")
    if body.label is not None:
        k.label = body.label.strip() or k.label
    if body.key_value:                       # only replace if a new value provided
        k.key_value = body.key_value.strip()
    if body.daily_quota is not None:
        k.daily_quota = max(0, body.daily_quota)
    if body.enabled is not None:
        k.enabled = body.enabled
    session.add(k)
    session.commit()
    session.refresh(k)
    return summarize(k)


@router.post("/{key_id}/reset")
def reset_quota(key_id: int, _: User = Depends(require_admin), session: Session = Depends(get_session)):
    k = session.get(ApiKey, key_id)
    if not k:
        raise HTTPException(status_code=404, detail="Key not found")
    k.quota_used = 0
    session.add(k)
    session.commit()
    session.refresh(k)
    return summarize(k)


@router.delete("/{key_id}")
def delete_key(key_id: int, _: User = Depends(require_admin), session: Session = Depends(get_session)):
    k = session.get(ApiKey, key_id)
    if not k:
        raise HTTPException(status_code=404, detail="Key not found")
    # remove any user assignments for this key
    for l in session.exec(select(UserApiKeyLink).where(UserApiKeyLink.apikey_id == key_id)).all():
        session.delete(l)
    session.delete(k)
    session.commit()
    return {"deleted": key_id}
