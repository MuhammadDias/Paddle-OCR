"""
FastAPI web server for ai-ocr-system.

Provides an API endpoint for running the OCR pipeline on uploaded images,
returning structured results, an annotated image (Base64), and statistics.
Also manages user registration, login, and OCR task history with a 1-day retention TTL.
"""

from __future__ import annotations

import base64
import logging
import time
import io
import os
import json
from typing import Any, Optional

import cv2
import numpy as np
from fastapi import FastAPI, File, HTTPException, UploadFile, Depends, Header
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from config.settings import DEVICE, configure_logging, MAX_PDF_SIZE_MB, OUTPUTS_DIR
from core.image_processor import preprocess_image
from core.ocr_engine import OCREngine
from core.postprocessor import postprocess_results
from core.visualizer import draw_ocr_results

# Database & Auth & Entities
from core.database import init_db, create_user, get_user_by_email, add_history, get_history
from core.auth import hash_password, verify_password, create_access_token, decode_access_token
from core.entity_extractor import extract_entities

# Configure system-wide logging
configure_logging()
logger = logging.getLogger("ai_ocr_system.server")

# Initialize SQLite database tables on startup
init_db()

app = FastAPI(
    title="PaddleOCR API Server",
    description="Backend API for ai-ocr-system web interface.",
    version="1.1.0",
)

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for simplicity in local setups
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------------------------------------------------------------------------- #
# Pydantic Schemas
# --------------------------------------------------------------------------- #

class TextRegion(BaseModel):
    index: int
    text: str
    confidence: float
    box: list[list[float]]


class Entities(BaseModel):
    emails: list[str]
    phones: list[str]
    currencies: list[str]
    urls: list[str]


class OCRResponse(BaseModel):
    text_regions: list[TextRegion]
    annotated_image: str  # Base64 data URL
    stats: dict[str, Any]
    entities: Entities


class UserRegister(BaseModel):
    email: str
    password: str


class UserLogin(BaseModel):
    email: str
    password: str


# --------------------------------------------------------------------------- #
# Authentication Helper
# --------------------------------------------------------------------------- #

def get_current_user(authorization: Optional[str] = Header(None)) -> Optional[dict]:
    """
    Fetch and validate the current user from the Authorization bearer token header.
    Returns the user dict if valid, else None.
    """
    if not authorization:
        return None
    try:
        if not authorization.startswith("Bearer "):
            return None
        token = authorization.split(" ")[1]
        payload = decode_access_token(token)
        if not payload or "email" not in payload:
            return None
        
        user = get_user_by_email(payload["email"])
        return dict(user) if user else None
    except Exception as exc:
        logger.error("Authentication check failed: %s", exc)
        return None


# --------------------------------------------------------------------------- #
# Endpoints
# --------------------------------------------------------------------------- #

@app.get("/api/status")
async def get_status() -> dict[str, str]:
    """Check backend status and device availability."""
    return {
        "status": "online",
        "device": DEVICE.upper(),
    }


@app.post("/api/auth/register")
async def register(user_data: UserRegister):
    """Register a new user account and return a session token."""
    email = user_data.email.strip().lower()
    password = user_data.password
    
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Alamat email tidak valid.")
    if len(password) < 6:
        raise HTTPException(status_code=400, detail="Kata sandi minimal terdiri dari 6 karakter.")
    
    try:
        hashed_pw = hash_password(password)
        user_id = create_user(email, hashed_pw)
        token = create_access_token({"sub": user_id, "email": email})
        
        return {
            "status": "success",
            "message": "Pendaftaran akun berhasil.",
            "access_token": token,
            "token_type": "bearer",
            "user": {"id": user_id, "email": email}
        }
    except ValueError as val_err:
        raise HTTPException(status_code=400, detail=str(val_err))
    except Exception as exc:
        logger.error("Registration error: %s", exc)
        raise HTTPException(status_code=500, detail="Terjadi kesalahan saat mendaftarkan akun.")


@app.post("/api/auth/login")
async def login(credentials: UserLogin):
    """Authenticate credentials and return a signed JWT token."""
    email = credentials.email.strip().lower()
    password = credentials.password
    
    user = get_user_by_email(email)
    if not user or not verify_password(password, user["hashed_password"]):
        raise HTTPException(status_code=400, detail="Email atau kata sandi tidak cocok.")
    
    token = create_access_token({"sub": user["id"], "email": user["email"]})
    return {
        "status": "success",
        "message": "Berhasil masuk.",
        "access_token": token,
        "token_type": "bearer",
        "user": {"id": user["id"], "email": user["email"]}
    }


