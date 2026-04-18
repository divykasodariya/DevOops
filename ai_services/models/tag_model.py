from pydantic import BaseModel

class TagInput(BaseModel):
    data: dict