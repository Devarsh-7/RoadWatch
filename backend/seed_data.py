"""
seed_data.py — Populate the RoadWatch database with 20 realistic
Indian roads across 5 states, plus matching authorities.

Run directly:  python seed_data.py
Or called from main.py on first launch.
"""

import os
from datetime import date, datetime, timedelta
import hashlib
from database import engine, SessionLocal, Base
from security import hash_password
from models import (
    Road, Authority, Complaint, Vote, ComplaintVerification,
    Repair, RepairMedia, RepairVerification, RepairProgressLog,
    AdminUser, OfficerRole, RepairAssignment, Escalation, AuditLog,
    ContractorPerformance, DistrictReport
)


def seed():
    """Create tables and insert sample data (idempotent — skips if data exists)."""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    # Skip if already seeded
    if db.query(Road).count() > 0:
        if db.query(Repair).count() == 0:
            print("[INFO] Roads already seeded. Seeding missing Repairs...")
            seed_repairs(db)
        seed_admin_data(db)
        db.close()
        return

    # ─────────────────────────────────────────────────────
    # 20 Realistic Indian Roads
    # ─────────────────────────────────────────────────────
    roads = [
        # ── Tamil Nadu (5 roads) ─────────────────────────
        Road(
            road_name="NH-44 (Chennai – Madurai Section)",
            road_type="NH",
            state="Tamil Nadu",
            district="Kanchipuram",
            length_km=462.0,
            contractor_name="L&T Infrastructure",
            contractor_contact="+91 44 2345 6789",
            last_repair_date=date(2025, 8, 15),
            condition="Good",
            budget_sanctioned=285.50,
            budget_spent=241.30,
            exec_engineer="Er. S. Ramanathan",
            engineer_contact="+91 94421 56789",
            engineer_email="s.ramanathan@nhai.gov.in",
            latitude_start=13.0827,
            longitude_start=80.2707,
            latitude_end=9.9252,
            longitude_end=78.1198,
            data_source="NHAI PMIS Portal",
        ),
        Road(
            road_name="NH-32 (Tirunelveli – Kanyakumari)",
            road_type="NH",
            state="Tamil Nadu",
            district="Tirunelveli",
            length_km=87.0,
            contractor_name="Dilip Buildcon Ltd",
            contractor_contact="+91 44 2890 1234",
            last_repair_date=date(2024, 3, 20),
            condition="Fair",
            budget_sanctioned=52.40,
            budget_spent=48.10,
            exec_engineer="Er. K. Meenakshi",
            engineer_contact="+91 94425 67890",
            engineer_email="k.meenakshi@nhai.gov.in",
            latitude_start=8.7139,
            longitude_start=77.7567,
            latitude_end=8.0883,
            longitude_end=77.5385,
            data_source="NHAI PMIS Portal",
        ),
        Road(
            road_name="SH-49 (Coimbatore – Pollachi)",
            road_type="SH",
            state="Tamil Nadu",
            district="Coimbatore",
            length_km=42.0,
            contractor_name="NCC Infrastructure",
            contractor_contact="+91 422 234 5678",
            last_repair_date=date(2025, 11, 5),
            condition="Good",
            budget_sanctioned=18.75,
            budget_spent=16.20,
            exec_engineer="Er. P. Vivek Kumar",
            engineer_contact="+91 98765 43210",
            engineer_email="vivek.pwd@tn.gov.in",
            latitude_start=11.0168,
            longitude_start=76.9558,
            latitude_end=10.6600,
            longitude_end=77.0100,
            data_source="TN PWD Records",
        ),
        Road(
            road_name="SH-68 (Salem – Namakkal)",
            road_type="SH",
            state="Tamil Nadu",
            district="Salem",
            length_km=55.0,
            contractor_name="KNR Constructions",
            contractor_contact="+91 427 234 9876",
            last_repair_date=date(2023, 6, 10),
            condition="Poor",
            budget_sanctioned=22.10,
            budget_spent=14.50,
            exec_engineer="Er. R. Sundaram",
            engineer_contact="+91 94422 11223",
            engineer_email="r.sundaram@tn.gov.in",
            latitude_start=11.6643,
            longitude_start=78.1460,
            latitude_end=11.2189,
            longitude_end=78.1674,
            data_source="TN PWD Records",
        ),
        Road(
            road_name="MDR-127 (Thanjavur – Kumbakonam Link)",
            road_type="MDR",
            state="Tamil Nadu",
            district="Thanjavur",
            length_km=38.0,
            contractor_name="Ramky Infrastructure",
            contractor_contact="+91 4362 234567",
            last_repair_date=date(2022, 12, 1),
            condition="Poor",
            budget_sanctioned=8.60,
            budget_spent=5.30,
            exec_engineer="Er. A. Balasubramanian",
            engineer_contact="+91 94421 78965",
            engineer_email="bala.dist@tn.gov.in",
            latitude_start=10.7867,
            longitude_start=79.1378,
            latitude_end=10.9617,
            longitude_end=79.3881,
            data_source="District Collector Office, Thanjavur",
        ),

        # ── Maharashtra (4 roads) ───────────────────────
        Road(
            road_name="NH-8 (Mumbai – Pune Expressway)",
            road_type="NH",
            state="Maharashtra",
            district="Pune",
            length_km=94.5,
            contractor_name="IRB Infrastructure Developers",
            contractor_contact="+91 22 6640 1000",
            last_repair_date=date(2025, 10, 20),
            condition="Good",
            budget_sanctioned=420.00,
            budget_spent=395.60,
            exec_engineer="Er. Vijay Deshmukh",
            engineer_contact="+91 98201 45678",
            engineer_email="v.deshmukh@nhai.gov.in",
            latitude_start=19.0760,
            longitude_start=72.8777,
            latitude_end=18.5204,
            longitude_end=73.8567,
            data_source="NHAI PMIS Portal",
        ),
        Road(
            road_name="NH-61 (Nashik – Pune via Ahmednagar)",
            road_type="NH",
            state="Maharashtra",
            district="Ahmednagar",
            length_km=211.0,
            contractor_name="Ashoka Buildcon",
            contractor_contact="+91 241 234 5678",
            last_repair_date=date(2024, 7, 12),
            condition="Fair",
            budget_sanctioned=145.30,
            budget_spent=120.80,
            exec_engineer="Er. Priya Patil",
            engineer_contact="+91 90112 33445",
            engineer_email="p.patil@nhai.gov.in",
            latitude_start=19.9975,
            longitude_start=73.7898,
            latitude_end=18.5204,
            longitude_end=73.8567,
            data_source="NHAI PMIS Portal",
        ),
        Road(
            road_name="SH-60 (Nagpur – Wardha)",
            road_type="SH",
            state="Maharashtra",
            district="Nagpur",
            length_km=78.0,
            contractor_name="Sadbhav Engineering",
            contractor_contact="+91 712 234 5678",
            last_repair_date=date(2025, 2, 28),
            condition="Good",
            budget_sanctioned=35.20,
            budget_spent=30.50,
            exec_engineer="Er. Aman Joshi",
            engineer_contact="+91 93722 54321",
            engineer_email="aman.pwd@maharashtra.gov.in",
            latitude_start=21.1458,
            longitude_start=79.0882,
            latitude_end=20.7453,
            longitude_end=78.6022,
            data_source="Maharashtra PWD Records",
        ),
        Road(
            road_name="MDR-44 (Kolhapur – Ratnagiri Link)",
            road_type="MDR",
            state="Maharashtra",
            district="Kolhapur",
            length_km=120.0,
            contractor_name="Hindustan Construction Co.",
            contractor_contact="+91 231 234 5678",
            last_repair_date=date(2023, 9, 15),
            condition="Poor",
            budget_sanctioned=42.00,
            budget_spent=28.70,
            exec_engineer="Er. Snehal Rane",
            engineer_contact="+91 98509 87654",
            engineer_email="snehal.dist@maharashtra.gov.in",
            latitude_start=16.7050,
            longitude_start=74.2433,
            latitude_end=16.9944,
            longitude_end=73.3001,
            data_source="District Collector Office, Kolhapur",
        ),

        # ── Uttar Pradesh (4 roads) ─────────────────────
        Road(
            road_name="NH-19 (Agra – Lucknow Expressway)",
            road_type="NH",
            state="Uttar Pradesh",
            district="Agra",
            length_km=302.0,
            contractor_name="UP Expressways Industrial Dev. Authority",
            contractor_contact="+91 522 234 5678",
            last_repair_date=date(2025, 6, 30),
            condition="Good",
            budget_sanctioned=680.00,
            budget_spent=612.50,
            exec_engineer="Er. Rajesh Tiwari",
            engineer_contact="+91 94151 23456",
            engineer_email="r.tiwari@nhai.gov.in",
            latitude_start=27.1767,
            longitude_start=78.0081,
            latitude_end=26.8467,
            longitude_end=80.9462,
            data_source="NHAI PMIS Portal",
        ),
        Road(
            road_name="NH-27 (Lucknow – Varanasi)",
            road_type="NH",
            state="Uttar Pradesh",
            district="Lucknow",
            length_km=320.0,
            contractor_name="Gayatri Projects Ltd",
            contractor_contact="+91 522 890 1234",
            last_repair_date=date(2024, 11, 10),
            condition="Fair",
            budget_sanctioned=195.00,
            budget_spent=162.40,
            exec_engineer="Er. Savitri Mishra",
            engineer_contact="+91 99365 67890",
            engineer_email="s.mishra@nhai.gov.in",
            latitude_start=26.8467,
            longitude_start=80.9462,
            latitude_end=25.3176,
            longitude_end=82.9739,
            data_source="NHAI PMIS Portal",
        ),
        Road(
            road_name="SH-21 (Kanpur – Jhansi)",
            road_type="SH",
            state="Uttar Pradesh",
            district="Kanpur",
            length_km=225.0,
            contractor_name="PNC Infratech Ltd",
            contractor_contact="+91 512 234 5678",
            last_repair_date=date(2023, 4, 18),
            condition="Poor",
            budget_sanctioned=78.50,
            budget_spent=52.60,
            exec_engineer="Er. Deepak Verma",
            engineer_contact="+91 94150 22334",
            engineer_email="deepak.pwd@up.gov.in",
            latitude_start=26.4499,
            longitude_start=80.3319,
            latitude_end=25.4484,
            longitude_end=78.5685,
            data_source="UP PWD Records",
        ),
        Road(
            road_name="MDR-9 (Gorakhpur – Deoria Link)",
            road_type="MDR",
            state="Uttar Pradesh",
            district="Gorakhpur",
            length_km=56.0,
            contractor_name="BL Kashyap & Sons Ltd",
            contractor_contact="+91 551 234 5678",
            last_repair_date=date(2022, 8, 25),
            condition="Poor",
            budget_sanctioned=12.40,
            budget_spent=7.80,
            exec_engineer="Er. Amita Singh",
            engineer_contact="+91 94157 88990",
            engineer_email="amita.dist@up.gov.in",
            latitude_start=26.7606,
            longitude_start=83.3732,
            latitude_end=26.5024,
            longitude_end=83.7791,
            data_source="District Collector Office, Gorakhpur",
        ),

        # ── Karnataka (4 roads) ─────────────────────────
        Road(
            road_name="NH-75 (Bengaluru – Mangaluru)",
            road_type="NH",
            state="Karnataka",
            district="Bengaluru Urban",
            length_km=352.0,
            contractor_name="MEP Infrastructure Developers",
            contractor_contact="+91 80 2345 6789",
            last_repair_date=date(2025, 4, 10),
            condition="Good",
            budget_sanctioned=310.00,
            budget_spent=275.40,
            exec_engineer="Er. Nagaraj Shetty",
            engineer_contact="+91 98450 12345",
            engineer_email="n.shetty@nhai.gov.in",
            latitude_start=12.9716,
            longitude_start=77.5946,
            latitude_end=12.9141,
            longitude_end=74.8560,
            data_source="NHAI PMIS Portal",
        ),
        Road(
            road_name="NH-48 (Bengaluru – Tumkur)",
            road_type="NH",
            state="Karnataka",
            district="Tumkur",
            length_km=70.0,
            contractor_name="NHAI Direct",
            contractor_contact="+91 80 6789 0123",
            last_repair_date=date(2025, 9, 1),
            condition="Good",
            budget_sanctioned=55.80,
            budget_spent=50.20,
            exec_engineer="Er. Lakshmi Devi",
            engineer_contact="+91 99002 33445",
            engineer_email="l.devi@nhai.gov.in",
            latitude_start=12.9716,
            longitude_start=77.5946,
            latitude_end=13.3379,
            longitude_end=77.1173,
            data_source="NHAI PMIS Portal",
        ),
        Road(
            road_name="SH-17 (Mysuru – Hunsur)",
            road_type="SH",
            state="Karnataka",
            district="Mysuru",
            length_km=48.0,
            contractor_name="Navayuga Engineering",
            contractor_contact="+91 821 234 5678",
            last_repair_date=date(2024, 5, 22),
            condition="Fair",
            budget_sanctioned=21.60,
            budget_spent=18.30,
            exec_engineer="Er. Prakash Gowda",
            engineer_contact="+91 94481 55667",
            engineer_email="prakash.pwd@karnataka.gov.in",
            latitude_start=12.2958,
            longitude_start=76.6394,
            latitude_end=12.3052,
            longitude_end=76.2898,
            data_source="Karnataka PWD Records",
        ),
        Road(
            road_name="MDR-82 (Hubli – Dharwad Ring Road)",
            road_type="MDR",
            state="Karnataka",
            district="Dharwad",
            length_km=32.0,
            contractor_name="JMC Projects India Ltd",
            contractor_contact="+91 836 234 5678",
            last_repair_date=date(2025, 1, 14),
            condition="Fair",
            budget_sanctioned=14.20,
            budget_spent=11.80,
            exec_engineer="Er. Vinay Kulkarni",
            engineer_contact="+91 94482 99001",
            engineer_email="vinay.dist@karnataka.gov.in",
            latitude_start=15.3647,
            longitude_start=75.1240,
            latitude_end=15.4589,
            longitude_end=75.0078,
            data_source="District Collector Office, Dharwad",
        ),

        # ── Rajasthan (3 roads) ─────────────────────────
        Road(
            road_name="NH-48 (Jaipur – Udaipur)",
            road_type="NH",
            state="Rajasthan",
            district="Jaipur",
            length_km=396.0,
            contractor_name="Essel Infraprojects Ltd",
            contractor_contact="+91 141 234 5678",
            last_repair_date=date(2025, 3, 5),
            condition="Good",
            budget_sanctioned=240.00,
            budget_spent=205.70,
            exec_engineer="Er. Mahendra Singh Rathore",
            engineer_contact="+91 94140 12345",
            engineer_email="m.rathore@nhai.gov.in",
            latitude_start=26.9124,
            longitude_start=75.7873,
            latitude_end=24.5854,
            longitude_end=73.7125,
            data_source="NHAI PMIS Portal",
        ),
        Road(
            road_name="NH-52 (Jaipur – Delhi via Kotputli)",
            road_type="NH",
            state="Rajasthan",
            district="Jaipur",
            length_km=270.0,
            contractor_name="Oriental Structural Engineers",
            contractor_contact="+91 141 890 1234",
            last_repair_date=date(2024, 9, 18),
            condition="Fair",
            budget_sanctioned=165.00,
            budget_spent=138.20,
            exec_engineer="Er. Kavita Sharma",
            engineer_contact="+91 98290 56789",
            engineer_email="k.sharma@nhai.gov.in",
            latitude_start=26.9124,
            longitude_start=75.7873,
            latitude_end=28.6139,
            longitude_end=77.2090,
            data_source="NHAI PMIS Portal",
        ),
        Road(
            road_name="SH-8 (Jodhpur – Barmer)",
            road_type="SH",
            state="Rajasthan",
            district="Jodhpur",
            length_km=198.0,
            contractor_name="Gawar Construction Ltd",
            contractor_contact="+91 291 234 5678",
            last_repair_date=date(2023, 11, 30),
            condition="Poor",
            budget_sanctioned=56.00,
            budget_spent=34.20,
            exec_engineer="Er. Hemant Gehlot",
            engineer_contact="+91 94141 78965",
            engineer_email="hemant.pwd@rajasthan.gov.in",
            latitude_start=26.2389,
            longitude_start=73.0243,
            latitude_end=25.7521,
            longitude_end=71.3967,
            data_source="Rajasthan PWD Records",
        ),
    ]

    db.add_all(roads)
    db.commit()

    # Refresh to get IDs
    for road in roads:
        db.refresh(road)

    # ─────────────────────────────────────────────────────
    # Authorities — mapped to road types by state
    # NH   → NHAI Regional Officer
    # SH   → State PWD Executive Engineer
    # MDR  → District Collector's Office
    # ─────────────────────────────────────────────────────
    authorities = [
        # Tamil Nadu
        Authority(
            name="Er. S. Ramanathan",
            designation="NHAI Regional Officer – Tamil Nadu",
            state="Tamil Nadu",
            district="Chennai",
            contact="+91 94421 56789",
            email="s.ramanathan@nhai.gov.in",
            road_ids=[r.id for r in roads if r.state == "Tamil Nadu" and r.road_type == "NH"],
        ),
        Authority(
            name="Er. P. Vivek Kumar",
            designation="State PWD Executive Engineer – Tamil Nadu",
            state="Tamil Nadu",
            district="Coimbatore",
            contact="+91 98765 43210",
            email="vivek.pwd@tn.gov.in",
            road_ids=[r.id for r in roads if r.state == "Tamil Nadu" and r.road_type == "SH"],
        ),
        Authority(
            name="Er. A. Balasubramanian",
            designation="District Collector Office – Thanjavur",
            state="Tamil Nadu",
            district="Thanjavur",
            contact="+91 94421 78965",
            email="bala.dist@tn.gov.in",
            road_ids=[r.id for r in roads if r.state == "Tamil Nadu" and r.road_type == "MDR"],
        ),

        # Maharashtra
        Authority(
            name="Er. Vijay Deshmukh",
            designation="NHAI Regional Officer – Maharashtra",
            state="Maharashtra",
            district="Mumbai",
            contact="+91 98201 45678",
            email="v.deshmukh@nhai.gov.in",
            road_ids=[r.id for r in roads if r.state == "Maharashtra" and r.road_type == "NH"],
        ),
        Authority(
            name="Er. Aman Joshi",
            designation="State PWD Executive Engineer – Maharashtra",
            state="Maharashtra",
            district="Nagpur",
            contact="+91 93722 54321",
            email="aman.pwd@maharashtra.gov.in",
            road_ids=[r.id for r in roads if r.state == "Maharashtra" and r.road_type == "SH"],
        ),
        Authority(
            name="Er. Snehal Rane",
            designation="District Collector Office – Kolhapur",
            state="Maharashtra",
            district="Kolhapur",
            contact="+91 98509 87654",
            email="snehal.dist@maharashtra.gov.in",
            road_ids=[r.id for r in roads if r.state == "Maharashtra" and r.road_type == "MDR"],
        ),

        # Uttar Pradesh
        Authority(
            name="Er. Rajesh Tiwari",
            designation="NHAI Regional Officer – Uttar Pradesh",
            state="Uttar Pradesh",
            district="Lucknow",
            contact="+91 94151 23456",
            email="r.tiwari@nhai.gov.in",
            road_ids=[r.id for r in roads if r.state == "Uttar Pradesh" and r.road_type == "NH"],
        ),
        Authority(
            name="Er. Deepak Verma",
            designation="State PWD Executive Engineer – Uttar Pradesh",
            state="Uttar Pradesh",
            district="Kanpur",
            contact="+91 94150 22334",
            email="deepak.pwd@up.gov.in",
            road_ids=[r.id for r in roads if r.state == "Uttar Pradesh" and r.road_type == "SH"],
        ),
        Authority(
            name="Er. Amita Singh",
            designation="District Collector Office – Gorakhpur",
            state="Uttar Pradesh",
            district="Gorakhpur",
            contact="+91 94157 88990",
            email="amita.dist@up.gov.in",
            road_ids=[r.id for r in roads if r.state == "Uttar Pradesh" and r.road_type == "MDR"],
        ),

        # Karnataka
        Authority(
            name="Er. Nagaraj Shetty",
            designation="NHAI Regional Officer – Karnataka",
            state="Karnataka",
            district="Bengaluru",
            contact="+91 98450 12345",
            email="n.shetty@nhai.gov.in",
            road_ids=[r.id for r in roads if r.state == "Karnataka" and r.road_type == "NH"],
        ),
        Authority(
            name="Er. Prakash Gowda",
            designation="State PWD Executive Engineer – Karnataka",
            state="Karnataka",
            district="Mysuru",
            contact="+91 94481 55667",
            email="prakash.pwd@karnataka.gov.in",
            road_ids=[r.id for r in roads if r.state == "Karnataka" and r.road_type == "SH"],
        ),
        Authority(
            name="Er. Vinay Kulkarni",
            designation="District Collector Office – Dharwad",
            state="Karnataka",
            district="Dharwad",
            contact="+91 94482 99001",
            email="vinay.dist@karnataka.gov.in",
            road_ids=[r.id for r in roads if r.state == "Karnataka" and r.road_type == "MDR"],
        ),

        # Rajasthan
        Authority(
            name="Er. Mahendra Singh Rathore",
            designation="NHAI Regional Officer – Rajasthan",
            state="Rajasthan",
            district="Jaipur",
            contact="+91 94140 12345",
            email="m.rathore@nhai.gov.in",
            road_ids=[r.id for r in roads if r.state == "Rajasthan" and r.road_type == "NH"],
        ),
        Authority(
            name="Er. Hemant Gehlot",
            designation="State PWD Executive Engineer – Rajasthan",
            state="Rajasthan",
            district="Jodhpur",
            contact="+91 94141 78965",
            email="hemant.pwd@rajasthan.gov.in",
            road_ids=[r.id for r in roads if r.state == "Rajasthan" and r.road_type == "SH"],
        ),
    ]

    db.add_all(authorities)
    db.commit()

    # --- Seed Community Complaints, Votes & Verifications ---
    sh68 = db.query(Road).filter(Road.road_name.like("%SH-68%")).first()
    nh19 = db.query(Road).filter(Road.road_name.like("%Agra – Lucknow%")).first()
    mdr127 = db.query(Road).filter(Road.road_name.like("%MDR-127%")).first()
    sh21 = db.query(Road).filter(Road.road_name.like("%SH-21%")).first()
    nh75 = db.query(Road).filter(Road.road_name.like("%NH-75%")).first()

    complaints_data = [
        (sh68, "Pothole", "Massive potholes causing traffic delays near Salem junction.", "Forwarded", "RW-2026-POT68", 12, [("confirm", 3), ("severity_increased", 1)]),
        (nh19, "Flooding", "Severe waterlogging on expressway after light rainfall.", "Pending", "RW-2026-FLD19", 28, [("confirm", 5), ("severity_increased", 3)]),
        (mdr127, "Bad surface", "Extremely gravelly road, difficult to ride two-wheelers.", "Pending", "RW-2026-SUR127", 4, [("confirm", 1)]),
        (sh21, "Missing barrier", "Broken crash barriers on a sharp curve near Jhansi.", "Pending", "RW-2026-BAR21", 16, [("confirm", 4), ("severity_increased", 2)]),
        (nh75, "Flooding", "Flooded underpass near Bengaluru city limits.", "Resolved", "RW-2026-FLD75", 6, [("resolved", 5)])
    ]

    for road, issue_type, desc, status, ref_id, upvotes_count, verif_tuples in complaints_data:
        if not road:
            continue
        comp = Complaint(
            road_id=road.id,
            issue_type=issue_type,
            description=desc,
            status=status,
            complaint_ref_id=ref_id,
            latitude=road.latitude_start + 0.005 if road.latitude_start else None,
            longitude=road.longitude_start + 0.005 if road.longitude_start else None
        )
        db.add(comp)
        db.commit()
        db.refresh(comp)

        # Seed votes
        for i in range(upvotes_count):
            db.add(Vote(complaint_id=comp.id, device_id=f"device_{i}", vote_type="upvote"))
        
        # Seed verifications
        v_idx = 0
        for action_type, count in verif_tuples:
            for _ in range(count):
                db.add(ComplaintVerification(complaint_id=comp.id, device_id=f"device_{v_idx}", action_type=action_type))
                v_idx += 1
        
        db.commit()

        # Update cache counts
        comp.upvotes = db.query(Vote).filter(Vote.complaint_id == comp.id, Vote.vote_type == "upvote").count()
        comp.downvotes = db.query(Vote).filter(Vote.complaint_id == comp.id, Vote.vote_type == "downvote").count()
        
        # Calculate verification score
        verifs = db.query(ComplaintVerification).filter(ComplaintVerification.complaint_id == comp.id).all()
        score = 0
        for v in verifs:
            if v.action_type == "confirm":
                score += 1
            elif v.action_type == "resolved":
                score += 1
            elif v.action_type == "severity_increased":
                score += 2
        comp.verification_score = score
        
        # Recalculate priority
        comp.recalculate_priority(db)
        
        db.commit()

    seed_admin_data(db)
    db.close()
    print("[OK] Base seeding complete.")


