import logging
import langdetect

logger = logging.getLogger("ai_ocr_system.lang_detector")

# Mapping of langdetect codes to PaddleOCR language identifiers
LANG_MAP = {
    "id": "id",       # Indonesian
    "en": "en",       # English
    "ja": "japan",    # Japanese
    "ko": "korean",   # Korean
    "ar": "ar",       # Arabic
    "zh-cn": "ch",    # Chinese Simplified
    "zh-tw": "ch",    # Chinese Traditional
    "zh": "ch",       # Chinese generic
}

def detect_language_from_text(text: str, default_lang: str = "id") -> str:
    """
    Detects language of a string using langdetect library and maps it to a PaddleOCR-supported code.
    Defaults to default_lang if detection fails or language is not mapped.
    """
    if not text or not text.strip():
        return default_lang

    try:
        # Prevent detection on extremely short text with no alphabetic characters
        clean_text = "".join([c for c in text if c.isalnum() or c.isspace()]).strip()
        if len(clean_text) < 5:
            return default_lang

        detected = langdetect.detect(clean_text)
        logger.info("Detected raw language code: %s", detected)
        
        # Match exact code or match prefix (e.g. zh-cn -> zh)
        if detected in LANG_MAP:
            return LANG_MAP[detected]
        
        prefix = detected.split("-")[0]
        if prefix in LANG_MAP:
            return LANG_MAP[prefix]
            
        logger.info("Language %s not supported directly. Falling back to default: %s", detected, default_lang)
        return default_lang
    except Exception as e:
        logger.warning("Language detection failed: %s. Falling back to default: %s", e, default_lang)
        return default_lang
