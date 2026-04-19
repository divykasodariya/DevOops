import json
import jwt
from copy import deepcopy
from config import settings
from services.llm.llm_client import call_llm
from services.tools.mailer import send_email
from services.tools.node_client import (
    get_attendance_overview, get_faculty_stats, mark_attendance,
    get_my_schedule, get_free_slots, create_schedule,
    get_my_requests, get_pending_requests, get_requests_for_approver,
    create_request, action_request,
    create_issue, get_my_issues,
    get_my_notifications, get_announcements, create_announcement,
)
from db.queries import (
    get_attendance_summary_for_student,
    get_upcoming_schedules_for_user,
    get_pending_payments_for_user,
    get_pending_requests_for_user,
    get_teacher_email_for_student,
)
from utils.json_parser import safe_parse_json
from utils.logger import logger
from bookable_spaces import BOOKABLE_SPACES, format_bookable_spaces_for_prompt


FALLBACK_TEACHER_EMAIL = "krishkhandwalacnm@gmail.com"

INVALID_EMAIL_HINTS = ["teacher", "email", "unknown", "string", "none", "null", "placeholder", "@example"]


def _normalize_create_schedule_params(params: dict | None) -> dict:
    """Map LLM keys to Node POST /schedule; avoid bad types that cause 500s."""
    if not params:
        return {}
    p = deepcopy(params)
    for src, dst in (
        ("start_time", "start"),
        ("end_time", "end"),
        ("startTime", "start"),
        ("endTime", "end"),
    ):
        if src in p and dst not in p:
            p[dst] = p[src]
    if p.get("start") is not None:
        p["start"] = str(p["start"]).strip()
    if p.get("end") is not None:
        p["end"] = str(p["end"]).strip()
    if p.get("room") is not None:
        p["room"] = str(p["room"]).strip()
    t = str(p.get("type") or "").lower().strip()
    if t in ("", "booking", "book", "reservation", "room", "study"):
        p["type"] = "room_booking"
    return p


def _safe_json_dumps(obj: dict) -> str:
    try:
        return json.dumps(obj, default=str)
    except (TypeError, ValueError) as e:
        logger.warning(f"json.dumps tool results failed: {e}")
        return json.dumps({k: repr(v) for k, v in obj.items()})


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
    "list_bookable_spaces": {
        "description": (
            "List every study room / rehearsal space students can reserve, with official room IDs. "
            "Call when the user asks what rooms exist, what they can book, or before suggesting a booking."
        ),
        "params": [],
    },
    "check_free_slots": {
        "description": (
            "Check free 1-hour slots (8am–6pm local) for one room on a date. "
            "Params: room = exact code from list_bookable_spaces (e.g. LIB-STUDY-A); date = YYYY-MM-DD."
        ),
        "params": ["room", "date"],
    },
    "create_schedule": {
        "description": (
            "Book a room or create a schedule entry. For study/room bookings use type room_booking, "
            "room code (e.g. LIB-STUDY-A), start and end as full ISO 8601 datetimes (UTC or offset). "
            "Example end: 2026-04-19T16:00:00.000Z"
        ),
        "params": ["title", "type", "room", "start", "end"],
    },

    # ── Requests ─────────────────────────────────────────────
    "check_requests": {
        "description": "Get my submitted approval requests and their status",
        "params": [],
    },
    "check_pending_approvals": {
        "description": "Get requests pending my approval (faculty/HOD only)",
        "params": [],
    },
    "submit_request": {
        "description": "Submit a new approval request. REQUIRED: type and title. Optional: description. type must be one of: leave, room, event, certificate, lor, research, od, lab_access, event_permission, custom.",
        "params": ["type", "title", "description"],
    },
    "approve_request": {
        "description": "Approve or reject a pending approval request",
        "params": ["request_id", "action", "remarks"],
    },
    "submit_document_request": {
        "description": (
            "Submit a document or image for faculty review/signing. Use when a user has uploaded a file/image and wants to "
            "send it to a faculty member. REQUIRED: title (a short description like 'Sick leave certificate for signing'). "
            "Optional: description, faculty_email (target professor's email). "
            "The attachments are passed automatically from the chat context — do NOT invent attachment URLs. "
            "Example: {\"title\":\"Medical certificate\",\"description\":\"Please review\",\"faculty_email\":\"prof@college.edu\"}"
        ),
        "params": ["title", "description", "faculty_email"],
    },

    # ── Issues ───────────────────────────────────────────────
    "report_issue": {
        "description": "Report a campus infrastructure issue. REQUIRED: title, category (it, facility, electrical, plumbing, safety, other), and location. Optional: priority (low, medium, high, critical) and description.",
        "params": ["title", "category", "location", "description", "priority"],
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
        "description": "Send an announcement to students or faculty. REQUIRED: title and body. Optional: audience (student, faculty, all).",
        "params": ["title", "body", "audience"],
    },

    # ── Email ────────────────────────────────────────────────
    "send_email": {
        "description": "Send an email directly to a faculty, HOD, or any address",
        "params": ["to", "subject", "body"],
    },

    # ── Payments (direct DB) ──────────────────────────────────
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


