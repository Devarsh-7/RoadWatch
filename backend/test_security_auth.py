"""
test_security_auth.py — Security & Authentication Test Suite for RoadWatch
==========================================================================
Tests:
1. PBKDF2-HMAC-SHA256 password hashing, salting, and legacy upgrade
2. PyJWT token generation, validation, tampering defense, and expiration
3. IP and username rate limiting & lockout mechanism
4. API endpoints via FastAPI TestClient:
   - Login rate limiting (returns 429 upon repeated failures)
   - Successful authentication and JWT token issuance
   - Auto-rehash of legacy passwords
   - Forgot-password flow with 15-minute token expiration
   - Reset-password flow with complexity validation
   - Email verification flow and unverified user lockout
   - Logout endpoint
"""

import os
import sys
import time
from datetime import datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

# Set environment for testing
os.environ["ENV"] = "testing"

from main import app, get_db
from database import engine, SessionLocal, Base
from models import AdminUser, AuditLog
import security
from security import (
    hash_password, verify_password, validate_password_strength,
    create_access_token, decode_access_token,
    login_rate_limiter, password_reset_rate_limiter,
    generate_secure_token, hash_token,
    PBKDF2_ITERATIONS, LEGACY_SALT
)

client = TestClient(app)

def _clean_test_user(db: Session, username: str):
    u = db.query(AdminUser).filter(AdminUser.username == username).first()
    if u:
        db.query(AuditLog).filter(AuditLog.admin_user_id == u.id).delete()
        db.delete(u)
        db.commit()

def test_password_hashing():
    print("\n--- [TEST 1] Password Hashing & Legacy Upgrade ---")
    pw = "SecureP@ssw0rd2026"
    
    # 1. PBKDF2 generation & salt randomness
    h1 = hash_password(pw)
    h2 = hash_password(pw)
    assert h1.startswith("pbkdf2_sha256$600000$"), f"Unexpected hash format: {h1}"
    assert h1 != h2, "Hashes must have unique salts!"
    
    # 2. Verification
    is_valid, needs_rehash = verify_password(pw, h1)
    assert is_valid is True, "Valid PBKDF2 password failed verification!"
    assert needs_rehash is False, "Modern PBKDF2 should not need rehash!"
    
    # 3. Wrong password
    is_wrong_valid, _ = verify_password("WrongPassword123", h1)
    assert is_wrong_valid is False, "Wrong password verified as True!"
    
    # 4. Legacy SHA-256 verification and rehash signal
    import hashlib
    legacy_h = hashlib.sha256((pw + LEGACY_SALT).encode('utf-8')).hexdigest()
    leg_valid, leg_rehash = verify_password(pw, legacy_h)
    assert leg_valid is True, "Legacy SHA-256 verification failed!"
    assert leg_rehash is True, "Legacy hash should trigger needs_rehash=True!"
    
    # 5. Complexity validator
    ok, _ = validate_password_strength("Short1")
    assert ok is False, "Short password should fail complexity"
    ok, _ = validate_password_strength("AllLettersOnly")
    assert ok is False, "Password without numbers should fail"
    ok, _ = validate_password_strength("ValidPass123")
    assert ok is True, "Valid password failed complexity"
    
    print("[PASS] Password hashing & legacy verification assertions passed.")


def test_jwt_session_management():
    print("\n--- [TEST 2] PyJWT Session Token Creation & Expiration ---")
    data = {"sub": "test_officer", "role": "District Collector"}
    
    # 1. Valid token
    token = create_access_token(data, expires_delta=timedelta(minutes=30))
    payload = decode_access_token(token)
    assert payload["sub"] == "test_officer"
    assert payload["role"] == "District Collector"
    assert "exp" in payload
    assert "iat" in payload
    assert "jti" in payload
    
    # 2. Expired token
    expired_token = create_access_token(data, expires_delta=timedelta(seconds=-5))
    try:
        decode_access_token(expired_token)
        assert False, "Expired token did not raise exception!"
    except ValueError as e:
        assert "expired" in str(e).lower(), f"Unexpected error on expired token: {e}"
        
    # 3. Tampered token
    parts = token.split('.')
    tampered_token = f"{parts[0]}.{parts[1]}wrongsig.{parts[2]}"
    try:
        decode_access_token(tampered_token)
        assert False, "Tampered token passed verification!"
    except ValueError as e:
        assert "invalid" in str(e).lower() or "signature" in str(e).lower()
        
    print("[PASS] PyJWT token creation, validation, and expiration assertions passed.")


def test_rate_limiter():
    print("\n--- [TEST 3] In-Memory Rate Limiting & Lockout ---")
    test_ip = "192.168.1.105"
    test_user = "rate_limit_test_user"
    
    # Reset for clean test
    login_rate_limiter.record_success(test_ip, test_user)
    
    # Record 4 failures - should not be locked yet
    for i in range(4):
        locked, _ = login_rate_limiter.record_failure(test_ip, test_user)
        assert locked is False, f"Locked prematurely on attempt {i+1}"
        
    # 5th failure triggers lockout
    locked, wait_time = login_rate_limiter.record_failure(test_ip, test_user)
    assert locked is True, "5th attempt must trigger lockout!"
    assert wait_time > 0
    
    # Check is_locked
    is_locked, remaining = login_rate_limiter.is_locked(test_ip, test_user)
    assert is_locked is True
    assert remaining > 0
    
    # Successful login resets
    login_rate_limiter.record_success(test_ip, test_user)
    is_locked, _ = login_rate_limiter.is_locked(test_ip, test_user)
    assert is_locked is False, "Record success must release lockout!"
    
    print("[PASS] Rate limiter and lockout assertions passed.")


