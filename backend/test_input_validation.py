"""
test_input_validation.py — Security Test Suite for Input Validation & Upload Defense
====================================================================================
"""

import io
from fastapi.testclient import TestClient
from main import app
from sanitizer import (
    sanitize_text,
    sanitize_search_query,
    sanitize_filename,
    validate_uploaded_image
)
from schemas import (
    ComplaintCreate,
    ChatRequest,
    VoteCreate,
    VerificationCreate,
    RepairVerificationCreate,
    CitizenResponsePayload,
    AdminLogin,
    AdminUserCreate
)
from pydantic import ValidationError

def assert_validation_error(func):
    """Asserts that calling func raises Pydantic ValidationError."""
    try:
        func()
        assert False, "Expected ValidationError was not raised"
    except ValidationError:
        pass

client = TestClient(app)

print("=" * 70)
print("RUNNING COMPREHENSIVE INPUT VALIDATION & UPLOAD DEFENSE TESTS")
print("=" * 70)


def test_sql_injection_patterns_sanitized():
    """Verify that dangerous SQL injection keywords and comments are rejected with HTTP 400."""
    from fastapi import HTTPException
    sqli_payloads = [
        "NH-44'; DROP TABLE roads; --",
        "NH-44' UNION SELECT username, password FROM admin_users --",
        "NH-44' /* inline comment */ OR 1=1",
    ]
    for payload in sqli_payloads:
        try:
            sanitize_search_query(payload)
            assert False, f"Expected HTTPException 400 for SQLi payload: {payload}"
        except HTTPException as exc:
            assert exc.status_code == 400
            assert "disallowed characters or SQL syntax" in exc.detail

    # Verify live endpoint rejects SQL injection with 400
    resp = client.get("/api/roads/search", params={"q": "NH-44'; DROP TABLE roads; --"})
    assert resp.status_code == 400
    assert "disallowed characters or SQL syntax" in resp.json()["detail"]

    # Verify normal search works seamlessly with 200
    resp_valid = client.get("/api/roads/search", params={"q": "Expressway"})
    assert resp_valid.status_code == 200
    assert isinstance(resp_valid.json(), list)
    print("  [PASS] SQL injection patterns strictly rejected with HTTP 400 and normal searches succeed")


def test_sql_like_wildcard_escaping():
    """Verify % and _ wildcards are escaped to prevent ReDoS / wildcard table scans."""
    raw = "%NH_44%"
    escaped = sanitize_search_query(raw)
    assert r"\%" in escaped
    assert r"\_" in escaped
    print("  [PASS] SQL LIKE wildcards properly escaped")


def test_xss_script_tags_escaped():
    """Verify script tags and javascript: URIs are stripped or HTML-escaped."""
    xss_payloads = [
        "<script>alert('test')</script>",
        "<img src=x onerror=alert(1)>",
        "<a href=\"javascript:alert(1)\">Click</a>",
        "<iframe src=\"example.com\"></iframe>",
        "onload=alert(1)"
    ]
    for payload in xss_payloads:
        clean = sanitize_text(payload)
        assert "<script>" not in clean.lower()
        assert "javascript:" not in clean.lower()
        assert "onerror=" not in clean.lower()
        assert "onload=" not in clean.lower()
        assert "<iframe" not in clean.lower()
    print("  [PASS] Script injection vectors neutralized")


def test_complaint_schema_sanitizes_description():
    """Verify ComplaintCreate model automatically escapes HTML/XSS in descriptions."""
    model = ComplaintCreate(
        road_id=1,
        issue_type="Pothole",
        description="Dangerous pothole <script>alert(1)</script> & <b>urgent</b>",
        latitude=13.0827,
        longitude=80.2707
    )
    assert "<script>" not in model.description
    assert "&amp;" in model.description
    print("  [PASS] ComplaintCreate schema sanitizes text input")


def test_chat_schema_sanitizes_message():
    """Verify ChatRequest model escapes message text."""
    model = ChatRequest(message="<svg onload=alert(1)>")
    assert "onload=" not in model.message
    print("  [PASS] ChatRequest schema sanitizes input message")


