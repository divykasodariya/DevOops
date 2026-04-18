from fastapi import APIRouter
from services.tagging.tag_generator import generate_tags

router = APIRouter()

@router.post("/generate")
async def tags(data: dict):
    return {"tags": generate_tags(data)}