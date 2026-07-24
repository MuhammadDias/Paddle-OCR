"""
Real-time camera and video OCR loop.

Responsibilities:
    - Continuously capture frames from a webcam or an opened video file.
    - Run the full OCR pipeline on a sampled subset of frames (OCR is far
      slower than frame capture, so running it every frame would tank FPS).
    - Display bounding boxes, recognized text, confidence, and live FPS.
    - Let the user quit ('q') or save a snapshot export ('s') interactively.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Union

import cv2

from config.settings import CAMERA_INDEX_DEFAULT, REALTIME_OCR_EVERY_N_FRAMES
from core.exporter import export_results
from core.image_processor import preprocess_image
from core.ocr_engine import OCREngine
from core.postprocessor import postprocess_results
from core.utils import FPSCounter, OCRResult
from core.visualizer import draw_fps, draw_ocr_results

logger = logging.getLogger("ai_ocr_system.realtime")

PathLike = Union[str, Path]

_WINDOW_NAME = "ai-ocr-system — realtime"
_QUIT_KEY = ord("q")
_SNAPSHOT_KEY = ord("s")


def run_stream(
    capture: cv2.VideoCapture,
    engine: OCREngine | None = None,
    ocr_every_n_frames: int = REALTIME_OCR_EVERY_N_FRAMES,
    export_dir: PathLike | None = None,
) -> None:
    """
    Run the real-time OCR loop over an already-opened video capture source
    (camera or video file), displaying results in a window until the user
    quits.

    Args:
        capture: an opened cv2.VideoCapture (see core.image_loader.open_camera
            / open_video).
        engine: OCR engine to use. Defaults to the shared OCREngine instance
            (built lazily on first use).
        ocr_every_n_frames: run OCR once every N frames; intermediate
            frames reuse the last OCR result so the window stays smooth.
        export_dir: if given, pressing 's' during playback exports the
            current OCR results (TXT + JSON) into this directory.

    Notes:
        Requires a display environment (a GUI-capable OpenCV build); it
        will raise if `cv2.imshow` cannot open a window (e.g. headless
        servers without a virtual display).
    """
    engine = engine or OCREngine.get_instance()
    fps_counter = FPSCounter()
    last_results: list[OCRResult] = []
    frame_index = 0

    try:
        while True:
            grabbed, frame = capture.read()
            if not grabbed:
                logger.info("Stream ended or frame could not be read.")
                break

            if frame_index % ocr_every_n_frames == 0:
                try:
                    processed = preprocess_image(frame)
                    raw_results = engine.recognize(processed)
                    last_results = postprocess_results(raw_results)
                except RuntimeError as exc:
                    logger.error("OCR failed on frame %d: %s", frame_index, exc)

            annotated = draw_ocr_results(frame, last_results)
            annotated = draw_fps(annotated, fps_counter.tick())

            cv2.imshow(_WINDOW_NAME, annotated)
            key = cv2.waitKey(1) & 0xFF

            if key == _QUIT_KEY:
                logger.info("Quit key pressed — stopping stream.")
                break

            if key == _SNAPSHOT_KEY and export_dir is not None:
                exported = export_results(
                    last_results, export_dir, base_name=f"realtime_frame_{frame_index}"
                )
                logger.info("Snapshot exported: %s", exported)

            frame_index += 1
    finally:
        capture.release()
        cv2.destroyAllWindows()