"""Gemini API key management: round-robin rotation + model-name setting.

The future Gemini pipeline should call `get_next_key(session)` for each image/request
to obtain the next enabled key (round-robin) and increment its usage counter, and
`get_model_name(session)` for the configured model. Nothing here calls Google yet —
it's the management + rotation layer, ready for the real API code to plug in.
"""
from typing import List, Optional

from sqlmodel import Session, select

from models import ApiKey, Setting

DEFAULT_MODEL = "gemini-2.5-flash"
MODEL_KEY = "gemini_model"
ROTATION_KEY = "rotation_index"


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


# --- rotation ---------------------------------------------------------------
def _enabled_available(session: Session) -> List[ApiKey]:
    keys = session.exec(select(ApiKey).order_by(ApiKey.id)).all()
    return [
        k for k in keys
        if k.enabled and (k.daily_quota == 0 or k.quota_used < k.daily_quota)
    ]


def get_next_key(session: Session) -> Optional[ApiKey]:
    """Return the next enabled key (round-robin) and increment its usage.

    Skips disabled and quota-exhausted keys. Returns None if none are available.
    """
    available = _enabled_available(session)
    if not available:
        return None
    try:
        idx = int(_get_setting(session, ROTATION_KEY, "0"))
    except ValueError:
        idx = 0
    chosen = available[idx % len(available)]
    chosen.quota_used += 1
    session.add(chosen)
    _set_setting(session, ROTATION_KEY, str((idx + 1) % 1_000_000))
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
