from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    APP_ENV: str = "development"
    SECRET_KEY: str = "changeme-use-a-long-random-string-in-production"
    GROQ_API_KEY: str = ""
    CARTESIA_API_KEY: str = ""
    DATABASE_URL: str = ""

    # JWT
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    ALGORITHM: str = "HS256"

    class Config:
        env_file = ".env"

settings = Settings()
