"""Image-processing endpoints.

The frontend sends the list of selected image filenames (from the folder picker),
we spin up a background job that processes them one by one, and the frontend polls
for live progress.

For the prototype we only need the filenames to drive progress + template
generation. When you wire in real Gemini + real file uploads, extend `start` to
accept the actual files (multipart) and pass their paths into the job.
"""
from typing import List, Dict, Optional, Union
from pydantic import BaseModel
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlmodel import Session

from auth import get_current_user
from database import get_session
from jobs import create_job, get_job, run_job
from models import Batch, Role, User

router = APIRouter(prefix="/processing", tags=["processing"])


class StartRequest(BaseModel):
    batch_id: Optional[int] = None
    batch_name: str = "batch"
    image_names: List[str]
    store_id: Optional[int] = None
    country: Optional[str] = None   # drives which template is used


@router.post("/start")
def start(
    body: StartRequest,
    background: BackgroundTasks,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    if not body.image_names:
        raise HTTPException(status_code=400, detail="No images provided")

    batch_name = body.batch_name
    if body.batch_id is not None:
        batch = session.get(Batch, body.batch_id)
        if not batch:
            raise HTTPException(status_code=404, detail="Batch not found")
        if user.role != Role.admin and batch.assigned_user_id != user.id:
            raise HTTPException(status_code=403, detail="Not your batch")
        batch_name = batch.name

    job = create_job(user.id, body.batch_id, batch_name, body.image_names, body.country or "")
    background.add_task(run_job, job.id)
    return {"job_id": job.id, "total": job.total}


@router.get("/status/{job_id}")
def status(job_id: str, user: User = Depends(get_current_user)):
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.user_id != user.id and user.role != Role.admin:
        raise HTTPException(status_code=403, detail="Not your job")
    return {
        "job_id": job.id,
        "status": job.status,
        "total": job.total,
        "processed": job.processed,
        "remaining": job.total - job.processed,
        "current_image": job.current_image,
        "report_id": job.report_id,
        "error": job.error,
    }