@app.get("/api/auth/me")
async def get_me(current_user: Optional[dict] = Depends(get_current_user)):
    """Fetch current user identity if authenticated."""
    if not current_user:
        raise HTTPException(status_code=401, detail="Sesi telah kedaluwarsa. Silakan masuk kembali.")
    return {
        "id": current_user["id"],
        "email": current_user["email"]
    }


@app.get("/api/history")
async def get_user_history(current_user: Optional[dict] = Depends(get_current_user)):
    """Retrieve history of processed documents for the user (expires in 24 hours)."""
    if not current_user:
        raise HTTPException(status_code=401, detail="Sesi telah kedaluwarsa. Silakan masuk kembali.")
    try:
        history = get_history(current_user["id"])
        return history
    except Exception as exc:
        logger.error("Failed to fetch user history: %s", exc)
        raise HTTPException(status_code=500, detail="Gagal mengambil data riwayat.")


@app.post("/api/ocr-pdf")
async def process_pdf_ocr(
    file: UploadFile = File(...),
    lang: str = "id",
    current_user: Optional[dict] = Depends(get_current_user)
):
    """
    Process an uploaded PDF document:
    1. Authenticate user.
    2. Check file format.
    3. Check file size.
    4. Process page-by-page asymmetrically (native text extraction or PaddleOCR).
    5. Return streaming progress updates.
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Sesi telah kedaluwarsa. Silakan masuk kembali.")
    
    filename = file.filename or "document.pdf"
    if not filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Format berkas harus berupa PDF.")
        
    try:
        contents = await file.read()
        file_size_mb = len(contents) / (1024 * 1024)
        if file_size_mb > MAX_PDF_SIZE_MB:
            raise HTTPException(
                status_code=400,
                detail=f"Ukuran berkas PDF melebihi batas maksimum ({MAX_PDF_SIZE_MB} MB)."
            )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Failed to read PDF file: %s", exc)
        raise HTTPException(status_code=400, detail="Gagal membaca berkas PDF.")

    from core.pdf_processor import process_pdf_generator
    return StreamingResponse(
        process_pdf_generator(contents, filename, current_user["id"], lang=lang),
        media_type="application/x-ndjson"
    )


@app.post("/api/ocr", response_model=OCRResponse)
async def process_ocr(
    image: UploadFile = File(...),
    lang: str = "id",
    authorization: Optional[str] = Header(None)
) -> OCRResponse:
    """
    Process an uploaded image through the OCR pipeline:
    1. Read and decode image.
    2. Adaptive preprocessing (OpenCV).
    3. OCR inference (PaddleOCR).
    4. Postprocessing (Clean text & natural reading order).
    5. Draw bounding boxes (OpenCV) -> Base64.
    6. Extract Entities (Emails, Phones, Currency, Links).
    7. Save to History (if user is authenticated).
    8. Package results and return.
    """
    start_time = time.time()
    
    # Optional authentication check
    current_user = get_current_user(authorization)
    
    # Read uploaded file
    try:
        contents = await image.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    except Exception as exc:
        logger.error("Failed to read uploaded image file: %s", exc)
        raise HTTPException(
            status_code=400, detail=f"Failed to read image file: {exc}"
        ) from exc

    if img is None:
        logger.error("Failed to decode uploaded image")
        raise HTTPException(status_code=400, detail="Format file gambar tidak valid.")

    orig_height, orig_width = img.shape[:2]

    try:
        # 1. Preprocess
        processed = preprocess_image(img)
        
        # 2. OCR Inference
        engine = OCREngine.get_instance()
        
        # Auto detect language on scanned image
        target_lang = lang
        if target_lang == "auto":
            target_lang = "id"
            raw_results = engine.recognize(processed, lang=target_lang)
            first_page_text = " ".join([r.text for r in raw_results])
            from core.lang_detector import detect_language_from_text
            detected = detect_language_from_text(first_page_text, default_lang="id")
            if detected != target_lang:
                logger.info("Auto-detected scanned image language as %s. Re-running OCR...", detected)
                target_lang = detected
                raw_results = engine.recognize(processed, lang=target_lang)
        else:
            raw_results = engine.recognize(processed, lang=target_lang)
        
        # 3. Postprocess
        results = postprocess_results(raw_results)
        
        # Calculate processing time
        duration = time.time() - start_time
        
        # 4. Visualization (draw boxes on original image)
        annotated_img = draw_ocr_results(img, results)
        
        # Encode annotated image as Base64 JPEG
        success, encoded_buf = cv2.imencode(".jpg", annotated_img)
        if not success:
            raise IOError("Failed to encode annotated image to JPEG")
        
        base64_data = base64.b64encode(encoded_buf).decode("utf-8")
        annotated_data_url = f"data:image/jpeg;base64,{base64_data}"
        
        # 5. Format results
        regions = [
            TextRegion(
                index=idx + 1,
                text=res.text,
                confidence=float(res.confidence * 100),  # Convert to percentage
                box=res.box,
            )
            for idx, res in enumerate(results)
        ]
        
        avg_confidence = (
            sum(res.confidence for res in results) / len(results) * 100
            if results
            else 0.0
        )

        stats = {
            "total_regions": len(results),
            "average_confidence": round(avg_confidence, 2),
            "processing_time": round(duration, 3),
            "device": DEVICE.upper(),
            "resolution": f"{orig_width}x{orig_height}",
        }
        
        # 6. Extract entities (Email, Phone, Currency, Links)
        full_text = " \n ".join(res.text for res in results)
        entities_dict = extract_entities(full_text)
        entities = Entities(
            emails=entities_dict["emails"],
            phones=entities_dict["phones"],
            currencies=entities_dict["currencies"],
            urls=entities_dict["urls"]
        )
        
        ocr_response = OCRResponse(
            text_regions=regions,
            annotated_image=annotated_data_url,
            stats=stats,
            entities=entities,
        )
        
        # 7. Save to database history (if authenticated)
        if current_user:
            try:
                add_history(current_user["id"], image.filename, ocr_response.model_dump())
            except Exception as hist_err:
                logger.error("Failed to write to OCR history DB: %s", hist_err)
        
        logger.info(
            "API processed OCR successfully | regions=%d | time=%.3fs | user_authenticated=%s",
            len(results), duration, str(current_user is not None)
        )
        
        return ocr_response

    except Exception as exc:
        logger.exception("Unexpected error during API OCR processing")
        raise HTTPException(
            status_code=500, detail=f"OCR processing pipeline failed: {exc}"
        ) from exc


class ExportRequest(BaseModel):
    filename: str
    results: Any
    format: str

@app.post("/api/ocr/export")
async def export_ocr_results(payload: ExportRequest):
    filename = payload.filename
    results = payload.results
    export_format = payload.format.lower()
    
    base_filename = os.path.splitext(filename)[0]
    
    # Generate text representation
    text_content = ""
    if isinstance(results, list):
        for page in results:
            page_num = page.get("page", 1)
            text_content += f"--- Halaman {page_num} ---\n"
            text_content += page.get("text", "") + "\n\n"
    elif isinstance(results, dict):
        text_regions = results.get("text_regions", [])
        text_content = "\n".join(r.get("text", "") for r in text_regions)
        
    if export_format == "txt":
        return StreamingResponse(
            io.BytesIO(text_content.encode("utf-8")),
            media_type="text/plain",
            headers={"Content-Disposition": f"attachment; filename={base_filename}.txt"}
        )
        
    elif export_format == "json":
        json_bytes = json.dumps(results, indent=2, ensure_ascii=False).encode("utf-8")
        return StreamingResponse(
            io.BytesIO(json_bytes),
            media_type="application/json",
            headers={"Content-Disposition": f"attachment; filename={base_filename}.json"}
        )
        
    elif export_format == "docx":
        from core.exporter import generate_docx_bytes
        docx_bytes = generate_docx_bytes(results)
        return StreamingResponse(
            io.BytesIO(docx_bytes),
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f"attachment; filename={base_filename}.docx"}
        )
        
    elif export_format == "pdf":
        pdf_path = OUTPUTS_DIR / f"{base_filename}_searchable.pdf"
        if not pdf_path.exists():
            raise HTTPException(status_code=404, detail="Berkas Searchable PDF tidak ditemukan untuk dokumen ini.")
            
        return FileResponse(
            pdf_path,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={base_filename}_searchable.pdf"}
        )
        
    elif export_format == "zip":
        from core.exporter import generate_docx_bytes, generate_zip_bytes
        docx_bytes = generate_docx_bytes(results)
        
        pdf_path = OUTPUTS_DIR / f"{base_filename}_searchable.pdf"
        pdf_bytes = None
        if pdf_path.exists():
            try:
                with open(pdf_path, "rb") as f:
                    pdf_bytes = f.read()
            except Exception as e:
                logger.error("Failed to read searchable PDF for ZIP: %s", e)
                
        zip_bytes = generate_zip_bytes(
            filename=filename,
            text_content=text_content,
            json_data=results,
            docx_bytes=docx_bytes,
            pdf_bytes=pdf_bytes
        )
        return StreamingResponse(
            io.BytesIO(zip_bytes),
            media_type="application/zip",
            headers={"Content-Disposition": f"attachment; filename={base_filename}_all_formats.zip"}
        )
        
    else:
        raise HTTPException(status_code=400, detail="Format ekspor tidak didukung.")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="127.0.0.1", port=8000, reload=True)
