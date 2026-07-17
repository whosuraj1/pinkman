"""Application configuration.

All values can be overridden with environment variables (or a .env file).
See .env.example for the list of variables.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # --- Security ---
    # CHANGE THIS in production. Used to sign JWT tokens.
    secret_key: str = "change-me-in-production-please-use-a-long-random-string"
    access_token_expire_minutes: int = 60 * 24  # 24h

    # --- Database ---
    database_url: str = "sqlite:///./pinkman.db"

    # --- CORS ---
    # Comma-separated list of allowed frontend origins.
    # Example for Netlify: "https://your-site.netlify.app"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    # --- Default admin (created on first run if no users exist) ---
    default_admin_username: str = "admin"
    default_admin_password: str = "admin123"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
