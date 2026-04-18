from fastapi import APIRouter, HTTPException
from models.tag_model import TagInput, TagOutput
from services.tagging.tagger import generate_tags
from utils.logger import logger

router = APIRouter()


@router.post("/generate", response_model=TagOutput)
async def generate(inp: TagInput):
    """
    Generate semantic tags for any campus entity.
    Context examples: 'professor_profile', 'issue', 'course', 'research'
    """
    try:
        return await generate_tags(inp)
    except Exception as e:
        logger.error(f"/tags/generate error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Tag generation failed")