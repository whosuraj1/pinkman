"""Google Drive tool stub (the second sidebar tool).

=====================================================================
  PLACEHOLDER. Replace with your real Google Drive API code later.
  Workflow you described:
    1. Check available storage space in the target Drive folder.
    2. Delete old images if space is needed.
    3. Upload the new images via the Drive API.
    4. Produce an XLSX with the resulting image links.
=====================================================================
"""
from typing import List, Dict, Optional, Union
import os
import time
from datetime import datetime

from openpyxl import Workbook


def check_storage() -> dict:
    """Return fake storage info. TODO: query Drive `about.get` for real quota."""
    return {"total_gb": 15, "used_gb": 9.4, "free_gb": 5.6}


def cleanup_old_images(folder_id: str) -> int:
    """Delete old images if needed. TODO: real Drive delete. Returns count deleted."""
    time.sleep(0.3)
    return 0


def upload_images_and_make_links(image_names: List[str], output_dir: str) -> dict:
    """Simulate uploading images and building the links XLSX.

    TODO: replace with real Drive uploads. Returns {"file_path", "links"}.
    """
    os.makedirs(output_dir, exist_ok=True)
    links = []
    for name in image_names:
        time.sleep(0.1)  # simulate upload
        fake_id = abs(hash(name)) % (10**11)
        links.append({"image_name": name, "drive_link": f"https://drive.google.com/uc?id={fake_id}"})

    wb = Workbook()
    ws = wb.active
    ws.title = "Image Links"
    ws.append(["image_name", "drive_link"])
    for row in links:
        ws.append([row["image_name"], row["drive_link"]])
    ws.column_dimensions["A"].width = 30
    ws.column_dimensions["B"].width = 60

    stamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    filename = f"drive_links_{stamp}.xlsx"
    path = os.path.join(output_dir, filename)
    wb.save(path)
    return {"file_path": path, "filename": filename, "links": links}
