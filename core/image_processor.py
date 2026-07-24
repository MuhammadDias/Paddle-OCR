"""
Adaptive OpenCV image enhancement prior to OCR.

Responsibilities:
    - Classify the incoming image's likely category (document, screenshot,
      camera capture, outdoor photo) using lightweight heuristics.
    - Apply only the enhancement steps needed for that category (denoise,
      deskew, contrast enhancement, adaptive threshold, sharpen, upscale),
      per config.settings.PREPROCESS_PROFILES.
    - Keep preprocessing conservative: helping PaddleOCR read text, never
      over-processing to the point of destroying detail.
"""

from __future__ import annotations

import logging

import cv2
import numpy as np

from config.settings import (
    DEFAULT_PREPROCESS_PROFILE,
    PREPROCESS_PROFILES,
    PreprocessProfile,
)

logger = logging.getLogger("ai_ocr_system.image_processor")

_MIN_DIMENSION_FOR_UPSCALE = 800
_MAX_DESKEW_ANGLE_DEG = 15.0
_MIN_DESKEW_ANGLE_DEG = 0.3


def classify_image_type(image: np.ndarray) -> str:
    """
    Heuristically classify an image into one of: 'document', 'screenshot',
    'camera', 'outdoor'.

    This is a lightweight statistical heuristic (not a trained classifier):
        - Mostly white background + low color variety -> 'document'
          (scanned/photographed paper, certificates, printed pages).
        - Low pixel noise + moderate color variety -> 'screenshot'
          (clean UI renders: WhatsApp, websites).
        - Low sharpness + high noise -> 'outdoor'
          (natural photos: banners, signage, packaging in daylight).
        - Otherwise -> 'camera' (handheld real-time capture, indoor photos).

    It exists to pick a sensible PreprocessProfile automatically; it is not
    meant to be perfectly accurate for every image.

    Args:
        image: input BGR or grayscale image.

    Returns:
        str: one of "document", "screenshot", "camera", "outdoor".
    """
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if image.ndim == 3 else image

    # Sharpness proxy: variance of the Laplacian (higher = crisper edges).
    sharpness = float(cv2.Laplacian(gray, cv2.CV_64F).var())

    # Noise proxy: std deviation of the high-frequency residual after blur.
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    noise = float(np.std(gray.astype(np.float32) - blurred.astype(np.float32)))

    # Color richness: number of unique colors in a downsampled thumbnail.
    if image.ndim == 3:
        thumbnail = cv2.resize(image, (64, 64), interpolation=cv2.INTER_AREA)
    else:
        thumbnail = cv2.cvtColor(
            cv2.resize(gray, (64, 64), interpolation=cv2.INTER_AREA), cv2.COLOR_GRAY2BGR
        )
    unique_colors = int(len(np.unique(thumbnail.reshape(-1, thumbnail.shape[-1]), axis=0)))

    # Fraction of near-white pixels (paper-like background).
    white_ratio = float(np.mean(gray > 200))

    if white_ratio > 0.55 and unique_colors < 700:
        image_type = "document"
    elif noise < 4.0 and unique_colors < 900:
        image_type = "screenshot"
    elif sharpness < 100.0 and noise >= 4.0:
        image_type = "outdoor"
    else:
        image_type = "camera"

    logger.debug(
        "classify_image_type: sharpness=%.1f noise=%.2f unique_colors=%d "
        "white_ratio=%.2f -> %s",
        sharpness, noise, unique_colors, white_ratio, image_type,
    )
    return image_type


def get_profile_for_image(image: np.ndarray) -> tuple[str, PreprocessProfile]:
    """
    Classify an image and return its (category, PreprocessProfile) pair.

    Args:
        image: input BGR or grayscale image.

    Returns:
        tuple[str, PreprocessProfile]: the detected category name and the
        matching preprocessing profile from config.settings.
    """
    category = classify_image_type(image)
    profile = PREPROCESS_PROFILES.get(
        category, PREPROCESS_PROFILES[DEFAULT_PREPROCESS_PROFILE]
    )
    return category, profile


def denoise_image(image: np.ndarray) -> np.ndarray:
    """
    Apply light denoising using Non-Local Means.

    Args:
        image: input BGR or grayscale image.

    Returns:
        np.ndarray: denoised image, same shape/dtype as input.
    """
    if image.ndim == 3:
        return cv2.fastNlMeansDenoisingColored(image, None, 5, 5, 7, 21)
    return cv2.fastNlMeansDenoising(image, None, 5, 7, 21)


