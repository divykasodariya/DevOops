import chromadb
from chromadb.config import Settings

_client = None
_collection = None

def get_collection():
    global _client, _collection
    if _collection is None:
        _client = chromadb.PersistentClient(path="./chroma_db")  # saves to disk
        _collection = _client.get_or_create_collection(
            name="campus_docs",
            metadata={"hnsw:space": "cosine"},
        )
    return _collection

def add_documents(chunks: list[dict]):
    """
    chunks = [
        {"id": "doc1_chunk0", "text": "...", "metadata": {"source": "notice", "date": "..."}}
    ]
    """
    from services.rag.embedder import embed_many

    collection = get_collection()
    texts      = [c["text"] for c in chunks]
    ids        = [c["id"]   for c in chunks]
    metadatas  = [c.get("metadata", {}) for c in chunks]
    embeddings = embed_many(texts)

    collection.add(
        ids=ids,
        documents=texts,
        embeddings=embeddings,
        metadatas=metadatas,
    )

def search(query: str, n_results: int = 4, filter: dict = None) -> list[dict]:
    from services.rag.embedder import embed

    collection = get_collection()
    kwargs = {
        "query_embeddings": [embed(query)],
        "n_results":        n_results,
        "include":          ["documents", "metadatas", "distances"],
    }
    if filter:
        kwargs["where"] = filter

    results = collection.query(**kwargs)

    output = []
    for i, doc in enumerate(results["documents"][0]):
        output.append({
            "text":     doc,
            "metadata": results["metadatas"][0][i],
            "score":    1 - results["distances"][0][i],  # cosine → similarity
        })
    return output