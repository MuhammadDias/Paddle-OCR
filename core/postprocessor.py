"""
Post-processing of raw OCR output.

Responsibilities:
    - Clean/normalize recognized text (whitespace, stray artifacts).
    - Drop low-confidence or empty results.
    - Reconstruct natural human reading order from detection boxes, since
      raw detection order is not guaranteed to follow line-by-line,
      left-to-right reading order (especially on multi-column layouts).
"""

from __future__ import annotations

import logging
import re

from config.settings import OCR_CONFIG
from core.utils import OCRResult

logger = logging.getLogger("ai_ocr_system.postprocessor")

_WHITESPACE_RE = re.compile(r"\s+")


def clean_text(text: str) -> str:
    """
    Normalize recognized text: trim surrounding whitespace and collapse
    any run of internal whitespace into a single space.

    Args:
        text: raw recognized text.

    Returns:
        str: cleaned text.
    """
    return _WHITESPACE_RE.sub(" ", text).strip()


def _box_center(box: list[list[float]]) -> tuple[float, float]:
    """Return the (x, y) centroid of a 4-point box."""
    xs = [point[0] for point in box]
    ys = [point[1] for point in box]
    return sum(xs) / len(xs), sum(ys) / len(ys)


def _box_height(box: list[list[float]]) -> float:
    """Return the vertical extent (max y - min y) of a box."""
    ys = [point[1] for point in box]
    return max(ys) - min(ys)


def reconstruct_reading_order(
    results: list[OCRResult], line_height_tolerance: float = 0.6
) -> list[OCRResult]:
    """
    Reorder detected text regions into natural human reading order:
    top-to-bottom by line, then left-to-right within each line.

    Boxes are grouped into lines when their vertical centers fall within
    `line_height_tolerance` * average-box-height of each other, then each
    line is sorted left-to-right and lines are sorted top-to-bottom.

    Args:
        results: unordered OCR results (as produced by OCREngine.recognize).
        line_height_tolerance: fraction of the average box height used as
            the vertical-center grouping threshold. Lower values create
            more, thinner lines; higher values merge more aggressively.

    Returns:
        list[OCRResult]: the same results, reordered for natural reading.
    """
    if not results:
        return []

    heights = [_box_height(r.box) for r in results]
    avg_height = sum(heights) / len(heights) if heights else 20.0
    threshold = max(avg_height * line_height_tolerance, 1.0)

    # (center_y, center_x, result)
    items = [(*_box_center(r.box)[::-1], r) for r in results]
    items.sort(key=lambda t: t[0])

    lines: list[list[tuple[float, float, OCRResult]]] = []
    for center_y, center_x, result in items:
        placed = False
        for line in lines:
            line_avg_y = sum(t[0] for t in line) / len(line)
            if abs(center_y - line_avg_y) <= threshold:
                line.append((center_y, center_x, result))
                placed = True
                break
        if not placed:
            lines.append([(center_y, center_x, result)])

    lines.sort(key=lambda line: sum(t[0] for t in line) / len(line))

    ordered: list[OCRResult] = []
    for line in lines:
        line.sort(key=lambda t: t[1])
        ordered.extend(entry[2] for entry in line)

    return ordered


def postprocess_results(
    results: list[OCRResult], drop_score: float | None = None
) -> list[OCRResult]:
    """
    Full post-processing pass: clean text, drop empty/low-confidence
    results, then reconstruct natural reading order.

    Args:
        results: raw OCR results from OCREngine.recognize.
        drop_score: minimum confidence to keep a result. Defaults to
            config.settings.OCR_CONFIG.drop_score.

    Returns:
        list[OCRResult]: cleaned results in human reading order.
    """
    threshold = OCR_CONFIG.drop_score if drop_score is None else drop_score

    cleaned: list[OCRResult] = []
    for result in results:
        text = clean_text(result.text)
        if not text:
            continue
        if result.confidence < threshold:
            logger.debug(
                "Dropping low-confidence result: %r (%.3f < %.3f)",
                text, result.confidence, threshold,
            )
            continue
        cleaned.append(OCRResult(box=result.box, text=text, confidence=result.confidence))

    ordered = reconstruct_reading_order(cleaned)
    logger.info("Post-processing: %d raw -> %d kept", len(results), len(ordered))
    return ordered