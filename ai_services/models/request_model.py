from pydantic import BaseModel

class RequestInput(BaseModel):
    text: str