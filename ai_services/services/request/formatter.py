def format_request(parsed: dict):
    return f"""
    Type: {parsed.get("type")}
    Reason: {parsed.get("reason")}
    Urgency: {parsed.get("urgency")}
    """