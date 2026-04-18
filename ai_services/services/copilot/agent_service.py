import json
import jwt
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


FALLBACK_TEACHER_EMAIL = "krishkhandwalacnm@gmail.com"

INVALID_EMAIL_HINTS = ["teacher", "email", "unknown", "string", "none", "null", "placeholder", "@example"]

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
- Never make up data — use tools to fetch real data
- You can call multiple tools in one shot
"""


async def run_agent(
    message:  str,
    user_id:  str,
    role:     str = "student",
    history:  list = None,
    token:    str = "",
) -> dict:

    if history is None:
        history = []

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

            elif tool_name == "create_schedule":
                results["create_schedule"] = await create_schedule(token, params)

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
                    "clear, friendly reply for a college student. Max 4 sentences. "
                    "If attendance is low in any subject, mention it. "
                    "If an email was sent, confirm it. "
                    "If a request was submitted, confirm it."
                ),
            },
            {
                "role":    "user",
                "content": (
                    f"Original request: {message}\n\n"
                    f"Tool results: {json.dumps(results, default=str)}"
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