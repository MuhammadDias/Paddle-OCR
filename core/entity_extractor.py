import re

# Regular expressions for entity extraction
EMAIL_REGEX = re.compile(
    r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
)

# Matches Indonesian formats (e.g. 0812-3456-7890, +62 812 3456 7890) and general international phone numbers
PHONE_REGEX = re.compile(
    r'(?:\+?62|0)[2-9]\d{1,3}[-.\s]?\d{3,4}[-.\s]?\d{3,5}|\+?\d{1,4}[-.\s]?\d{3,4}[-.\s]?\d{4,10}'
)

# Matches Rp 50.000, Rp. 1.500.000, $150.00, IDR 250000, 100 USD, 5000 Rupiah
CURRENCY_REGEX = re.compile(
    r'(?:Rp\.?|IDR|\$|€|¥|£)\s?\d{1,3}(?:\.\d{3})*(?:,\d{2})?|\b\d{1,3}(?:\.\d{3})*(?:,\d{2})?\s?(?:Rupiah|USD|EUR|GBP|Yen)\b',
    re.IGNORECASE
)

# Matches URLs starting with http://, https://, or www.
URL_REGEX = re.compile(
    r'https?://[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:/[^\s]*)?|www\.[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
)

def extract_entities(text: str) -> dict[str, list[str]]:
    """
    Parse a block of text and extract emails, phone numbers, currency figures, and web URLs.
    Cleans duplicates and returns a dictionary of lists.
    """
    if not text:
        return {
            "emails": [],
            "phones": [],
            "currencies": [],
            "urls": []
        }

    # Find matches
    emails = EMAIL_REGEX.findall(text)
    phones = PHONE_REGEX.findall(text)
    currencies = CURRENCY_REGEX.findall(text)
    urls = URL_REGEX.findall(text)

    # Helper function to remove duplicates while preserving order
    def clean_results(matches: list[str]) -> list[str]:
        seen = set()
        cleaned = []
        for item in matches:
            trimmed = item.strip().strip(',').strip('.')
            if trimmed and trimmed.lower() not in seen:
                # Basic validation for phone numbers to avoid single numbers or year numbers
                if matches is phones:
                    # Strip spaces, hyphens, dots
                    digits = re.sub(r'[-.\s+]', '', trimmed)
                    if len(digits) < 7 or len(digits) > 15:
                        continue
                seen.add(trimmed.lower())
                cleaned.append(trimmed)
        return cleaned

    return {
        "emails": clean_results(emails),
        "phones": clean_results(phones),
        "currencies": clean_results(currencies),
        "urls": clean_results(urls)
    }
