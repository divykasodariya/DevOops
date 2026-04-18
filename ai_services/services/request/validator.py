def validate(parsed: dict):
    required = ["type", "reason"]
    for r in required:
        if r not in parsed:
            return False
    return True