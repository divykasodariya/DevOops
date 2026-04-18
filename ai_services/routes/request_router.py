from fastapi import APIRouter
from services.request.parser import parse_request
from services.request.router import route_request

router = APIRouter()

@router.post("/process")
async def process(data: dict):
    parsed = parse_request(data.get("text", ""))
    return route_request(parsed)