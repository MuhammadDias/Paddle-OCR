"""
Image/video/camera loading and validation.

Responsibilities:
    - Load a single image from a file path.
    - List/iterate all valid images inside a folder (batch mode).
    - Open a camera stream for real-time capture.
    - Open a video file for frame-by-frame processing.
    - Validate that loaded input is a proper, non-corrupt image/frame.

All loading functions here raise clear, specific exceptions on invalid
input so callers (app.py, core/realtime.py) can handle errors predictably.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Iterator, Optional, Union

import cv2
import numpy as np

from config.settings import SUPPORTED_IMAGE_EXTENSIONS

logger = logging.getLogger("ai_ocr_system.image_loader")

PathLike = Union[str, Path]


def validate_image(image: Optional[np.ndarray], source: str = "") -> np.ndarray:
    """
    Validate that a decoded image array is usable.

    Args:
        image: the decoded image array, or None if decoding failed.
        source: a human-readable identifier (path or description) used in
            error messages.

    Returns:
        np.ndarray: the same image, once validated.

    Raises:
        ValueError: if the image is None, empty, or has an unexpected
            number of dimensions.
    """
    if image is None:
        raise ValueError(f"Failed to load image (decoded to None): {source}")
    if image.size == 0:
        raise ValueError(f"Loaded image is empty: {source}")
    if image.ndim not in (2, 3):
        raise ValueError(f"Unexpected image dimensionality {image.ndim}: {source}")
    return image


def load_image(path: PathLike) -> np.ndarray:
    """
    Load and validate a single image from disk.

    Uses np.fromfile + cv2.imdecode (instead of cv2.imread) so that
    non-ASCII / unicode file paths are handled correctly on all platforms.

    Args:
        path: path to the image file.

    Returns:
        np.ndarray: the loaded BGR image.

    Raises:
        FileNotFoundError: if the path does not exist.
        ValueError: if the extension is unsupported or the file is corrupt.
    """
    path = Path(path)
    if not path.is_file():
        raise FileNotFoundError(f"Image file not found: {path}")
    if path.suffix.lower() not in SUPPORTED_IMAGE_EXTENSIONS:
        raise ValueError(
            f"Unsupported image extension '{path.suffix}'. "
            f"Supported: {SUPPORTED_IMAGE_EXTENSIONS}"
        )

    raw_bytes = np.fromfile(str(path), dtype=np.uint8)
    image = cv2.imdecode(raw_bytes, cv2.IMREAD_COLOR)
    image = validate_image(image, source=str(path))

    logger.info("Loaded image: %s (shape=%s)", path.name, image.shape)
    return image


def list_images_in_folder(folder: PathLike) -> list[Path]:
    """
    List all supported image files directly inside a folder (non-recursive).

    Args:
        folder: path to the folder to scan.

    Returns:
        list[Path]: sorted list of image file paths. Empty list (with a
        warning logged) if no supported images are found.

    Raises:
        NotADirectoryError: if the path is not an existing directory.
    """
    folder = Path(folder)
    if not folder.is_dir():
        raise NotADirectoryError(f"Not a folder: {folder}")

    files = sorted(
        p for p in folder.iterdir()
        if p.is_file() and p.suffix.lower() in SUPPORTED_IMAGE_EXTENSIONS
    )
    if not files:
        logger.warning("No supported images found in folder: %s", folder)
    else:
        logger.info("Found %d image(s) in folder: %s", len(files), folder)
    return files


def load_images_from_folder(folder: PathLike) -> Iterator[tuple[Path, np.ndarray]]:
    """
    Yield (path, image) pairs for every valid image in a folder.

    Corrupt or unreadable files are logged and skipped rather than raising,
    so a single bad file doesn't abort an entire batch run.

    Args:
        folder: path to the folder to scan.

    Yields:
        tuple[Path, np.ndarray]: the file path and its loaded image.
    """
    for path in list_images_in_folder(folder):
        try:
            yield path, load_image(path)
        except (ValueError, FileNotFoundError) as exc:
            logger.error("Skipping unreadable image %s: %s", path, exc)
            continue


def open_camera(index: int = 0) -> cv2.VideoCapture:
    """
    Open a camera device for real-time capture.

    Args:
        index: OS camera device index (0 = default camera).

    Returns:
        cv2.VideoCapture: an opened capture object.

    Raises:
        RuntimeError: if the camera cannot be opened.
    """
    capture = cv2.VideoCapture(index)
    if not capture.isOpened():
        raise RuntimeError(f"Could not open camera at index {index}")
    logger.info("Camera opened at index %d", index)
    return capture


def open_video(path: PathLike) -> cv2.VideoCapture:
    """
    Open a video file for frame-by-frame reading.

    Args:
        path: path to the video file.

    Returns:
        cv2.VideoCapture: an opened capture object.

    Raises:
        FileNotFoundError: if the video file does not exist.
        RuntimeError: if the file exists but cannot be opened/decoded.
    """
    path = Path(path)
    if not path.is_file():
        raise FileNotFoundError(f"Video file not found: {path}")

    capture = cv2.VideoCapture(str(path))
    if not capture.isOpened():
        raise RuntimeError(f"Could not open video file: {path}")
    logger.info("Video opened: %s", path.name)
    return capture