"""
test_idor_security.py — Insecure Direct Object Reference (IDOR) & Ownership Authorization Test Suite
====================================================================================================
Validates that:
1. State Authority cannot access or modify resources in another State (HTTP 403).
2. District Collector cannot access or modify resources in another District (HTTP 403).
3. Unauthenticated requests to repair endpoints are blocked with HTTP 401.
4. Intra-jurisdiction operations succeed with HTTP 200.
5. Super Admin possesses global jurisdiction and can manage resources across all territories.
6. /api/admin/me returns the calling user's own profile without exposure to other accounts.
"""

import os
import sys
from fastapi.testclient import TestClient

os.environ["ENV"] = "testing"

from main import app
from database import SessionLocal
from models import AdminUser, Road, Complaint, Repair
from security import verify_resource_jurisdiction, hash_password
from fastapi import HTTPException

client = TestClient(app)

def get_token(username: str, password: str) -> str:
    res = client.post("/api/admin/login", json={"username": username, "password": password})
    assert res.status_code == 200, f"Login failed for {username}: {res.text}"
    return res.json()["access_token"]


def test_unit_jurisdiction_verifier():
    print("\n--- [TEST 1] Unit Verification of Resource Jurisdiction Guard ---")
    super_admin = AdminUser(username="sa", role="Super Admin", state=None, district=None)
    state_auth = AdminUser(username="mh", role="State Authority", state="Maharashtra", district=None)
    collector = AdminUser(username="pune", role="District Collector", state="Maharashtra", district="Pune")

    # 1. Super admin can access any territory
    verify_resource_jurisdiction(super_admin, "Tamil Nadu", "Salem")
    verify_resource_jurisdiction(super_admin, "Maharashtra", "Mumbai")

    # 2. State authority can access own state
    verify_resource_jurisdiction(state_auth, "Maharashtra", "Pune")
    verify_resource_jurisdiction(state_auth, "Maharashtra", "Nagpur")

    # State authority blocked on other states
    try:
        verify_resource_jurisdiction(state_auth, "Tamil Nadu", "Salem")
        assert False, "State Authority should be blocked from Tamil Nadu!"
    except HTTPException as e:
        assert e.status_code == 403
        assert "IDOR protection" in e.detail

    # 3. District collector can access own district
    verify_resource_jurisdiction(collector, "Maharashtra", "Pune")

    # District collector blocked on other districts in same state
    try:
        verify_resource_jurisdiction(collector, "Maharashtra", "Nagpur")
        assert False, "District Collector should be blocked from Nagpur!"
    except HTTPException as e:
        assert e.status_code == 403
        assert "district" in e.detail.lower()

    # District collector blocked on other states
    try:
        verify_resource_jurisdiction(collector, "Tamil Nadu", "Salem")
        assert False, "District Collector should be blocked from Tamil Nadu!"
    except HTTPException as e:
        assert e.status_code == 403

    print("[PASS] Unit jurisdiction verification guard tests passed.")


def test_idor_unauthenticated_repairs():
    print("\n--- [TEST 2] Unauthenticated Repair Endpoints Protection ---")
    db = SessionLocal()
    road = db.query(Road).first()
    assert road is not None, "A road must exist in database"
    road_id = road.id
    db.close()

    # 1. Start repair without token -> 401
    res = client.post(f"/api/roads/{road_id}/repair/start", json={"repair_cost": 50.0})
    assert res.status_code == 401, f"Expected 401 Unauthorized, got {res.status_code}"

    # 2. Update repair without token -> 401
    res = client.post(f"/api/roads/{road_id}/repair/update", json={"repair_status": "Repair In Progress"})
    assert res.status_code == 401, f"Expected 401 Unauthorized, got {res.status_code}"

    # 3. Complete repair without token -> 401
    res = client.post(f"/api/roads/{road_id}/repair/complete")
    assert res.status_code == 401, f"Expected 401 Unauthorized, got {res.status_code}"

    print("[PASS] Anonymous repair modifications successfully blocked with HTTP 401.")


