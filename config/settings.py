"""
Central configuration for the ai-ocr-system project.

This module is the single source of truth for:
    - Filesystem paths (assets, outputs, logs)
    - OCR engine configuration (language, detection/recognition/angle settings)
    - Device selection (GPU if available, otherwise CPU)
    - Adaptive preprocessing profiles for different image categories
    - Logging configuration

No other module should hardcode paths or OCR parameters — everything should
be imported from here so the whole system stays configurable from one place.
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Final


# --------------------------------------------------------------------------- #
# Base paths
# --------------------------------------------------------------------------- #

BASE_DIR: Final[Path] = Path(__file__).resolve().parent.parent
ASSETS_DIR: Final[Path] = BASE_DIR / "assets"
IMAGES_DIR: Final[Path] = ASSETS_DIR / "images"
ASSETS_OUTPUTS_DIR: Final[Path] = ASSETS_DIR / "outputs"
OUTPUTS_DIR: Final[Path] = BASE_DIR / "outputs"
LOGS_DIR: Final[Path] = BASE_DIR / "logs"

# Ensure runtime directories exist. This is safe to call multiple times.
for _dir in (ASSETS_DIR, IMAGES_DIR, ASSETS_OUTPUTS_DIR, OUTPUTS_DIR, LOGS_DIR):
    _dir.mkdir(parents=True, exist_ok=True)


# --------------------------------------------------------------------------- #
# Supported file types
# --------------------------------------------------------------------------- #

SUPPORTED_IMAGE_EXTENSIONS: Final[tuple[str, ...]] = (
    ".jpg",
    ".jpeg",
    ".png",
    ".bmp",
    ".webp",
    ".tif",
    ".tiff",
)

SUPPORTED_VIDEO_EXTENSIONS: Final[tuple[str, ...]] = (
    ".mp4",
    ".avi",
    ".mov",
    ".mkv",
)


# --------------------------------------------------------------------------- #
# Device selection (GPU if available, else CPU)
# --------------------------------------------------------------------------- #

def detect_device() -> str:
    """
    Detect whether a GPU is available for PaddlePaddle/PaddleOCR to use.

    Returns:
        str: ``"gpu"`` if a CUDA-capable device is detected and usable by
        PaddlePaddle, otherwise ``"cpu"``. Falls back to ``"cpu"`` on any
        import or runtime error so the system never crashes on machines
        without a GPU or without the GPU build of PaddlePaddle installed.
    """
    try:
        import paddle  # imported lazily so CPU-only machines don't need it configured

        if paddle.device.is_compiled_with_cuda() and paddle.device.cuda.device_count() > 0:
            return "gpu"
    except Exception:
        # Any failure (paddle missing, no CUDA build, driver issue, etc.)
        # means we safely fall back to CPU.
        pass
    return "cpu"


DEVICE: Final[str] = detect_device()
USE_GPU: Final[bool] = DEVICE == "gpu"


# --------------------------------------------------------------------------- #
# OCR engine configuration
# --------------------------------------------------------------------------- #

@dataclass(frozen=True)
class OCRConfig:
    """Configuration passed to the PaddleOCR engine."""

    lang: str = "id"  # PaddleOCR multilingual "id" model covers Indonesian; "en" also selectable
    use_angle_cls: bool = True
    use_textline_orientation: bool = True
    use_gpu: bool = USE_GPU
    det_db_box_thresh: float = 0.5
    det_db_unclip_ratio: float = 1.6
    drop_score: float = 0.5
    show_log: bool = False
    # Disabled by default: some PaddlePaddle 3.x builds crash on CPU with a
    # "ConvertPirAttribute2RuntimeAttribute ... pir::ArrayAttribute" error
    # when oneDNN (MKLDNN) acceleration is enabled for PP-OCRv6 detection.
    # Only relevant when use_gpu is False; ignored on GPU.
    enable_mkldnn: bool = False


OCR_CONFIG: Final[OCRConfig] = OCRConfig()


# --------------------------------------------------------------------------- #
# Adaptive preprocessing profiles
# --------------------------------------------------------------------------- #
# Each profile tunes how aggressively core/image_processor.py enhances an
# image before it reaches the OCR engine. The goal is "just enough"
# preprocessing per image category, never one-size-fits-all.

@dataclass(frozen=True)
class PreprocessProfile:
    """Describes how much/what kind of enhancement to apply for an image category."""

    denoise: bool = False
    deskew: bool = True
    contrast_enhance: bool = False
    adaptive_threshold: bool = False
    sharpen: bool = False
    upscale_if_small: bool = True


PREPROCESS_PROFILES: Final[dict[str, PreprocessProfile]] = {
    "document": PreprocessProfile(
        denoise=False,
        deskew=True,
        contrast_enhance=True,
        adaptive_threshold=True,
        sharpen=False,
        upscale_if_small=True,
    ),
    "screenshot": PreprocessProfile(
        denoise=False,
        deskew=False,
        contrast_enhance=False,
        adaptive_threshold=False,
        sharpen=False,
        upscale_if_small=False,
    ),
    "camera": PreprocessProfile(
        denoise=True,
        deskew=True,
        contrast_enhance=True,
        adaptive_threshold=False,
        sharpen=True,
        upscale_if_small=True,
    ),
    "outdoor": PreprocessProfile(
        denoise=True,
        deskew=True,
        contrast_enhance=True,
        adaptive_threshold=False,
        sharpen=True,
        upscale_if_small=True,
    ),
}

DEFAULT_PREPROCESS_PROFILE: Final[str] = "document"


# --------------------------------------------------------------------------- #
# Visualization / export defaults
# --------------------------------------------------------------------------- #

BOX_COLOR_BGR: Final[tuple[int, int, int]] = (0, 220, 0)
TEXT_COLOR_BGR: Final[tuple[int, int, int]] = (0, 0, 255)
BOX_THICKNESS: Final[int] = 2
FONT_SCALE: Final[float] = 0.5

EXPORT_FORMATS: Final[tuple[str, ...]] = ("txt", "json")
MAX_PDF_SIZE_MB: Final[int] = 20


# --------------------------------------------------------------------------- #
# Realtime camera defaults
# --------------------------------------------------------------------------- #

CAMERA_INDEX_DEFAULT: Final[int] = 0
REALTIME_OCR_EVERY_N_FRAMES: Final[int] = 5  # run OCR every N frames to keep FPS usable


# --------------------------------------------------------------------------- #
# Logging configuration
# --------------------------------------------------------------------------- #

LOG_LEVEL: Final[int] = logging.INFO
LOG_FORMAT: Final[str] = "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"
LOG_FILE: Final[Path] = LOGS_DIR / "ai_ocr_system.log"


def configure_logging() -> None:
    """
    Configure root logging for the whole application.

    Sets up two handlers:
        - Console handler (stdout), for interactive feedback.
        - File handler, writing to ``logs/ai_ocr_system.log`` for debugging.

    Safe to call multiple times; it will not duplicate handlers.
    """
    root_logger = logging.getLogger()
    if root_logger.handlers:
        # Already configured (e.g. re-imported); avoid duplicate handlers.
        return

    root_logger.setLevel(LOG_LEVEL)
    formatter = logging.Formatter(LOG_FORMAT)

    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    root_logger.addHandler(console_handler)

    file_handler = logging.FileHandler(LOG_FILE, encoding="utf-8")
    file_handler.setFormatter(formatter)
    root_logger.addHandler(file_handler)