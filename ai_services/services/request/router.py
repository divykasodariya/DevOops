from db.queries import get_department_by_name, get_hod_for_department
from models.request_model import ParsedRequest, RoutedRequest
from utils.logger import logger


# ── Approval chain rules per request type ──────────────────────────────────
# Each list item is a role that must approve (in order).
APPROVAL_CHAINS: dict[str, list[str]] = {
    "leave":            ["hod"],
    "od":               ["faculty", "hod"],
    "certificate":      ["hod"],
    "lor":              ["faculty", "hod"],
    "room":             ["hod"],
    "event":            ["hod", "principal"],
    "event_permission": ["hod", "principal"],
    "lab_access":       ["faculty", "hod"],
    "research":         ["hod", "principal"],
    "custom":           ["hod"],
}


async def route_request(parsed: ParsedRequest) -> RoutedRequest:
    """
    Resolves the department from DB and builds the approver chain.
    """
    dept_doc   = await get_department_by_name(parsed.department)
    hod_id     = None
    chain_ids  = []

    if dept_doc:
        hod_id = str(dept_doc.get("hod", "")) or None
        chain_roles = APPROVAL_CHAINS.get(parsed.type, ["hod"])

        for role in chain_roles:
            if role == "hod" and hod_id:
                chain_ids.append(hod_id)
            elif role == "principal":
                principal_id = str(dept_doc.get("principal", "")) or None
                if principal_id:
                    chain_ids.append(principal_id)
            # "faculty" is resolved at request creation time by the Node backend
            # (faculty who teaches the student's current course)
    else:
        logger.warning(f"Department not found in DB: {parsed.department}")

    return RoutedRequest(
        **parsed.model_dump(),
        hod_user_id=hod_id,
        approver_chain=chain_ids,
    )