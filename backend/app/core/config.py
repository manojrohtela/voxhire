from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    APP_ENV: str = "development"
    SECRET_KEY: str = "changeme"
    GROQ_API_KEY: str = ""
    CARTESIA_API_KEY: str = ""
    DATABASE_URL: str = ""

    class Config:
        env_file = ".env"

settings = Settings()