def seed_repairs(db):
    print("[INFO] Seeding road repair history...")
    sh68 = db.query(Road).filter(Road.road_name.like("%SH-68%")).first()
    sh21 = db.query(Road).filter(Road.road_name.like("%SH-21%")).first()
    mdr127 = db.query(Road).filter(Road.road_name.like("%MDR-127%")).first()
    
    # 1. SH-68 (Salem – Namakkal) -> Repair In Progress
    if sh68:
        rep1 = Repair(
            road_id=sh68.id,
            contractor_name="KNR Constructions",
            contractor_contact="+91 427 234 9876",
            start_date=datetime.now() - timedelta(days=12),
            expected_completion=datetime.now() + timedelta(days=8),
            repair_status="Repair In Progress",
            repair_cost=85.00,  # ₹ 85 Lakhs
            authority_assigned="State PWD Executive Engineer – Tamil Nadu",
            notes="Active excavation and asphalt layering under progress. Work delayed slightly by machinery maintenance."
        )
        db.add(rep1)
        db.commit()
        db.refresh(rep1)

        # Progress Logs
        logs = [
            RepairProgressLog(repair_id=rep1.id, stage="Complaint Registered", note="Citizen complaints forwarded to PWD office.", logged_at=datetime.now() - timedelta(days=20)),
            RepairProgressLog(repair_id=rep1.id, stage="Inspection Pending", note="PWD team completed field survey. Recommending complete re-carpeting.", logged_at=datetime.now() - timedelta(days=15)),
            RepairProgressLog(repair_id=rep1.id, stage="Repair Approved", note="Project sanctioned, budget allocated, contractor assigned.", logged_at=datetime.now() - timedelta(days=12)),
            RepairProgressLog(repair_id=rep1.id, stage="Repair In Progress", note="Machinery mobilized. Grading completed. Initial tarmac layer being rolled.", logged_at=datetime.now() - timedelta(days=8)),
        ]
        db.add_all(logs)

        # Media
        m1 = RepairMedia(
            repair_id=rep1.id,
            media_url="https://images.unsplash.com/photo-1515162305285-0293e4767cc2?w=800",
            media_type="before",
            caption="Severe crater-like potholes blocking Salem double road section."
        )
        m2 = RepairMedia(
            repair_id=rep1.id,
            media_url="https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=800",
            media_type="during",
            caption="Road scraper milling damaged asphalt."
        )
        db.add_all([m1, m2])
        db.commit()

    # 2. NH-44 (Chennai – Madurai Section) -> Repair Completed & Quality Verification Active
    nh44 = db.query(Road).filter(Road.road_name.like("%NH-44%")).first()
    if nh44:
        rep2 = Repair(
            road_id=nh44.id,
            contractor_name="L&T Infrastructure",
            contractor_contact="+91 44 2345 6789",
            start_date=datetime.now() - timedelta(days=30),
            expected_completion=datetime.now() - timedelta(days=2),
            actual_completion=datetime.now() - timedelta(days=3),
            repair_status="Quality Verification",
            repair_cost=420.00,  # ₹ 4.2 Cr
            authority_assigned="NHAI Regional Officer – Tamil Nadu",
            notes="Full re-carpeting and lane markings successfully completed. Public quality checking live."
        )
        db.add(rep2)
        db.commit()
        db.refresh(rep2)

        # Progress Logs
        logs = [
            RepairProgressLog(repair_id=rep2.id, stage="Complaint Registered", note="Pothole cluster reported on NH-44 Chennai segment.", logged_at=datetime.now() - timedelta(days=35)),
            RepairProgressLog(repair_id=rep2.id, stage="Inspection Pending", note="NHAI engineer inspects. Allocates emergency restoration funds.", logged_at=datetime.now() - timedelta(days=32)),
            RepairProgressLog(repair_id=rep2.id, stage="Repair Approved", note="Tender awarded to L&T Infrastructure.", logged_at=datetime.now() - timedelta(days=30)),
            RepairProgressLog(repair_id=rep2.id, stage="Repair In Progress", note="Night shifts ongoing. Old top layer completely milled. 80mm binder layer poured.", logged_at=datetime.now() - timedelta(days=20)),
            RepairProgressLog(repair_id=rep2.id, stage="Repair Completed", note="Finished asphalt concrete wearing coat. Reflective road markings completed.", logged_at=datetime.now() - timedelta(days=3)),
            RepairProgressLog(repair_id=rep2.id, stage="Quality Verification", note="Citizen feedback channel open for public rating audits.", logged_at=datetime.now() - timedelta(days=2)),
        ]
        db.add_all(logs)

        # Media
        m3 = RepairMedia(
            repair_id=rep2.id,
            media_url="https://images.unsplash.com/photo-1584467541268-b040f83be3fd?w=800",
            media_type="before",
            caption="Deep cracking and heavy rutting on Madurai approach lane."
        )
        m4 = RepairMedia(
            repair_id=rep2.id,
            media_url="https://images.unsplash.com/photo-1594818379496-da1e345b0cd3?w=800",
            media_type="after",
            caption="Fully restored smooth NH-44 highway stretch."
        )
        db.add_all([m3, m4])
        db.commit()

        # Verifications
        verifs = [
            RepairVerification(repair_id=rep2.id, device_id="device_a", verdict="successfully_repaired", rating=5, comment="Absolutely smooth now! Marked improvement in traffic flow."),
            RepairVerification(repair_id=rep2.id, device_id="device_b", verdict="successfully_repaired", rating=4, comment="Great repair speed. Lanes are drawn perfectly."),
            RepairVerification(repair_id=rep2.id, device_id="device_c", verdict="partially_fixed", rating=3, comment="Tarmac is excellent, but PWD forgot to clear the debris on the hard shoulder.")
        ]
        db.add_all(verifs)
        db.commit()

        # Calculate metrics
        rep2.recalculate_quality()
        db.commit()

    # 3. SH-21 (Kanpur – Jhansi) -> Repair In Progress - Delayed
    if sh21:
        rep3 = Repair(
            road_id=sh21.id,
            contractor_name="PNC Infratech Ltd",
            contractor_contact="+91 512 234 5678",
            start_date=datetime.now() - timedelta(days=45),
            expected_completion=datetime.now() - timedelta(days=10),  # Delayed!
            repair_status="Repair In Progress",
            repair_cost=155.00,
            authority_assigned="State PWD Executive Engineer – Uttar Pradesh",
            notes="Unexpected soil subsidence near storm drain required foundation structural changes. Project delayed."
        )
        db.add(rep3)
        db.commit()
        db.refresh(rep3)

        # Progress Logs
        logs = [
            RepairProgressLog(repair_id=rep3.id, stage="Complaint Registered", note="Complaints filed about safety risk due to crumbling shoulder.", logged_at=datetime.now() - timedelta(days=50)),
            RepairProgressLog(repair_id=rep3.id, stage="Inspection Pending", note="Structural assessment indicates storm drain erosion.", logged_at=datetime.now() - timedelta(days=48)),
            RepairProgressLog(repair_id=rep3.id, stage="Repair Approved", note="Emergency rehabilitation approved.", logged_at=datetime.now() - timedelta(days=45)),
            RepairProgressLog(repair_id=rep3.id, stage="Repair In Progress", note="Contractor began piling work. Heavy water logging halted concrete pouring.", logged_at=datetime.now() - timedelta(days=35)),
            RepairProgressLog(repair_id=rep3.id, stage="Repair In Progress", note="WARNING: Project delayed due to unexpected sub-soil subsidence near drain wall.", logged_at=datetime.now() - timedelta(days=10)),
        ]
        db.add_all(logs)
        db.commit()

    # 4. MDR-127 (Thanjavur – Kumbakonam Link) -> Inspection Pending
    if mdr127:
        rep4 = Repair(
            road_id=mdr127.id,
            contractor_name="Ramky Infrastructure",
            contractor_contact="+91 4362 234567",
            repair_status="Inspection Pending",
            authority_assigned="District Collector Office – Thanjavur",
            notes="Citizen complaints registered. PWD inspection scheduled for feasibility assessment."
        )
        db.add(rep4)
        db.commit()
        db.refresh(rep4)

        log = RepairProgressLog(
            repair_id=rep4.id,
            stage="Inspection Pending",
            note="Road condition reported as Poor. Survey assigned to sub-division officer."
        )
        db.add(log)
        db.commit()
    else:
        print("[INFO] Repairs already seeded. Skipping.")

    db.close()
    print("[OK] Seeding complete.")


