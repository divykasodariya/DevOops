from services.tools.mailer import send_email
from db.queries import (
    get_attendance_summary_for_student,
    get_upcoming_schedules_for_user,
    get_pending_payments_for_user,
    get_pending_requests_for_user,
)

# Every tool the agent can call
TOOLS = {
    # ── Attendance ───────────────────────────────────────────
    "check_attendance": {
        "description": "Get my attendance overview — percentage, status, total classes",
        "params": [],
    },
    "check_faculty_stats": {
        "description": "Get class-wise attendance summary (faculty only)",
        "params": [],
    },
    "mark_attendance": {
        "description": "Mark attendance for a course (faculty only)",
        "params": ["course_id", "date", "records"],
    },

    # ── Schedule ─────────────────────────────────────────────
    "check_schedule": {
        "description": "Get my upcoming classes, exams, and events",
        "params": [],
    },
    "check_free_slots": {
        "description": "Check free room slots for a given room and date",
        "params": ["room", "date"],
    },
    "create_schedule": {
        "description": "Create a new schedule or class entry",
        "params": ["title", "type", "room", "start", "end"],
    },

    # ── Requests ─────────────────────────────────────────────
    "check_requests": {
        "description": "Get my submitted approval requests and their status",
        "params": [],
    },
    "check_pending_approvals": {
        "description": "Get requests pending my approval (faculty/HOD)",
        "params": [],
    },
    "submit_request": {
        "description": (
            "Submit a new approval request. REQUIRED: type and title. Optional: description, steps, meta. "
            "type must be one of: leave, room, event, certificate, lor, research, od, lab_access, event_permission, custom. "
            "For 'steps', provide an array of objects e.g. [{'approver': '<user_id>', 'role': 'hod'}]. If steps is omitted, the approval chain is auto-generated. "
            "For LOR (lor) or research directed at a specific professor, set meta.facultyEmail to that professor's "
            "campus email (lowercase) so the first approval step routes to them. You may also set meta.tags (string array) "
            "for topic matching. Example params: {\"type\":\"lor\",\"title\":\"Letter of recommendation\",\"description\":\"...\",\"steps\":[{\"approver\":\"prof123\",\"role\":\"faculty\"}],\"meta\":{\"facultyEmail\":\"prof@college.edu\",\"tags\":[\"ml\"]}}"
        ),
        "params": ["type", "title", "description", "steps", "meta"],
    },
    "approve_request": {
        "description": "Approve or reject a pending approval request",
        "params": ["request_id", "action", "remarks"],
    },

    # ── Issues ───────────────────────────────────────────────
    "report_issue": {
        "description": "Report a campus infrastructure issue — electrical, plumbing, IT, safety",
        "params": ["title", "location", "category", "priority","description"],
    },
    "check_my_issues": {
        "description": "Check status of issues I have reported",
        "params": [],
    },

    # ── Notifications ─────────────────────────────────────────
    "check_notifications": {
        "description": "Get my latest notifications and alerts",
        "params": [],
    },
    "check_announcements": {
        "description": "Get latest announcements from faculty or admin",
        "params": [],
    },
    "send_announcement": {
        "description": "Send an announcement to students or faculty (admin/faculty only)",
        "params": ["title", "body", "audience"],
    },

    # ── Email ────────────────────────────────────────────────
    "send_email": {
        "description": "Send an email directly to a faculty, HOD, or any address",
        "params": ["to", "subject", "body"],
    },

    # ── Payments ─────────────────────────────────────────────
    "check_payments": {
        "description": "Get my pending fines, lab dues, and fee payments",
        "params": [],
    },

    # ── RAG ──────────────────────────────────────────────────
    "search_docs": {
        "description": "Search college notices, syllabus, exam rules, announcements",
        "params": ["question"],
    },
}