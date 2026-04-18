import asyncio
from services.tools.node_client import create_request, create_issue
from db.db_client import get_db

async def main():
    print(await create_request("test_token", {"type": "leave", "title": "Test", "description": "Test leave"}))
    print(await create_issue("test_token", {"title": "Test", "category": "it", "location": "Lab", "description": "Test", "priority": "medium"}))

asyncio.run(main())
