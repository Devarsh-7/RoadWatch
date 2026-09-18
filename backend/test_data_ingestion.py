"""
test_data_ingestion.py — Verification tests for direct data ingestion pipeline:
1. OpenStreetMap (Overpass API) ingestion (Zero API Key)
2. Bulk CSV import
3. Protected Admin API endpoints
"""

import os
import io
import sys

from fastapi.testclient import TestClient

from main import app
from database import SessionLocal
from models import Road, AdminUser
from data_ingestion import fetch_osm_roads, import_roads_csv
from security import create_access_token

client = TestClient(app, base_url="http://testserver")


def get_admin_headers():
    """Generates an authorized JWT for an admin officer."""
    db = SessionLocal()
    try:
        user = db.query(AdminUser).filter(AdminUser.is_active == 1).first()
        if not user:
            from security import hash_password
            user = AdminUser(
                username="admin_test",
                password_hash=hash_password("AdminPass123!"),
                email="admin_test@roadwatch.gov.in",
                name="System Administrator",
                role="Super Admin",
                is_active=1,
                is_verified=1
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        token = create_access_token({
            "sub": user.username,
            "role": user.role,
            "state": user.state,
            "district": user.district
        })
        return {"Authorization": f"Bearer {token}"}
    finally:
        db.close()


def test_osm_ingestion_direct():
    """Test OSM Overpass ingestion function directly."""
    db = SessionLocal()
    try:
        result = fetch_osm_roads(db, state_name="Tamil Nadu", limit=5)
        assert result["status"] == "success"
        assert result["source"] == "OpenStreetMap Overpass API"
        assert "roads_created" in result
        assert "roads_updated" in result
        print(f"[PASS] OSM Ingestion result: {result}")
    finally:
        db.close()


def test_csv_import_direct():
    """Test bulk CSV parser directly."""
    db = SessionLocal()
    try:
        csv_content = (
            "road_name,road_type,state,district,length_km,budget_sanctioned,budget_spent,contractor_name,lat_start,lng_start\n"
            "NH-999 Test Expressway,NH,Gujarat,Ahmedabad,45.0,80.0,72.0,Adani Road Transport,23.0225,72.5714\n"
            "SH-888 Test State Highway,SH,Gujarat,Vadodara,28.0,30.0,25.5,L&T Construction,22.3072,73.1812\n"
        ).encode("utf-8")

        result = import_roads_csv(db, csv_content, filename="test_roads.csv")
        assert result["status"] == "success"
        assert result["roads_created"] >= 1 or result["roads_updated"] >= 1
        assert len(result["errors"]) == 0

        road = db.query(Road).filter(Road.road_name == "NH-999 Test Expressway").first()
        assert road is not None
        assert road.state == "Gujarat"
        assert road.budget_sanctioned == 80.0
        print(f"[PASS] CSV Bulk Import result: {result}")
    finally:
        db.close()


def test_api_ingestion_endpoints():
    """Verify ingestion endpoints security (401 unauthorized) and admin execution (200)."""
    # 1. Test unauthorized rejection
    res_osm = client.post("/api/admin/ingest/osm", json={"state": "Tamil Nadu", "limit": 5})
    assert res_osm.status_code == 401, f"Expected 401, got {res_osm.status_code}"

    res_csv = client.post("/api/admin/roads/bulk-import", files={"file": ("test.csv", b"dummy content", "text/csv")})
    assert res_csv.status_code == 401, f"Expected 401, got {res_csv.status_code}"

    # 2. Test authorized execution
    admin_headers = get_admin_headers()

    # Ingest CSV file
    csv_data = (
        "road_name,road_type,state,district,length_km,budget_sanctioned,budget_spent,contractor_name\n"
        "NH-111 FastTrack Highway,NH,Maharashtra,Pune,65.0,110.0,95.0,Dilip Buildcon\n"
    ).encode("utf-8")
    files = {"file": ("fasttrack_roads.csv", io.BytesIO(csv_data), "text/csv")}
    res_csv = client.post("/api/admin/roads/bulk-import", files=files, headers=admin_headers)
    assert res_csv.status_code == 200, f"Expected 200, got {res_csv.status_code}: {res_csv.text}"
    assert res_csv.json()["status"] == "success"

    # Reject non-csv file
    bad_files = {"file": ("roads.exe", io.BytesIO(b"executable data"), "application/octet-stream")}
    res_bad = client.post("/api/admin/roads/bulk-import", files=bad_files, headers=admin_headers)
    assert res_bad.status_code == 400

    print("[PASS] All admin API ingestion endpoints verified successfully!")


if __name__ == "__main__":
    print("=================================================================")
    print("Starting RoadWatch Clean Data Ingestion Verification Suite")
    print("=================================================================")
    test_osm_ingestion_direct()
    test_csv_import_direct()
    test_api_ingestion_endpoints()
    print("\n=================================================================")
    print("ALL CLEAN INGESTION TESTS PASSED WITH 100% SUCCESS!")
    print("=================================================================")
