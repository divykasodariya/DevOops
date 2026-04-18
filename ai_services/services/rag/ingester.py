import uuid
import PyPDF2
from pathlib import Path
from services.rag.vector_store import add_documents
from utils.logger import logger


def chunk_text(text: str, chunk_size: int = 400, overlap: int = 50) -> list[str]:
    """Split text into overlapping chunks."""
    words  = text.split()
    chunks = []
    i = 0
    while i < len(words):
        chunk = " ".join(words[i: i + chunk_size])
        chunks.append(chunk)
        i += chunk_size - overlap
    return [c for c in chunks if c.strip()]   # filter empty chunks


def ingest_text(text: str, source: str, metadata: dict = None):
    if metadata is None:
        metadata = {}                          # ← fix: mutable default arg

    chunks = chunk_text(text)
    if not chunks:
        logger.warning(f"No chunks generated from source: {source}")
        return

    docs = [
        {
            "id":       f"{source}_{i}_{uuid.uuid4().hex[:6]}",
            "text":     chunk,
            "metadata": {"source": source, **metadata},
        }
        for i, chunk in enumerate(chunks)
    ]
    add_documents(docs)
    logger.info(f"Ingested {len(docs)} chunks from: {source}")


def ingest_pdf(path: str, metadata: dict = None):
    if metadata is None:
        metadata = {}                          # ← fix: mutable default arg

    text = ""
    try:
        with open(path, "rb") as f:
            reader = PyPDF2.PdfReader(f)
            for page in reader.pages:
                extracted = page.extract_text()
                if extracted:
                    text += extracted + "\n"
    except Exception as e:
        logger.error(f"Failed to read PDF {path}: {e}")
        return

    if not text.strip():
        logger.warning(f"No text extracted from PDF: {path}")
        return

    source = Path(path).stem
    ingest_text(text, source=source, metadata={"type": "pdf", **metadata})


def ingest_folder(folder: str, metadata: dict = None):
    """Ingest all PDFs and .txt files from a folder."""
    if metadata is None:
        metadata = {}                          # ← fix: mutable default arg

    folder_path = Path(folder)

    if not folder_path.exists():
        logger.error(f"Folder not found: {folder}")
        return

    files = list(folder_path.iterdir())
    if not files:
        logger.warning(f"No files found in folder: {folder}")
        return

    for file in files:
        if file.suffix.lower() == ".pdf":
            logger.info(f"Ingesting PDF: {file.name}")
            ingest_pdf(str(file), metadata={"filename": file.name, **metadata})

        elif file.suffix.lower() == ".txt":
            logger.info(f"Ingesting TXT: {file.name}")
            try:
                text = file.read_text(encoding="utf-8")
                ingest_text(
                    text=text,
                    source=file.stem,
                    metadata={"type": "txt", "filename": file.name, **metadata},
                )
            except Exception as e:
                logger.error(f"Failed to read {file.name}: {e}")

        else:
            logger.debug(f"Skipping unsupported file: {file.name}")