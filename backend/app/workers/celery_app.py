import os
from celery import Celery
from dotenv import load_dotenv

# Load backend/app/workers/.env or main .env
load_dotenv()

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

# Create Celery instance
app = Celery(
    "leadgen_workers",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=["app.workers.automation.scraper"]
)

# Optional configuration
app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=3600,  # 1 hour limit for long-running scraping tasks
)

if __name__ == "__main__":
    app.start()
