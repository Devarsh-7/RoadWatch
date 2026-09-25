"""
models.py — SQLAlchemy ORM models for RoadWatch.
Three tables: roads, complaints, authorities.
"""

import json
from datetime import datetime, date

from sqlalchemy import (
    Column, Integer, String, Float, Text, Date, DateTime, JSON,
    ForeignKey, func,
)
from sqlalchemy.orm import relationship

from database import Base


class Road(Base):
    """Stores information about every tracked road (NH/SH/MDR)."""
    __tablename__ = "roads"

    id = Column(Integer, primary_key=True)
    road_name = Column(String(200), nullable=False, index=True)
    road_type = Column(String(10), nullable=False)  # NH, SH, MDR
    state = Column(String(100), nullable=False)
    district = Column(String(100), nullable=False)
    length_km = Column(Float, nullable=False)

    # Contractor details
    contractor_name = Column(String(200), nullable=True)
    contractor_contact = Column(String(50), nullable=True)

    # Maintenance
    last_repair_date = Column(Date, nullable=True)
    condition = Column(String(10), nullable=False, default="Fair")  # Good / Fair / Poor

    # Budget (in ₹ Crores)
    budget_sanctioned = Column(Float, nullable=True)
    budget_spent = Column(Float, nullable=True)

    # Responsible Executive Engineer
    exec_engineer = Column(String(200), nullable=True)
    engineer_contact = Column(String(50), nullable=True)
    engineer_email = Column(String(200), nullable=True)

    # Geo-coordinates (start and end of road stretch)
    latitude_start = Column(Float, nullable=True)
    longitude_start = Column(Float, nullable=True)
    latitude_end = Column(Float, nullable=True)
    longitude_end = Column(Float, nullable=True)

    # Metadata
    data_source = Column(String(300), nullable=True)
    last_updated = Column(DateTime, default=func.now(), onupdate=func.now())

    # Relationships
    complaints = relationship("Complaint", back_populates="road", lazy="dynamic")
    repairs = relationship("Repair", back_populates="road", lazy="dynamic")

    def transparency_score(self) -> int:
        """
        Calculate transparency / health score 0-100 based on:
        - Repair recency (40 pts)
        - Budget utilization efficiency (40 pts)
        - Complaint volume penalty (20 pts)
        """
        score = 0

        # --- Repair recency (40 points) ---
        if self.last_repair_date:
            days_since = (date.today() - self.last_repair_date).days
            if days_since < 180:
                score += 40
            elif days_since < 365:
                score += 30
            elif days_since < 730:
                score += 15
            else:
                score += 5
        # No repair date → 0 points

        # --- Budget utilization (40 points) ---
        if self.budget_sanctioned and self.budget_sanctioned > 0:
            utilization = (self.budget_spent or 0) / self.budget_sanctioned
            if 0.7 <= utilization <= 1.0:
                score += 40  # Healthy spend
            elif 0.5 <= utilization < 0.7:
                score += 25  # Under-utilized
            elif utilization > 1.0:
                score += 10  # Over-budget — red flag
            else:
                score += 5   # Very low utilization
        else:
            score += 0

        # --- Complaint penalty (20 points base, deducted) ---
        complaint_count = self.complaints.count() if self.complaints else 0
        if complaint_count == 0:
            score += 20
        elif complaint_count <= 3:
            score += 15
        elif complaint_count <= 10:
            score += 5
        else:
            score += 0  # Heavy complaints

        return min(score, 100)


