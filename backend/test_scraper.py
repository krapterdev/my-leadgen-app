import sys
import os

# Add the backend folder to python path so it can import app.workers.celery_app
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.workers.automation.scraper import scrape_gmb_task

if __name__ == "__main__":
    query = "Web Development Companies in Delhi"
    max_results = 2
    
    print(f"--- Running GMB Scraper Test for Query: '{query}' ---")
    print(f"Expecting maximum {max_results} results...")
    
    try:
        results = scrape_gmb_task(query, max_results=max_results)
        print("\n--- Test Scraping Finished Successfully ---")
        print(f"Scraped {len(results)} items:")
        for idx, item in enumerate(results):
            print(f"{idx+1}. Name: {item['name']}")
            print(f"   Website: {item['website']}")
            print(f"   Phone: {item['phone']}")
            print(f"   Address: {item['address']}")
            print(f"   Rating: {item['rating']} ({item['reviews']} reviews)")
            print("-" * 40)
    except Exception as e:
        print(f"\nError running scraper test: {e}")
        import traceback
        traceback.print_exc()