def test_citizen_response_schema_sanitizes_message():
    """Verify CitizenResponsePayload sanitizes officer remarks."""
    model = CitizenResponsePayload(
        complaint_id=1,
        message="Notice: <script>alert('admin')</script> Repair scheduled"
    )
    assert "<script>" not in model.message
    print("  [PASS] CitizenResponsePayload sanitizes remarks")


def test_nearby_roads_invalid_coordinates_rejected():
    """Verify latitude and longitude out-of-bounds parameters return 422."""
    resp_lat_high = client.get("/api/roads/nearby", params={"lat": 95.0, "lng": 80.0, "radius_km": 50})
    assert resp_lat_high.status_code == 422

    resp_lat_low = client.get("/api/roads/nearby", params={"lat": -95.0, "lng": 80.0, "radius_km": 50})
    assert resp_lat_low.status_code == 422

    resp_lng_high = client.get("/api/roads/nearby", params={"lat": 13.0, "lng": 185.0, "radius_km": 50})
    assert resp_lng_high.status_code == 422

    resp_lng_low = client.get("/api/roads/nearby", params={"lat": 13.0, "lng": -185.0, "radius_km": 50})
    assert resp_lng_low.status_code == 422

    resp_rad_zero = client.get("/api/roads/nearby", params={"lat": 13.0, "lng": 80.0, "radius_km": 0})
    assert resp_rad_zero.status_code == 422

    resp_rad_too_large = client.get("/api/roads/nearby", params={"lat": 13.0, "lng": 80.0, "radius_km": 1000})
    assert resp_rad_too_large.status_code == 422
    print("  [PASS] Out-of-bounds coordinates and search radiuses strictly rejected with 422")


def test_complaint_coordinates_bounds_enforced():
    """Verify ComplaintCreate model rejects invalid lat/long values."""
    assert_validation_error(lambda: ComplaintCreate(
        road_id=1,
        issue_type="Pothole",
        latitude=150.0,
        longitude=80.0
    ))

    assert_validation_error(lambda: ComplaintCreate(
        road_id=-5,
        issue_type="Pothole",
        latitude=13.0,
        longitude=80.0
    ))
    print("  [PASS] Pydantic models reject negative road IDs and invalid coordinates")


def test_complaint_invalid_issue_type_rejected():
    """Verify invalid issue_type is rejected."""
    assert_validation_error(lambda: ComplaintCreate(
        road_id=1,
        issue_type="InvalidRandomIssue",
        description="Testing"
    ))
    print("  [PASS] Invalid complaint issue_type rejected")


def test_vote_invalid_type_rejected():
    """Verify VoteCreate only accepts 'upvote' or 'downvote'."""
    assert_validation_error(lambda: VoteCreate(device_id="device_12345678", vote_type="supervote"))
    print("  [PASS] Invalid vote_type rejected")


def test_verification_invalid_action_rejected():
    """Verify VerificationCreate only accepts allowed action types."""
    assert_validation_error(lambda: VerificationCreate(device_id="device_12345678", action_type="invalid_action"))
    print("  [PASS] Invalid verification action rejected")


def test_device_id_regex_pattern():
    """Verify device_id requires valid characters and min 8 chars."""
    assert_validation_error(lambda: VoteCreate(device_id="shrt", vote_type="upvote"))
    assert_validation_error(lambda: VoteCreate(device_id="dev<script>test</script>", vote_type="upvote"))
    print("  [PASS] Device ID format and length restrictions enforced")


def test_filename_sanitization_removes_path_traversal():
    """Verify sanitize_filename eliminates directory traversal and null bytes."""
    bad_filenames = [
        "../../../etc/passwd",
        "..\\..\\windows\\system32\\cmd.exe",
        "test.php\x00.jpg",
        "file;test.png",
        "nested/path/to/image.jpeg"
    ]
    for fn in bad_filenames:
        clean = sanitize_filename(fn)
        assert "../" not in clean
        assert "..\\" not in clean
        assert "\x00" not in clean
        assert ";" not in clean
        assert "/" not in clean
        assert "\\" not in clean
    print("  [PASS] Filename sanitization eliminates path traversal tokens")


