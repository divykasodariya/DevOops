"""
Canonical list of spaces users can reserve via the app (Schedule > Book a Space).
Keep in sync with frontend: frontend/src/screens/BookSpaceScreen.js → SPACES
"""

BOOKABLE_SPACES = [
    {"label": "Main Library - Study Room A (4 persons)", "room": "LIB-STUDY-A"},
    {"label": "Main Library - Study Room B (6 persons)", "room": "LIB-STUDY-B"},
    {"label": "Library — Quiet Nook (2 persons)", "room": "LIB-NOOK-2"},
    {"label": "Student Center — Rehearsal Room 1", "room": "SC-REH-1"},
    {"label": "Engineering Building — Study Pod E-104", "room": "ENG-POD-104"},
]


def format_bookable_spaces_for_prompt() -> str:
    return "\n".join(f"  • {s['room']} — {s['label']}" for s in BOOKABLE_SPACES)
