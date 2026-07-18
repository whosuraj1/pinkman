"""In-memory job manager for live image-processing progress.

Each job tracks how many images are done vs. remaining so the frontend can poll
GET /processing/status/{job_id}. When a job finishes it generates the Amazon
template and records a Report row.

Note: state lives in memory, which is fine for a single-process prototype. For a
multi-worker production deploy, move this to Redis or the database.
"""
from typing import List, Dict, Optional, Union
import threading
import uuid
from dataclasses import dataclass, field
from typing import Optional

from sqlmodel import Session

from database import engine
from models import Batch, BatchStatus, Report
from services.ai_stub import analyze_image
from services.amazon_template import generate_amazon_template

OUTPUT_DIR = "generated_reports"


@dataclass
class Job:
    id: str
    user_id: int
    batch_id: Optional[int]
    batch_name: str
    image_names: List[str]
    total: int
    processed: int = 0
    status: str = "running"        # running | completed | error
    current_image: str = ""
    report_id: Optional[int] = None
    error: str = ""
    results: List[dict] = field(default_factory=list)


_jobs: Dict[str, Job] = {}
_lock = threading.Lock()


def create_job(user_id: int, batch_id: Optional[int], batch_name: str, image_names: List[str]) -> Job:
    job = Job(
        id=str(uuid.uuid4()),
        user_id=user_id,
        batch_id=batch_id,
        batch_name=batch_name,
        image_names=image_names,
        total=len(image_names),
    )
    with _lock:
        _jobs[job.id] = job
    return job


def get_job(job_id: str) -> Optional[Job]:
    return _jobs.get(job_id)


def run_job(job_id: str) -> None:
    """Runs in a background thread. Processes each image one by one."""
    job = _jobs.get(job_id)
    if not job:
        return

    # Mark the batch in progress
    if job.batch_id is not None:
        with Session(engine) as s:
            batch = s.get(Batch, job.batch_id)
            if batch and batch.status == BatchStatus.assigned:
                batch.status = BatchStatus.in_progress
                batch.total_images = job.total
                s.add(batch)
                s.commit()

    try:
        for name in job.image_names:
            job.current_image = name
            data = analyze_image(name, name)  # <-- Gemini plugs in here
            data["image_name"] = name
            job.results.append(data)
            job.processed += 1

            if job.batch_id is not None:
                with Session(engine) as s:
                    batch = s.get(Batch, job.batch_id)
                    if batch:
                        batch.processed_images = job.processed
                        s.add(batch)
                        s.commit()

        # Generate the Amazon template
        path = generate_amazon_template(job.results, OUTPUT_DIR, job.batch_name)
        filename = path.rsplit("/", 1)[-1]
        with Session(engine) as s:
            report = Report(
                batch_id=job.batch_id,
                user_id=job.user_id,
                filename=filename,
                file_path=path,
            )
            s.add(report)
            # mark the batch as having a generated template (enables the Finish step)
            if job.batch_id is not None:
                b = s.get(Batch, job.batch_id)
                if b:
                    b.has_template = True
                    s.add(b)
            s.commit()
            s.refresh(report)
            job.report_id = report.id

        job.status = "completed"
        job.current_image = ""
    except Exception as exc:  # noqa: BLE001
        job.status = "error"
        job.error = str(exc)
