"""Gemini API key management: round-robin rotation + model-name setting.

The future Gemini pipeline should call `get_next_key(session)` for each image/request
to obtain the next enabled key (round-robin) and increment its usage counter, and
`get_model_name(session)` for the configured model. Nothing here calls Google yet —
it's the management + rotation layer, ready for the real API code to plug in.
"""
from typing import List, Optional

from sqlmodel import Session, select

from models import ApiKey, Setting, UserApiKeyLink

DEFAULT_MODEL = "gemini-2.5-flash"
MODEL_KEY = "gemini_model"
ROTATION_KEY = "rotation_index"  # base; per-user pointer is ROTATION_KEY_<user_id>


# --- settings helpers -------------------------------------------------------
def _get_setting(session: Session, key: str, default: str = "") -> str:
    row = session.get(Setting, key)
    return row.value if row else default


def _set_setting(session: Session, key: str, value: str) -> None:
    row = session.get(Setting, key)
    if row:
        row.value = value
    else:
        row = Setting(key=key, value=value)
    session.add(row)
    session.commit()


def get_model_name(session: Session) -> str:
    return _get_setting(session, MODEL_KEY, DEFAULT_MODEL)


def set_model_name(session: Session, name: str) -> None:
    _set_setting(session, MODEL_KEY, (name or DEFAULT_MODEL).strip())


# --- rotation (scoped per user) --------------------------------------------
def assigned_key_ids(session: Session, user_id: int) -> List[int]:
    links = session.exec(
        select(UserApiKeyLink).where(UserApiKeyLink.user_id == user_id)
    ).all()
    return [l.apikey_id for l in links]


def _available_for_user(session: Session, user_id: int) -> List[ApiKey]:
    ids = set(assigned_key_ids(session, user_id))
    if not ids:
        return []
    keys = session.exec(select(ApiKey).order_by(ApiKey.id)).all()
    return [
        k for k in keys
        if k.id in ids and k.enabled and (k.daily_quota == 0 or k.quota_used < k.daily_quota)
    ]


def get_next_key(session: Session, user_id: int) -> Optional[ApiKey]:
    """Return the next key (round-robin) from the keys ASSIGNED TO THIS USER.

    Only the user's assigned, enabled, non-exhausted keys are considered, with a
    rotation pointer kept separately per user. Returns None if the user has no
    usable assigned keys.
    """
    available = _available_for_user(session, user_id)
    if not available:
        return None
    rot_key = f"{ROTATION_KEY}_{user_id}"
    try:
        idx = int(_get_setting(session, rot_key, "0"))
    except ValueError:
        idx = 0
    chosen = available[idx % len(available)]
    chosen.quota_used += 1
    session.add(chosen)
    _set_setting(session, rot_key, str((idx + 1) % 1_000_000))
    session.commit()
    session.refresh(chosen)
    return chosen


# --- display helpers --------------------------------------------------------
def mask(key_value: str) -> str:
    if not key_value:
        return ""
    if len(key_value) <= 4:
        return "••••"
    return "••••" + key_value[-4:]


def status_of(k: ApiKey) -> str:
    if not k.enabled:
        return "disabled"
    if k.daily_quota and k.quota_used >= k.daily_quota:
        return "exhausted"
    return "active"


def summarize(k: ApiKey) -> dict:
    remaining = None if k.daily_quota == 0 else max(0, k.daily_quota - k.quota_used)
    return {
        "id": k.id,
        "label": k.label,
        "key_masked": mask(k.key_value),
        "enabled": k.enabled,
        "daily_quota": k.daily_quota,
        "quota_used": k.quota_used,
        "quota_remaining": remaining,   # None = unlimited
        "status": status_of(k),
    }
