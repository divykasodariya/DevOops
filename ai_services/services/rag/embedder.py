from sentence_transformers import SentenceTransformer

_model = None

def get_embedder():
    global _model
    if _model is None:
        # downloads once, runs locally, free forever
        _model = SentenceTransformer("all-MiniLM-L6-v2")
    return _model

def embed(text: str) -> list[float]:
    return get_embedder().encode(text).tolist()

def embed_many(texts: list[str]) -> list[list[float]]:
    return get_embedder().encode(texts).tolist()