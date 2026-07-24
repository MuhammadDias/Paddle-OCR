"""
ai-ocr-system — main CLI entry point.

Supported invocations:
    python app.py --image path/to/image.jpg
    python app.py --folder assets/images
    python app.py --camera
    python app.py --video path/to/video.mp4

This file is responsible ONLY for:
    - Parsing and validating CLI arguments.
    - Wiring the pipeline together (image_loader -> image_processor ->
      ocr_engine -> postprocessor -> visualizer -> exporter / realtime).
    - Top-level error handling and logging.

It intentionally contains no business logic itself — every pipeline stage
lives in its own module under core/, following the Single Responsibility
Principle.
"""

from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

from config.settings import (
    ASSETS_OUTPUTS_DIR,
    CAMERA_INDEX_DEFAULT,
    DEVICE,
    OUTPUTS_DIR,
    SUPPORTED_IMAGE_EXTENSIONS,
    SUPPORTED_VIDEO_EXTENSIONS,
    configure_logging,
)
from core.exporter import export_results
from core.image_loader import load_image, load_images_from_folder, open_camera, open_video
from core.image_processor import preprocess_image
from core.ocr_engine import OCREngine
from core.postprocessor import postprocess_results
from core.realtime import run_stream
from core.visualizer import draw_ocr_results, save_annotated_image

logger = logging.getLogger("ai_ocr_system.app")

_EXPORT_FORMAT_MAP: dict[str, tuple[str, ...]] = {
    "txt": ("txt",),
    "json": ("json",),
    "both": ("txt", "json"),
}


def build_arg_parser() -> argparse.ArgumentParser:
    """
    Build the CLI argument parser for app.py.

    Returns:
        argparse.ArgumentParser: parser configured with a mutually exclusive
        group covering the four supported input modes (image, folder,
        camera, video), so exactly one input source can be selected per run.
    """
    parser = argparse.ArgumentParser(
        prog="app.py",
        description=(
            "ai-ocr-system: modular OCR pipeline (OpenCV + PaddleOCR) for "
            "documents, certificates, books, ID cards, screenshots, posters, "
            "banners, signage, product packaging, brochures, and real-time "
            "camera text recognition (Indonesian & English)."
        ),
    )

    source_group = parser.add_mutually_exclusive_group(required=True)
    source_group.add_argument(
        "--image",
        type=str,
        metavar="PATH",
        help="Path to a single image file to run OCR on.",
    )
    source_group.add_argument(
        "--folder",
        type=str,
        metavar="PATH",
        help="Path to a folder containing images to run OCR on in batch.",
    )
    source_group.add_argument(
        "--camera",
        action="store_true",
        help="Run real-time OCR using the default connected camera.",
    )
    source_group.add_argument(
        "--video",
        type=str,
        metavar="PATH",
        help="Path to a video file to run frame-by-frame OCR on.",
    )

    parser.add_argument(
        "--export",
        type=str,
        choices=["txt", "json", "both"],
        default="both",
        help="Export format for OCR results (default: both).",
    )

    return parser


def validate_image_path(path_str: str) -> Path:
    """
    Validate that a given path points to an existing, supported image file.

    Args:
        path_str: Path provided via --image.

    Returns:
        Path: the validated, resolved path.

    Raises:
        FileNotFoundError: if the path does not exist.
        ValueError: if the file extension is not a supported image type.
    """
    path = Path(path_str).expanduser().resolve()
    if not path.is_file():
        raise FileNotFoundError(f"Image file not found: {path}")
    if path.suffix.lower() not in SUPPORTED_IMAGE_EXTENSIONS:
        raise ValueError(
            f"Unsupported image extension '{path.suffix}'. "
            f"Supported: {SUPPORTED_IMAGE_EXTENSIONS}"
        )
    return path


def validate_folder_path(path_str: str) -> Path:
    """
    Validate that a given path points to an existing folder.

    Args:
        path_str: Path provided via --folder.

    Returns:
        Path: the validated, resolved directory path.

    Raises:
        FileNotFoundError: if the folder does not exist.
        NotADirectoryError: if the path exists but is not a directory.
    """
    path = Path(path_str).expanduser().resolve()
    if not path.exists():
        raise FileNotFoundError(f"Folder not found: {path}")
    if not path.is_dir():
        raise NotADirectoryError(f"Path is not a folder: {path}")
    return path


def validate_video_path(path_str: str) -> Path:
    """
    Validate that a given path points to an existing, supported video file.

    Args:
        path_str: Path provided via --video.

    Returns:
        Path: the validated, resolved path.

    Raises:
        FileNotFoundError: if the path does not exist.
        ValueError: if the file extension is not a supported video type.
    """
    path = Path(path_str).expanduser().resolve()
    if not path.is_file():
        raise FileNotFoundError(f"Video file not found: {path}")
    if path.suffix.lower() not in SUPPORTED_VIDEO_EXTENSIONS:
        raise ValueError(
            f"Unsupported video extension '{path.suffix}'. "
            f"Supported: {SUPPORTED_VIDEO_EXTENSIONS}"
        )
    return path


