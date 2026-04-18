from pydantic import BaseModel, Field
from typing import Optional


class TagInput(BaseModel):
    text:        str = Field(..., min_length=5, max_length=5000)
    context:     Optional[str] = None       # "professor_profile" | "issue" | "course"
    max_tags:    int = Field(default=8, ge=1, le=20)
    entity_id:   Optional[str] = None      # MongoDB ObjectId of the entity


class TagOutput(BaseModel):
    tags:       list[str]
    entity_id:  Optional[str] = None
    confidence: Optional[float] = None