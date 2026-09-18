"""
sanitizer.py — Comprehensive Input Sanitization, Validation & Safe Uploads
=========================================================================
Protects against:
1. Cross-Site Scripting (XSS) & Script Injection.
2. SQL Wildcard & Malicious Pattern Injection.
3. Path Traversal & Command Injection.
4. Unsafe File Uploads (extension spoofing, executable polyglots, oversized files).
"""

import re
import html
import os
from typing import Optional, Tuple
from fastapi import HTTPException, UploadFile

# Maximum allowed file upload size: 10 Megabytes
MAX_UPLOAD_BYTES = 10 * 1024 * 1024

# Allowed file extensions and corresponding magic byte signatures
ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}

MAGIC_SIGNATURES = {
    ".jpg": [b"\xFF\xD8\xFF"],
    ".jpeg": [b"\xFF\xD8\xFF"],
    ".png": [b"\x89PNG\r\n\x1a\n"],
    ".webp": [b"RIFF"],  # WebP begins with RIFF....WEBP
}

# Dangerous shell/command execution characters
DANGEROUS_CMD_CHARS = re.compile(r"[;&|`$><!]")

# Common SQL injection patterns in raw search strings
SQLI_PATTERNS = re.compile(
    r"(\bUNION\b\s+\bSELECT\b|\bSELECT\b\s+.*\bFROM\b|--|/\*|\*/|;\s*$|\bDROP\b\s+\bTABLE\b|\bINSERT\b\s+\bINTO\b)",
    re.IGNORECASE
)

# Dangerous HTML/Script tags and event handlers
SCRIPT_PATTERNS = re.compile(
    r"(<\s*script[^>]*>|<\s*/\s*script\s*>|javascript:|vbscript:|data:text/html|on[a-z]+\s*=)",
    re.IGNORECASE
)


def sanitize_text(value: Optional[str], max_length: int = 2000) -> Optional[str]:
    """
    Sanitizes user input text:
    1. Trims leading/trailing whitespace.
    2. HTML-escapes dangerous characters (&, <, >, ", ').
    3. Strips script protocols.
    4. Truncates to max_length.
    """
    if not value:
        return value

    cleaned = value.strip()
    if len(cleaned) > max_length:
        cleaned = cleaned[:max_length]

    # Neutralize script protocols
    cleaned = SCRIPT_PATTERNS.sub("", cleaned)
    # HTML escape
    cleaned = html.escape(cleaned, quote=True)
    return cleaned


def sanitize_search_query(query: str, max_length: int = 100) -> str:
    """
    Sanitizes search query parameters:
    1. Truncates length.
    2. Rejects blatant SQL injection attack patterns.
    3. Escapes SQL LIKE wildcards (% and _) to avoid wildcard DoS / unintended regex.
    """
    if not query:
        return ""

    cleaned = query.strip()[:max_length]

    # Check for SQL injection attempts
    if SQLI_PATTERNS.search(cleaned):
        raise HTTPException(
            status_code=400,
            detail="Search query contains disallowed characters or SQL syntax."
        )

    # Neutralize script tags
    if SCRIPT_PATTERNS.search(cleaned):
        raise HTTPException(
            status_code=400,
            detail="Search query contains disallowed script characters."
        )

    # Escape LIKE wildcard characters
    cleaned = cleaned.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return cleaned


def sanitize_filename(filename: str) -> str:
    """
    Sanitizes an uploaded filename:
    1. Removes directory traversal sequences (../, ..\).
    2. Removes command injection characters.
    3. Restricts characters to safe alphanumeric, dashes, dots, underscores.
    """
    base = os.path.basename(filename)
    # Strip dangerous command characters and path traversal
    base = DANGEROUS_CMD_CHARS.sub("", base)
    base = base.replace("\0", "")
    # Keep only safe characters
    clean_name = re.sub(r"[^a-zA-Z0-9._-]", "_", base)
    return clean_name or "uploaded_media"


async def validate_uploaded_image(file: UploadFile) -> tuple[bytes, str]:
    """
    Strictly validates an uploaded image file:
    1. Validates file extension against whitelist (.jpg, .jpeg, .png, .webp).
    2. Reads content and validates magic byte header.
    3. Validates total file size does not exceed MAX_UPLOAD_BYTES (10 MB).
    Returns (content_bytes, sanitized_extension).
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing filename in upload.")

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Disallowed file extension '{ext}'. Only JPEG, PNG, and WebP images are permitted."
        )

    # Read file content safely
    content = await file.read()
    if hasattr(file, "seek"):
        await file.seek(0)

    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=400,
            detail="Uploaded file exceeds maximum allowed size of 10 MB."
        )

    # Inspect magic bytes
    valid_sig = False
    expected_sigs = MAGIC_SIGNATURES.get(ext, [])
    for sig in expected_sigs:
        if content.startswith(sig):
            valid_sig = True
            break

    # Special check for WebP (RIFF....WEBP)
    if ext == ".webp" and content.startswith(b"RIFF") and b"WEBP" in content[:16]:
        valid_sig = True

    if not valid_sig:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid image binary header: file content does not match '{ext}' signature."
        )

    return content, ext