class Complaint(Base):
    """Stores citizen complaints filed against roads."""
    __tablename__ = "complaints"

    id = Column(Integer, primary_key=True)
    road_id = Column(Integer, ForeignKey("roads.id"), nullable=False)
    issue_type = Column(String(50), nullable=False)
    description = Column(Text, nullable=True)
    photo_url = Column(String(500), nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    status = Column(String(20), nullable=False, default="Pending")  # Pending / Forwarded / Resolved
    complaint_ref_id = Column(String(20), nullable=False, unique=True, index=True)
    created_at = Column(DateTime, default=func.now())

    # Caching upvote, downvote, and verification scores for fast queries
    upvotes = Column(Integer, default=0, nullable=False)
    downvotes = Column(Integer, default=0, nullable=False)
    verification_score = Column(Integer, default=0, nullable=False)
    trust_level = Column(String(30), default="Unverified", nullable=False)  # Unverified / Verified / High Trust
    priority_score = Column(Integer, default=0, nullable=False)

    # Relationships
    road = relationship("Road", back_populates="complaints")
    votes = relationship("Vote", back_populates="complaint", cascade="all, delete-orphan")
    verifications = relationship("ComplaintVerification", back_populates="complaint", cascade="all, delete-orphan")

    def recalculate_priority(self, db) -> int:
        """
        Calculate and assign priority_score dynamically:
        priority_score = (upvotes * 2) + (verification_score * 3) + (severity_weight * 5) - (days_since_reported) + (repeat_complaints * 4)
        """
        # Severity rating map
        severity_map = {
            "Pothole": 5,
            "Flooding": 4,
            "Missing barrier": 4,
            "Bad surface": 3,
            "No signage": 2,
            "Other": 1
        }
        severity_weight = severity_map.get(self.issue_type, 1)

        # Days since reported
        days_since = 0
        if self.created_at:
            delta = datetime.now() - self.created_at
            days_since = max(0, delta.days)

        # Repeat complaints count on same road
        repeat_complaints = db.query(Complaint).filter(
            Complaint.road_id == self.road_id,
            Complaint.status != "Resolved",
            Complaint.id != self.id
        ).count()

        # Road transparency factor (bonus up to 10 points for neglected roads)
        transparency_bonus = 0
        if self.road:
            transparency_score = self.road.transparency_score()
            transparency_bonus = round((100 - transparency_score) / 10)

        # Core priority calculation
        score = (
            (self.upvotes * 2)
            + (self.verification_score * 3)
            + (severity_weight * 5)
            + (repeat_complaints * 4)
            + transparency_bonus
            - days_since
        )
        self.priority_score = max(0, score)

        # Recalculate trust level
        if self.upvotes >= 15 or self.verification_score >= 8:
            self.trust_level = "High Trust"
        elif self.upvotes >= 5 or self.verification_score >= 3:
            self.trust_level = "Verified"
        else:
            self.trust_level = "Unverified"

        return self.priority_score


class Vote(Base):
    """Tracks upvotes and downvotes to prevent duplicates."""
    __tablename__ = "votes"

    id = Column(Integer, primary_key=True)
    complaint_id = Column(Integer, ForeignKey("complaints.id"), nullable=False)
    device_id = Column(String(100), nullable=False, index=True)
    vote_type = Column(String(10), nullable=False)  # "upvote" or "downvote"
    created_at = Column(DateTime, default=func.now())

    # Relationships
    complaint = relationship("Complaint", back_populates="votes")


class ComplaintVerification(Base):
    """Tracks community confirmations, status indicators, and severity markers."""
    __tablename__ = "complaint_verifications"

    id = Column(Integer, primary_key=True)
    complaint_id = Column(Integer, ForeignKey("complaints.id"), nullable=False)
    device_id = Column(String(100), nullable=False, index=True)
    action_type = Column(String(30), nullable=False)  # "confirm", "resolved", "severity_increased"
    created_at = Column(DateTime, default=func.now())

    # Relationships
    complaint = relationship("Complaint", back_populates="verifications")


class Authority(Base):
    """Government authorities responsible for road maintenance."""
    __tablename__ = "authorities"

    id = Column(Integer, primary_key=True)
    name = Column(String(200), nullable=False)
    designation = Column(String(200), nullable=False)
    state = Column(String(100), nullable=False)
    district = Column(String(100), nullable=True)
    contact = Column(String(50), nullable=True)
    email = Column(String(200), nullable=True)
    road_ids = Column(JSON, nullable=True)  # List of road IDs this authority manages


# ─── Repair Tracking Models ────────────────────────────────────────────────────

REPAIR_STAGES = [
    "Complaint Registered",
    "Inspection Pending",
    "Repair Approved",
    "Repair In Progress",
    "Repair Completed",
    "Quality Verification",
]


class Repair(Base):
    """
    Core repair lifecycle record.
    Tracks a road repair from approval through quality verification.
    """
    __tablename__ = "repairs"

    id = Column(Integer, primary_key=True)
    road_id = Column(Integer, ForeignKey("roads.id"), nullable=False, index=True)

    # Contractor
    contractor_name = Column(String(200), nullable=True)
    contractor_contact = Column(String(100), nullable=True)

    # Timeline
    start_date = Column(DateTime, nullable=True)
    expected_completion = Column(DateTime, nullable=True)
    actual_completion = Column(DateTime, nullable=True)

    # Status — one of REPAIR_STAGES
    repair_status = Column(String(60), nullable=False, default="Complaint Registered", index=True)

    # Financials (₹ Lakhs)
    repair_cost = Column(Float, nullable=True)

    # Authority responsible
    authority_assigned = Column(String(200), nullable=True)

    # Free-text notes / last update message
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    # Cached quality metrics (refreshed on each verification)
    quality_score = Column(Float, nullable=True)       # 0-100
    satisfaction_rating = Column(Float, nullable=True)  # 0-5

    # Relationships
    road = relationship("Road", back_populates="repairs")
    media = relationship("RepairMedia", back_populates="repair", cascade="all, delete-orphan")
    verifications = relationship("RepairVerification", back_populates="repair", cascade="all, delete-orphan")
    progress_logs = relationship("RepairProgressLog", back_populates="repair", cascade="all, delete-orphan", order_by="RepairProgressLog.logged_at")

    def recalculate_quality(self):
        """
        Derive quality_score (0–100) and satisfaction_rating (0–5)
        from all citizen verifications.
        """
        if not self.verifications:
            self.quality_score = None
            self.satisfaction_rating = None
            return

        verdict_weights = {
            "successfully_repaired": 100,
            "partially_fixed": 55,
            "poor_quality": 20,
            "issue_still_exists": 0,
        }

        total_weight = sum(verdict_weights.get(v.verdict, 0) for v in self.verifications)
        self.quality_score = round(total_weight / len(self.verifications), 1)

        ratings = [v.rating for v in self.verifications if v.rating is not None]
        self.satisfaction_rating = round(sum(ratings) / len(ratings), 2) if ratings else None


class RepairMedia(Base):
    """Stores before / during / after media attachments for a repair."""
    __tablename__ = "repair_media"

    id = Column(Integer, primary_key=True)
    repair_id = Column(Integer, ForeignKey("repairs.id"), nullable=False, index=True)
    media_url = Column(String(500), nullable=False)   # relative path served by FastAPI
    media_type = Column(String(10), nullable=False)   # "before" | "during" | "after"
    caption = Column(String(300), nullable=True)
    file_name = Column(String(300), nullable=True)
    uploaded_at = Column(DateTime, default=func.now())

    # Relationships
    repair = relationship("Repair", back_populates="media")


class RepairVerification(Base):
    """Citizen quality verification after repair completion."""
    __tablename__ = "repair_verifications"

    id = Column(Integer, primary_key=True)
    repair_id = Column(Integer, ForeignKey("repairs.id"), nullable=False, index=True)
    device_id = Column(String(100), nullable=False, index=True)

    # Verdict: one of the four quality options
    verdict = Column(String(50), nullable=False)
    # verdicts: "successfully_repaired" | "partially_fixed" | "poor_quality" | "issue_still_exists"

    rating = Column(Integer, nullable=True)   # 1–5 star rating
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime, default=func.now())

    # Relationships
    repair = relationship("Repair", back_populates="verifications")


