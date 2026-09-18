"""
security.py — Security & Cryptographic Utilities for RoadWatch
================================================================
Implements:
1. PBKDF2-HMAC-SHA256 adaptive password hashing with per-user cryptographic salt
   and backward-compatible verification/auto-upgrade for legacy SHA-256 hashes.
2. Standard PyJWT token creation & verification with strict algorithm and expiration checks.
3. Cryptographically secure random tokens for password reset and email verification.
4. IP and username-based login rate limiting & lockout tracking.
"""

import os
import secrets
import hashlib
import logging
from logging.handlers import RotatingFileHandler
import json
import time
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple, Dict, Any
from collections import defaultdict
import jwt

# ─── Security Logger Setup ───────────────────────────────────────────────────

LOG_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "logs")
os.makedirs(LOG_DIR, exist_ok=True)
SECURITY_LOG_FILE = os.path.join(LOG_DIR, "security.log")

security_logger = logging.getLogger("roadwatch.security")
security_logger.setLevel(logging.INFO)

if not security_logger.handlers:
    formatter = logging.Formatter(
        '{"timestamp":"%(asctime)s", "level":"%(levelname)s", "logger":"%(name)s", "message":%(message)s}'
    )
    file_handler = RotatingFileHandler(
        SECURITY_LOG_FILE, maxBytes=10 * 1024 * 1024, backupCount=5, encoding="utf-8"
    )
    file_handler.setFormatter(formatter)
    security_logger.addHandler(file_handler)

    stream_handler = logging.StreamHandler()
    stream_handler.setFormatter(formatter)
    security_logger.addHandler(stream_handler)


def log_auth_event(
    event_type: str,
    status: str,
    client_ip: str,
    username: Optional[str] = None,
    user_agent: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None
) -> None:
    """Logs an authentication or authorization event with structured JSON."""
    payload = {
        "event_category": "AUTH",
        "event_type": event_type,
        "status": status,
        "client_ip": client_ip,
        "username": username or "anonymous",
        "user_agent": (user_agent or "unknown")[:150],
        "details": details or {},
    }
    level = logging.INFO if status == "SUCCESS" else logging.WARNING
    security_logger.log(level, json.dumps(payload))


def log_security_alert(
    alert_type: str,
    severity: str,
    client_ip: str,
    endpoint: str,
    message: str,
    details: Optional[Dict[str, Any]] = None
) -> None:
    """Logs a high-severity security alert (e.g. IDOR violation, scanner probe)."""
    payload = {
        "event_category": "SECURITY_ALERT",
        "alert_type": alert_type,
        "severity": severity,
        "client_ip": client_ip,
        "endpoint": endpoint,
        "message": message,
        "details": details or {},
    }
    level = logging.ERROR if severity == "HIGH" else logging.WARNING
    security_logger.log(level, json.dumps(payload))


def log_traffic_anomaly(
    anomaly_type: str,
    client_ip: str,
    request_url: str,
    user_agent: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None
) -> None:
    """Logs anomalous or suspicious traffic patterns (probes, scans, bursts)."""
    payload = {
        "event_category": "TRAFFIC_ANOMALY",
        "anomaly_type": anomaly_type,
        "client_ip": client_ip,
        "request_url": request_url,
        "user_agent": (user_agent or "unknown")[:150],
        "details": details or {},
    }
    security_logger.warning(json.dumps(payload))


# ─── Configuration & Production Secrets Validation ───────────────────────────

def validate_production_secrets() -> None:
    """
    Validates critical secrets before starting in production mode.
    Fails fast if default insecure keys or insufficient entropy are detected.
    """
    env = os.getenv("ENVIRONMENT", "development").lower()
    if env == "production":
        jwt_sec = os.getenv("JWT_SECRET", "")
        if not jwt_sec or jwt_sec == "roadwatch_admin_jwt_secret_2026_key":
            raise RuntimeError(
                "CRITICAL SECURITY CONFIGURATION ERROR: "
                "In production mode, JWT_SECRET must be explicitly set to a unique, "
                "cryptographically secure key (minimum 32 characters). Default fallback rejected."
            )
        if len(jwt_sec) < 32:
            raise RuntimeError(
                "CRITICAL SECURITY CONFIGURATION ERROR: "
                "In production mode, JWT_SECRET must be at least 32 characters long."
            )
        
        db_url = os.getenv("DATABASE_URL", "")
        if "sqlite" in db_url.lower():
            security_logger.warning(
                json.dumps({
                    "event_category": "SECURITY_ADVISORY",
                    "message": "SQLite is configured in production mode. Ensure persistent volume or use PostgreSQL."
                })
            )

JWT_SECRET = os.getenv("JWT_SECRET", "roadwatch_admin_jwt_secret_2026_key")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))  # 1 hour
PASSWORD_RESET_EXPIRE_MINUTES = int(os.getenv("PASSWORD_RESET_EXPIRE_MINUTES", "15"))  # 15 minutes
EMAIL_VERIFICATION_EXPIRE_HOURS = int(os.getenv("EMAIL_VERIFICATION_EXPIRE_HOURS", "24"))  # 24 hours

