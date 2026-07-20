"""Admin API-key management endpoints: model name + CRUD + enable/disable + rotation.

All endpoints are admin-only. Keys are never returned in full (only masked).
"""
from typing import List, Dict, Optional, Union

from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from auth import require_admin
from database import get_session
from models import ApiKey, User
from services.gemini_keys import get_model_name, set_model_name, summarize

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


@router.get("")
def list_keys(_: User = Depends(require_admin), session: Session = Depends(get_session)):
    keys = session.exec(select(ApiKey).order_by(ApiKey.id)).all()
    return {
        "model": get_model_name(session),
        "keys": [summarize(k) for k in keys],
    }


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
    session.delete(k)
    session.commit()
    return {"deleted": key_id}
