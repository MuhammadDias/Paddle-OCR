"""
PaddleOCR engine wrapper.

Wraps the latest PaddleOCR (3.x, PaddleX-based) `PaddleOCR` pipeline class
with:
    - A single, lazily-created, reusable pipeline instance (avoids the
      multi-second model load cost on every call).
    - Automatic GPU/CPU device selection via config.settings.DEVICE.
    - A stable output type (core.utils.OCRResult) so the rest of the
      pipeline never has to know about PaddleOCR's internal result format.

PaddleOCR 3.x's `predict()` returns one result object per input image; each
result behaves like a dict with (at least) these keys:
    "rec_texts": list[str]        recognized text per detected line
    "rec_scores": list[float]      recognition confidence per line
    "rec_polys":  list[np.ndarray] 4-point polygon per line, in reading
                                    order already sorted top-to-bottom by
                                    the pipeline's internal box sorting
"""

from __future__ import annotations

import logging
from typing import Any, Optional

import numpy as np

from config.settings import OCR_CONFIG, OCRConfig
from core.utils import OCRResult

logger = logging.getLogger("ai_ocr_system.ocr_engine")


class OCREngine:
    """
    Thin, reusable wrapper around PaddleOCR's detection + angle
    classification + recognition pipeline.

    Use `OCREngine.get_instance()` to obtain a shared, lazily-initialized
    engine rather than constructing `OCREngine()` repeatedly — building the
    underlying PaddleOCR pipeline loads several neural network models and
    is expensive to redo per image.
    """

    _instance: Optional["OCREngine"] = None

    def __init__(self, config: OCRConfig | None = None) -> None:
        """
        Initialize the OCR engine.
        """
        self.config = config or OCR_CONFIG
        self._pipelines: dict[str, Any] = {}

    def _get_pipeline(self, lang: str) -> Any:
        """Retrieve or build a cached pipeline for a specific language."""
        if lang not in self._pipelines:
            self._pipelines[lang] = self._build_pipeline(lang)
        return self._pipelines[lang]

    def _build_pipeline(self, lang: str) -> Any:
        """Construct the underlying PaddleOCR pipeline object for a language."""
        try:
            from paddleocr import PaddleOCR
        except ImportError as exc:
            raise RuntimeError(
                "The 'paddleocr' package is not installed. "
                "Install it with: pip install -r requirements.txt"
            ) from exc

        device = "gpu" if self.config.use_gpu else "cpu"
        logger.info(
            "Initializing PaddleOCR pipeline (lang=%s, device=%s)...",
            lang, device,
        )
        try:
            init_kwargs: dict[str, Any] = dict(
                lang=lang,
                use_textline_orientation=self.config.use_textline_orientation,
                use_doc_orientation_classify=False,
                use_doc_unwarping=False,
                device=device,
            )
            if not self.config.use_gpu:
                # Sidestep a known PaddlePaddle/oneDNN PIR-executor crash on
                # CPU with certain PP-OCRv6 detection ops (see OCRConfig).
                init_kwargs["enable_mkldnn"] = self.config.enable_mkldnn
            pipeline = PaddleOCR(**init_kwargs)
        except Exception as exc:  # noqa: BLE001 - surface a clear, actionable error
            raise RuntimeError(
                "Failed to initialize the PaddleOCR pipeline. This is usually "
                "caused by missing model weights and no network access to "
                "download them, or an incompatible paddlepaddle/paddleocr "
                f"install. Original error: {exc}"
            ) from exc

        logger.info("PaddleOCR pipeline ready for lang=%s.", lang)
        return pipeline

    @classmethod
    def get_instance(cls, config: OCRConfig | None = None) -> "OCREngine":
        """
        Get (or lazily create) the shared OCREngine instance.

        Args:
            config: configuration to use if the instance does not exist yet.
                Ignored if an instance was already created.

        Returns:
            OCREngine: the shared engine instance.
        """
        if cls._instance is None:
            cls._instance = cls(config)
        return cls._instance

    def recognize(self, image: np.ndarray, lang: str | None = None) -> list[OCRResult]:
        """
        Run detection + angle classification + recognition on one image.

        Args:
            image: a preprocessed BGR image (as produced by
                core.image_processor.preprocess_image).
            lang: language model to use (e.g. 'id', 'en', 'japan', etc.)

        Returns:
            list[OCRResult]: one entry per detected text line.
        """
        target_lang = lang or self.config.lang
        pipeline = self._get_pipeline(target_lang)
        try:
            raw_results = pipeline.predict(
                image, text_rec_score_thresh=self.config.drop_score
            )
        except Exception as exc:  # noqa: BLE001 - convert to a domain error
            raise RuntimeError(f"OCR inference failed: {exc}") from exc

        return self._parse_raw_results(raw_results)

    @staticmethod
    def _parse_raw_results(raw_results: Any) -> list[OCRResult]:
        """
        Convert PaddleOCR's raw predict() output into a flat list of
        OCRResult objects.

        Args:
            raw_results: iterable of per-image PaddleOCR result objects
                (dict-like, with "rec_texts" / "rec_scores" / "rec_polys").

        Returns:
            list[OCRResult]: flattened, framework-agnostic results.
        """
        parsed: list[OCRResult] = []
        for page in raw_results:
            texts = page.get("rec_texts", []) if hasattr(page, "get") else []
            scores = page.get("rec_scores", []) if hasattr(page, "get") else []
            polys = page.get("rec_polys", []) if hasattr(page, "get") else []

            for text, score, poly in zip(texts, scores, polys):
                box = [[float(point[0]), float(point[1])] for point in poly]
                parsed.append(
                    OCRResult(box=box, text=str(text), confidence=float(score))
                )
        return parsed