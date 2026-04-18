import httpx
from config import settings
from utils.logger import logger

BASE = settings.NODE_BACKEND_URL

# We pass the user's JWT token so Node auth middleware works normally
async def _get(path: str, token: str, params: dict = None) -> dict:
    async with httpx.AsyncClient() as client:
        try:
            r = await client.get(
                f"{BASE}{path}",
                headers={"Authorization": f"Bearer {token}"},
                params=params,
                timeout=10,
            )
            r.raise_for_status()
            return r.json()
        except Exception as e:
            logger.error(f"Node GET {path} failed: {e}")
            return {"error": str(e)}


async def _post(path: str, token: str, body: dict = None) -> dict:
    async with httpx.AsyncClient() as client:
        try:
            r = await client.post(
                f"{BASE}{path}",
                headers={"Authorization": f"Bearer {token}"},
                json=body or {},
                timeout=10,
            )
            r.raise_for_status()
            return r.json()
        except Exception as e:
            logger.error(f"Node POST {path} failed: {e}")
            return {"error": str(e)}


# ── attendanceController.js ──────────────────────────────────────────────────

async def get_attendance_overview(token: str) -> dict:
    """GET /attendance/overview"""
    return await _get("/attendance/overview", token)


async def get_faculty_stats(token: str) -> dict:
    """GET /attendance/faculty-stats"""
    return await _get("/attendance/faculty-stats", token)


async def mark_attendance(token: str, course_id: str, date: str, records: list) -> dict:
    """POST /attendance/mark"""
    return await _post("/attendance/mark", token, {
        "courseId": course_id,
        "date":     date,
        "records":  records,
    })


# ── scheduleController.js ────────────────────────────────────────────────────

async def get_my_schedule(token: str) -> dict:
    """GET /schedule/my"""
    return await _get("/schedule/my", token)


async def get_free_slots(token: str, room: str, date: str) -> dict:
    """GET /schedule/slots?room=LH-301&date=2025-04-18"""
    return await _get("/schedule/slots", token, params={"room": room, "date": date})


async def create_schedule(token: str, data: dict) -> dict:
    """POST /schedule"""
    return await _post("/schedule", token, data)


# ── requestController.js ─────────────────────────────────────────────────────

async def get_my_requests(token: str) -> dict:
    """GET /request — student sees own, faculty sees pending approvals"""
    return await _get("/request", token)


async def get_pending_requests(token: str) -> dict:
    """GET /request/pending — user's own pending requests"""
    return await _get("/request/pending", token)


async def get_requests_for_approver(token: str) -> dict:
    """GET /request — faculty/HOD sees requests where they are the approver"""
    return await _get("/request", token)


async def create_request(token: str, data: dict) -> dict:
    """POST /request"""
    return await _post("/request", token, data)


async def action_request(token: str, request_id: str, action: str, remarks: str = "") -> dict:
    """POST /request/action — approve or reject"""
    return await _post("/request/action", token, {
        "requestId": request_id,
        "action":    action,
        "remarks":   remarks,
    })


async def get_approver_candidates(token: str) -> dict:
    """GET /request/approvers"""
    return await _get("/request/approvers", token)


# ── issueController.js ───────────────────────────────────────────────────────

async def create_issue(token: str, data: dict) -> dict:
    """POST /issues"""
    return await _post("/issues", token, data)


async def get_my_issues(token: str) -> dict:
    """GET /issues/my"""
    return await _get("/issues/my", token)


# ── notificationController.js ────────────────────────────────────────────────

async def get_my_notifications(token: str) -> dict:
    """GET /notifications/my"""
    return await _get("/notifications/my", token)


async def get_announcements(token: str) -> dict:
    """GET /notifications/announcements"""
    return await _get("/notifications/announcements", token)


async def create_announcement(token: str, title: str, body: str, audience: str = "all") -> dict:
    """POST /notifications/announce"""
    return await _post("/notifications/announce", token, {
        "title":          title,
        "body":           body,
        "targetAudience": audience,
    })


# ── professorController.js ───────────────────────────────────────────────────

async def setup_professor_profile(token: str, data: dict) -> dict:
    """POST /prof/setup"""
    return await _post("/prof/setup", token, data)