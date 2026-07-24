"""
Exporting OCR results to disk.

Responsibilities:
    - Export results to a plain-text (.txt) file preserving reading order.
    - Export results to a structured JSON file with schema:
          {"text": ..., "confidence": ..., "bounding_box": [...], "page": ...}
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Union

from core.utils import OCRResult

logger = logging.getLogger("ai_ocr_system.exporter")

PathLike = Union[str, Path]


def results_to_records(results: list[OCRResult], page: int = 1) -> list[dict]:
    """
    Convert OCRResult objects into plain JSON-serializable dict records.

    Args:
        results: OCR results, ideally already in reading order.
        page: page number to attach to each record (for multi-page/batch
            exports where results are combined later).

    Returns:
        list[dict]: records shaped as
            {"text": str, "confidence": float, "bounding_box": [[x,y], ...], "page": int}
    """
    return [
        {
            "text": result.text,
            "confidence": round(result.confidence, 4),
            "bounding_box": result.box,
            "page": page,
        }
        for result in results
    ]


def export_to_txt(results: list[OCRResult], output_path: PathLike) -> Path:
    """
    Export OCR results to a plain-text file, one line per result, in the
    order given (should already be reading order).

    Args:
        results: OCR results to export.
        output_path: destination .txt file path. Parent directories are
            created automatically.

    Returns:
        Path: the resolved output path.
    """
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    content = "\n".join(result.text for result in results)
    output_path.write_text(content, encoding="utf-8")
    logger.info("Exported TXT: %s (%d lines)", output_path, len(results))
    return output_path


def export_to_json(
    results: list[OCRResult], output_path: PathLike, page: int = 1
) -> Path:
    """
    Export OCR results to a structured JSON file.

    Args:
        results: OCR results to export.
        output_path: destination .json file path. Parent directories are
            created automatically.
        page: page number attached to every record.

    Returns:
        Path: the resolved output path.
    """
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    records = results_to_records(results, page=page)
    output_path.write_text(
        json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    logger.info("Exported JSON: %s (%d records)", output_path, len(records))
    return output_path


def export_results(
    results: list[OCRResult],
    output_dir: PathLike,
    base_name: str,
    formats: tuple[str, ...] = ("txt", "json"),
    page: int = 1,
) -> dict[str, Path]:
    """
    Export OCR results to one or more formats in a single call.

    Args:
        results: OCR results to export.
        output_dir: destination directory. Created automatically if missing.
        base_name: filename stem used for every exported file
            (e.g. "invoice" -> "invoice.txt", "invoice.json").
        formats: which formats to export; any subset of ("txt", "json").
        page: page number attached to JSON records.

    Returns:
        dict[str, Path]: mapping of format name to the file path written.

    Raises:
        ValueError: if `formats` contains an unsupported value.
    """
    output_dir = Path(output_dir)
    exported: dict[str, Path] = {}

    for fmt in formats:
        if fmt == "txt":
            exported["txt"] = export_to_txt(results, output_dir / f"{base_name}.txt")
        elif fmt == "json":
            exported["json"] = export_to_json(
                results, output_dir / f"{base_name}.json", page=page
            )
        else:
            raise ValueError(f"Unsupported export format: {fmt!r}. Use 'txt' or 'json'.")

    return exported