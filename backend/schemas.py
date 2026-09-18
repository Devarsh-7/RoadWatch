"""
schemas.py — Pydantic schemas for request/response validation.
Separates API contracts from ORM models for clean layering.
"""

from datetime import date, datetime
from typing import Optional, List
from pydantic import BaseModel, Field, field_validator
from sanitizer import sanitize_text


# ─── Road Schemas ───────────────────────────────────────────

class RoadBase(BaseModel):
    road_name: str
    road_type: str
    state: str
    district: str
    length_km: float
    contractor_name: Optional[str] = None
    contractor_contact: Optional[str] = None
    last_repair_date: Optional[date] = None
    condition: str = "Fair"
    budget_sanctioned: Optional[float] = None
    budget_spent: Optional[float] = None
    exec_engineer: Optional[str] = None
    engineer_contact: Optional[str] = None
    engineer_email: Optional[str] = None
    latitude_start: Optional[float] = None
    longitude_start: Optional[float] = None
    latitude_end: Optional[float] = None
    longitude_end: Optional[float] = None
    data_source: Optional[str] = None


class RoadOut(RoadBase):
    """Road response with computed transparency score."""
    id: int
    last_updated: Optional[datetime] = None
    transparency_score: int = 0

    class Config:
        from_attributes = True


class RoadCard(BaseModel):
    """Lightweight road card for search results grid."""
    id: int
    road_name: str
    road_type: str
    state: str
    district: str
    last_repair_date: Optional[date] = None
    budget_sanctioned: Optional[float] = None
    budget_spent: Optional[float] = None
    condition: str
    transparency_score: int = 0

    class Config:
        from_attributes = True


# ─── Complaint Schemas ──────────────────────────────────────

VALID_ISSUE_TYPES = {"Pothole", "Bad surface", "No signage", "Flooding", "Missing barrier", "Other"}

