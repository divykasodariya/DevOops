from fastapi import APIRouter, HTTPException
from models.request_model import RawRequestInput, RoutedRequest
from services.request.parser import parse_request
from services.request.router import route_request
from services.request.formatter import format_request_body
from utils.logger import logger

router = APIRouter()


@router.post("/parse", response_model=RoutedRequest)
async def parse_and_route(inp: RawRequestInput):
    """
    Full pipeline:
      raw text → AI parse → validate → route to HOD → format body
    Returns a RoutedRequest ready for the Node backend to create an ApprovalRequest doc.
    """
    # 1. Parse
    parsed = await parse_request(
        raw_text=inp.raw_text,
        role=inp.role,
        department=inp.department_id or "Unknown",
    )

    if not parsed:
        raise HTTPException(status_code=422, detail="Could not understand the request. Please rephrase.")

    # 2. Route
    routed = await route_request(parsed)

    # 3. Format body
    routed.formatted_body = await format_request_body(parsed, role=inp.role)

    logger.info(f"Request parsed → type={routed.type} dept={routed.department} hod={routed.hod_user_id}")
    return routed


@router.post("/parse-only", response_model=dict)
async def parse_only(inp: RawRequestInput):
    """
    Lightweight endpoint — parse only, no DB routing.
    Useful for previewing before submission.
    """
    parsed = await parse_request(
        raw_text=inp.raw_text,
        role=inp.role,
        department=inp.department_id or "Unknown",
    )
    if not parsed:
        raise HTTPException(status_code=422, detail="Could not understand the request.")
    return parsed.model_dump()