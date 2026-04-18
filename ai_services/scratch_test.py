import asyncio
import sys
import os

# Ensure the correct path
sys.path.insert(0, os.path.abspath('.'))

from services.tools.node_client import create_request, create_issue

async def main():
    print("Testing create_request:")
    res1 = await create_request("test_token", {"type": "leave", "title": "Test", "description": "Test leave"})
    print(res1)
    
    print("\nTesting create_issue:")
    res2 = await create_issue("test_token", {"title": "Test", "category": "it", "location": "Lab", "description": "Test", "priority": "medium"})
    print(res2)

asyncio.run(main())
