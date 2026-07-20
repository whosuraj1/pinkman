"""Store management: admin CRUD + per-user assignment, and /mine for the user's stores.

A store's `country` determines the output template (UAE store -> UAE template, etc.).
Users can only generate files for stores assigned to them.
"""
from typing import List, Dict, Optional, Union

from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from auth import get_current_user, require_admin
from database import get_session
from models import Store, User, UserStoreLink

router = APIRouter(prefix="/stores", tags=["stores"])

# Countries a store can belong to (each maps to a template). Extend later.
COUNTRIES = ["UAE", "India"]


class StoreCreate(BaseModel):
    name: str
    country: str
    user_ids: List[int] = []


class StoreUpdate(BaseModel):
    name: Optional[str] = None
    country: Optional[str] = None
    user_ids: Optional[List[int]] = None   # None = leave assignments unchanged


def _set_store_users(session: Session, store_id: int, user_ids: List[int]) -> None:
    for l in session.exec(select(UserStoreLink).where(UserStoreLink.store_id == store_id)).all():
        session.delete(l)
    valid = {u.id for u in session.exec(select(User)).all()}
    for uid in set(user_ids):
        if uid in valid:
            session.add(UserStoreLink(user_id=uid, store_id=store_id))


def _assigned(session: Session):
    links = session.exec(select(UserStoreLink)).all()
    users = {u.id: u.username for u in session.exec(select(User)).all()}
    names: Dict[int, List[str]] = {}
    ids: Dict[int, List[int]] = {}
    for l in links:
        names.setdefault(l.store_id, []).append(users.get(l.user_id, f"user{l.user_id}"))
        ids.setdefault(l.store_id, []).append(l.user_id)
    return names, ids


@router.get("")
def list_stores(_: User = Depends(require_admin), session: Session = Depends(get_session)):
    stores = session.exec(select(Store).order_by(Store.id)).all()
    names, ids = _assigned(session)
    return [
        {
            "id": s.id, "name": s.name, "country": s.country,
            "assigned_users": sorted(names.get(s.id, [])),
            "assigned_user_ids": sorted(ids.get(s.id, [])),
        }
        for s in stores
    ]


@router.get("/mine")
def my_stores(user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    """Stores assigned to the current user (used by MrWhite AI)."""
    links = session.exec(select(UserStoreLink).where(UserStoreLink.user_id == user.id)).all()
    ids = {l.store_id for l in links}
    stores = session.exec(select(Store).order_by(Store.id)).all()
    return [
        {"id": s.id, "name": s.name, "country": s.country}
        for s in stores if s.id in ids
    ]


@router.post("")
def create_store(body: StoreCreate, _: User = Depends(require_admin), session: Session = Depends(get_session)):
    if not body.name.strip():
        raise HTTPException(status_code=400, detail="Store name is required")
    if body.country not in COUNTRIES:
        raise HTTPException(status_code=400, detail=f"Country must be one of {COUNTRIES}")
    s = Store(name=body.name.strip(), country=body.country)
    session.add(s)
    session.commit()
    session.refresh(s)
    _set_store_users(session, s.id, body.user_ids)
    session.commit()
    return {"id": s.id, "name": s.name, "country": s.country}


@router.put("/{store_id}")
def update_store(store_id: int, body: StoreUpdate, _: User = Depends(require_admin), session: Session = Depends(get_session)):
    s = session.get(Store, store_id)
    if not s:
        raise HTTPException(status_code=404, detail="Store not found")
    if body.name is not None:
        s.name = body.name.strip() or s.name
    if body.country is not None:
        if body.country not in COUNTRIES:
            raise HTTPException(status_code=400, detail=f"Country must be one of {COUNTRIES}")
        s.country = body.country
    session.add(s)
    if body.user_ids is not None:
        _set_store_users(session, store_id, body.user_ids)
    session.commit()
    return {"id": s.id, "name": s.name, "country": s.country}


@router.delete("/{store_id}")
def delete_store(store_id: int, _: User = Depends(require_admin), session: Session = Depends(get_session)):
    s = session.get(Store, store_id)
    if not s:
        raise HTTPException(status_code=404, detail="Store not found")
    for l in session.exec(select(UserStoreLink).where(UserStoreLink.store_id == store_id)).all():
        session.delete(l)
    session.delete(s)
    session.commit()
    return {"deleted": store_id}


@router.get("/countries")
def countries(_: User = Depends(require_admin)):
    return COUNTRIES
