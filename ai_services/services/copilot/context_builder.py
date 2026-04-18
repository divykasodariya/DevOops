def build_context(intent: str, user_id: str):
    # placeholder (no DB yet)
    if intent == "requests":
        return "User has 2 pending requests."
    if intent == "schedule":
        return "Next class at 10 AM."
    return "General info."