def test_cross_jurisdiction_idor_prevention():
    print("\n--- [TEST 3] Cross-Jurisdiction IDOR Attack Prevention ---")
    db = SessionLocal()

    # Find a road and complaint outside Pune jurisdiction (e.g. Uttar Pradesh, Agra)
    outside_complaint = db.query(Complaint).join(Road).filter(Road.district != "Pune").first()
    assert outside_complaint is not None, "A complaint outside Pune must exist in database"
    outside_road = outside_complaint.road

    # Authenticate as Pune District Collector (Maharashtra, Pune)
    pune_token = get_token("pune_collector", "pune123")
    pune_headers = {"Authorization": f"Bearer {pune_token}"}

    # 1. IDOR: Pune Collector attempts to assign an outside complaint -> Must be 403
    assign_res = client.post(
        f"/api/admin/complaints/{outside_complaint.id}/assign",
        json={"officer_id": 1, "notes": "Malicious cross-district assignment"},
        headers=pune_headers
    )
    assert assign_res.status_code == 403, f"Expected 403 Forbidden for cross-district assign, got {assign_res.status_code}"
    assert "IDOR protection" in assign_res.json()["detail"]

    # 2. IDOR: Pune Collector attempts to escalate an outside complaint -> Must be 403
    escalate_res = client.post(
        f"/api/admin/complaints/{outside_complaint.id}/escalate",
        json={"escalated_to": "State Authority", "reason": "Cross-district escalation"},
        headers=pune_headers
    )
    assert escalate_res.status_code == 403, f"Expected 403 Forbidden for cross-district escalate, got {escalate_res.status_code}"
    assert "IDOR protection" in escalate_res.json()["detail"]

    # 3. IDOR: Pune Collector attempts to create a repair project on outside road -> Must be 403
    repair_res = client.post(
        "/api/admin/repairs/create",
        json={
            "road_id": outside_road.id,
            "contractor_name": "Unauthorized Contractor",
            "repair_cost": 25.0
        },
        headers=pune_headers
    )
    assert repair_res.status_code == 403, f"Expected 403 Forbidden for cross-district repair create, got {repair_res.status_code}"
    assert "IDOR protection" in repair_res.json()["detail"]

    # 4. IDOR: Pune Collector attempts to start repair on outside road -> Must be 403
    start_res = client.post(
        f"/api/roads/{outside_road.id}/repair/start",
        json={"road_id": outside_road.id, "repair_cost": 20.0},
        headers=pune_headers
    )
    assert start_res.status_code == 403, f"Expected 403 Forbidden for cross-district repair start, got {start_res.status_code}"

    # 5. IDOR: Pune Collector attempts to respond to citizen on outside complaint -> Must be 403
    citizen_res = client.post(
        "/api/admin/citizen-response",
        json={"complaint_id": outside_complaint.id, "message": "Cross-district remark"},
        headers=pune_headers
    )
    assert citizen_res.status_code == 403, f"Expected 403 Forbidden for citizen-response, got {citizen_res.status_code}"

    print("[PASS] Cross-jurisdiction IDOR attacks blocked with HTTP 403.")

    # 6. Global Super Admin can manage any resource
    sa_token = get_token("admin", "admin123")
    sa_headers = {"Authorization": f"Bearer {sa_token}"}

    sa_escalate_res = client.post(
        f"/api/admin/complaints/{outside_complaint.id}/escalate",
        json={"escalated_to": "State Authority", "reason": "Authorized Super Admin audit"},
        headers=sa_headers
    )
    assert sa_escalate_res.status_code == 200, f"Super Admin should be allowed: {sa_escalate_res.text}"
    print("[PASS] Super Admin global authority verified successfully.")

    # 7. Self identity endpoint /api/admin/me
    me_res = client.get("/api/admin/me", headers=pune_headers)
    assert me_res.status_code == 200
    me_data = me_res.json()
    assert me_data["username"] == "pune_collector"
    assert me_data["district"] == "Pune"
    assert "password" not in me_data
    assert "password_hash" not in me_data
    print("[PASS] Self profile retrieval verified without cross-account exposure.")

    db.close()


if __name__ == "__main__":
    print("=================================================================")
    print("Starting RoadWatch IDOR & Ownership Authorization Test Suite")
    print("=================================================================")
    test_unit_jurisdiction_verifier()
    test_idor_unauthenticated_repairs()
    test_cross_jurisdiction_idor_prevention()
    print("\n=================================================================")
    print("ALL IDOR & OBJECT-LEVEL AUTHORIZATION TESTS PASSED WITH 100% SUCCESS!")
    print("=================================================================")
