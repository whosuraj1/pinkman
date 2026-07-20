"""FastAPI application entrypoint.

Run locally:
    uvicorn main:app --reload

Run on your Oracle server (example):
    uvicorn main:app --host 0.0.0.0 --port 8000
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select

from auth import hash_password
from config import settings
from database import engine, init_db
from models import Role, User
from routers import auth, batches, processing, reports, tools, users, api_keys, stores


def seed_admin() -> None:
    """Create the default admin account if no users exist yet."""
    with Session(engine) as session:
        existing = session.exec(select(User)).first()
        if existing:
            return
        admin = User(
            username=settings.default_admin_username,
            full_name="Administrator",
            password_hash=hash_password(settings.default_admin_password),
            role=Role.admin,
        )
        session.add(admin)
        # a demo employee so the dashboards aren't empty
        demo = User(
            username="employee1",
            full_name="Demo Employee",
            password_hash=hash_password("employee123"),
            role=Role.user,
        )
        session.add(demo)
        session.commit()
        print(
            f"[seed] created admin '{settings.default_admin_username}' "
            f"and demo user 'employee1'"
        )


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    seed_admin()
    yield


app = FastAPI(title="Pinkman API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(batches.router)
app.include_router(processing.router)
app.include_router(reports.router)
app.include_router(tools.router)
app.include_router(api_keys.router)
app.include_router(stores.router)


@app.get("/")
def root():
    return {"name": "Pinkman API", "status": "ok"}


@app.get("/health")
def health():
    return {"status": "healthy"}
