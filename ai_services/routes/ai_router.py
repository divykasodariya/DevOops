from fastapi import APIRouter, HTTPException
from models.copilot_model import CopilotInput, CopilotResponse
from services.copilot.co_service import handle_copilot_message
from utils.logger import logger
from services.copilot.agent_service import run_agent

router = APIRouter()


@router.post("/chat", response_model=CopilotResponse)
async def copilot_chat(inp: CopilotInput):
    """
    Main copilot endpoint.
    Accepts a user message + session history, returns AI reply + optional action.
    """
    try:
        return await handle_copilot_message(inp)
    except Exception as e:
        logger.error(f"/copilot/chat error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Copilot service error")
    

@router.post("/agent")                                         # ← ADD
async def agent_chat(inp: CopilotInput):                       # ← ADD
    return await run_agent(                                    # ← ADD
        message=inp.message,                                   # ← ADD
        user_id=inp.user_id,                                   # ← ADD
        role=inp.role,                                         # ← ADD
        history=inp.history,                                   # ← ADD
    )  
    

from services.rag.rag_service import rag_query
from services.rag.ingester import ingest_text, ingest_pdf
from fastapi import UploadFile, File
import tempfile, os

# Query RAG
@router.post("/rag/query")
async def rag_search(payload: dict):
    question = payload.get("question", "")
    result   = await rag_query(question)
    return result

# Ingest plain text (notices, announcements)
@router.post("/rag/ingest/text")
async def ingest_notice(payload: dict):
    ingest_text(
        text=payload["text"],
        source=payload.get("source", "notice"),
        metadata=payload.get("metadata", {}),
    )
    return {"status": "ingested"}

# Ingest PDF upload
@router.post("/rag/ingest/pdf")
async def ingest_pdf_upload(file: UploadFile = File(...)):
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name
    ingest_pdf(tmp_path, metadata={"filename": file.filename})
    os.unlink(tmp_path)
    return {"status": "ingested", "filename": file.filename}

@router.post("/agent")
async def agent_chat(inp: CopilotInput):
    return await run_agent(
        message=inp.message,
        user_id=inp.user_id,
        role=inp.role,
        history=inp.history,
        token=inp.token,           # ← pass it through
    )