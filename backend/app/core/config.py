from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    APP_ENV: str = "development"
    SECRET_KEY: str = "changeme-use-a-long-random-string-in-production"
    GROQ_API_KEY: str = ""
    CARTESIA_API_KEY: str = ""

    # Real-time voice pipeline
    DEEPGRAM_API_KEY: str = ""
    CARTESIA_VOICE_ID: str = "3e39e9a5-585c-4f5f-bac6-5e4905c51095"
    GROQ_LLM_MODEL: str = "llama-3.3-70b-versatile"
    DATABASE_URL: str = ""
    FRONTEND_URL: str = "http://localhost:3000"

    # JWT
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    ALGORITHM: str = "HS256"

    # Super admin bootstrap (set in prod env, one-time use)
    SUPER_ADMIN_SEED_KEY: str = ""

    # Vapi screening call integration
    VAPI_API_KEY: str = ""                      # Vapi private key — used to trigger outbound calls
    VAPI_PUBLIC_KEY: str = ""                   # Vapi public key — used by the browser Web SDK
    VAPI_ASSISTANT_ID: str = ""                 # Vapi assistant ID configured for screening
    VAPI_WEBHOOK_SECRET: str = ""               # Shared secret Vapi sends in X-Vapi-Secret header

    # Vapi interview integration (separate assistant)
    VAPI_INTERVIEW_ASSISTANT_ID: str = "8e44dddb-97a5-4cc5-90f3-2ef130e39fcf"
    VAPI_INTERVIEW_WEBHOOK_SECRET: str = ""     # Set in Vapi dashboard → interview assistant webhook

    # Billing — payment provider is pluggable; "" = none (manual super-admin assignment)
    PAYMENT_PROVIDER: str = ""                   # "" | "razorpay" | "stripe"

    # Durable job queue (Arq). Empty = run jobs in-process (no durability).
    REDIS_URL: str = ""                          # e.g. rediss://default:****@xxx.upstash.io:6379

    # SMTP (optional — if empty, invitation link is returned but no email is sent)
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    FROM_EMAIL: str = "noreply@voxhire.ai"

    class Config:
        env_file = ".env"

settings = Settings()
