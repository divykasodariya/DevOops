from bson import ObjectId
from datetime import datetime


def serialize_doc(doc: dict) -> dict:
    """Recursively convert ObjectId and datetime to JSON-safe types."""
    if doc is None:
        return {}
    out = {}
    for k, v in doc.items():
        if isinstance(v, ObjectId):
            out[k] = str(v)
        elif isinstance(v, datetime):
            out[k] = v.isoformat()
        elif isinstance(v, dict):
            out[k] = serialize_doc(v)
        elif isinstance(v, list):
            out[k] = [serialize_doc(i) if isinstance(i, dict) else
                      str(i) if isinstance(i, ObjectId) else i for i in v]
        else:
            out[k] = v
    return out


def truncate(text: str, max_len: int = 500) -> str:
    return text[:max_len] + "..." if len(text) > max_len else text


def role_display(role: str) -> str:
    return {
        "student":   "Student",
        "faculty":   "Faculty Member",
        "hod":       "Head of Department",
        "principal": "Principal",
        "admin":     "Administrator",
        "support":   "Support Staff",
        "club":      "Club Representative",
    }.get(role, role.title())