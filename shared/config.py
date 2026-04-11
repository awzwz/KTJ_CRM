from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    postgres_user: str = "ktzh_user"
    postgres_password: str = "ktzh_secret_password"
    postgres_db: str = "ktzh_crm"
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    database_url: str = ""

    redis_host: str = "localhost"
    redis_port: int = 6379
    redis_url: str = "redis://localhost:6379/0"

    rabbitmq_host: str = "localhost"
    rabbitmq_port: int = 5672
    rabbitmq_user: str = "ktzh"
    rabbitmq_password: str = "ktzh_rabbit_password"
    rabbitmq_url: str = "amqp://ktzh:ktzh_rabbit_password@localhost:5672/"

    jwt_secret_key: str = "dev-secret-key"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 30
    jwt_refresh_token_expire_days: int = 7

    openai_api_key: str = ""
    openai_model: str = "gpt-4o"

    wazzup_api_key: str = ""
    wazzup_webhook_secret: str = ""
    wazzup_api_url: str = "https://api.wazzup24.com/v3"

    cors_origins: str = "http://localhost:3000"  # comma-separated allowed origins

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    class Config:
        env_file = ".env"
        extra = "ignore"

    @property
    def effective_database_url(self) -> str:
        if self.database_url:
            return self.database_url
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def sync_database_url(self) -> str:
        return self.effective_database_url.replace("+asyncpg", "")


@lru_cache
def get_settings() -> Settings:
    return Settings()
