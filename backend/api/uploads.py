from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from fastapi.responses import FileResponse
from models.user import User
from api.admin import admin_required
import os
import uuid
from typing import List

router = APIRouter()

UPLOAD_DIR = "media"
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
MAX_IMAGE_SIZE = 5 * 1024 * 1024  # 5MB

os.makedirs(f"{UPLOAD_DIR}/archives", exist_ok=True)
os.makedirs(f"{UPLOAD_DIR}/images", exist_ok=True)


@router.post("/archive")
async def upload_archive(
        file: UploadFile = File(...),
        admin_check: User = Depends(admin_required)
):
    """Завантажити архів"""

    file_ext = os.path.splitext(file.filename)[1].lower()
    if file_ext not in [".rar", ".zip", ".7z"]:
        raise HTTPException(400, "Дозволені тільки .rar, .zip, .7z")

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(400, f"Максимум {MAX_FILE_SIZE // 1024 // 1024}MB")

    filename = f"{uuid.uuid4()}{file_ext}"
    path = f"{UPLOAD_DIR}/archives/{filename}"

    with open(path, 'wb') as f:
        f.write(contents)

    return {
        "success": True,
        "file_path": path,
        "file_size": len(contents),
        "original_name": file.filename
    }


@router.post("/images")
async def upload_images(
        files: List[UploadFile] = File(...),
        admin_check: User = Depends(admin_required)
):
    """Завантажити зображення"""

    if len(files) > 10:
        raise HTTPException(400, "Максимум 10 зображень")

    uploaded = []

    for file in files:
        file_ext = os.path.splitext(file.filename)[1].lower()
        if file_ext not in [".jpg", ".jpeg", ".png", ".webp"]:
            continue

        contents = await file.read()
        if len(contents) > MAX_IMAGE_SIZE:
            continue

        filename = f"{uuid.uuid4()}{file_ext}"
        path = f"{UPLOAD_DIR}/images/{filename}"

        with open(path, 'wb') as f:
            f.write(contents)

        uploaded.append(path)

    return {
        "success": True,
        "image_paths": uploaded,
        "count": len(uploaded)
    }