"""
All DB queries are here. Collection names match the Mongoose model names (lowercase plural).
Mirrors:  User, Department, ApprovalRequest, Schedule, Issue, Payment, Course, Attendance
"""

from bson import ObjectId
from datetime import datetime, timezone
from db.db_client import get_db
from utils.logger import logger


def _safe_id(id_str: str):
    try:
        return ObjectId(id_str)
    except Exception:
        return None

async def get_teacher_email_for_student(user_id: str) -> str:
    db = get_db()
    if db is None:
        return ""

    try:
        # Step 1: find one course the student is enrolled in (via attendance)
        attendance = await db.attendances.find_one(
            {"records.student": _safe_id(user_id)},
            {"course": 1}
        )

        if not attendance:
            return ""

        course_id = attendance.get("course")

        # Step 2: get course details
        course = await db.courses.find_one(
            {"_id": course_id},
            {"faculty": 1}
        )

        if not course or not course.get("faculty"):
            return ""

        faculty_id = course["faculty"]

        # Step 3: get faculty email
        faculty = await db.users.find_one(
            {"_id": faculty_id},
            {"email": 1}
        )

        if not faculty:
            return ""

        return faculty.get("email", "")

    except Exception as e:
        logger.error(f"get_teacher_email_for_student: {e}")
        return ""
# ── Department ──────────────────────────────────────────────────────────────

async def get_department_by_name(name: str) -> dict | None:
    db = get_db()
    if db is None:
        return None
    try:
        doc = await db.departments.find_one(
            {"name": {"$regex": name, "$options": "i"}},
            {"_id": 1, "name": 1, "code": 1, "hod": 1, "principal": 1},
        )
        return doc
    except Exception as e:
        logger.error(f"get_department_by_name: {e}")
        return None


async def get_hod_for_department(department_id: str) -> dict | None:
    db = get_db()
    if db is None:
        return None
    try:
        dept = await db.departments.find_one({"_id": _safe_id(department_id)})
        if not dept or not dept.get("hod"):
            return None
        return await db.users.find_one(
            {"_id": dept["hod"]},
            {"_id": 1, "name": 1, "email": 1, "role": 1},
        )
    except Exception as e:
        logger.error(f"get_hod_for_department: {e}")
        return None


# ── ApprovalRequest ─────────────────────────────────────────────────────────

async def get_pending_requests_for_user(user_id: str) -> list[dict]:
    db = get_db()
    if db is None:
        return []
    try:
        cursor = db.approvalrequests.find(
            {"requestedBy": _safe_id(user_id), "overallStatus": "pending"},
            {"_id": 1, "type": 1, "title": 1, "overallStatus": 1, "createdAt": 1},
        ).sort("createdAt", -1).limit(5)
        return [doc async for doc in cursor]
    except Exception as e:
        logger.error(f"get_pending_requests_for_user: {e}")
        return []


async def get_requests_awaiting_approver(approver_id: str) -> list[dict]:
    db = get_db()
    if db is None:
        return []
    try:
        cursor = db.approvalrequests.find(
            {
                "steps.approver": _safe_id(approver_id),
                "steps.status":   "pending",
                "overallStatus":  "pending",
            },
            {"_id": 1, "type": 1, "title": 1, "requestedBy": 1, "currentStep": 1},
        ).limit(10)
        return [doc async for doc in cursor]
    except Exception as e:
        logger.error(f"get_requests_awaiting_approver: {e}")
        return []


# ── Schedule ────────────────────────────────────────────────────────────────

async def get_upcoming_schedules_for_user(user_id: str) -> list[dict]:
    db = get_db()
    if db is None:
        return []
    try:
        now = datetime.now(timezone.utc)
        cursor = db.schedules.find(
            {
                "audienceIds": _safe_id(user_id),
                "start": {"$gte": now},
                "isActive": True,
            },
            {"_id": 1, "title": 1, "type": 1, "start": 1, "end": 1, "room": 1},
        ).sort("start", 1).limit(5)
        return [doc async for doc in cursor]
    except Exception as e:
        logger.error(f"get_upcoming_schedules_for_user: {e}")
        return []


# ── Issue ───────────────────────────────────────────────────────────────────

async def get_open_issues_for_department(department_id: str) -> list[dict]:
    """
    Issues don't have a department field directly, so we scope by users in dept.
    Simplified: just return recent open issues.
    """
    db = get_db()
    if db is None:
        return []
    try:
        cursor = db.issues.find(
            {"status": {"$in": ["open", "in_progress"]}},
            {"_id": 1, "title": 1, "category": 1, "status": 1, "priority": 1, "location": 1},
        ).sort("createdAt", -1).limit(5)
        return [doc async for doc in cursor]
    except Exception as e:
        logger.error(f"get_open_issues_for_department: {e}")
        return []


# ── Payment ─────────────────────────────────────────────────────────────────

async def get_pending_payments_for_user(user_id: str) -> list[dict]:
    db = get_db()
    if db is None:
        return []
    try:
        cursor = db.payments.find(
            {"paidBy": _safe_id(user_id), "status": "pending"},
            {"_id": 1, "type": 1, "amount": 1, "currency": 1, "description": 1, "status": 1},
        ).sort("createdAt", -1).limit(5)
        return [doc async for doc in cursor]
    except Exception as e:
        logger.error(f"get_pending_payments_for_user: {e}")
        return []


# ── Attendance ───────────────────────────────────────────────────────────────

async def get_attendance_summary_for_student(user_id: str) -> list[dict]:
    """
    Aggregates attendance % per course for a student.
    """
    db = get_db()
    if db is None:
        return []
    try:
        pipeline = [
            {"$match": {"records.student": _safe_id(user_id)}},
            {"$unwind": "$records"},
            {"$match": {"records.student": _safe_id(user_id)}},
            {
                "$group": {
                    "_id": "$course",
                    "total":   {"$sum": 1},
                    "present": {"$sum": {"$cond": [{"$eq": ["$records.status", "present"]}, 1, 0]}},
                }
            },
            {
                "$project": {
                    "course": "$_id",
                    "total": 1,
                    "present": 1,
                    "percentage": {
                        "$round": [
                            {"$multiply": [{"$divide": ["$present", "$total"]}, 100]}, 1
                        ]
                    },
                }
            },
        ]
        cursor = db.attendances.aggregate(pipeline)
        return [doc async for doc in cursor]
    except Exception as e:
        logger.error(f"get_attendance_summary_for_student: {e}")
        return []