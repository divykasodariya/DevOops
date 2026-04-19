import asyncio
from services.copilot.agent_service import run_agent

async def test():
    res = await run_agent(
        message="Please send this document to dr. smith for signing",
        user_id="test_user",
        attachments=[{"fileName": "sick_leave.pdf", "url": "http://test", "mimeType": "application/pdf", "size": 1000}],
        token="test_token"
    )
    print(res)

asyncio.run(test())
