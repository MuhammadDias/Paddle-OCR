"""
Visualization of OCR results.

Responsibilities:
    - Draw bounding boxes over detected text regions.
    - Overlay recognized text and confidence scores.
    - Overlay a live FPS counter for real-time mode.
"""

from __future__ import annotations

import logging

import cv2
import numpy as np

from config.settings import BOX_COLOR_BGR, BOX_THICKNESS, FONT_SCALE, TEXT_COLOR_BGR
from core.utils import OCRResult

logger = logging.getLogger("ai_ocr_system.visualizer")

_FPS_COLOR_BGR = (0, 255, 255)
_FPS_POSITION = (10, 30)


def draw_ocr_results(
    image: np.ndarray,
    results: list[OCRResult],
    draw_text: bool = True,
    draw_confidence: bool = True,
) -> np.ndarray:
    """
    Draw bounding boxes (and optionally recognized text / confidence
    scores) for a list of OCR results onto a copy of an image.

    Args:
        image: the base BGR image to annotate (not modified in place).
        results: OCR results to draw.
        draw_text: whether to overlay the recognized text.
        draw_confidence: whether to overlay the confidence score.

    Returns:
        np.ndarray: a new annotated image; `image` itself is untouched.
    """
    annotated = image.copy()

    for result in results:
        points = np.array(result.box, dtype=np.int32).reshape((-1, 1, 2))
        cv2.polylines(
            annotated, [points], isClosed=True, color=BOX_COLOR_BGR, thickness=BOX_THICKNESS
        )

        if not (draw_text or draw_confidence):
            continue

        label_parts: list[str] = []
        if draw_text:
            label_parts.append(result.text)
        if draw_confidence:
            label_parts.append(f"{result.confidence:.2f}")
        label = " | ".join(label_parts)

        x = int(min(point[0] for point in result.box))
        y = int(min(point[1] for point in result.box)) - 6
        y = max(y, 14)  # keep label on-screen if the box touches the top edge

        cv2.putText(
            annotated,
            label,
            (x, y),
            cv2.FONT_HERSHEY_SIMPLEX,
            FONT_SCALE,
            TEXT_COLOR_BGR,
            1,
            cv2.LINE_AA,
        )

    return annotated


def draw_fps(image: np.ndarray, fps: float) -> np.ndarray:
    """
    Overlay a live FPS counter onto the top-left corner of an image.

    Args:
        image: the base BGR image to annotate (not modified in place).
        fps: the current frames-per-second value to display.

    Returns:
        np.ndarray: a new annotated image; `image` itself is untouched.
    """
    annotated = image.copy()
    cv2.putText(
        annotated,
        f"FPS: {fps:.1f}",
        _FPS_POSITION,
        cv2.FONT_HERSHEY_SIMPLEX,
        0.7,
        _FPS_COLOR_BGR,
        2,
        cv2.LINE_AA,
    )
    return annotated


def save_annotated_image(image: np.ndarray, output_path: str) -> None:
    """
    Save an annotated image to disk, safely handling unicode paths.

    Args:
        image: the BGR image to save.
        output_path: destination file path.
    """
    success, buffer = cv2.imencode(".jpg", image)
    if not success:
        raise IOError(f"Failed to encode image for saving: {output_path}")
    buffer.tofile(output_path)
    logger.info("Saved annotated image: %s", output_path)