async def test_upload_validator_rejects_disallowed_extensions():
    """Verify uploaded files with non-whitelisted extensions are rejected."""
    from fastapi import UploadFile

    disallowed_files = [
        ("sample.php", b"sample script"),
        ("sample.py", b"print(1)"),
        ("sample.sh", b"echo test"),
        ("sample.exe", b"binary content"),
        ("sample.html", b"<html></html>"),
    ]

    for filename, content in disallowed_files:
        mock_file = UploadFile(
            filename=filename,
            file=io.BytesIO(content)
        )
        try:
            await validate_uploaded_image(mock_file)
            assert False, f"Should have rejected {filename}"
        except Exception as e:
            assert "Disallowed file extension" in str(e) or "400" in str(e)
    print("  [PASS] Disallowed file extensions (.php, .py, .sh, .exe, .html) rejected")


async def test_upload_validator_rejects_fake_extension_magic_bytes():
    """Verify files disguised as images with invalid binary headers are rejected."""
    from fastapi import UploadFile

    fake_image = UploadFile(
        filename="fake_image.jpg",
        file=io.BytesIO(b"this is just plain text, not a jpeg binary header")
    )
    try:
        await validate_uploaded_image(fake_image)
        assert False, "Should have rejected fake image"
    except Exception as e:
        assert "Invalid image binary header" in str(e) or "400" in str(e)
    print("  [PASS] Disguised files with invalid magic byte signatures rejected")


async def test_upload_validator_accepts_valid_image():
    """Verify genuine JPEG and PNG magic byte headers are accepted."""
    from fastapi import UploadFile

    # Valid JPEG (header starts with \xFF\xD8\xFF)
    valid_jpeg = UploadFile(
        filename="pothole_photo.jpg",
        file=io.BytesIO(b"\xFF\xD8\xFF\xE0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00\xFF\xDB")
    )
    data, ext = await validate_uploaded_image(valid_jpeg)
    assert ext == ".jpg"
    assert len(data) > 0

    # Valid PNG (header starts with \x89PNG\r\n\x1a\n)
    valid_png = UploadFile(
        filename="road_inspection.png",
        file=io.BytesIO(b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01")
    )
    data, ext = await validate_uploaded_image(valid_png)
    assert ext == ".png"
    assert len(data) > 0
    print("  [PASS] Genuine JPEG and PNG files with valid magic signatures accepted")


async def test_upload_validator_rejects_oversized_file():
    """Verify files larger than 10MB are rejected."""
    from fastapi import UploadFile

    large_payload = b"\xFF\xD8\xFF" + (b"A" * (11 * 1024 * 1024))
    large_file = UploadFile(
        filename="oversized.jpg",
        file=io.BytesIO(large_payload)
    )
    try:
        await validate_uploaded_image(large_file)
        assert False, "Should have rejected oversized file"
    except Exception as e:
        assert "exceeds maximum allowed size" in str(e) or "400" in str(e)
    print("  [PASS] Oversized files exceeding 10MB ceiling rejected")


if __name__ == "__main__":
    import asyncio
    test_sql_injection_patterns_sanitized()
    test_sql_like_wildcard_escaping()
    test_xss_script_tags_escaped()
    test_complaint_schema_sanitizes_description()
    test_chat_schema_sanitizes_message()
    test_citizen_response_schema_sanitizes_message()
    test_nearby_roads_invalid_coordinates_rejected()
    test_complaint_coordinates_bounds_enforced()
    test_complaint_invalid_issue_type_rejected()
    test_vote_invalid_type_rejected()
    test_verification_invalid_action_rejected()
    test_device_id_regex_pattern()
    test_filename_sanitization_removes_path_traversal()
    asyncio.run(test_upload_validator_rejects_disallowed_extensions())
    asyncio.run(test_upload_validator_rejects_fake_extension_magic_bytes())
    asyncio.run(test_upload_validator_accepts_valid_image())
    asyncio.run(test_upload_validator_rejects_oversized_file())
    print("\n" + "=" * 70)
    print("ALL INPUT VALIDATION & UPLOAD DEFENSE TESTS PASSED (100% SUCCESS)")
    print("=" * 70)
