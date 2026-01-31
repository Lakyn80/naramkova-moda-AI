from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "naramkovamoda-v2"
    environment: str = "development"
    debug: bool = False
    log_level: str = "INFO"

    api_prefix: str = "/api"
    expose_invoice_api: bool = False
    database_url: str

    class Config:
        env_prefix = "NMM_"
        case_sensitive = False


@lru_cache
def get_settings() -> Settings:
    return Settings()