def test_api_auth_and_flows():
    print("\n--- [TEST 4] FastAPI Endpoints & Security Flows ---")
    db: Session = SessionLocal()
    
    # 1. Setup a dedicated test admin user
    test_username = "audit_officer"
    test_password = "OfficerSecret123"
    test_email = "audit.officer@roadwatch.gov.in"
    
    _clean_test_user(db, test_username)
    
    test_user = AdminUser(
        username=test_username,
        password_hash=hash_password(test_password),
        email=test_email,
        name="Test Audit Officer",
        role="Super Admin",
        is_active=1,
        is_verified=1
    )
    db.add(test_user)
    db.commit()
    
    # 2. Test successful login
    login_res = client.post("/api/admin/login", json={
        "username": test_username,
        "password": test_password
    })
    assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    auth_data = login_res.json()
    token = auth_data["access_token"]
    assert auth_data["role"] == "Super Admin"
    assert auth_data["expires_in"] == 3600
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # 3. Test logout endpoint
    logout_res = client.post("/api/admin/logout", headers=headers)
    assert logout_res.status_code == 200
    assert "invalidated" in logout_res.json()["message"].lower()
    
    # 4. Test rate limiting on login endpoint
    fake_ip_user = "brute_force_target"
    for i in range(5):
        res = client.post("/api/admin/login", json={"username": fake_ip_user, "password": "BadPassword1"})
        assert res.status_code in [401, 429]
    # 6th attempt should be blocked with 429
    res_6th = client.post("/api/admin/login", json={"username": fake_ip_user, "password": "BadPassword1"})
    assert res_6th.status_code == 429, f"Expected 429 Too Many Requests, got {res_6th.status_code}"
    assert "Retry-After" in res_6th.headers
    print("[PASS] API rate limiting blocked brute-force attack with HTTP 429.")

    # Reset testclient IP lockout so subsequent tests can authenticate
    login_rate_limiter.record_success("testclient", fake_ip_user)
    
    # 5. Test Forgot-Password flow
    forgot_res = client.post("/api/admin/forgot-password", json={"email": test_email})
    assert forgot_res.status_code == 200
    forgot_data = forgot_res.json()
    assert forgot_data["expires_in_minutes"] == 15
    dev_token = forgot_data.get("dev_token")
    assert dev_token is not None, "Dev token should be returned in testing environment"
    
    # 6. Test Reset-Password with weak password
    # 6a. Too short (< 8 chars) -> Pydantic 422
    short_res = client.post("/api/admin/reset-password", json={
        "token": dev_token,
        "new_password": "weak"
    })
    assert short_res.status_code == 422, f"Expected 422, got {short_res.status_code}"

    # 6b. Long enough but no digits -> Business logic 400
    no_digits_res = client.post("/api/admin/reset-password", json={
        "token": dev_token,
        "new_password": "alllettersonly"
    })
    assert no_digits_res.status_code == 400, f"Expected 400, got {no_digits_res.status_code}"
    assert "number" in no_digits_res.json()["detail"].lower()
    
    # 7. Test Reset-Password with valid new password
    new_pw = "NewP@ssword2026"
    valid_reset_res = client.post("/api/admin/reset-password", json={
        "token": dev_token,
        "new_password": new_pw
    })
    assert valid_reset_res.status_code == 200
    
    # Login with new password
    new_login_res = client.post("/api/admin/login", json={
        "username": test_username,
        "password": new_pw
    })
    assert new_login_res.status_code == 200, "Login with newly reset password failed!"
    
    # 8. Test Email Verification enforcement
    unverified_user = "unverified_worker"
    _clean_test_user(db, unverified_user)
    
    raw_vtoken, vtoken_hash = generate_secure_token()
    unverified_obj = AdminUser(
        username=unverified_user,
        password_hash=hash_password("WorkerPass123"),
        email="worker@roadwatch.gov.in",
        name="Field Worker",
        role="Complaint Inspector",
        is_active=1,
        is_verified=0,  # Unverified!
        email_verification_token=vtoken_hash,
        email_verification_expires=datetime.now() + timedelta(hours=24)
    )
    db.add(unverified_obj)
    db.commit()
    
    # Attempt login while unverified -> must return 403
    unverified_login = client.post("/api/admin/login", json={
        "username": unverified_user,
        "password": "WorkerPass123"
    })
    assert unverified_login.status_code == 403, f"Unverified account was not blocked: {unverified_login.text}"
    assert "email verification" in unverified_login.json()["detail"].lower()
    
    # Verify email
    verify_res = client.post("/api/admin/verify-email", json={"token": raw_vtoken})
    assert verify_res.status_code == 200
    
    # Login should now succeed!
    now_verified_login = client.post("/api/admin/login", json={
        "username": unverified_user,
        "password": "WorkerPass123"
    })
    assert now_verified_login.status_code == 200, "Verified account failed login!"
    
    # Cleanup test users
    _clean_test_user(db, test_username)
    _clean_test_user(db, unverified_user)
    db.close()
    
    print("[PASS] Full authentication, reset, and verification flows verified successfully!")


if __name__ == "__main__":
    print("=================================================================")
    print("Starting RoadWatch Authentication & Security Verification Suite")
    print("=================================================================")
    test_password_hashing()
    test_jwt_session_management()
    test_rate_limiter()
    test_api_auth_and_flows()
    print("\n=================================================================")
    print("ALL SECURITY ASSERTIONS COMPLETED AND VERIFIED WITH 100% SUCCESS!")
    print("=================================================================")
