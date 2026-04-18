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
        "description": "Submit a new approval request — leave, OD, certificate, room, LOR",
        "params": ["type", "title", "description"],
    },
    "approve_request": {
        "description": "Approve or reject a pending approval request",
        "params": ["request_id", "action", "remarks"],
    },

    # ── Issues ───────────────────────────────────────────────
    "report_issue": {
        "description": "Report a campus infrastructure issue — electrical, plumbing, IT, safety",
        "params": ["title", "category", "location", "description"],
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

    # ── RAG ──────────────────────────────────────────────────
    "search_docs": {
        "description": "Search college notices, syllabus, exam rules, announcements",
        "params": ["question"],
    },
}