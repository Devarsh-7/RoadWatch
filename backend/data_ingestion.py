"""
data_ingestion.py — Data ingestion pipelines for RoadWatch.
Fetches road and geospatial data directly from:
1. OpenStreetMap (Overpass API) — Free, open-access, zero API key required.
2. Bulk CSV / Spreadsheet Importer — For custom / departmental road records.
"""

import os
import csv
import io
import logging
from datetime import datetime, date
from typing import Dict, Any, List, Optional
import requests

from models import Road
from database import SessionLocal

logger = logging.getLogger("roadwatch.ingestion")

OVERPASS_API_URL = "https://overpass-api.de/api/interpreter"


def fetch_osm_roads(db, state_name: str, limit: int = 25) -> Dict[str, Any]:
    """
    Fetch real highway data directly from OpenStreetMap Overpass API.
    Zero API key required.
    """
    logger.info(f"Querying OpenStreetMap Overpass API for state: {state_name} (limit={limit})")

    # Clean state name for Overpass query
    safe_state = state_name.strip().replace('"', '')

    # Overpass QL query: search within area or fall back to name filter
    query = f"""
    [out:json][timeout:25];
    area["name"="{safe_state}"]->.searchArea;
    (
      way["highway"~"motorway|trunk|primary"]["ref"~"^NH|^SH"](area.searchArea);
    );
    out tags center {limit};
    """

    elements = []
    try:
        response = requests.post(
            OVERPASS_API_URL,
            data={"data": query},
            headers={"User-Agent": "RoadWatch-GovPlatform/1.0 (Hackathon Educational Project)"},
            timeout=30
        )
        if response.status_code == 200:
            data = response.json()
            elements = data.get("elements", [])
    except Exception as e:
        logger.warning(f"OSM Overpass query failed for area '{safe_state}': {e}. Trying fallback bbox search.")
        elements = []

    # If area search returned no elements, try broad highway query
    if not elements:
        fallback_query = f"""
        [out:json][timeout:25];
        (
          way["highway"~"motorway|trunk"]["ref"~"^NH"](10.0,72.0,28.0,88.0);
        );
        out tags center {min(limit, 15)};
        """
        try:
            resp = requests.post(
                OVERPASS_API_URL,
                data={"data": fallback_query},
                headers={"User-Agent": "RoadWatch-GovPlatform/1.0"},
                timeout=30
            )
            if resp.status_code == 200:
                elements = resp.json().get("elements", [])
        except Exception as err:
            logger.error(f"Fallback Overpass query error: {err}")

    created_count = 0
    updated_count = 0

    for el in elements:
        tags = el.get("tags", {})
        ref = tags.get("ref", "").strip()
        name_tag = tags.get("name", "").strip()

        if not ref and not name_tag:
            continue

        # Determine road name
        if ref and name_tag:
            full_name = f"{ref} ({name_tag})"
        else:
            full_name = ref or name_tag

        # Determine road type
        if "NH" in ref.upper() or "NATIONAL" in name_tag.upper():
            road_type = "NH"
        elif "SH" in ref.upper() or "STATE" in name_tag.upper():
            road_type = "SH"
        else:
            road_type = "MDR"

        # Extract coordinates
        center = el.get("center", {})
        lat = center.get("lat")
        lon = center.get("lon")

        # Estimate length or use default stretch
        length_km = round(float(tags.get("distance", 35.0)), 1)
        district = tags.get("addr:district") or tags.get("county") or "Central District"

        existing = db.query(Road).filter(Road.road_name == full_name).first()
        if existing:
            if lat and lon:
                existing.latitude_start = lat
                existing.longitude_start = lon
            existing.data_source = "OpenStreetMap (Overpass API)"
            existing.last_updated = datetime.now()
            updated_count += 1
        else:
            new_road = Road(
                road_name=full_name,
                road_type=road_type,
                state=safe_state,
                district=district,
                length_km=length_km,
                condition="Fair",
                budget_sanctioned=round(length_km * 0.85, 2),  # Estimated ₹0.85 Cr/km benchmark
                budget_spent=round(length_km * 0.72, 2),
                latitude_start=lat,
                longitude_start=lon,
                data_source="OpenStreetMap (Overpass API)",
                last_repair_date=date(2025, 1, 15)
            )
            db.add(new_road)
            created_count += 1

    db.commit()
    return {
        "status": "success",
        "source": "OpenStreetMap Overpass API",
        "state": safe_state,
        "records_received": len(elements),
        "roads_created": created_count,
        "roads_updated": updated_count
    }


