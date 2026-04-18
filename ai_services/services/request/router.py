def route_request(parsed: dict):
    dept_map = {
        "Computer Engineering": "hod_ce",
        "IT": "hod_it"
    }

    dept = parsed.get("department", "Computer Engineering")
    hod = dept_map.get(dept, "default_hod")

    parsed["approver"] = hod
    return parsed