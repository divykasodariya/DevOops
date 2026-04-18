from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from config import settings
from utils.logger import logger


_client: AsyncIOMotorClient | None = None
_db: AsyncIOMotorDatabase | None = None


async def connect_db() -> None:
    global _client, _db
    if not settings.MONGO_URI:
        logger.warning("MONGO_URI not set — DB queries will return empty results.")
        return
    try:
        _client = AsyncIOMotorClient(settings.MONGO_URI)
        _db     = _client[settings.MONGO_DB_NAME]
        # Ping to verify connection
        await _db.command("ping")
        logger.info(f"Connected to MongoDB: {settings.MONGO_DB_NAME}")
    except Exception as e:
        logger.error(f"MongoDB connection failed: {e}")
        _client = None
        _db     = None


async def disconnect_db() -> None:
    global _client
    if _client:
        _client.close()
        logger.info("MongoDB connection closed.")


def get_db() -> AsyncIOMotorDatabase | None:
    return _db