from fastapi import APIRouter, HTTPException, UploadFile, File
from models.copilot_model import CopilotInput, CopilotResponse
from services.copilot.co_service import handle_copilot_message
from services.copilot.agent_service import run_agent
from services.rag.rag_service import rag_query
from services.rag.ingester import ingest_text, ingest_pdf
from utils.logger import logger
import tempfile, os

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


@router.post("/agent")
async def agent_chat(inp: CopilotInput):
    """
    Agentic endpoint — the AI plans + executes tool calls
    (attendance, schedule, email, RAG, etc.) and returns a summarized reply.
    """
    try:
        return await run_agent(
            message=inp.message,
            user_id=inp.user_id,
            role=inp.role,
            history=inp.history,
            token=inp.token or "",
        )
    except Exception as e:
        logger.error(f"/copilot/agent fatal: {e}", exc_info=True)
        return {
            "reply": (
                "Something went wrong while handling that request. "
                "For room bookings, include a room code, date, and start/end times in ISO format."
            ),
            "tool_calls": [],
            "results": {},
            "thoughts": "",
        }


# ── RAG endpoints ────────────────────────────────────────────────────────────

@router.post("/rag/query")
async def rag_search(payload: dict):
    question = payload.get("question", "")
    result   = await rag_query(question)
    return result


@router.post("/rag/ingest/text")
async def ingest_notice(payload: dict):
    ingest_text(
        text=payload["text"],
        source=payload.get("source", "notice"),
        metadata=payload.get("metadata", {}),
    )
    return {"status": "ingested"}


@router.post("/rag/ingest/pdf")
async def ingest_pdf_upload(file: UploadFile = File(...)):
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name
    ingest_pdf(tmp_path, metadata={"filename": file.filename})
    os.unlink(tmp_path)
    return {"status": "ingested", "filename": file.filename}