class RepairProgressLog(Base):
    """Immutable audit log entry for each repair stage transition."""
    __tablename__ = "repair_progress_logs"

    id = Column(Integer, primary_key=True)
    repair_id = Column(Integer, ForeignKey("repairs.id"), nullable=False, index=True)
    stage = Column(String(60), nullable=False)
    note = Column(Text, nullable=True)
    logged_by = Column(String(200), nullable=True)
    logged_at = Column(DateTime, default=func.now())

    # Relationships
    repair = relationship("Repair", back_populates="progress_logs")


# ─── Admin & Officer Dashboard Models ───────────────────────────────────────────

class AdminUser(Base):
    """Admin users/government officers authorized to manage the platform."""
    __tablename__ = "admin_users"

    id = Column(Integer, primary_key=True)
    username = Column(String(100), unique=True, index=True, nullable=False)
    password_hash = Column(String(200), nullable=False)
    email = Column(String(200), nullable=False)
    name = Column(String(200), nullable=False)
    role = Column(String(50), nullable=False)  # Super Admin, State Authority, District Collector, PWD Engineer, NHAI Officer, Complaint Inspector
    state = Column(String(100), nullable=True)     # For role scope restriction
    district = Column(String(100), nullable=True)   # For role scope restriction
    is_active = Column(Integer, default=1)          # 1 = Active, 0 = Inactive
    is_verified = Column(Integer, default=1)        # 1 = Verified, 0 = Pending verification
    email_verification_token = Column(String(200), nullable=True, index=True)
    email_verification_expires = Column(DateTime, nullable=True)
    reset_password_token = Column(String(200), nullable=True, index=True)
    reset_password_expires = Column(DateTime, nullable=True)
    failed_login_attempts = Column(Integer, default=0)
    locked_until = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=func.now())

    # Relationships
    audit_logs = relationship("AuditLog", back_populates="admin_user", cascade="all, delete-orphan")


