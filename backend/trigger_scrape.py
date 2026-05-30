import sys
import argparse
import os
from dotenv import load_dotenv

# Load env variables
load_dotenv()

# Add current backend folder to python search path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.workers.automation.scraper import scrape_gmb_task

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--query", required=True)
    parser.add_argument("--max_results", type=int, default=20)
    parser.add_argument("--use_proxy", type=str, default="false")
    args = parser.parse_args()
    
    use_proxy_bool = args.use_proxy.lower() == "true"
    
    try:
        # Trigger Celery task asynchronously
        task = scrape_gmb_task.delay(args.query, args.max_results, use_proxy_bool)
        print(f"SUCCESS: Task triggered with ID: {task.id}")
        sys.exit(0)
    except Exception as e:
        print(f"ERROR: Failed to queue task: {e}")
        sys.exit(1)
