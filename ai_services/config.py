from dotenv import load_dotenv
load_dotenv(override=True)  # add this line BEFORE the Settings class

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Groq
    GROQ_API_KEY: str
    GROQ_BASE_URL: str = "https://api.groq.com/openai/v1"
    GROQ_MODEL: str = "llama3-70b-8192"       # swap to mixtral-8x7b-32768 if needed

    # MongoDB (Node backend DB — read-only access for context)
    MONGO_URI: str = ""                        # set in .env
    MONGO_DB_NAME: str = "campus_erp"

    # Supabase (optional secondary store)
    SUPABASE_URL: str = ""
    SUPABASE_KEY: str = ""

     # ✅ ADD THIS (SMTP)
    SMTP_USER: str
    SMTP_PASS: str
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587

    # App
    APP_ENV: str = "development"
    LOG_LEVEL: str = "INFO"
    MAX_TOKENS: int = 1024
    TEMPERATURE: float = 0.2     
    
    NODE_BACKEND_URL: str = "http://localhost:6969"
    NODE_INTERNAL_SECRET: str = "dev-token"
    JWT_SECRET: str = "sehack_super_secret_key_12345"

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()