class OfficerRole(Base):
    """Stores granular permissions assigned to different administrative roles."""
    __tablename__ = "officer_roles"

    id = Column(Integer, primary_key=True)
    role_name = Column(String(50), unique=True, nullable=False)
    permissions = Column(JSON, nullable=False)  # JSON list of strings, e.g., ["view_complaints", "assign_complaint"]


class RepairAssignment(Base):
    """Tracks repair inspections or project supervisions assigned to PWD/NHAI officers."""
    __tablename__ = "repair_assignments"

    id = Column(Integer, primary_key=True)
    repair_id = Column(Integer, ForeignKey("repairs.id"), nullable=False, index=True)
    officer_id = Column(Integer, ForeignKey("admin_users.id"), nullable=False, index=True)
    status = Column(String(50), nullable=False, default="Assigned")  # Assigned / Inspected / Completed
    assigned_at = Column(DateTime, default=func.now())
    notes = Column(Text, nullable=True)


class Escalation(Base):
    """Tracks automatic SLA breach escalations of unresolved complaints."""
    __tablename__ = "escalations"

    id = Column(Integer, primary_key=True)
    complaint_id = Column(Integer, ForeignKey("complaints.id"), nullable=False, index=True)
    original_status = Column(String(50), nullable=False)
    escalated_to = Column(String(100), nullable=False)  # Executive Engineer, District Collector, State Authority
    escalated_at = Column(DateTime, default=func.now())
    status = Column(String(50), nullable=False, default="Escalated")  # Escalated / Resolved / Overruled
    reason = Column(Text, nullable=True)

    # Relationships
    complaint = relationship("Complaint")


class AuditLog(Base):
    """Logs administrative actions for accountability and transparency."""
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True)
    admin_user_id = Column(Integer, ForeignKey("admin_users.id"), nullable=True, index=True)
    action = Column(String(255), nullable=False)            # e.g., "ASSIGN_COMPLAINT"
    target_type = Column(String(100), nullable=True)        # e.g., "complaint", "repair"
    target_id = Column(Integer, nullable=True)
    timestamp = Column(DateTime, default=func.now())
    details = Column(JSON, nullable=True)                   # Extra metadata (IP address, old value vs new value)

    # Relationships
    admin_user = relationship("AdminUser", back_populates="audit_logs")


class ContractorPerformance(Base):
    """Aggregates quality, speed, and budget efficiency scores for road contractors."""
    __tablename__ = "contractor_performance"

    id = Column(Integer, primary_key=True)
    contractor_name = Column(String(200), unique=True, nullable=False, index=True)
    quality_score = Column(Float, default=100.0)       # 0 - 100 derived from citizen verification ratings
    budget_efficiency = Column(Float, default=100.0)   # 0 - 100 based on spent vs sanctioned budget
    completion_speed = Column(Float, default=100.0)    # 0 - 100 based on expected vs actual completion dates
    recurrence_rate = Column(Float, default=0.0)       # % of repairs failing/re-opened within 1 year
    projects_completed = Column(Integer, default=0)
    projects_delayed = Column(Integer, default=0)
    citizen_rating = Column(Float, default=5.0)        # 1.0 - 5.0 derived star rating


class DistrictReport(Base):
    """Monthly statistical reports aggregating road quality metrics by district."""
    __tablename__ = "district_reports"

    id = Column(Integer, primary_key=True)
    state = Column(String(100), nullable=False, index=True)
    district = Column(String(100), nullable=False, index=True)
    reporting_month = Column(String(20), nullable=False)    # "YYYY-MM"
    total_complaints = Column(Integer, default=0)
    resolved_complaints = Column(Integer, default=0)
    budget_spent = Column(Float, default=0.0)               # In ₹ Crores
    budget_sanctioned = Column(Float, default=0.0)          # In ₹ Crores
    road_health_index = Column(Float, default=100.0)        # Aggregate state index
    created_at = Column(DateTime, default=func.now())

