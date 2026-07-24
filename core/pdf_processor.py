"""
PDF processing pipeline.

Responsible for:
1. Opening and validating PDF files (handling corruption, empty, or encrypted PDFs).
2. Rendering each page to an image.
3. Checking if a page has a native text layer.
4. Extracting text directly from the text layer, or falling back to OpenCV preprocessing + PaddleOCR if scanned.
5. Saving output as TXT and JSON files on backend.
6. Yielding NDJSON chunks for real-time progress monitoring in the frontend.
"""

from __future__ import annotations

import base64
import json
import logging
import os
from typing import Generator, Optional

import cv2
import fitz  # PyMuPDF
import numpy as np

from config.settings import OUTPUTS_DIR
from core.image_processor import preprocess_image
from core.ocr_engine import OCREngine
from core.postprocessor import postprocess_results
from core.visualizer import draw_ocr_results

logger = logging.getLogger("ai_ocr_system.pdf_processor")


def process_pdf_generator(pdf_bytes: bytes, filename: str, user_id: Optional[int] = None) -> Generator[str, None, None]:
    """
    Process a PDF file page by page, streaming progress as line-delimited JSON.

    Yields:
        str: NDJSON string representing progress or results.
    """
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    except Exception as e:
        logger.error("Corrupted PDF: %s", e)
        yield json.dumps({"status": "error", "message": "File PDF rusak atau tidak valid."}) + "\n"
        return

    if len(doc) == 0:
        yield json.dumps({"status": "error", "message": "Dokumen PDF kosong."}) + "\n"
        return

    if doc.is_encrypted:
        yield json.dumps({"status": "error", "message": "Dokumen PDF dilindungi sandi (password-protected)."}) + "\n"
        return

    total_pages = len(doc)
    yield json.dumps({"status": "start", "total_pages": total_pages}) + "\n"

    results = []

    for page_idx in range(total_pages):
        try:
            page = doc.load_page(page_idx)
            text = page.get_text("text").strip()

            # Render page preview image at 150 DPI
            pix = page.get_pixmap(dpi=150)
            
            if len(text) > 0:
                # Page has a native text layer
                source = "text_layer"
                blocks = []
                
                # Convert raw page image directly to Base64 (unannotated)
                img_data = pix.tobytes("jpg")
                base64_preview = "data:image/jpeg;base64," + base64.b64encode(img_data).decode("utf-8")
                
                yield json.dumps({
                    "status": "progress",
                    "page": page_idx + 1,
                    "total": total_pages,
                    "source": source
                }) + "\n"
            else:
                # Scanned/image page - convert pixmap to BGR numpy array
                source = "ocr"
                img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)
                if pix.n == 4:
                    img = cv2.cvtColor(img, cv2.COLOR_RGBA2BGR)
                else:
                    img = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)
                
                processed = preprocess_image(img)
                
                engine = OCREngine.get_instance()
                raw_results = engine.recognize(processed)
                ocr_results = postprocess_results(raw_results)
                
                # Reconstruct full text
                text = " \n ".join(r.text for r in ocr_results)
                
                # Map to standard JSON block structure
                blocks = [
                    {
                        "index": idx + 1,
                        "text": r.text,
                        "confidence": round(r.confidence * 100, 2),
                        "box": r.box
                    }
                    for idx, r in enumerate(ocr_results)
                ]
                
                # Render annotated page image
                annotated_img = draw_ocr_results(img, ocr_results)
                success, encoded_buf = cv2.imencode(".jpg", annotated_img)
                if success:
                    base64_preview = "data:image/jpeg;base64," + base64.b64encode(encoded_buf).decode("utf-8")
                else:
                    img_data = pix.tobytes("jpg")
                    base64_preview = "data:image/jpeg;base64," + base64.b64encode(img_data).decode("utf-8")
                
                yield json.dumps({
                    "status": "progress",
                    "page": page_idx + 1,
                    "total": total_pages,
                    "source": source
                }) + "\n"
            
            page_data = {
                "page": page_idx + 1,
                "source": source,
                "text": text,
                "blocks": blocks,
                "preview_image": base64_preview
            }
            results.append(page_data)

        except Exception as page_err:
            logger.error("Error processing PDF page %d: %s", page_idx + 1, page_err)
            yield json.dumps({
                "status": "progress",
                "page": page_idx + 1,
                "total": total_pages,
                "source": "error"
            }) + "\n"
            
            page_data = {
                "page": page_idx + 1,
                "source": "error",
                "text": f"Gagal mengekstrak teks pada halaman {page_idx + 1}: {page_err}",
                "blocks": [],
                "preview_image": ""
            }
            results.append(page_data)

    # Save compile outputs to local server disk (outputs/)
    base_filename = os.path.splitext(filename)[0]
    txt_path = OUTPUTS_DIR / f"{base_filename}.txt"
    json_path = OUTPUTS_DIR / f"{base_filename}.json"
    
    # Save TXT compiled file
    try:
        with open(txt_path, "w", encoding="utf-8") as f:
            for res in results:
                f.write(f"--- Halaman {res['page']} ---\n")
                f.write(res["text"] + "\n\n")
    except Exception as e:
        logger.error("Failed to write PDF TXT output file: %s", e)

    # Save JSON data structure (compact version, omitting preview images)
    try:
        clean_results = [
            {
                "page": r["page"],
                "source": r["source"],
                "text": r["text"],
                "blocks": r["blocks"]
            }
            for r in results
        ]
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(clean_results, f, indent=2, ensure_ascii=False)
    except Exception as e:
        logger.error("Failed to write PDF JSON output file: %s", e)

    # Save to SQLite database ocr_history (if authenticated)
    if user_id:
        try:
            from core.database import add_history
            total_regions = sum(len(r["blocks"]) for r in results)
            add_history(user_id, filename, {
                "is_pdf": True,
                "pages": results,
                "stats": {
                    "total_regions": total_regions,
                    "total_pages": len(results)
                }
            })
            logger.info("Successfully saved PDF OCR result to database history for user ID %d", user_id)
        except Exception as db_err:
            logger.error("Failed to save PDF OCR result to database history: %s", db_err)

    yield json.dumps({"status": "completed", "results": results}) + "\n"