AGENT_SYSTEM = """
You are CampusAI, an autonomous agent embedded in a college ERP system.
You help students and faculty by actually performing tasks, not just answering.

You have access to these tools:
{tools}

Official bookable spaces (use these exact `room` codes in check_free_slots and create_schedule):
{bookable_spaces}
Tip: In the mobile app, users can also open Schedule → "Book a Space" to pick a room from this same list.

User role: {role}

When the user sends a message:
1. Decide which tools to call (can be multiple at once)
2. Extract the required params from the message
3. Respond ONLY with this exact JSON — no extra text, no markdown:
{{
  "thoughts": "brief plan of what you will do",
  "tool_calls": [
    {{"tool": "tool_name", "params": {{"param1": "value1"}}}}
  ],
  "reply": "friendly message to show user while working"
}}

Rules:
- If no tool is needed, set tool_calls to []
- For send_email: use ONLY keys "to", "subject", "body". NEVER use "email" as key.
- For send_email: NEVER invent or guess email addresses. If "to" is not explicitly given, set it to ""
- For check_attendance, check_schedule, check_payments, check_requests, check_notifications — no params needed
- For search_docs: set question to exactly what the user is asking about
- For check_free_slots: room and date are required; date must be YYYY-MM-DD (e.g. 2026-04-19). Only use room codes from the list above or from list_bookable_spaces.
- If the user asks what rooms they can book or what spaces exist, call list_bookable_spaces (or use the list above) and give friendly names plus codes and capacity.
- For create_schedule (room booking): use type room_booking, a room code from the official list, start and end as ISO 8601 strings. Never omit start/end.
- Never make up room codes — only use listed spaces.
- Never make up data — use tools to fetch real data
- You can call multiple tools in one shot
- When the user has attached a document or image and wants to send it to someone for signing/review/approval, use submit_document_request. Document/image attachments are handled automatically so you don't need to specify their URLs.
"""


