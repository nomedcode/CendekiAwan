from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuration read from environment variables / .env."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # storage
    database_url: str = "postgresql+psycopg://cloudlens:cloudlens@db:5432/cloudlens"
    redis_url: str = "redis://redis:6379/0"

    # emulator (Floci exposes the LocalStack endpoint shape on :4566)
    floci_endpoint: str = "http://floci:4566"
    aws_region: str = "us-east-1"

    # allowlisted resource names, seeded at startup in phase 2
    sqs_queue: str = "cloudlens-queue"
    s3_bucket: str = "cloudlens-bucket"
    sns_topic: str = "cloudlens-topic"
    dynamodb_table: str = "cloudlens-table"
    lambda_function: str = "cloudlens-fn"

    # sampling cadence: instant attributes vs CloudWatch (SQS emits 1/minute)
    sample_interval_seconds: int = 5
    cloudwatch_interval_seconds: int = 60


settings = Settings()