PBKDF2_ITERATIONS = 600000  # OWASP recommended minimum for PBKDF2-HMAC-SHA256
LEGACY_SALT = "roadwatch_salt_2026"


# ─── Password Hashing & Verification ──────────────────────────────────────────

def hash_password(password: str) -> str:
    """
    Hashes a password using PBKDF2-HMAC-SHA256 with 600,000 iterations
    and a cryptographically random 32-byte salt.
    Format: pbkdf2_sha256$<iterations>$<salt_hex>$<hash_hex>
    """
    salt = secrets.token_bytes(32)
    key = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt,
        PBKDF2_ITERATIONS
    )
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${salt.hex()}${key.hex()}"


def _verify_legacy_sha256(password: str, hashed: str) -> bool:
    """Verifies a password against the legacy single-round SHA-256 hash."""
    expected = hashlib.sha256((password + LEGACY_SALT).encode('utf-8')).hexdigest()
    return secrets.compare_digest(expected, hashed)


def verify_password(plain_password: str, hashed_password: str) -> Tuple[bool, bool]:
    """
    Verifies a plain password against a stored hash.
    Returns a tuple (is_valid, needs_rehash).
    If the hash is in legacy SHA-256 format and matches, needs_rehash is True.
    """
    if not hashed_password or not plain_password:
        return False, False

    # Check if modern PBKDF2 format
    if hashed_password.startswith("pbkdf2_sha256$"):
        try:
            parts = hashed_password.split("$")
            if len(parts) != 4:
                return False, False
            _, iterations_str, salt_hex, key_hex = parts
            iterations = int(iterations_str)
            salt = bytes.fromhex(salt_hex)
            key = bytes.fromhex(key_hex)

            computed_key = hashlib.pbkdf2_hmac(
                'sha256',
                plain_password.encode('utf-8'),
                salt,
                iterations
            )
            is_valid = secrets.compare_digest(computed_key, key)
            needs_rehash = (iterations < PBKDF2_ITERATIONS)
            return is_valid, needs_rehash
        except Exception:
            return False, False

    # Check if legacy SHA-256 hash (64 hex characters)
    if len(hashed_password) == 64 and all(c in "0123456789abcdefABCDEF" for c in hashed_password):
        if _verify_legacy_sha256(plain_password, hashed_password):
            return True, True  # Valid, but needs upgrade to PBKDF2!

    return False, False


def validate_password_strength(password: str) -> Tuple[bool, str]:
    """
    Validates password complexity:
    - At least 8 characters
    - Contains letters and numbers
    """
    if len(password) < 8:
        return False, "Password must be at least 8 characters long."
    if not any(c.isalpha() for c in password):
        return False, "Password must contain at least one letter."
    if not any(c.isdigit() for c in password):
        return False, "Password must contain at least one number."
    return True, ""