async def run_agent(
    message:  str,
    user_id:  str,
    role:     str = "student",
    history:  list = None,
    token:    str = "",
    attachments: list = None,
) -> dict:

    if history is None:
        history = []
    if attachments is None:
        attachments = []

    # If no token provided, generate a fresh one using the shared secret
    if not token or token.strip() == "":
        try:
            token = jwt.encode({"id": user_id}, settings.JWT_SECRET, algorithm="HS256")
            logger.info(f"Generated fresh JWT for user {user_id}")
        except Exception as e:
            logger.error(f"Failed to generate JWT: {e}")

    # 1. Build tool descriptions
    tool_descriptions = "\n".join(
        f"- {name}: {meta['description']}"
        for name, meta in TOOLS.items()
    )

    # 2. Ask LLM to plan tool calls
    messages = [
        {
            "role":    "system",
            "content": AGENT_SYSTEM.format(
                tools=tool_descriptions,
                bookable_spaces=format_bookable_spaces_for_prompt(),
                role=role,
            ),
        },
        *history[-6:],
        {"role": "user", "content": message},
    ]

    try:
        raw  = await call_llm(messages, json_mode=True, temperature=0.1)
        plan = safe_parse_json(raw)
    except Exception as e:
        logger.error(f"Agent planning failed: {e}")
        return {
            "reply":      "Sorry, I had trouble processing that. Please try again.",
            "tool_calls": [],
            "results":    {},
        }

    if not plan:
        return {
            "reply":      "I couldn't understand what to do. Can you rephrase?",
            "tool_calls": [],
            "results":    {},
        }

    logger.info(f"Agent thoughts: {plan.get('thoughts')}")
    logger.info(f"Agent tool_calls: {plan.get('tool_calls')}")

    # 3. Execute each tool call
    results = {}

    for call in plan.get("tool_calls", []):
        tool_name = call.get("tool")
        params    = call.get("params", {})

        logger.info(f"Executing tool: {tool_name} | params: {params}")

        try:

            # ── Email ─────────────────────────────────────────────
            if tool_name == "send_email":
                raw_to = params.get("to") or params.get("email") or ""

                # Reject placeholder/fake emails
                if any(hint in raw_to.lower() for hint in INVALID_EMAIL_HINTS):
                    raw_to = ""

                to = raw_to or await get_teacher_email_for_student(user_id) or FALLBACK_TEACHER_EMAIL

                ok = await send_email(
                    to=to,
                    subject=params.get("subject") or "Regarding absence",
                    body=params.get("body") or "No message provided.",
                )
                results["send_email"] = f"Email sent to {to}" if ok else "Failed to send email."

            # ── Attendance (via Node API if token, else direct DB) ─
            elif tool_name == "check_attendance":
                if token:
                    results["attendance"] = await get_attendance_overview(token)
                else:
                    data = await get_attendance_summary_for_student(user_id)
                    results["attendance"] = data or "No attendance data found."

            elif tool_name == "check_faculty_stats":
                results["faculty_stats"] = await get_faculty_stats(token)

            elif tool_name == "mark_attendance":
                results["mark_attendance"] = await mark_attendance(
                    token,
                    course_id=params.get("course_id"),
                    date=params.get("date"),
                    records=params.get("records", []),
                )

            # ── Schedule ─────────────────────────────────────────
            elif tool_name == "check_schedule":
                if token:
                    results["schedule"] = await get_my_schedule(token)
                else:
                    data = await get_upcoming_schedules_for_user(user_id)
                    results["schedule"] = data or "No upcoming schedules found."

            elif tool_name == "check_free_slots":
                results["free_slots"] = await get_free_slots(
                    token,
                    room=params.get("room", ""),
                    date=params.get("date", ""),
                )

            elif tool_name == "list_bookable_spaces":
                results["list_bookable_spaces"] = {
                    "spaces": BOOKABLE_SPACES,
                    "hours": "Free-slot checks use 8:00–18:00 local time in 1-hour steps.",
                    "app_hint": "Schedule tab → Book a Space lists the same rooms in the UI.",
                }

            elif tool_name == "create_schedule":
                results["create_schedule"] = await create_schedule(
                    token, _normalize_create_schedule_params(params)
                )

            # ── Requests ─────────────────────────────────────────
            elif tool_name == "check_requests":
                if token:
                    results["requests"] = await get_my_requests(token)
                else:
                    data = await get_pending_requests_for_user(user_id)
                    results["requests"] = data or "No pending requests."

            elif tool_name == "check_pending_approvals":
                results["pending_approvals"] = await get_requests_for_approver(token)

            elif tool_name == "submit_request":
                if "title" not in params or not params["title"]:
                    params["title"] = f"{params.get('type', 'Request').title()} Request"
                results["submit_request"] = await create_request(token, params)

            elif tool_name == "approve_request":
                results["approve_request"] = await action_request(
                    token,
                    request_id=params.get("request_id", ""),
                    action=params.get("action", ""),
                    remarks=params.get("remarks", ""),
                )

            elif tool_name == "submit_document_request":
                # Build the request payload with document type
                doc_title = params.get("title") or "Document for review"
                doc_desc  = params.get("description") or "Please review the attached document."
                doc_meta  = {"source": "ai_chat", "requiresSignature": True}
                faculty_email = params.get("faculty_email") or ""
                if faculty_email:
                    doc_meta["facultyEmail"] = faculty_email

                req_body = {
                    "type": "certificate",
                    "title": doc_title,
                    "description": doc_desc,
                    "meta": doc_meta,
                }

                # Attachments are injected from the chat context
                if attachments:
                    req_body["attachments"] = attachments
                results["submit_document_request"] = await create_request(token, req_body)

            # ── Issues ───────────────────────────────────────────
            elif tool_name == "report_issue":
                results["issue"] = await create_issue(token, params)

            elif tool_name == "check_my_issues":
                results["issues"] = await get_my_issues(token)

            # ── Payments (direct DB — no Node endpoint in your controllers) ─
            elif tool_name == "check_payments":
                data = await get_pending_payments_for_user(user_id)
                results["payments"] = data or "No pending payments."

            # ── Notifications ─────────────────────────────────────
            elif tool_name == "check_notifications":
                results["notifications"] = await get_my_notifications(token)

            elif tool_name == "check_announcements":
                results["announcements"] = await get_announcements(token)

            elif tool_name == "send_announcement":
                results["announcement"] = await create_announcement(
                    token,
                    title=params.get("title") or "Important Announcement",
                    body=params.get("body") or "Please check the portal for details.",
                    audience=params.get("audience", "all"),
                )

            # ── RAG ───────────────────────────────────────────────
            elif tool_name == "search_docs":
                from services.rag.rag_service import rag_query
                results["docs"] = await rag_query(params.get("question", message))

            else:
                logger.warning(f"Unknown tool requested: {tool_name}")
                results[tool_name] = f"Tool '{tool_name}' is not available."

        except Exception as e:
            logger.error(f"Tool {tool_name} failed: {e}", exc_info=True)
            results[tool_name] = f"Error running {tool_name}: {str(e)}"

    # 4. Final LLM pass — summarize results
    if results:
        summary_messages = [
            {
                "role":    "system",
                "content": (
                    "You are CampusAI. Summarize the tool results below into a "
                    "clear, friendly reply for a college student. Max 6 short sentences if needed for room lists. "
                    "If attendance is low in any subject, mention it. "
                    "If an email was sent, confirm it. "
                    "If a request was submitted, confirm it. "
                    "If list_bookable_spaces or free_slots is in the results, name each space with its room code and capacity; "
                    "for free_slots, mention how many openings there are and suggest concrete times. "
                    "Remind users they can book in the app under Schedule → Book a Space."
                ),
            },
            {
                "role":    "user",
                "content": (
                    f"Original request: {message}\n\n"
                    f"Tool results: {_safe_json_dumps(results)}"
                ),
            },
        ]
        try:
            final_reply = await call_llm(summary_messages, temperature=0.3, max_tokens=300)
        except Exception as e:
            logger.error(f"Summary LLM failed: {e}")
            final_reply = plan.get("reply", "Done! Check the results below.")
    else:
        final_reply = plan.get("reply", "How can I help you?")

    return {
        "reply":      final_reply,
        "tool_calls": plan.get("tool_calls", []),
        "results":    results,
        "thoughts":   plan.get("thoughts", ""),
    }