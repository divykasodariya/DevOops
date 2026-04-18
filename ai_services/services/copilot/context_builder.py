from db.queries import (
    get_pending_requests_for_user,
    get_upcoming_schedules_for_user,
    get_open_issues_for_department,
    get_pending_payments_for_user,
)
from models.copilot_model import IntentType
from utils.logger import logger


async def build_context(
    user_id: str,
    department_id: str | None,
    intent: IntentType,
) -> dict:
    """
    Fetches relevant DB records based on detected intent.
    Keeps context lean — only pull what's needed.
    """
    context: dict = {}

    try:
        if intent in (IntentType.check_status, IntentType.submit_request):
            reqs = await get_pending_requests_for_user(user_id)
            context["pending_requests"] = reqs

        if intent == IntentType.ask_schedule:
            schedules = await get_upcoming_schedules_for_user(user_id)
            context["upcoming_schedules"] = schedules

        if intent == IntentType.report_issue and department_id:
            issues = await get_open_issues_for_department(department_id)
            context["open_issues"] = issues

        if intent == IntentType.payment_query:
            payments = await get_pending_payments_for_user(user_id)
            context["pending_payments"] = payments

    except Exception as e:
        logger.warning(f"Context build partial failure: {e}")

    return context


def format_context_for_prompt(context: dict) -> str:
    """Serializes context dict into a compact string for injection into system prompt."""
    if not context:
        return "No additional context available."

    lines: list[str] = []

    if reqs := context.get("pending_requests"):
        lines.append(f"Pending approval requests ({len(reqs)}):")
        for r in reqs[:3]:                         # cap at 3 to save tokens
            lines.append(f"  - [{r.get('type','')}] {r.get('title','')} — {r.get('overallStatus','')}")

    if schedules := context.get("upcoming_schedules"):
        lines.append(f"Upcoming schedules ({len(schedules)}):")
        for s in schedules[:3]:
            lines.append(f"  - {s.get('title','')} at {s.get('start','')}")

    if payments := context.get("pending_payments"):
        lines.append(f"Pending payments ({len(payments)}):")
        for p in payments[:3]:
            lines.append(f"  - {p.get('type','')} ₹{p.get('amount','')} — {p.get('status','')}")

    return "\n".join(lines)