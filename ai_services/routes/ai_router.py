from fastapi import APIRouter
from services.copilot.copilot_service import handle_query

router = APIRouter()

@router.post("/copilot")
async def copilot(data: dict):
    return {"response": handle_query(data.get("query",""), data.get("user_id","demo"))}