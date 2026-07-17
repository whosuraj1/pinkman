"""The second sidebar tool: upload images to Google Drive + get a links XLSX.

Prototype only — wraps drive_stub. Real Drive API code plugs into services/drive_stub.py.
"""
import os

from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse

from auth import get_current_user
from models import User
from services.drive_stub import check_storage, cleanup_old_images, upload_images_and_make_links

router = APIRouter(prefix="/tools/drive", tags=["tools"])

OUTPUT_DIR = "generated_reports"


class UploadRequest(BaseModel):
    folder_id: str = ""
    image_names: list[str]
    cleanup_if_needed: bool = True


@router.get("/storage")
def storage(_: User = Depends(get_current_user)):
    return check_storage()


@router.post("/upload")
def upload(body: UploadRequest, _: User = Depends(get_current_user)):
    if not body.image_names:
        raise HTTPException(status_code=400, detail="No images provided")
    deleted = 0
    if body.cleanup_if_needed:
        deleted = cleanup_old_images(body.folder_id)
    result = upload_images_and_make_links(body.image_names, OUTPUT_DIR)
    return {
        "deleted_old_images": deleted,
        "uploaded": len(body.image_names),
        "links_file": result["filename"],
        "links": result["links"],
    }


@router.get("/download/{filename}")
def download_links(filename: str, _: User = Depends(get_current_user)):
    # Basic path-traversal guard
    safe = os.path.basename(filename)
    path = os.path.join(OUTPUT_DIR, safe)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(
        path,
        filename=safe,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
