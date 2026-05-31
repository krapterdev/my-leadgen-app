import argparse
import sys
import os

# Add root backend folder to python sys.path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.workers.celery_app import app as celery_app

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Trigger GMB scraper Celery task")
    parser.add_argument("--query", required=True, help="Search query")
    parser.add_argument("--max_results", type=int, default=20, help="Max results")
    parser.add_argument("--use_proxy", type=str, default="false", help="Use proxy (true/false)")
    parser.add_argument("--user_id", default=None, help="User ID to broadcast progress to")
    
    args = parser.parse_args()
    
    # Standardize use_proxy boolean
    use_proxy_bool = args.use_proxy.lower() == "true"
    
    try:
        # Trigger Celery task asynchronously using celery signature
        # This publishes a message to Redis without blocking
        result = celery_app.send_task(
            "app.workers.automation.scraper.scrape_gmb_task",
            args=[args.query, args.max_results],
            kwargs={"user_id": args.user_id}
        )
        print(f"SUCCESS: Celery task triggered. Task ID: {result.id}")
    except Exception as e:
        print(f"ERROR: Failed to trigger Celery task: {e}")
        sys.exit(1)
