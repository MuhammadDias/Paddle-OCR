"""
FastAPI web server for ai-ocr-system.

Provides an API endpoint for running the OCR pipeline on uploaded images,
returning structured results, an annotated image (Base64), and statistics.
"""

from __future__ import annotations

import base64
import logging
import time
from typing import Any

import cv2
import numpy as np
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from config.settings import DEVICE, configure_logging
from core.image_processor import preprocess_image
from core.ocr_engine import OCREngine
from core.postprocessor import postprocess_results
from core.visualizer import draw_ocr_results

# Configure system-wide logging
configure_logging()
logger = logging.getLogger("ai_ocr_system.server")

app = FastAPI(
    title="PaddleOCR API Server",
    description="Backend API for ai-ocr-system web interface.",
    version="1.0.0",
)

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for simplicity in local setups
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class TextRegion(BaseModel):
    index: int
    text: str
    confidence: float
    box: list[list[float]]


class OCRResponse(BaseModel):
    text_regions: list[TextRegion]
    annotated_image: str  # Base64 data URL
    stats: dict[str, Any]


@app.get("/api/status")
async def get_status() -> dict[str, str]:
    """Check backend status and device availability."""
    return {
        "status": "online",
        "device": DEVICE.upper(),
    }


@app.post("/api/ocr", response_model=OCRResponse)
async def process_ocr(image: UploadFile = File(...)) -> OCRResponse:
    """
    Process an uploaded image through the OCR pipeline:
    1. Read and decode image.
    2. Adaptive preprocessing (OpenCV).
    3. OCR inference (PaddleOCR).
    4. Postprocessing (Clean text & natural reading order).
    5. Draw bounding boxes (OpenCV) -> Base64.
    6. Package results and return.
    """
    start_time = time.time()
    
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
        raise HTTPException(status_code=400, detail="Invalid image file or format.")

    orig_height, orig_width = img.shape[:2]

    try:
        # 1. Preprocess
        processed = preprocess_image(img)
        
        # 2. OCR Inference
        engine = OCREngine.get_instance()
        raw_results = engine.recognize(processed)
        
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
        
        logger.info(
            "API processed OCR successfully | regions=%d | time=%.3fs",
            len(results), duration
        )
        
        return OCRResponse(
            text_regions=regions,
            annotated_image=annotated_data_url,
            stats=stats,
        )

    except Exception as exc:
        logger.exception("Unexpected error during API OCR processing")
        raise HTTPException(
            status_code=500, detail=f"OCR processing pipeline failed: {exc}"
        ) from exc


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="127.0.0.1", port=8000, reload=True)