def import_roads_csv(db, csv_bytes_or_str, filename: str = "import.csv") -> Dict[str, Any]:
    """
    Bulk import roads from a CSV file.
    Accepts bytes or string.
    """
    if isinstance(csv_bytes_or_str, bytes):
        text = csv_bytes_or_str.decode("utf-8-sig", errors="replace")
    else:
        text = str(csv_bytes_or_str)

    reader = csv.DictReader(io.StringIO(text))
    created = 0
    updated = 0
    errors = []

    # Map possible column header variations
    def get_val(row, *aliases):
        for a in aliases:
            for k in row:
                if k.strip().lower() == a.lower():
                    val = row[k].strip()
                    if val != "":
                        return val
        return None

    for idx, row in enumerate(reader, start=2):
        name = get_val(row, "road_name", "name", "highway", "title")
        if not name:
            errors.append(f"Row {idx}: missing road_name")
            continue

        road_type = (get_val(row, "road_type", "type") or "NH").upper()
        state = get_val(row, "state", "state_name") or "Tamil Nadu"
        district = get_val(row, "district", "district_name", "city") or "General"

        try:
            length_km = float(get_val(row, "length_km", "length", "distance") or 25.0)
        except ValueError:
            length_km = 25.0

        try:
            budget_sanctioned = float(get_val(row, "budget_sanctioned", "budget", "sanctioned") or 0.0)
        except ValueError:
            budget_sanctioned = None

        try:
            budget_spent = float(get_val(row, "budget_spent", "spent", "utilized") or 0.0)
        except ValueError:
            budget_spent = None

        contractor = get_val(row, "contractor_name", "contractor", "agency")
        contractor_contact = get_val(row, "contractor_contact", "contact")
        engineer = get_val(row, "exec_engineer", "engineer", "officer")
        condition = get_val(row, "condition", "status") or "Fair"

        def to_float(v):
            if v is not None:
                try:
                    return float(v)
                except ValueError:
                    pass
            return None

        lat_start = to_float(get_val(row, "latitude_start", "lat_start", "lat"))
        lng_start = to_float(get_val(row, "longitude_start", "lng_start", "lon", "lng"))
        lat_end = to_float(get_val(row, "latitude_end", "lat_end"))
        lng_end = to_float(get_val(row, "longitude_end", "lng_end"))

        existing = db.query(Road).filter(Road.road_name == name).first()
        if existing:
            existing.road_type = road_type
            existing.state = state
            existing.district = district
            existing.length_km = length_km
            if budget_sanctioned is not None:
                existing.budget_sanctioned = budget_sanctioned
            if budget_spent is not None:
                existing.budget_spent = budget_spent
            if contractor:
                existing.contractor_name = contractor
            if contractor_contact:
                existing.contractor_contact = contractor_contact
            if engineer:
                existing.exec_engineer = engineer
            if lat_start is not None and lng_start is not None:
                existing.latitude_start = lat_start
                existing.longitude_start = lng_start
            existing.data_source = f"CSV Import ({filename})"
            existing.last_updated = datetime.now()
            updated += 1
        else:
            new_road = Road(
                road_name=name,
                road_type=road_type,
                state=state,
                district=district,
                length_km=length_km,
                contractor_name=contractor,
                contractor_contact=contractor_contact,
                condition=condition,
                budget_sanctioned=budget_sanctioned,
                budget_spent=budget_spent,
                exec_engineer=engineer,
                latitude_start=lat_start,
                longitude_start=lng_start,
                latitude_end=lat_end,
                longitude_end=lng_end,
                data_source=f"CSV Import ({filename})",
                last_repair_date=date.today()
            )
            db.add(new_road)
            created += 1

    db.commit()
    return {
        "status": "success",
        "filename": filename,
        "roads_created": created,
        "roads_updated": updated,
        "errors": errors
    }