def seed_admin_data(db):
    print("[INFO] Seeding Officer/Admin Dashboard Data...")
    
    # 1. Seed Officer Roles & Permissions if they don't exist
    if db.query(OfficerRole).count() == 0:
        roles_permissions = [
            OfficerRole(role_name="Super Admin", permissions=["all"]),
            OfficerRole(role_name="State Authority", permissions=["view_dashboard", "view_complaints", "escalate_complaint", "approve_repair", "view_analytics", "view_budget", "export_reports", "view_contractors"]),
            OfficerRole(role_name="District Collector", permissions=["view_dashboard", "view_complaints", "assign_officer", "escalate_complaint", "approve_repair", "view_analytics", "view_budget", "export_reports"]),
            OfficerRole(role_name="PWD Engineer", permissions=["view_dashboard", "view_complaints", "add_remarks", "update_repair_status", "upload_repair_media"]),
            OfficerRole(role_name="NHAI Officer", permissions=["view_dashboard", "view_complaints", "add_remarks", "update_repair_status", "upload_repair_media", "approve_repair"]),
            OfficerRole(role_name="Complaint Inspector", permissions=["view_dashboard", "view_complaints", "verify_complaint", "add_remarks"])
        ]
        db.add_all(roles_permissions)
        db.commit()

    # 2. Seed Admin Users if they don't exist
    if db.query(AdminUser).count() == 0:
        env = os.getenv("ENVIRONMENT", "development").lower()
        if env == "production":
            init_username = os.getenv("ADMIN_INIT_USERNAME")
            init_password = os.getenv("ADMIN_INIT_PASSWORD")
            init_email = os.getenv("ADMIN_INIT_EMAIL", "admin@roadwatch.gov.in")
            if init_username and init_password:
                from security import validate_password_strength
                is_valid, msg = validate_password_strength(init_password)
                if not is_valid:
                    print(f"[WARN] ADMIN_INIT_PASSWORD does not meet strength requirements: {msg}. Super Admin not created.")
                else:
                    admin_user = AdminUser(
                        username=init_username.strip(),
                        password_hash=hash_password(init_password),
                        email=init_email.strip().lower(),
                        name="Super Admin",
                        role="Super Admin",
                        is_verified=1
                    )
                    db.add(admin_user)
                    db.commit()
                    print(f"[OK] Production initial Super Admin '{init_username}' created securely.")
            else:
                print("[INFO] Production mode: Skipping demo admin user creation.")
                print("[INFO] To create a Super Admin, run: python cli_admin.py create-superuser")
                print("[INFO] Or configure ADMIN_INIT_USERNAME and ADMIN_INIT_PASSWORD in environment.")
        else:
            # Development / Demo mode: seed default accounts for testing & evaluation
            default_pw = os.getenv("ADMIN_PASSWORD", "admin123")
            admin_users = [
                AdminUser(
                    username="admin",
                    password_hash=hash_password(default_pw),
                    email="admin@roadwatch.gov.in",
                    name="Super Admin",
                    role="Super Admin",
                    is_verified=1
                ),
                AdminUser(
                    username="maharashtra_auth",
                    password_hash=hash_password(os.getenv("MAHARASHTRA_AUTH_PASSWORD", "maharashtra123")),
                    email="state.maharashtra@roadwatch.gov.in",
                    name="Shri Devendra Patil (State Secretary)",
                    role="State Authority",
                    state="Maharashtra",
                    is_verified=1
                ),
                AdminUser(
                    username="pune_collector",
                    password_hash=hash_password(os.getenv("PUNE_COLLECTOR_PASSWORD", "pune123")),
                    email="collector.pune@roadwatch.gov.in",
                    name="Dr. Rajesh Deshmukh (IAS)",
                    role="District Collector",
                    state="Maharashtra",
                    district="Pune",
                    is_verified=1
                ),
                AdminUser(
                    username="pwd_engineer",
                    password_hash=hash_password(os.getenv("PWD_ENGINEER_PASSWORD", "pwd123")),
                    email="engineer.pwd@roadwatch.gov.in",
                    name="Er. S. Ramanathan (PWD Executive Engineer)",
                    role="PWD Engineer",
                    state="Tamil Nadu",
                    district="Salem",
                    is_verified=1
                ),
                AdminUser(
                    username="nhai_officer",
                    password_hash=hash_password(os.getenv("NHAI_OFFICER_PASSWORD", "nhai123")),
                    email="officer.nhai@roadwatch.gov.in",
                    name="Er. K. Meenakshi (NHAI Project Director)",
                    role="NHAI Officer",
                    state="Tamil Nadu",
                    district="Salem",
                    is_verified=1
                ),
                AdminUser(
                    username="inspector",
                    password_hash=hash_password(os.getenv("INSPECTOR_PASSWORD", "inspector123")),
                    email="inspector@roadwatch.gov.in",
                    name="Sanjay Sharma (Complaint Inspector)",
                    role="Complaint Inspector",
                    is_verified=1
                )
            ]
            db.add_all(admin_users)
            db.commit()
            print("[OK] Development seed: 6 demo officer accounts seeded.")

    # 3. Seed Contractor Performance if it doesn't exist
    if db.query(ContractorPerformance).count() == 0:
        contractors = [
            ContractorPerformance(
                contractor_name="L&T Infrastructure",
                quality_score=94.5,
                budget_efficiency=88.2,
                completion_speed=92.0,
                recurrence_rate=2.4,
                projects_completed=14,
                projects_delayed=1,
                citizen_rating=4.6
            ),
            ContractorPerformance(
                contractor_name="Dilip Buildcon Ltd",
                quality_score=85.0,
                budget_efficiency=82.5,
                completion_speed=87.5,
                recurrence_rate=5.8,
                projects_completed=9,
                projects_delayed=2,
                citizen_rating=3.9
            ),
            ContractorPerformance(
                contractor_name="KNR Constructions",
                quality_score=78.2,
                budget_efficiency=72.0,
                completion_speed=74.5,
                recurrence_rate=12.0,
                projects_completed=6,
                projects_delayed=3,
                citizen_rating=3.2
            ),
            ContractorPerformance(
                contractor_name="IRB Infrastructure Developers",
                quality_score=91.0,
                budget_efficiency=90.5,
                completion_speed=89.0,
                recurrence_rate=4.1,
                projects_completed=11,
                projects_delayed=0,
                citizen_rating=4.4
            ),
            ContractorPerformance(
                contractor_name="Ramky Infrastructure",
                quality_score=60.5,
                budget_efficiency=64.0,
                completion_speed=58.0,
                recurrence_rate=22.5,
                projects_completed=4,
                projects_delayed=4,
                citizen_rating=2.1
            ),
            ContractorPerformance(
                contractor_name="PNC Infratech Ltd",
                quality_score=68.0,
                budget_efficiency=71.2,
                completion_speed=65.0,
                recurrence_rate=16.8,
                projects_completed=5,
                projects_delayed=3,
                citizen_rating=2.8
            )
        ]
        db.add_all(contractors)
        db.commit()

    # 4. Seed District Reports if they don't exist
    if db.query(DistrictReport).count() == 0:
        reports = [
            DistrictReport(state="Tamil Nadu", district="Salem", reporting_month="2026-05", total_complaints=48, resolved_complaints=32, budget_spent=14.50, budget_sanctioned=22.10, road_health_index=65.5),
            DistrictReport(state="Tamil Nadu", district="Kanchipuram", reporting_month="2026-05", total_complaints=12, resolved_complaints=10, budget_spent=241.30, budget_sanctioned=285.50, road_health_index=88.0),
            DistrictReport(state="Maharashtra", district="Pune", reporting_month="2026-05", total_complaints=85, resolved_complaints=64, budget_spent=395.60, budget_sanctioned=420.00, road_health_index=91.2),
            DistrictReport(state="Maharashtra", district="Kolhapur", reporting_month="2026-05", total_complaints=55, resolved_complaints=22, budget_spent=28.70, budget_sanctioned=42.00, road_health_index=55.4),
            DistrictReport(state="Uttar Pradesh", district="Gorakhpur", reporting_month="2026-05", total_complaints=92, resolved_complaints=40, budget_spent=7.80, budget_sanctioned=12.40, road_health_index=48.2),
            DistrictReport(state="Uttar Pradesh", district="Agra", reporting_month="2026-05", total_complaints=15, resolved_complaints=12, budget_spent=612.50, budget_sanctioned=680.00, road_health_index=89.5),
            DistrictReport(state="Karnataka", district="Bengaluru Urban", reporting_month="2026-05", total_complaints=110, resolved_complaints=80, budget_spent=275.40, budget_sanctioned=310.00, road_health_index=84.6),
            DistrictReport(state="Rajasthan", district="Jodhpur", reporting_month="2026-05", total_complaints=74, resolved_complaints=30, budget_spent=34.20, budget_sanctioned=56.00, road_health_index=52.8)
        ]
        db.add_all(reports)
        db.commit()

    # 5. Seed some past SLA Escalations if they don't exist
    if db.query(Escalation).count() == 0:
        complaints = db.query(Complaint).all()
        for idx, comp in enumerate(complaints):
            if idx == 0:
                # Escalated to Exec Engineer
                db.add(Escalation(
                    complaint_id=comp.id,
                    original_status="Pending",
                    escalated_to="Executive Engineer",
                    reason="Complaint unresolved for more than 7 days.",
                    status="Escalated"
                ))
            elif idx == 1:
                # Escalated to District Collector
                db.add(Escalation(
                    complaint_id=comp.id,
                    original_status="Forwarded",
                    escalated_to="District Collector",
                    reason="Complaint unresolved for more than 15 days without progress.",
                    status="Escalated"
                ))
        db.commit()
    print("[OK] Dashboard Seeding Complete.")


if __name__ == "__main__":
    seed()

