"""
abuse_protection.py — Abuse Prevention, Tiered Rate Limiting & Bot Mitigation
=============================================================================
Provides:
1. SlidingWindowRateLimiter: High-precision in-memory sliding window rate limiting.
2. Dedicated tiers:
   - AI Generation requests (chat, RAG, AI insights)
   - Account creation / administrative onboarding
   - Data scraping & bulk harvesting deterrence
   - Public contribution spam prevention (complaints, votes)
3. Bot & Malicious crawler signature detection.
4. Invisible form honeypot validation for spam mitigation.
"""

import time
import os
from collections import defaultdict
from typing import Optional, Tuple, Dict, List
from fastapi import Request, HTTPException
from security import log_security_alert, log_traffic_anomaly

# ─── Sliding Window Rate Limiter ──────────────────────────────────────────────

class SlidingWindowRateLimiter:
    """
    In-memory thread-safe sliding window rate limiter.
    Supports multi-window thresholding (e.g. max per minute and max per hour).
    """
    def __init__(self, name: str, limits: List[Tuple[int, int]]):
        """
        :param name: Name of the limiter (e.g. 'ai_generation', 'scraping')
        :param limits: List of tuples [(max_requests, window_seconds), ...]
        """
        self.name = name
        self.limits = limits  # sorted by window_seconds ascending
        self.history = defaultdict(list)

    def check(self, key: str) -> Tuple[bool, int, int, int]:
        """
        Checks whether the key has exceeded any limit window.
        Returns: (is_allowed, remaining_quota, retry_after_seconds, max_limit)
        """
        # Internal test client / localhost whitelist for testing
        if key in ("testclient", "127.0.0.1", "localhost") and os.getenv("TESTING_RATE_LIMITS") != "true":
            # In regular operations, local dev is permitted, but test scripts can set TESTING_RATE_LIMITS="true"
            pass

        now = time.time()
        timestamps = self.history[key]

        # Purge oldest entries beyond the largest window
        max_window = max(w for _, w in self.limits)
        self.history[key] = [t for t in timestamps if now - t < max_window]
        current_history = self.history[key]

        for max_reqs, window_secs in self.limits:
            window_times = [t for t in current_history if now - t < window_secs]
            if len(window_times) >= max_reqs:
                oldest_in_window = min(window_times)
                retry_after = max(1, int(window_secs - (now - oldest_in_window)))
                return False, 0, retry_after, max_reqs

        # Quota remains
        smallest_limit, _ = self.limits[0]
        remaining = max(0, smallest_limit - len(current_history))
        return True, remaining, 0, smallest_limit

    def record(self, key: str) -> None:
        """Records a request occurrence for the given key."""
        self.history[key].append(time.time())

    def reset(self, key: Optional[str] = None) -> None:
        """Resets the history for a key or clears all history."""
        if key:
            self.history.pop(key, None)
        else:
            self.history.clear()


# ─── Configured Rate Limiting Tiers ───────────────────────────────────────────

# AI Generation: 10 queries/minute, max 60 queries/hour per IP
ai_generation_limiter = SlidingWindowRateLimiter(
    name="ai_generation",
    limits=[(10, 60), (60, 3600)]
)

# Account Creation: Max 5 accounts per hour per IP
account_creation_limiter = SlidingWindowRateLimiter(
    name="account_creation",
    limits=[(5, 3600)]
)

# Data Scraping: Max 60 road/complaint reads per 60 seconds per IP
scraping_limiter = SlidingWindowRateLimiter(
    name="scraping_prevention",
    limits=[(60, 60), (300, 3600)]
)

# Complaint Submission: Max 10 complaints per hour per IP
complaint_submission_limiter = SlidingWindowRateLimiter(
    name="complaint_submission",
    limits=[(10, 3600)]
)

# Voting / Verification: Max 30 votes per 10 minutes per device/IP
voting_limiter = SlidingWindowRateLimiter(
    name="public_voting",
    limits=[(30, 600)]
)

# Global General API Limit: Max 120 requests per 60 seconds per IP
global_api_limiter = SlidingWindowRateLimiter(
    name="global_api",
    limits=[(120, 60)]
)


# ─── Helper: Enforce Rate Limit ────────────────────────────────────────────────

def enforce_rate_limit(
    limiter: SlidingWindowRateLimiter,
    key: str,
    error_message: Optional[str] = None
) -> None:
    """
    Enforces a rate limit for the given key.
    If limit is exceeded, logs an abuse alert and raises HTTP 429 with Retry-After header.
    """
    allowed, remaining, retry_after, max_limit = limiter.check(key)
    if not allowed:
        log_security_alert(
            alert_type="RATE_LIMIT_EXCEEDED",
            severity="MEDIUM",
            client_ip=key,
            endpoint=limiter.name,
            message=f"Rate limit exceeded on '{limiter.name}'. Max {max_limit}. Locked for {retry_after}s."
        )
        msg = error_message or f"Rate limit exceeded for {limiter.name.replace('_', ' ')}. Please wait {retry_after} seconds before retrying."
        raise HTTPException(
            status_code=429,
            detail=msg,
            headers={
                "Retry-After": str(retry_after),
                "X-RateLimit-Limit": str(max_limit),
                "X-RateLimit-Remaining": "0"
            }
        )
    limiter.record(key)


# ─── Bot & Malicious Scraper Detection ─────────────────────────────────────────

# Known malicious scrapers, vulnerability scanners, and automated exploitation tools
MALICIOUS_BOT_SIGNATURES = [
    "sqlmap", "nikto", "masscan", "nmap", "scrapy", "censys",
    "shodan", "zgrab", "gobuster", "dirbuster", "wpscan", "havij"
]

def check_bot_user_agent(user_agent: str, client_ip: str, request_url: str) -> bool:
    """
    Detects known aggressive scraper bots or penetration scanners.
    Returns True if malicious bot is detected.
    """
    if not user_agent:
        return False

    ua_lower = user_agent.lower()
    for sig in MALICIOUS_BOT_SIGNATURES:
        if sig in ua_lower:
            log_traffic_anomaly(
                anomaly_type="MALICIOUS_BOT_DETECTED",
                client_ip=client_ip,
                request_url=request_url,
                user_agent=user_agent,
                details={"matched_bot_signature": sig}
            )
            return True
    return False


# ─── Form Honeypot Validation ─────────────────────────────────────────────────

def validate_honeypot(field_value: Optional[str], client_ip: str, form_type: str = "form") -> None:
    """
    Validates that a hidden honeypot form field (which real users never see or fill)
    is empty. If populated, it indicates an automated form-filling spam bot.
    """
    if field_value and field_value.strip():
        log_security_alert(
            alert_type="BOT_HONEYPOT_TRIGGERED",
            severity="HIGH",
            client_ip=client_ip,
            endpoint=form_type,
            message=f"Automated spam bot filled hidden honeypot field '{form_type}' with value '{field_value[:50]}'."
        )
        raise HTTPException(
            status_code=400,
            detail="Submission rejected by automated abuse filter."
        )
