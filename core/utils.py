"""
Shared utility helpers used across the OCR pipeline.

Contains:
    - OCRResult: the common data structure passed between ocr_engine,
      postprocessor, visualizer, and exporter.
    - FPSCounter: a small smoothed FPS counter used by core/realtime.py.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field


@dataclass
class OCRResult:
    """
    A single recognized text region.

    Attributes:
        box: four (x, y) corner points of the text region, in image
            pixel coordinates, e.g. [[x1,y1], [x2,y2], [x3,y3], [x4,y4]].
        text: the recognized text string.
        confidence: recognition confidence score in [0.0, 1.0].
    """

    box: list[list[float]]
    text: str
    confidence: float


@dataclass
class FPSCounter:
    """
    Exponentially-smoothed frames-per-second counter for real-time mode.

    Call `tick()` once per processed frame; it returns the current
    smoothed FPS estimate.
    """

    smoothing: float = 0.9
    _fps: float = field(default=0.0, init=False, repr=False)
    _last_time: float | None = field(default=None, init=False, repr=False)

    def tick(self) -> float:
        """
        Register that a frame was just processed and update the FPS estimate.

        Returns:
            float: the current smoothed FPS value.
        """
        now = time.perf_counter()
        if self._last_time is not None:
            elapsed = now - self._last_time
            if elapsed > 0:
                instantaneous_fps = 1.0 / elapsed
                self._fps = (
                    instantaneous_fps
                    if self._fps == 0.0
                    else self._fps * self.smoothing + instantaneous_fps * (1 - self.smoothing)
                )
        self._last_time = now
        return self._fps

    def reset(self) -> None:
        """Reset the counter, e.g. when starting a new stream."""
        self._fps = 0.0
        self._last_time = None