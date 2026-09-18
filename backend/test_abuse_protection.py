"""
test_abuse_protection.py — Abuse Protection, Bot Mitigation & Rate Limiting Test Suite
====================================================================================
Verifies:
1. AI Generation rate limiting on /api/chat.
2. Account creation rate limiting on /api/admin/users/create.
3. Anti-scraping defenses on public data endpoints (/api/roads).
4. Automated bot & scanner user-agent blocking.
5. Invisible honeypot trap on public forms.
"""

import os
import sys
import uuid
from fastapi.testclient import TestClient

# Ensure backend root is in sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from main import app
from abuse_protection import (
    ai_generation_limiter, account_creation_limiter, scraping_limiter,
    complaint_submission_limiter, voting_limiter
)

client = TestClient(app, base_url="http://testserver")


def get_token(username="admin", password="password"):
    res = client.post("/api/admin/login", json={"username": username, "password": password})
    if res.status_code == 200:
        return res.json()["access_token"]
    res = client.post("/api/admin/login", json={"username": "admin", "password": "admin123"})
    assert res.status_code == 200, f"Login failed: {res.text}"
    return res.json()["access_token"]


def test_malicious_bot_user_agent_blocking():
    print("\n--- [TEST 1] Malicious Bot & Crawler User-Agent Blocking ---")
    
    # 1. Scrapy crawler bot
    bot_res = client.get("/api/roads", headers={"User-Agent": "Scrapy/2.5.0 (+https://scrapy.org)"})
    assert bot_res.status_code == 403, f"Expected 403 Forbidden for Scrapy bot, got {bot_res.status_code}"
    assert "automated scraping bot" in bot_res.json()["detail"]

    # 2. SQLMap scanner bot
    sqlmap_res = client.get("/api/roads/1", headers={"User-Agent": "sqlmap/1.6#stable (https://sqlmap.org)"})
    assert sqlmap_res.status_code == 403, f"Expected 403 Forbidden for sqlmap, got {sqlmap_res.status_code}"

    # 3. Legitimate browser User-Agent
    legit_res = client.get("/api/roads", headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"})
    assert legit_res.status_code == 200, f"Expected 200 for legitimate browser, got {legit_res.status_code}"

    print("[PASS] Malicious scraper and scanner bots blocked with HTTP 403.")


def test_honeypot_bot_trap():
    print("\n--- [TEST 2] Form Honeypot Trap on Complaint Submission ---")

    # Fetch a valid road
    road_res = client.get("/api/roads")
    assert road_res.status_code == 200
    road_id = road_res.json()[0]["id"]

    # 1. Bot fills invisible honeypot field 'website' -> Must be rejected with 400
    bot_payload = {
        "road_id": road_id,
        "issue_type": "Pothole",
        "description": "Automated spam message from bot network.",
        "website": "http://spambot-phishing-link.ru"
    }
    trap_res = client.post("/api/complaints", json=bot_payload)
    assert trap_res.status_code == 400, f"Expected 400 for triggered honeypot, got {trap_res.status_code}"
    assert "automated abuse filter" in trap_res.json()["detail"]

    # 2. Legitimate user leaves honeypot empty -> Must succeed
    legit_payload = {
        "road_id": road_id,
        "issue_type": "Pothole",
        "description": "Legitimate pothole reported by real citizen.",
        "website": None
    }
    legit_res = client.post("/api/complaints", json=legit_payload)
    assert legit_res.status_code == 200, f"Expected 200 for legitimate complaint, got {legit_res.status_code}"
    assert legit_res.json()["complaint_ref_id"].startswith("RW-")

    print("[PASS] Invisible honeypot successfully captured and rejected form bots.")


def test_ai_generation_rate_limiting():
    print("\n--- [TEST 3] AI Generation Rate Limiting ---")
    simulated_ip = f"198.51.100.{uuid.uuid4().int % 200 + 10}"
    ai_generation_limiter.reset(simulated_ip)

    headers = {
        "X-Forwarded-For": simulated_ip,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
    }

    # First 10 requests should succeed within the minute
    for i in range(10):
        res = client.post("/api/chat", json={"message": f"Query {i}"}, headers=headers)
        assert res.status_code == 200, f"Request {i+1} failed with {res.status_code}"

    # 11th request must be throttled with HTTP 429 and Retry-After header
    throttled_res = client.post("/api/chat", json={"message": "Exceed quota query"}, headers=headers)
    assert throttled_res.status_code == 429, f"Expected 429 Too Many Requests, got {throttled_res.status_code}"
    assert "Retry-After" in throttled_res.headers
    assert "AI generation rate limit exceeded" in throttled_res.json()["detail"]

    print("[PASS] AI generation requests properly throttled at 10 req/min with HTTP 429.")


def test_account_creation_rate_limiting():
    print("\n--- [TEST 4] Account Creation Rate Limiting ---")
    simulated_ip = f"203.0.113.{uuid.uuid4().int % 200 + 10}"
    account_creation_limiter.reset(simulated_ip)

    token = get_token()
    headers = {
        "Authorization": f"Bearer {token}",
        "X-Forwarded-For": simulated_ip,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
    }

    # Create 5 admin users (the allowed quota)
    for i in range(5):
        uid = uuid.uuid4().hex[:6]
        user_payload = {
            "username": f"officer_{uid}",
            "password": "SecurePassword123!",
            "name": f"Officer {uid}",
            "email": f"officer_{uid}@roadwatch.gov.in",
            "role": "PWD Engineer",
            "state": "Maharashtra",
            "district": "Pune"
        }
        res = client.post("/api/admin/users/create", json=user_payload, headers=headers)
        assert res.status_code == 200, f"User creation {i+1} failed: {res.text}"

    # 6th attempt must be blocked with HTTP 429
    excess_uid = uuid.uuid4().hex[:6]
    excess_payload = {
        "username": f"officer_{excess_uid}",
        "password": "SecurePassword123!",
        "name": f"Officer {excess_uid}",
        "email": f"officer_{excess_uid}@roadwatch.gov.in",
        "role": "PWD Engineer",
        "state": "Maharashtra",
        "district": "Pune"
    }
    blocked_res = client.post("/api/admin/users/create", json=excess_payload, headers=headers)
    assert blocked_res.status_code == 429, f"Expected 429 for excess account creation, got {blocked_res.status_code}"
    assert "Retry-After" in blocked_res.headers

    print("[PASS] Account creation rate limit enforced at 5 accounts/hour with HTTP 429.")


def test_anti_scraping_protection():
    print("\n--- [TEST 5] Anti-Scraping Defense on Public Datasets ---")
    simulated_ip = f"192.0.2.{uuid.uuid4().int % 200 + 10}"
    scraping_limiter.reset(simulated_ip)

    headers = {
        "X-Forwarded-For": simulated_ip,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
    }

    # Simulate rapid automated crawler querying roads 60 times
    for i in range(60):
        scraping_limiter.record(simulated_ip)

    # 61st read request must be intercepted with HTTP 429
    res = client.get("/api/roads", headers=headers)
    assert res.status_code == 429, f"Expected 429 for automated scraping, got {res.status_code}"
    assert "Automated scraping" in res.json()["detail"]
    assert "Retry-After" in res.headers

    print("[PASS] Anti-scraping defense successfully throttles high-frequency data harvesters.")


if __name__ == "__main__":
    print("=================================================================")
    print("Starting RoadWatch Abuse Protection & Bot Mitigation Test Suite")
    print("=================================================================")
    test_malicious_bot_user_agent_blocking()
    test_honeypot_bot_trap()
    test_ai_generation_rate_limiting()
    test_account_creation_rate_limiting()
    test_anti_scraping_protection()
    print("\n=================================================================")
    print("ALL ABUSE PROTECTION & BOT MITIGATION TESTS PASSED WITH 100%!")
    print("=================================================================")