def deskew_image(image: np.ndarray) -> np.ndarray:
    """
    Estimate and correct small rotation (skew) using the minimum-area
    bounding rectangle of foreground (text-like) pixels.

    Only corrects angles within (MIN_DESKEW_ANGLE, MAX_DESKEW_ANGLE] degrees
    so that already-straight images are left untouched and large, likely
    incorrect angle estimates are never applied destructively.

    Args:
        image: input BGR or grayscale image.

    Returns:
        np.ndarray: deskewed image, or the original image unchanged if no
        reliable/small-enough skew was detected.
    """
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if image.ndim == 3 else image
    _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV | cv2.THRESH_OTSU)
    coords = cv2.findNonZero(thresh)
    if coords is None:
        return image

    angle = cv2.minAreaRect(coords)[-1]
    if angle < -45:
        angle = 90 + angle

    if abs(angle) < _MIN_DESKEW_ANGLE_DEG or abs(angle) > _MAX_DESKEW_ANGLE_DEG:
        return image

    height, width = image.shape[:2]
    center = (width // 2, height // 2)
    rotation_matrix = cv2.getRotationMatrix2D(center, angle, 1.0)
    rotated = cv2.warpAffine(
        image,
        rotation_matrix,
        (width, height),
        flags=cv2.INTER_CUBIC,
        borderMode=cv2.BORDER_REPLICATE,
    )
    logger.debug("Deskewed image by %.2f degrees", angle)
    return rotated


def enhance_contrast(image: np.ndarray) -> np.ndarray:
    """
    Apply CLAHE (Contrast Limited Adaptive Histogram Equalization) on the
    luminance channel so text stands out from its background without
    blowing out already well-lit regions.

    Args:
        image: input BGR or grayscale image.

    Returns:
        np.ndarray: contrast-enhanced image, same shape/dtype as input.
    """
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    if image.ndim == 3:
        lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
        l_channel, a_channel, b_channel = cv2.split(lab)
        l_channel = clahe.apply(l_channel)
        lab = cv2.merge((l_channel, a_channel, b_channel))
        return cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)
    return clahe.apply(image)


def adaptive_threshold_image(image: np.ndarray) -> np.ndarray:
    """
    Binarize an image using adaptive Gaussian thresholding. Output is
    converted back to 3-channel BGR (if input was BGR) so downstream
    modules always receive a consistent channel count.

    Args:
        image: input BGR or grayscale image.

    Returns:
        np.ndarray: binarized image (black/white text on background).
    """
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if image.ndim == 3 else image
    binary = cv2.adaptiveThreshold(
        gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 15
    )
    return cv2.cvtColor(binary, cv2.COLOR_GRAY2BGR) if image.ndim == 3 else binary


def sharpen_image(image: np.ndarray) -> np.ndarray:
    """
    Apply a mild unsharp-mask style sharpening kernel to make text edges
    crisper for detection/recognition.

    Args:
        image: input BGR or grayscale image.

    Returns:
        np.ndarray: sharpened image, same shape/dtype as input.
    """
    kernel = np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]], dtype=np.float32)
    return cv2.filter2D(image, -1, kernel)


def upscale_image(
    image: np.ndarray, min_dimension: int = _MIN_DIMENSION_FOR_UPSCALE
) -> np.ndarray:
    """
    Upscale an image with cubic interpolation if its smallest side is
    below `min_dimension`, so small text has enough pixels for the
    detection/recognition models to work with.

    Args:
        image: input BGR or grayscale image.
        min_dimension: minimum acceptable smallest-side size, in pixels.

    Returns:
        np.ndarray: the original image if already large enough, otherwise
        an upscaled copy.
    """
    height, width = image.shape[:2]
    smallest_side = min(height, width)
    if smallest_side >= min_dimension:
        return image

    scale = min_dimension / smallest_side
    new_size = (int(width * scale), int(height * scale))
    logger.debug("Upscaling image from %s to %s", (width, height), new_size)
    return cv2.resize(image, new_size, interpolation=cv2.INTER_CUBIC)


def preprocess_image(
    image: np.ndarray, profile: PreprocessProfile | None = None
) -> np.ndarray:
    """
    Apply adaptive preprocessing to an image following a PreprocessProfile.

    If no profile is given, the image is classified automatically
    (see classify_image_type) and the matching profile from
    config.settings.PREPROCESS_PROFILES is used.

    Steps run conditionally, in this fixed order, so results stay
    predictable: denoise -> deskew -> upscale -> contrast -> threshold ->
    sharpen. Any step whose flag is False on the profile is skipped
    entirely — this is what keeps preprocessing "just enough" rather than
    applying every filter to every image.

    Args:
        image: input BGR image, as returned by core.image_loader.
        profile: optional explicit PreprocessProfile; auto-detected if None.

    Returns:
        np.ndarray: the preprocessed image, ready for the OCR engine.
    """
    if profile is None:
        category, profile = get_profile_for_image(image)
        logger.info("Auto-detected image category: %s", category)

    result = image.copy()

    if profile.denoise:
        result = denoise_image(result)
    if profile.deskew:
        result = deskew_image(result)
    if profile.upscale_if_small:
        result = upscale_image(result)
    if profile.contrast_enhance:
        result = enhance_contrast(result)
    if profile.adaptive_threshold:
        result = adaptive_threshold_image(result)
    if profile.sharpen:
        result = sharpen_image(result)

    return result