class ComplaintCreate(BaseModel):
    """Payload for filing a new complaint."""
    road_id: int = Field(..., gt=0, description="Valid positive road ID")
    issue_type: str = Field(
        ...,
        description="One of: Pothole, Bad surface, No signage, Flooding, Missing barrier, Other"
    )
    description: Optional[str] = Field(None, max_length=1000)
    photo_url: Optional[str] = Field(None, max_length=500)
    latitude: Optional[float] = Field(None, ge=-90.0, le=90.0)
    longitude: Optional[float] = Field(None, ge=-180.0, le=180.0)
    # Hidden bot honeypot field: must remain empty for legitimate users
    website: Optional[str] = Field(None, max_length=100)

    @field_validator('description', mode='before')
    @classmethod
    def clean_description(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        return sanitize_text(v, max_length=1000)

    @field_validator('issue_type')
    @classmethod
    def validate_issue_type(cls, v: str) -> str:
        if v not in VALID_ISSUE_TYPES:
            raise ValueError(f"Invalid issue_type. Must be one of: {', '.join(sorted(VALID_ISSUE_TYPES))}")
        return v


class ComplaintOut(BaseModel):
    id: int
    road_id: int
    issue_type: str
    description: Optional[str] = None
    photo_url: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    status: str
    complaint_ref_id: str
    created_at: Optional[datetime] = None
    
    # New community columns
    upvotes: int = 0
    downvotes: int = 0
    verification_score: int = 0
    trust_level: str = "Unverified"
    priority_score: int = 0

    class Config:
        from_attributes = True


class VoteCreate(BaseModel):
    """Payload for registering a complaint upvote or downvote."""
    device_id: str = Field(..., min_length=8, max_length=64, pattern=r"^[a-zA-Z0-9_\-\.:]{8,64}$")
    vote_type: str = Field(..., description="Must be 'upvote' or 'downvote'")

    @field_validator('vote_type')
    @classmethod
    def validate_vote_type(cls, v: str) -> str:
        if v not in {"upvote", "downvote"}:
            raise ValueError("vote_type must be either 'upvote' or 'downvote'")
        return v


class VerificationCreate(BaseModel):
    """Payload for validating a complaint."""
    device_id: str = Field(..., min_length=8, max_length=64, pattern=r"^[a-zA-Z0-9_\-\.:]{8,64}$")
    action_type: str = Field(..., description="Must be 'confirm', 'resolved', or 'severity_increased'")

    @field_validator('action_type')
    @classmethod
    def validate_action_type(cls, v: str) -> str:
        if v not in {"confirm", "resolved", "severity_increased"}:
            raise ValueError("action_type must be 'confirm', 'resolved', or 'severity_increased'")
        return v


# ─── Chat Schemas ───────────────────────────────────────────

class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=1000)

    @field_validator('message', mode='before')
    @classmethod
    def clean_chat_message(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Message cannot be empty")
        return sanitize_text(v, max_length=1000)


class ChatResponse(BaseModel):
    reply: str
    sources: List[str] = []


# ─── Stats Schema ──────────────────────────────────────────

class DashboardStats(BaseModel):
    total_roads: int
    total_budget_sanctioned: float
    total_budget_spent: float
    complaints_this_month: int
    roads_needing_repair: int
    condition_distribution: dict  # {"Good": n, "Fair": n, "Poor": n}
    budget_by_state: List[dict]   # [{"state": "TN", "sanctioned": x, "spent": y}, ...]
    most_reported_roads: List[dict] = []
    top_districts: List[dict] = []
    resolution_ratio: float = 0.0
    total_votes_cast: int = 0
    total_verifications: int = 0


# ─── Authority Schema ──────────────────────────────────────

class AuthorityOut(BaseModel):
    id: int
    name: str
    designation: str
    state: str
    district: Optional[str] = None
    contact: Optional[str] = None
    email: Optional[str] = None

    class Config:
        from_attributes = True


# ─── Repair Tracking Schemas ────────────────────────────────

class RepairMediaOut(BaseModel):
    id: int
    repair_id: int
    media_url: str
    media_type: str
    caption: Optional[str] = None
    file_name: Optional[str] = None
    uploaded_at: datetime

    class Config:
        from_attributes = True


class RepairProgressLogOut(BaseModel):
    id: int
    repair_id: int
    stage: str
    note: Optional[str] = None
    logged_by: Optional[str] = None
    logged_at: datetime

    class Config:
        from_attributes = True


class RepairVerificationOut(BaseModel):
    id: int
    repair_id: int
    device_id: str
    verdict: str
    rating: Optional[int] = None
    comment: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class RepairOut(BaseModel):
    id: int
    road_id: int
    contractor_name: Optional[str] = None
    contractor_contact: Optional[str] = None
    start_date: Optional[datetime] = None
    expected_completion: Optional[datetime] = None
    actual_completion: Optional[datetime] = None
    repair_status: str
    repair_cost: Optional[float] = None
    authority_assigned: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    quality_score: Optional[float] = None
    satisfaction_rating: Optional[float] = None
    media: List[RepairMediaOut] = []
    verifications: List[RepairVerificationOut] = []
    progress_logs: List[RepairProgressLogOut] = []

    class Config:
        from_attributes = True


class RepairCreate(BaseModel):
    road_id: Optional[int] = Field(None, gt=0)
    contractor_name: Optional[str] = Field(None, max_length=200)
    contractor_contact: Optional[str] = Field(None, pattern=r"^[+0-9\s-]{7,25}$")
    expected_completion: Optional[datetime] = None
    repair_cost: Optional[float] = Field(None, ge=0.0, le=100000000.0)
    authority_assigned: Optional[str] = Field(None, max_length=200)
    notes: Optional[str] = Field(None, max_length=2000)

    @field_validator('contractor_name', 'authority_assigned', 'notes', mode='before')
    @classmethod
    def clean_repair_fields(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        return sanitize_text(v, max_length=2000)


class RepairUpdate(BaseModel):
    repair_status: Optional[str] = Field(None, max_length=60)
    contractor_name: Optional[str] = Field(None, max_length=200)
    contractor_contact: Optional[str] = Field(None, pattern=r"^[+0-9\s-]{7,25}$")
    expected_completion: Optional[datetime] = None
    repair_cost: Optional[float] = Field(None, ge=0.0, le=100000000.0)
    notes: Optional[str] = Field(None, max_length=2000)

    @field_validator('contractor_name', 'notes', mode='before')
    @classmethod
    def clean_repair_update_fields(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        return sanitize_text(v, max_length=2000)


VALID_VERDICTS = {"successfully_repaired", "partially_fixed", "poor_quality", "issue_still_exists"}

class RepairVerificationCreate(BaseModel):
    device_id: str = Field(..., min_length=8, max_length=64, pattern=r"^[a-zA-Z0-9_\-\.:]{8,64}$")
    verdict: str = Field(..., description="Must be successfully_repaired, partially_fixed, poor_quality, or issue_still_exists")
    rating: Optional[int] = Field(None, ge=1, le=5)
    comment: Optional[str] = Field(None, max_length=500)

    @field_validator('verdict')
    @classmethod
    def validate_verdict(cls, v: str) -> str:
        if v not in VALID_VERDICTS:
            raise ValueError(f"verdict must be one of: {', '.join(sorted(VALID_VERDICTS))}")
        return v

    @field_validator('comment', mode='before')
    @classmethod
    def clean_comment(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        return sanitize_text(v, max_length=500)


# ─── Admin Dashboard Schemas ──────────────────────────────────────────

class AdminLogin(BaseModel):
    username: str = Field(..., min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9_.-]+$")
    password: str = Field(..., min_length=1, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    role: str
    name: str
    state: Optional[str] = None
    district: Optional[str] = None
    expires_in: Optional[int] = 3600


class ForgotPasswordRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=120, pattern=r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$", description="Registered email address or username for password reset")


class ResetPasswordRequest(BaseModel):
    token: str = Field(..., min_length=10, max_length=255, description="Expiring password reset token")
    new_password: str = Field(..., min_length=8, max_length=128, description="New strong password (min 8 chars)")


class VerifyEmailRequest(BaseModel):
    token: str = Field(..., min_length=10, max_length=255, description="Email verification token")


class ResendVerificationRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=120, pattern=r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$", description="Registered email address to resend verification")


class AdminUserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9_.-]+$")
    password: str = Field(..., min_length=8, max_length=128, description="Minimum 8 characters")
    name: str = Field(..., min_length=2, max_length=100)
    email: str = Field(..., min_length=5, max_length=120, pattern=r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")
    role: str = Field(..., min_length=2, max_length=50, description="Role: Super Admin, State Authority, District Collector, PWD Engineer, NHAI Officer, Complaint Inspector")
    state: Optional[str] = Field(None, max_length=100)
    district: Optional[str] = Field(None, max_length=100)

    @field_validator('name', 'state', 'district', mode='before')
    @classmethod
    def clean_user_strings(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        return sanitize_text(v, max_length=100)


class AdminUserOut(BaseModel):
    id: int
    username: str
    email: str
    name: str
    role: str
    state: Optional[str] = None
    district: Optional[str] = None
    is_active: int
    is_verified: int = 1
    created_at: datetime

    class Config:
        from_attributes = True


class ComplaintAssignPayload(BaseModel):
    officer_id: int = Field(..., gt=0)
    notes: Optional[str] = Field(None, max_length=1000)

    @field_validator('notes', mode='before')
    @classmethod
    def clean_notes(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        return sanitize_text(v, max_length=1000)


class ComplaintEscalatePayload(BaseModel):
    escalated_to: str = Field(..., min_length=2, max_length=100)
    reason: Optional[str] = Field(None, max_length=1000)

    @field_validator('escalated_to', 'reason', mode='before')
    @classmethod
    def clean_escalate_text(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        return sanitize_text(v, max_length=1000)


class CitizenResponsePayload(BaseModel):
    complaint_id: int = Field(..., gt=0)
    message: str = Field(..., min_length=1, max_length=1000)

    @field_validator('message', mode='before')
    @classmethod
    def clean_citizen_msg(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Message cannot be empty")
        return sanitize_text(v, max_length=1000)


class AuditLogOut(BaseModel):
    id: int
    admin_user_id: Optional[int] = None
    action: str
    target_type: Optional[str] = None
    target_id: Optional[int] = None
    timestamp: datetime
    details: Optional[dict] = None

    class Config:
        from_attributes = True


class ContractorPerformanceOut(BaseModel):
    id: int
    contractor_name: str
    quality_score: float
    budget_efficiency: float
    completion_speed: float
    recurrence_rate: float
    projects_completed: int
    projects_delayed: int
    citizen_rating: float

    class Config:
        from_attributes = True


class DistrictReportOut(BaseModel):
    id: int
    state: str
    district: str
    reporting_month: str
    total_complaints: int
    resolved_complaints: int
    budget_spent: float
    budget_sanctioned: float
    road_health_index: float

    class Config:
        from_attributes = True


