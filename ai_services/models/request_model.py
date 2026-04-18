from pydantic import BaseModel, Field
from typing import Optional, Literal
from enum import Enum


class RequestType(str, Enum):
    leave           = "leave"
    room            = "room"
    event           = "event"
    certificate     = "certificate"
    lor             = "lor"
    research        = "research"
    od              = "od"
    lab_access      = "lab_access"
    event_permission= "event_permission"
    custom          = "custom"


class UrgencyLevel(str, Enum):
    low    = "low"
    medium = "medium"
    high   = "high"


class ParsedRequest(BaseModel):
    type:       RequestType
    title:      str
    reason:     str
    urgency:    UrgencyLevel
    department: str                         # department name string
    extra:      Optional[dict] = None       # any extra fields AI extracted


class RoutedRequest(ParsedRequest):
    hod_user_id:   Optional[str] = None    # resolved from DB
    approver_chain: list[str] = []         # ordered list of approver IDs
    formatted_body: str = ""               # cleaned text for the approval doc


class RawRequestInput(BaseModel):
    raw_text:      str = Field(..., min_length=3, max_length=2000)
    user_id:       str
    department_id: Optional[str] = None    # pre-known from user profile
    role:          str = "student"