# ─── JWT Session Management (PyJWT) ───────────────────────────────────────────

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Encodes standard JWT claims using PyJWT with strict HMAC-SHA256.
    Includes:
    - sub (subject / username)
    - role
    - iat (issued at)
    - exp (expiration timestamp)
    - jti (unique session/token id)
    """
    to_encode = data.copy()
    now_utc = datetime.now(timezone.utc)
    if expires_delta:
        expire = now_utc + expires_delta
    else:
        expire = now_utc + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({
        "iat": int(now_utc.timestamp()),
        "exp": int(expire.timestamp()),
        "jti": secrets.token_hex(16),
    })

    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> dict:
    """
    Decodes and validates a JWT token using PyJWT.
    Enforces signature verification, algorithm integrity, and expiration.
    """
    try:
        payload = jwt.decode(
            token,
            JWT_SECRET,
            algorithms=[JWT_ALGORITHM],
            options={"require": ["exp", "sub"]}
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise ValueError("Session token has expired. Please log in again.")
    except jwt.InvalidTokenError as e:
        raise ValueError(f"Invalid authentication token: {str(e)}")


# ─── Secure Tokens for Password Reset & Email Verification ─────────────────────

def generate_secure_token() -> Tuple[str, str]:
    """
    Generates a cryptographically secure random token.
    Returns:
    - raw_token: sent to user in link / verification email
    - token_hash: SHA-256 hash stored in database
    """
    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode('utf-8')).hexdigest()
    return raw_token, token_hash


def hash_token(raw_token: str) -> str:
    """Hashes a raw token for constant-time lookup comparison against database."""
    return hashlib.sha256(raw_token.strip().encode('utf-8')).hexdigest()


# ─── Login Rate Limiter & Lockout System ──────────────────────────────────────

class LoginRateLimiter:
    """
    In-memory rate limiter with sliding window and lockout support.
    Protects against credential stuffing and brute-force attacks.
    Limits:
    - Max 5 failed attempts per 15 minutes per IP
    - Max 5 failed attempts per 15 minutes per Username
    - Lockout period: 15 minutes (900 seconds)
    """
    def __init__(self, max_attempts: int = 5, window_seconds: int = 900):
        self.max_attempts = max_attempts
        self.window_seconds = window_seconds
        self._ip_failures = defaultdict(list)
        self._user_failures = defaultdict(list)
        self._lockouts = {}  # key -> lockout_expiry_timestamp

    def _clean_window(self, records: list, now: float) -> list:
        cutoff = now - self.window_seconds
        return [t for t in records if t > cutoff]

    def is_locked(self, ip: str, username: Optional[str] = None) -> Tuple[bool, int]:
        """
        Returns (is_locked, remaining_seconds).
        """
        now = time.time()
        for key in [f"ip:{ip}", f"user:{username}" if username else None]:
            if key and key in self._lockouts:
                remaining = int(self._lockouts[key] - now)
                if remaining > 0:
                    return True, remaining
                else:
                    del self._lockouts[key]
        return False, 0

    def record_failure(self, ip: str, username: Optional[str] = None) -> Tuple[bool, int]:
        """
        Records a failed attempt. If threshold exceeded, applies lockout.
        Returns (is_locked_now, remaining_seconds).
        """
        now = time.time()
        # IP tracking
        ip_records = self._clean_window(self._ip_failures[ip], now)
        ip_records.append(now)
        self._ip_failures[ip] = ip_records

        # Username tracking
        if username:
            user_records = self._clean_window(self._user_failures[username], now)
            user_records.append(now)
            self._user_failures[username] = user_records

        # Check thresholds
        if len(ip_records) >= self.max_attempts:
            lockout_exp = now + self.window_seconds
            self._lockouts[f"ip:{ip}"] = lockout_exp
            return True, self.window_seconds

        if username and len(self._user_failures[username]) >= self.max_attempts:
            lockout_exp = now + self.window_seconds
            self._lockouts[f"user:{username}"] = lockout_exp
            return True, self.window_seconds

        return False, 0

    def record_success(self, ip: str, username: Optional[str] = None):
        """Resets failed attempt counters upon successful login."""
        self._ip_failures.pop(ip, None)
        if username:
            self._user_failures.pop(username, None)
        self._lockouts.pop(f"ip:{ip}", None)
        if username:
            self._lockouts.pop(f"user:{username}", None)


login_rate_limiter = LoginRateLimiter(max_attempts=5, window_seconds=900)
password_reset_rate_limiter = LoginRateLimiter(max_attempts=3, window_seconds=900)


# ─── IDOR & Jurisdictional Ownership Verification ─────────────────────────────

from fastapi import HTTPException

def verify_resource_jurisdiction(
    user: Any,
    resource_state: Optional[str] = None,
    resource_district: Optional[str] = None,
    resource_desc: str = "resource"
) -> None:
    """
    Prevents Insecure Direct Object Reference (IDOR) and Broken Object Level Authorization (BOLA).
    Enforces that the authenticated administrative user possesses official jurisdiction
    over the target resource.
    - Super Admin: global authority across all states and districts.
    - State Authority: restricted strictly to the user's state.
    - District Collector / Field Engineers: restricted strictly to the user's state and district.
    """
    user_role = getattr(user, "role", "") or ""
    if "Super Admin" in user_role:
        return  # Super Admin has global platform jurisdiction

    user_state = (getattr(user, "state", None) or "").strip().lower()
    user_district = (getattr(user, "district", None) or "").strip().lower()
    res_state = (resource_state or "").strip().lower()
    res_district = (resource_district or "").strip().lower()

    if user_state and res_state and user_state != res_state:
        log_security_alert(
            alert_type="IDOR_VIOLATION_BLOCKED",
            severity="HIGH",
            client_ip="authenticated_session",
            endpoint=resource_desc,
            message=f"Officer '{getattr(user, 'username', 'unknown')}' attempted cross-state IDOR access on '{resource_state}' outside jurisdiction '{user.state}'."
        )
        raise HTTPException(
            status_code=403,
            detail=f"Access denied (IDOR protection): You do not have authority over {resource_desc} in '{resource_state}'. Your administrative jurisdiction is restricted to '{user.state}'."
        )

    if user_district and res_district and user_district != res_district:
        log_security_alert(
            alert_type="IDOR_VIOLATION_BLOCKED",
            severity="HIGH",
            client_ip="authenticated_session",
            endpoint=resource_desc,
            message=f"Officer '{getattr(user, 'username', 'unknown')}' attempted cross-district IDOR access on '{resource_district}' outside jurisdiction '{user.district}'."
        )
        raise HTTPException(
            status_code=403,
            detail=f"Access denied (IDOR protection): You do not have authority over {resource_desc} in '{resource_district}' district. Your administrative jurisdiction is restricted to '{user.district}'."
        )
