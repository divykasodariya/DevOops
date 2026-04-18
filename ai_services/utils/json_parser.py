import json

def safe_parse(text: str):
    try:
        return json.loads(text)
    except:
        return None