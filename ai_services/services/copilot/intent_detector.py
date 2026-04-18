def detect_intent(query: str):
    q = query.lower()
    if "request" in q:
        return "requests"
    if "class" in q:
        return "schedule"
    return "general"