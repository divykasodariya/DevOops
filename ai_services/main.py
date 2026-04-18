from fastapi import FastAPI
from routes import ai_router,request_router,tag_router

app=FastAPI(title="Ather Ai services")

app.include_router(ai_router.router, prefix="/ai")
app.include_router(request_router.router, prefix="/request")
app.include_router(tag_router.router, prefix="/tag")