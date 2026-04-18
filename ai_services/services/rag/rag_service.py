from services.rag.vector_store import search
from services.llm.llm_client import call_llm
from utils.logger import logger

RAG_SYSTEM = """
You are CampusAI. Answer the student's question using ONLY the context below.
If the answer is not in the context, say "I don't have that information right now."
Be concise — max 3 sentences.

Context:
{context}
"""

async def rag_query(question: str, filter: dict = None) -> dict:
    # 1. Retrieve relevant chunks
    chunks = search(question, n_results=4, filter=filter)

    if not chunks:
        return {
            "reply":   "I couldn't find relevant information in college documents.",
            "sources": [],
        }

    # 2. Build context string
    context = "\n\n".join(
        f"[{c['metadata'].get('source', 'doc')}]\n{c['text']}"
        for c in chunks
        if c["score"] > 0.3          # only use relevant chunks
    )

    logger.info(f"RAG: {len(chunks)} chunks retrieved, top score={chunks[0]['score']:.2f}")

    # 3. LLM answers using context
    messages = [
        {"role": "system", "content": RAG_SYSTEM.format(context=context)},
        {"role": "user",   "content": question},
    ]
    reply = await call_llm(messages, temperature=0.1)

    return {
        "reply":   reply,
        "sources": [c["metadata"].get("source") for c in chunks],
    }