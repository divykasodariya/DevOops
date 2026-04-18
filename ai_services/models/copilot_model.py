from pydantic import BaseModel, Field
from typing import Optional, Literal
from enum import Enum


class IntentType(str, Enum):
    submit_request   = "submit_request"
    check_status     = "check_status"
    ask_schedule     = "ask_schedule"
    report_issue     = "report_issue"
    payment_query    = "payment_query"
    attendance_query = "attendance_query"
    general_query    = "general_query"
    greeting         = "greeting"
    unknown          = "unknown"


class CopilotInput(BaseModel):
    message:    str = Field(..., min_length=1, max_length=2000)
    session_id: str
    user_id:    str
    role:       str = "student"
    department_id: Optional[str] = None
    input_mode: Literal["text", "voice"] = "text"
    history:    list[dict] = []             # [{role, content}, ...]
    token:      Optional[str] = None        # JWT from Node backend for API calls


class CopilotResponse(BaseModel):
    reply:       str
    intent:      IntentType
    action:      Optional[str]  = None      # e.g. "create_approval_request"
    action_data: Optional[dict] = None      # payload for the action
    citations:   list[dict]     = []        # refs to DB records shown
    session_id:  str