from pydantic import BaseModel

class QueryInput(BaseModel):
    query: str
    user_id: str