def run_on_image(path: Path, export_format: str) -> None:
    """
    Run the full OCR pipeline on a single image: load -> preprocess ->
    recognize -> post-process -> visualize -> export.

    Args:
        path: validated path to the image file.
        export_format: one of "txt", "json", "both".
    """
    logger.info("Mode: single image | path=%s | export=%s", path, export_format)

    image = load_image(path)
    processed = preprocess_image(image)

    engine = OCREngine.get_instance()
    raw_results = engine.recognize(processed)
    results = postprocess_results(raw_results)

    annotated = draw_ocr_results(image, results)
    annotated_path = ASSETS_OUTPUTS_DIR / f"{path.stem}_annotated.jpg"
    save_annotated_image(annotated, str(annotated_path))

    exported = export_results(
        results, OUTPUTS_DIR, base_name=path.stem, formats=_EXPORT_FORMAT_MAP[export_format]
    )
    logger.info(
        "Done: %d text region(s) recognized | annotated=%s | exported=%s",
        len(results), annotated_path, exported,
    )


def run_on_folder(path: Path, export_format: str) -> None:
    """
    Run the full OCR pipeline on every supported image inside a folder
    (batch mode). Unreadable files are skipped (see core.image_loader).

    Args:
        path: validated path to the folder.
        export_format: one of "txt", "json", "both".
    """
    logger.info("Mode: folder batch | path=%s | export=%s", path, export_format)

    engine = OCREngine.get_instance()
    processed_count = 0

    for image_path, image in load_images_from_folder(path):
        processed = preprocess_image(image)
        raw_results = engine.recognize(processed)
        results = postprocess_results(raw_results)

        annotated = draw_ocr_results(image, results)
        annotated_path = ASSETS_OUTPUTS_DIR / f"{image_path.stem}_annotated.jpg"
        save_annotated_image(annotated, str(annotated_path))

        exported = export_results(
            results,
            OUTPUTS_DIR,
            base_name=image_path.stem,
            formats=_EXPORT_FORMAT_MAP[export_format],
        )
        logger.info(
            "%s: %d text region(s) | exported=%s", image_path.name, len(results), exported
        )
        processed_count += 1

    logger.info("Batch complete: %d image(s) processed.", processed_count)


def run_camera(export_format: str) -> None:
    """
    Run real-time OCR from the default connected camera. Press 'q' in the
    display window to quit, or 's' to export a snapshot of the current
    results.

    Args:
        export_format: one of "txt", "json", "both" (used for snapshots).
    """
    logger.info("Mode: real-time camera | export=%s", export_format)
    capture = open_camera(CAMERA_INDEX_DEFAULT)
    engine = OCREngine.get_instance()
    run_stream(capture, engine=engine, export_dir=OUTPUTS_DIR)


def run_on_video(path: Path, export_format: str) -> None:
    """
    Run the OCR pipeline frame-by-frame on a video file. Press 'q' in the
    display window to quit, or 's' to export a snapshot of the current
    results.

    Args:
        path: validated path to the video file.
        export_format: one of "txt", "json", "both" (used for snapshots).
    """
    logger.info("Mode: video file | path=%s | export=%s", path, export_format)
    capture = open_video(path)
    engine = OCREngine.get_instance()
    run_stream(capture, engine=engine, export_dir=OUTPUTS_DIR)


def main() -> int:
    """
    Entry point: parse arguments, validate the selected input source, and
    dispatch to the corresponding pipeline runner.

    Returns:
        int: process exit code (0 on success, 1 on handled error).
    """
    configure_logging()
    logger.info("ai-ocr-system starting up | device=%s", DEVICE.upper())

    parser = build_arg_parser()
    args = parser.parse_args()

    try:
        if args.image:
            image_path = validate_image_path(args.image)
            run_on_image(image_path, args.export)
        elif args.folder:
            folder_path = validate_folder_path(args.folder)
            run_on_folder(folder_path, args.export)
        elif args.camera:
            run_camera(args.export)
        elif args.video:
            video_path = validate_video_path(args.video)
            run_on_video(video_path, args.export)
        else:
            # argparse's mutually exclusive `required=True` group makes this
            # unreachable in practice, but it's kept as a defensive guard.
            parser.print_help()
            return 1
    except (FileNotFoundError, NotADirectoryError, ValueError) as exc:
        logger.error("Invalid input: %s", exc)
        return 1
    except Exception:  # noqa: BLE001 - top-level safety net for CLI usage
        logger.exception("Unexpected error while running ai-ocr-system")
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())