"""Reports endpoints: list generated Amazon templates and download them.

Admin sees all reports; a user sees only their own.
"""
import os

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlmodel import Session, select

from auth import get_current_user
from database import get_session
from models import Report, Role, User

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("")
def list_reports(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    if user.role == Role.admin:
        reports = session.exec(select(Report)).all()
    else:
        reports = session.exec(select(Report).where(Report.user_id == user.id)).all()

    users = {u.id: u.username for u in session.exec(select(User)).all()}
    return [
        {
            "id": r.id,
            "filename": r.filename,
            "batch_id": r.batch_id,
            "user_id": r.user_id,
            "username": users.get(r.user_id),
            "created_at": r.created_at.isoformat(),
        }
        for r in reports
    ]


@router.get("/{report_id}/download")
def download_report(
    report_id: int,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    report = session.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    if user.role != Role.admin and report.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not your report")
    if not os.path.exists(report.file_path):
        raise HTTPException(status_code=404, detail="File missing on server")
    return FileResponse(
        report.file_path,
        filename=report.filename,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
