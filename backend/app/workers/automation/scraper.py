import os
import random
import time
import urllib.parse
import urllib.request
import json
import datetime
import re
import socket
import ssl
import dns.resolver
from bs4 import BeautifulSoup
from celery.utils.log import get_task_logger
import redis
from playwright.sync_api import sync_playwright
from pymongo import MongoClient
from app.workers.celery_app import app as celery_app

# Try importing whois, camoufox and playwright-stealth
try:
    import whois
    HAS_WHOIS = True
except ImportError:
    HAS_WHOIS = False

try:
    from camoufox import Camoufox
    HAS_CAMOUFOX = True
except ImportError:
    HAS_CAMOUFOX = False

try:
    from playwright_stealth import stealth_sync
    HAS_STEALTH = True
except ImportError:
    HAS_STEALTH = False

logger = get_task_logger(__name__)

# Initialize database connections
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017/email-outreach")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
redis_client = redis.Redis.from_url(REDIS_URL)

def send_progress_update(user_id, status, company=None, progress=0, total=0, message=""):
    if not user_id:
        return
    try:
        payload = {
            "userId": user_id,
            "status": status,
            "progress": progress,
            "total": total,
            "message": message
        }
        if company:
            payload["company"] = {
                "name": company.get("name", ""),
                "website": company.get("website", ""),
                "phone": company.get("phone", ""),
                "address": company.get("address", ""),
                "rating": company.get("rating", ""),
                "reviews": company.get("reviews", ""),
                "upgradePriority": company.get("upgrade_priority", "LOW")
            }
        
        data = json.dumps(payload).encode('utf-8')
        req = urllib.request.Request(
            "http://localhost:5001/api/webhook/scraper-progress",
            data=data,
            headers={'Content-Type': 'application/json'}
        )
        with urllib.request.urlopen(req, timeout=5) as response:
            response.read()
    except Exception as e:
        logger.error(f"Failed to send progress update: {e}")

BLOOM_FILTER_NAME = "gmb_scraped_websites_bloom"
REDIS_SET_NAME = "gmb_scraped_websites_set"

# List of high-quality modern user agents for rotation
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 OPR/105.0.0.0",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
]

def get_random_user_agent() -> str:
    return random.choice(USER_AGENTS)

# Cache duration for WHOIS results: 7 days
WHOIS_CACHE_TTL = 604800

def get_domain_whois_details(domain: str) -> tuple[str, int, int]:
    """
    Check the age and expiration date of the domain using WHOIS, caching results in Redis.
    Returns (business_type, domain_age_days, domain_expiry_days)
    """
    if not domain:
        return "UNKNOWN", -1, -1
        
    cache_key = f"whois_details_cache:{domain}"
    try:
        cached_val = redis_client.get(cache_key)
        if cached_val:
            data = json.loads(cached_val.decode('utf-8'))
            logger.info(f"WHOIS cache hit for {domain}: {data}")
            return (
                data.get("business_type", "UNKNOWN"),
                data.get("domain_age_days", -1),
                data.get("domain_expiry_days", -1)
            )
    except Exception as e:
        logger.debug(f"Redis cache read error for WHOIS: {e}")

    business_type = "UNKNOWN"
    age_days = -1
    expiry_days = -1

    if HAS_WHOIS:
        try:
            logger.info(f"Querying WHOIS registry for domain: {domain}")
            w = whois.whois(domain)
            
            # 1. Age Calculation
            creation_date = w.creation_date
            if isinstance(creation_date, list):
                creation_date = creation_date[0]
                
            if creation_date:
                if isinstance(creation_date, str):
                    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%Y-%m-%dT%H:%M:%SZ", "%d-%b-%Y"):
                        try:
                            creation_date = datetime.datetime.strptime(creation_date.split('.')[0], fmt)
                            break
                        except ValueError:
                            continue
                
                if isinstance(creation_date, datetime.datetime):
                    if creation_date.tzinfo is not None:
                        creation_date = creation_date.replace(tzinfo=None)
                        
                    age_delta = datetime.datetime.now() - creation_date
                    age_days = max(0, age_delta.days)
                    if age_days < 1095:  # 3 years
                        business_type = "STARTUP"
                    else:
                        business_type = "ESTABLISHED"
                        
            # 2. Expiration Calculation
            expiration_date = w.expiration_date
            if isinstance(expiration_date, list):
                expiration_date = expiration_date[0]
                
            if expiration_date:
                if isinstance(expiration_date, str):
                    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%Y-%m-%dT%H:%M:%SZ", "%d-%b-%Y"):
                        try:
                            expiration_date = datetime.datetime.strptime(expiration_date.split('.')[0], fmt)
                            break
                        except ValueError:
                            continue
                            
                if isinstance(expiration_date, datetime.datetime):
                    if expiration_date.tzinfo is not None:
                        expiration_date = expiration_date.replace(tzinfo=None)
                        
                    expiry_delta = expiration_date - datetime.datetime.now()
                    expiry_days = max(0, expiry_delta.days)
                    
        except Exception as whois_err:
            logger.warning(f"WHOIS registry details lookup failed for {domain}: {whois_err}")
    else:
        logger.warning("WHOIS library is not loaded. Skipping registry check.")

    # Cache result
    try:
        result_data = {
            "business_type": business_type,
            "domain_age_days": age_days,
            "domain_expiry_days": expiry_days
        }
        redis_client.setex(cache_key, WHOIS_CACHE_TTL, json.dumps(result_data))
    except Exception as cache_err:
        logger.debug(f"Failed to cache WHOIS details in Redis: {cache_err}")

    return business_type, age_days, expiry_days

def check_domain_mx(domain: str) -> bool:
    """Verify if the domain has valid MX records for receiving emails."""
    if not domain:
        return False
    try:
        answers = dns.resolver.resolve(domain, 'MX')
        return len(answers) > 0
    except Exception as e:
        logger.debug(f"MX record lookup failed for domain {domain}: {e}")
        return False

def check_website_status_and_ssl(url: str, domain: str) -> tuple[bool, int]:
    """
    Checks if website is up and returns (is_up, ssl_expiry_days).
    """
    is_up = False
    ssl_expiry_days = -1
    
    # Check uptime
    if url:
        try:
            req = urllib.request.Request(
                url,
                headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
            )
            with urllib.request.urlopen(req, timeout=5) as resp:
                if resp.status in (200, 301, 302):
                    is_up = True
        except Exception:
            is_up = False
            
    # Check SSL
    if domain:
        try:
            clean_domain = domain.split(':')[0]
            context = ssl.create_default_context()
            with socket.create_connection((clean_domain, 443), timeout=5) as sock:
                with context.wrap_socket(sock, server_hostname=clean_domain) as ssock:
                    cert = ssock.getpeercert()
                    not_after_str = cert.get('notAfter')
                    if not_after_str:
                        expiry_date = datetime.datetime.strptime(not_after_str, '%b %d %H:%M:%S %Y %Z')
                        delta = expiry_date - datetime.datetime.utcnow()
                        ssl_expiry_days = max(0, delta.days)
                        is_up = True
        except Exception as ssl_err:
            logger.debug(f"SSL certificate check failed for {domain}: {ssl_err}")
            
    return is_up, ssl_expiry_days

def enrich_lead_website(url: str, company_name: str, rating: str, location: str) -> dict:
    """
    Enriches lead data by visiting the company website.
    Extracts emails, social links, tech stack, hiring intent (careers page),
    and generates a personalized cold pitch.
    """
    enriched_data = {
        "real_emails": [],
        "linkedin": "",
        "facebook": "",
        "twitter": "",
        "instagram": "",
        "tech_stack": [],
        "upgrade_priority": "LOW",
        "personalized_pitch": "",
        "hiring_intent": "NO",
        "hiring_intent_score": 0,
        "careers_url": ""
    }
    
    if not url:
        return enriched_data
        
    try:
        # Fetch the homepage HTML
        req = urllib.request.Request(
            url,
            headers={"User-Agent": get_random_user_agent()}
        )
        # 10s timeout to keep scraper fast
        with urllib.request.urlopen(req, timeout=10) as response:
            html = response.read()
            soup = BeautifulSoup(html, "html.parser")
            text_content = soup.get_text()
            
            # 1. Extract emails from text
            email_pattern = re.compile(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}')
            emails = set(email_pattern.findall(text_content))
            
            # Clean up list (filter false positives like images)
            valid_emails = []
            for e in emails:
                e_clean = e.lower().strip()
                if not any(e_clean.endswith(ext) for ext in ('.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp')):
                    valid_emails.append(e_clean)
            # If no emails found on homepage, fallback to crawling contact/about/legal subpages
            if len(valid_emails) == 0:
                logger.info(f"No emails found on homepage. Initiating deep subpage crawler fallback...")
                subpages_to_crawl = []
                for anchor in soup.find_all("a", href=True):
                    href = anchor["href"].lower()
                    href_raw = anchor["href"]
                    # Look for contact, about, terms, privacy, legal pages
                    if any(k in href for k in ("contact", "about", "terms", "privacy", "legal", "readme", "support")):
                        # Exclude external links
                        if not any(s in href for s in ("linkedin.com", "facebook.com", "twitter.com", "instagram.com", "youtube.com", "github.com")):
                            full_sub_url = urllib.parse.urljoin(url, href_raw)
                            if full_sub_url not in subpages_to_crawl:
                                subpages_to_crawl.append(full_sub_url)
                                if len(subpages_to_crawl) >= 3:
                                    break
                
                # Fetch subpages and extract emails
                for sub_url in subpages_to_crawl:
                    try:
                        logger.info(f"Fallback crawling subpage: {sub_url}")
                        sub_req = urllib.request.Request(
                            sub_url,
                            headers={"User-Agent": get_random_user_agent()}
                        )
                        with urllib.request.urlopen(sub_req, timeout=6) as sub_resp:
                            sub_html = sub_resp.read()
                            sub_soup = BeautifulSoup(sub_html, "html.parser")
                            sub_text = sub_soup.get_text()
                            sub_emails = email_pattern.findall(sub_text)
                            for se in sub_emails:
                                se_clean = se.lower().strip()
                                if not any(se_clean.endswith(ext) for ext in ('.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp')):
                                    valid_emails.append(se_clean)
                    except Exception as sub_err:
                        logger.debug(f"Failed to crawl subpage {sub_url} for emails: {sub_err}")

            enriched_data["real_emails"] = list(set(valid_emails))
            
            # 2. Extract social links and careers link from anchor hrefs
            careers_url = ""
            for anchor in soup.find_all("a", href=True):
                href = anchor["href"].lower()
                href_raw = anchor["href"]
                if "linkedin.com/company/" in href or "linkedin.com/in/" in href:
                    enriched_data["linkedin"] = href_raw
                elif "facebook.com/" in href:
                    enriched_data["facebook"] = href_raw
                elif "twitter.com/" in href or "x.com/" in href:
                    enriched_data["twitter"] = href_raw
                elif "instagram.com/" in href:
                    enriched_data["instagram"] = href_raw
                
                # Check for careers/jobs/hiring page link
                if any(k in href for k in ("careers", "jobs", "work-with-us", "join-us", "opportunities", "hiring")):
                    if not any(s in href for s in ("linkedin.com", "facebook.com", "twitter.com", "instagram.com", "youtube.com")):
                        careers_url = urllib.parse.urljoin(url, href_raw)
                        enriched_data["careers_url"] = careers_url
            
            # Crawl Careers page if found
            careers_text = ""
            if careers_url:
                try:
                    logger.info(f"Crawling detected careers subpage: {careers_url}")
                    c_req = urllib.request.Request(
                        careers_url,
                        headers={"User-Agent": get_random_user_agent()}
                    )
                    with urllib.request.urlopen(c_req, timeout=8) as c_response:
                        c_html = c_response.read()
                        c_soup = BeautifulSoup(c_html, "html.parser")
                        careers_text = c_soup.get_text()
                except Exception as careers_err:
                    logger.warning(f"Failed to crawl careers subpage {careers_url}: {careers_err}")
            
            # Combine homepage and careers text for intent scanning
            combined_text = (text_content + " " + careers_text).lower()
            
            # Calculate Hiring Intent Heuristic Score
            hiring_score = 0
            
            strong_signals = ["we are hiring", "join our team", "open positions", "job openings", "career opportunities", "now hiring", "work with us"]
            medium_signals = ["hiring", "careers", "positions vacant", "join us", "recruitment"]
            job_roles = ["developer", "designer", "frontend", "backend", "full stack", "engineer", "programmer", "php", "node", "react", "next.js", "wordpress"]

            for sig in strong_signals:
                if sig in combined_text:
                    hiring_score += 25
            
            for sig in medium_signals:
                if sig in combined_text:
                    hiring_score += 10
            
            role_matches = 0
            for role in job_roles:
                if role in combined_text:
                    hiring_score += 10
                    role_matches += 1
                    if role_matches >= 4:
                        break  # Max 40 points from roles
            
            hiring_score = min(100, hiring_score)
            enriched_data["hiring_intent_score"] = hiring_score
            enriched_data["hiring_intent"] = "YES" if hiring_score >= 35 else "NO"
            
            # 3. Detect Tech Stack
            html_str = str(html).lower()
            
            # WordPress indicators
            if "/wp-content/" in html_str or "/wp-includes/" in html_str or "wp-json" in html_str:
                enriched_data["tech_stack"].append("WordPress")
            # Wix
            if "wix.com" in html_str or "wix-site" in html_str:
                enriched_data["tech_stack"].append("Wix")
            # Squarespace
            if "squarespace.com" in html_str or "static1.squarespace.com" in html_str:
                enriched_data["tech_stack"].append("Squarespace")
            # Shopify
            if "shopify.com" in html_str or "cdn.shopify.com" in html_str:
                enriched_data["tech_stack"].append("Shopify")
            # jQuery
            if "jquery" in html_str:
                enriched_data["tech_stack"].append("jQuery")
            # Bootstrap
            if "bootstrap" in html_str:
                enriched_data["tech_stack"].append("Bootstrap")
            # React / Next.js
            if "_next/static" in html_str or "react" in html_str:
                enriched_data["tech_stack"].append("React/Next.js")
                
            # 4. Calculate Upgrade Priority
            has_old_tech = any(t in enriched_data["tech_stack"] for t in ("WordPress", "Wix", "Squarespace", "jQuery", "Bootstrap"))
            has_new_tech = "React/Next.js" in enriched_data["tech_stack"]
            
            if has_old_tech and not has_new_tech:
                enriched_data["upgrade_priority"] = "HIGH"
            elif not has_old_tech and not has_new_tech:
                enriched_data["upgrade_priority"] = "MEDIUM"
            else:
                enriched_data["upgrade_priority"] = "LOW"
                
            # 5. Generate Personalized cold outreach pitch
            techs_str = ", ".join(enriched_data["tech_stack"]) if enriched_data["tech_stack"] else "outdated libraries"
            
            if enriched_data["upgrade_priority"] == "HIGH":
                pitch = (
                    f"Hey Team, I visited {company_name} online and noticed you're currently using "
                    f"{techs_str} for your site. Outdated setups like this can limit SEO performance and slow down mobile load times. "
                    f"By upgrading to a modern, blazing-fast React/Next.js stack, we can increase your site speed by up to 300% "
                    f"and boost conversions. Would you be open to a quick 10-minute audit call this week?"
                )
            elif enriched_data["upgrade_priority"] == "MEDIUM":
                pitch = (
                    f"Hi Team, I found {company_name} on Google Maps in {location or 'your area'}. "
                    f"Your profile shows a solid {rating or '4.0'}+ rating. However, your website's front-end structure is "
                    f"using older design standards that might be dropping visitor conversions. We specialize in building "
                    f"custom high-converting React landings that double client inquiries. Let's connect for a brief chat?"
                )
            else:
                pitch = (
                    f"Hello, I was checking out {company_name} and was impressed by your fast, modern Next.js setup. "
                    f"Since your engineering stack is already state-of-the-art, we wanted to pitch our custom SEO "
                    f"and content optimization campaigns specifically tailored for headless frameworks to scale your organic search reach. "
                    f"Are you open to a call?"
                )
                
            enriched_data["personalized_pitch"] = pitch
            
    except Exception as enrich_err:
        logger.warning(f"Error enriching lead details for {url}: {enrich_err}")
        enriched_data["upgrade_priority"] = "MEDIUM"
        enriched_data["personalized_pitch"] = (
            f"Hi Team, I found {company_name} on Google Maps (Rating: {rating or 'N/A'}) in {location or 'your area'}. "
            f"I tried visiting your website, but had connection trouble. Let's schedule a call to help audit your site health "
            f"and ensure you're not losing customer traffic."
        )
        
    return enriched_data

# ----------------- PROXY ROTATION MODULE -----------------

def fetch_free_proxies():
    """Fetch active proxies from free-proxy-list.net."""
    proxies = []
    try:
        req = urllib.request.Request(
            "https://www.free-proxy-list.net/",
            headers={"User-Agent": get_random_user_agent()}
        )
        with urllib.request.urlopen(req, timeout=10) as response:
            html = response.read()
            soup = BeautifulSoup(html, "html.parser")
            table = soup.find("table", class_="table-striped")
            if table:
                for row in table.find_all("tr")[1:]:
                    cols = row.find_all("td")
                    if len(cols) >= 8:
                        ip = cols[0].text.strip()
                        port = cols[1].text.strip()
                        https = cols[6].text.strip().lower() == "yes"
                        proxies.append({
                            "server": f"http://{ip}:{port}",
                            "https": https
                        })
    except Exception as e:
        logger.error(f"Error fetching free proxies: {e}")
    return proxies

def test_proxy(proxy_url: str, timeout: int = 3) -> bool:
    """Verify proxy connectivity using a quick HTTP check."""
    try:
        proxy_handler = urllib.request.ProxyHandler({'http': proxy_url, 'https': proxy_url})
        opener = urllib.request.build_opener(proxy_handler)
        with opener.open("http://httpbin.org/ip", timeout=timeout) as resp:
            if resp.status == 200:
                return True
    except Exception:
        pass
    return False

class ProxyRotator:
    def __init__(self):
        self.proxies = []
        self.current_idx = 0
        self.last_fetch_time = 0
        self.fetch_cooldown = 600  # 10 minutes

    def _fetch_if_needed(self):
        current_time = time.time()
        if not self.proxies or (current_time - self.last_fetch_time > self.fetch_cooldown):
            logger.info("Refreshing proxy list...")
            raw_proxies = fetch_free_proxies()
            working_proxies = []
            
            random.shuffle(raw_proxies)
            # Test raw proxies until we get a pool of up to 3 working ones
            for p in raw_proxies[:20]:
                server = p["server"]
                logger.debug(f"Testing proxy: {server}")
                if test_proxy(server):
                    logger.info(f"Proxy is ACTIVE: {server}")
                    working_proxies.append(p)
                    if len(working_proxies) >= 3:
                        break
            
            self.proxies = working_proxies
            self.last_fetch_time = current_time
            self.current_idx = 0
            logger.info(f"Proxy rotator loaded {len(self.proxies)} working proxies.")

    def get_proxy(self):
        self._fetch_if_needed()
        if not self.proxies:
            return None
        proxy = self.proxies[self.current_idx]
        self.current_idx = (self.current_idx + 1) % len(self.proxies)
        return proxy

proxy_rotator = ProxyRotator()

# ----------------- DUPLICATE / SPEED LOGIC -----------------

def is_duplicate(url: str) -> bool:
    """
    Check if URL has already been processed using Redis Bloom Filter or fallback to Set.
    """
    if not url:
        return False
    
    parsed = urllib.parse.urlparse(url)
    clean_url = (parsed.netloc + parsed.path).strip().lower().rstrip('/')

    try:
        exists = redis_client.execute_command("BF.EXISTS", BLOOM_FILTER_NAME, clean_url)
        if exists:
            return True
        redis_client.execute_command("BF.ADD", BLOOM_FILTER_NAME, clean_url)
        return False
    except redis.exceptions.ResponseError as e:
        logger.debug(f"Redis Bloom Filter not supported, falling back to Set: {e}")
        is_member = redis_client.sismember(REDIS_SET_NAME, clean_url)
        if is_member:
            return True
        redis_client.sadd(REDIS_SET_NAME, clean_url)
        return False
    except Exception as e:
        logger.error(f"Error checking duplicate URL {url}: {e}")
        return False

def human_delay(min_sec=2.0, max_sec=5.0):
    """Introduce a randomized, human-like delay."""
    time.sleep(random.uniform(min_sec, max_sec))

# ----------------- NATURAL INTERACTIONS -----------------

def smooth_scroll_element(page, selector, scroll_amount=600, steps=6):
    """Simulate human-like gradual scrolling inside a feed element."""
    try:
        page.evaluate(
            f"""
            async (sel) => {{
                const elem = document.querySelector(sel);
                if (!elem) return;
                const step = {scroll_amount / steps};
                for (let i = 0; i < {steps}; i++) {{
                    elem.scrollBy(0, step);
                    await new Promise(r => setTimeout(r, 100 + Math.random() * 200));
                }}
            }}
            """,
            selector
        )
    except Exception as e:
        logger.debug(f"Failed to smooth scroll selector {selector}: {e}")

def human_click(element):
    """Simulate hover and wait before clicking."""
    try:
        element.hover()
        human_delay(0.5, 1.2)
        element.click()
        human_delay(1.5, 3.5)
    except Exception as e:
        logger.warning(f"Standard click fallback due to: {e}")
        element.click()

# ----------------- DB PERSISTENCE -----------------

# ----------------- DB PERSISTENCE -----------------

def save_lead_to_mongo(company_data, user_id=None, batch_id=None):
    """Save lead matching MongoDB schema in Contact.js."""
    try:
        client = MongoClient(MONGODB_URI)
        db = client.get_default_database()
        
        users_col = db["users"]
        contacts_col = db["contacts"]
        
        target_user_id = None
        if user_id:
            try:
                from bson.objectid import ObjectId
                target_user_id = ObjectId(user_id)
            except Exception as e:
                logger.error(f"Invalid user_id format passed: {user_id}")
        
        if not target_user_id:
            user = users_col.find_one()
            if not user:
                logger.error("No active user found in MongoDB. Cannot assign lead.")
                return False
            target_user_id = user["_id"]
            
        # Resolve email: first found real email, fallback to scraped, fallback to domain fallback
        email_addr = (
            (company_data.get("real_emails") and company_data.get("real_emails")[0]) or
            company_data.get("email") or
            f"info@{company_data['website_domain']}"
        )
        
        contact_doc = {
            "userId": target_user_id,
            "email": email_addr.lower(),
            "firstName": company_data.get("name", "Unknown"),
            "lastName": "Company",
            "company": company_data.get("name"),
            "status": "active",
            "tags": [
                "gmb-scraper", 
                company_data.get("query_tag", "general-lead"), 
                company_data.get("business_type", "UNKNOWN"),
                f"priority-{company_data.get('upgrade_priority', 'low').lower()}"
            ],
            "customFields": {
                "website": company_data.get("website", ""),
                "phone": company_data.get("phone", ""),
                "address": company_data.get("address", ""),
                "rating": str(company_data.get("rating", "")),
                "reviews": str(company_data.get("reviews", "")),
                "domainAgeDays": str(company_data.get("domain_age_days", "-1")),
                "businessType": company_data.get("business_type", "UNKNOWN"),
                "detectedEmails": ", ".join(company_data.get("real_emails", [])),
                "linkedin": company_data.get("linkedin", ""),
                "facebook": company_data.get("facebook", ""),
                "twitter": company_data.get("twitter", ""),
                "instagram": company_data.get("instagram", ""),
                "techStack": ", ".join(company_data.get("tech_stack", [])),
                "upgradePriority": company_data.get("upgrade_priority", "LOW"),
                "personalizedPitch": company_data.get("personalized_pitch", ""),
                "dnsMxValid": str(company_data.get("dns_mx_valid", True)),
                "websiteUp": str(company_data.get("website_up", True)),
                "sslExpiryDays": str(company_data.get("ssl_expiry_days", "-1")),
                "domainExpiryDays": str(company_data.get("domain_expiry_days", "-1")),
                "outreachHook": company_data.get("outreach_hook", ""),
                "hiringIntent": company_data.get("hiring_intent", "NO"),
                "hiringIntentScore": str(company_data.get("hiring_intent_score", 0)),
                "careersUrl": company_data.get("careers_url", "")
            }
        }
        
        if batch_id:
            try:
                from bson.objectid import ObjectId
                contact_doc["batchId"] = ObjectId(batch_id)
            except Exception as batch_err:
                logger.error(f"Invalid batch_id format: {batch_id}")
        
        existing = contacts_col.find_one({"userId": target_user_id, "email": contact_doc["email"]})
        if existing:
            logger.info(f"Lead with email {contact_doc['email']} already exists. Skipping insertion.")
            return False
            
        contacts_col.insert_one(contact_doc)
        logger.info(f"Saved GMB Lead: {company_data['name']} ({contact_doc['email']})")
        
        if batch_id:
            try:
                db["scraperbatches"].update_one(
                    {"_id": ObjectId(batch_id)},
                    {"$inc": {"count": 1}}
                )
            except Exception as inc_err:
                logger.error(f"Failed to increment batch count: {inc_err}")
                
        return True
    except Exception as e:
        logger.error(f"Failed to save lead: {e}")
        return False
    finally:
        try:
            client.close()
        except Exception:
            pass

# ----------------- BROWSER SPINNER -----------------

def launch_stealth_browser(playwright_instance, proxy_dict=None):
    """Launch Camoufox (if available) or standard Chromium with Playwright Stealth."""
    if HAS_CAMOUFOX:
        try:
            logger.info("Initializing Camoufox anti-detect browser...")
            browser = Camoufox(playwright_instance, headless=True, proxy=proxy_dict)
            context = browser.new_context()
            page = context.new_page()
            return browser, context, page
        except Exception as e:
            logger.warning(f"Camoufox launch failed: {e}. Falling back to standard Chromium.")
            
    # Fallback/standard browser launcher
    logger.info("Initializing standard Chromium with stealth patches...")
    args = [
        "--disable-blink-features=AutomationControlled",
        "--no-sandbox",
        "--disable-dev-shm-usage"
    ]
    
    browser = playwright_instance.chromium.launch(headless=True, args=args)
    
    # Rotate User-Agent
    user_agent = get_random_user_agent()
    
    context_args = {
        "user_agent": user_agent,
        "viewport": {"width": 1280, "height": 800},
        "locale": "en-US"
    }
    
    if proxy_dict:
        context_args["proxy"] = proxy_dict
        logger.info(f"Using proxy configurations: {proxy_dict}")
        
    context = browser.new_context(**context_args)
    page = context.new_page()
    
    if HAS_STEALTH:
        try:
            stealth_sync(page)
        except Exception as e:
            logger.warning(f"Could not apply stealth_sync: {e}")
            
    return browser, context, page

# ----------------- CELERY SCRAPING TASK -----------------

@celery_app.task(name="app.workers.automation.scraper.scrape_gmb_task", bind=True)
def scrape_gmb_task(self, query: str, max_results: int = 20, use_proxy: bool = False, user_id: str = None, location: str = "", batch_id: str = None):
    """
    Celery task to scrape Google Maps (GMB) for the given search query.
    Uses proxy rotation (if enabled), anti-fingerprinting stealth,
    and Bloom filters for URL duplicate check.
    """
    logger.info(f"Scrape GMB Task triggered: Query='{query}', Location='{location}', Max={max_results}, Proxy={use_proxy}, UserID={user_id}, BatchID={batch_id}")
    send_progress_update(user_id, "STARTED", progress=0, total=max_results, message="Scraping task initialized...")
    
    results = []
    
    # Determine if we should use a proxy
    proxy_config = None
    if use_proxy:
        p = proxy_rotator.get_proxy()
        if p:
            # Playwright proxy format: {"server": "http://ip:port"}
            proxy_config = {"server": p["server"]}
            
    with sync_playwright() as p:
        try:
            browser, context, page = launch_stealth_browser(p, proxy_config)
        except Exception as browser_err:
            logger.error(f"Failed to launch browser: {browser_err}")
            send_progress_update(user_id, "FAILED", progress=0, total=max_results, message=f"Failed to launch browser: {browser_err}")
            return []
            
        combined_query = f"{query} in {location}" if location else query
        search_url = f"https://www.google.com/maps/search/{urllib.parse.quote_plus(combined_query)}"
        logger.info(f"Searching maps: {search_url}")
        send_progress_update(user_id, "SEARCHING", progress=0, total=max_results, message=f"Searching Google Maps for '{combined_query}'...")
        
        try:
            loaded = False
            for attempt in range(1, 4):
                try:
                    logger.info(f"Loading search page (attempt {attempt}/3)...")
                    page.goto(search_url, wait_until="domcontentloaded", timeout=60000)
                    human_delay(3.0, 5.0)
                    
                    current_url = page.url
                    page_content = page.content()
                    
                    if "google.com/sorry" in current_url or "consent.google.com" in current_url or "detected unusual traffic" in page_content or "captcha" in page_content.lower():
                        logger.warning(f"Google Captcha/unusual traffic block detected on attempt {attempt}! Rotating proxy and entering cooldown...")
                        send_progress_update(user_id, "SEARCHING", progress=len(results), total=max_results, message=f"Unusual traffic block detected on attempt {attempt}. Rotating proxy and entering cooldown...")
                        time.sleep(random.uniform(15.0, 30.0))
                        
                        try:
                            browser.close()
                        except Exception:
                            pass
                            
                        p_new = proxy_rotator.get_proxy()
                        proxy_config = {"server": p_new["server"]} if (use_proxy and p_new) else None
                        browser, context, page = launch_stealth_browser(p, proxy_config)
                        continue
                    else:
                        loaded = True
                        break
                except Exception as goto_err:
                    logger.warning(f"Failed to navigate search page on attempt {attempt}: {goto_err}. Rotating proxy...")
                    send_progress_update(user_id, "SEARCHING", progress=len(results), total=max_results, message=f"Connection retry (attempt {attempt}/3) due to navigation error...")
                    try:
                        browser.close()
                    except Exception:
                        pass
                        
                    p_new = proxy_rotator.get_proxy()
                    proxy_config = {"server": p_new["server"]} if (use_proxy and p_new) else None
                    browser, context, page = launch_stealth_browser(p, proxy_config)
                    time.sleep(5.0)
            
            if not loaded:
                logger.error("Could not load Google Maps search results after 3 attempts due to captcha/network errors. Exiting.")
                send_progress_update(user_id, "FAILED", progress=len(results), total=max_results, message="Failed to load search results after 3 attempts (CAPTCHA or connection blocked).")
                return []
                
            scraped_names = set()
            feed_selector = "div[role='feed']"
            
            # Wait for search results feed to load
            try:
                page.wait_for_selector("a[href*='/maps/place/']", timeout=30000)
                send_progress_update(user_id, "SEARCHING", progress=0, total=max_results, message="Google Maps search feed loaded. Extracting leads...")
            except Exception:
                logger.warning("No initial maps search results loaded.")
                send_progress_update(user_id, "FAILED", progress=0, total=max_results, message="No initial search results loaded from Google Maps.")
                return []
                
            scroll_attempts = 0
            max_scroll_attempts = 30
            
            while len(results) < max_results and scroll_attempts < max_scroll_attempts:
                # Find all current place cards in the scroll feed
                place_links = page.query_selector_all("a[href*='/maps/place/']")
                logger.info(f"Loaded {len(place_links)} elements. Results: {len(results)}/{max_results}")
                send_progress_update(user_id, "SEARCHING", progress=len(results), total=max_results, message=f"Scrolling results: processing {len(place_links)} listing(s)...")
                
                new_items_processed = False
                
                for link in place_links:
                    if len(results) >= max_results:
                        break
                        
                    aria_label = link.get_attribute("aria-label")
                    if not aria_label or aria_label in scraped_names:
                        continue
                        
                    scraped_names.add(aria_label)
                    new_items_processed = True
                    
                    try:
                        # Emulate human click interaction
                        human_click(link)
                        
                        # Wait and extract details from the details container
                        name_element = page.query_selector("h1")
                        company_name = name_element.inner_text() if name_element else aria_label
                        
                        send_progress_update(user_id, "SEARCHING", progress=len(results), total=max_results, message=f"Analyzing details for: {company_name}...")
                        
                        # Website extraction
                        website = ""
                        website_elem = page.query_selector("a[data-item-id='authority']")
                        if website_elem:
                            website = website_elem.get_attribute("href")
                            
                        # Deduplication check
                        if website:
                            if is_duplicate(website):
                                logger.info(f"Website duplicate skipped: {website}")
                                send_progress_update(user_id, "DUPLICATE_SKIP", progress=len(results), total=max_results, message=f"Skipped duplicate website: {website}")
                                continue
                                
                        # Phone extraction
                        phone = ""
                        phone_elem = page.query_selector("button[data-item-id^='phone:tel:']")
                        if phone_elem:
                            phone = phone_elem.get_attribute("data-item-id").replace("phone:tel:", "").strip()
                            
                        # Address extraction
                        address = ""
                        address_elem = page.query_selector("button[data-item-id='address']")
                        if address_elem:
                            address = address_elem.inner_text().strip()
                            
                        # Rating/reviews
                        rating = ""
                        rating_elem = page.query_selector("div.F7nice span[aria-hidden='true']")
                        if rating_elem:
                            rating = rating_elem.inner_text().strip()
                            
                        reviews = ""
                        reviews_elem = page.query_selector("div.F7nice span[aria-label*='reviews']")
                        if reviews_elem:
                            reviews = reviews_elem.inner_text().replace("(", "").replace(")", "").strip()
                            
                        website_domain = ""
                        business_type = "UNKNOWN"
                        domain_age_days = -1
                        domain_expiry_days = -1
                        dns_mx_valid = True
                        website_up = True
                        ssl_expiry_days = -1
                        
                        real_emails = []
                        linkedin = ""
                        facebook = ""
                        twitter = ""
                        instagram = ""
                        tech_stack = []
                        upgrade_priority = "LOW"
                        personalized_pitch = ""
                        outreach_hook = ""
                        hiring_intent = "NO"
                        hiring_intent_score = 0
                        careers_url = ""

                        if website:
                            parsed_web = urllib.parse.urlparse(website)
                            website_domain = parsed_web.netloc.replace("www.", "")
                            if website_domain:
                                # 1. WHOIS (Age & Expiry)
                                business_type, domain_age_days, domain_expiry_days = get_domain_whois_details(website_domain)
                                # 2. DNS MX Check
                                dns_mx_valid = check_domain_mx(website_domain)
                                # 3. SSL & Uptime Check
                                website_up, ssl_expiry_days = check_website_status_and_ssl(website, website_domain)
                            
                            # Crawl the website to enrich details
                            try:
                                logger.info(f"Enriching website details for: {website}")
                                send_progress_update(user_id, "SEARCHING", progress=len(results), total=max_results, message=f"Crawling website for emails and tech stack: {website_domain}...")
                                enrichment = enrich_lead_website(website, company_name, rating, address)
                                real_emails = enrichment.get("real_emails", [])
                                linkedin = enrichment.get("linkedin", "")
                                facebook = enrichment.get("facebook", "")
                                twitter = enrichment.get("twitter", "")
                                instagram = enrichment.get("instagram", "")
                                tech_stack = enrichment.get("tech_stack", [])
                                upgrade_priority = enrichment.get("upgrade_priority", "LOW")
                                hiring_intent = enrichment.get("hiring_intent", "NO")
                                hiring_intent_score = enrichment.get("hiring_intent_score", 0)
                                careers_url = enrichment.get("careers_url", "")
                            except Exception as e:
                                logger.error(f"Failed website enrichment: {e}")
                                hiring_intent = "NO"
                                hiring_intent_score = 0
                                careers_url = ""
                            
                            # 4. Generate Outreach hook & Override priority/pitch based on non-AI checks
                            techs_str = ", ".join(tech_stack) if tech_stack else "outdated libraries"
                            if not dns_mx_valid:
                                outreach_hook = "No MX records found for target domain (critical email bounce warning)"
                            elif not website_up:
                                outreach_hook = "Website appears to be DOWN (recovery/maintenance pitch)"
                                upgrade_priority = "CRITICAL"
                            elif ssl_expiry_days >= 0 and ssl_expiry_days < 30:
                                outreach_hook = f"SSL certificate expires in {ssl_expiry_days} days (urgent security patch pitch)"
                                upgrade_priority = "URGENT"
                            elif domain_expiry_days >= 0 and domain_expiry_days < 90:
                                outreach_hook = f"Domain registration expires in {domain_expiry_days} days (migration/redesign pitch)"
                                upgrade_priority = "URGENT"
                            elif upgrade_priority == "HIGH":
                                outreach_hook = f"Site built on {techs_str} (headless Next.js speed upgrade pitch)"
                            elif hiring_intent == "YES":
                                outreach_hook = f"Active hiring intent detected (hiring intent score: {hiring_intent_score})"
                                upgrade_priority = "HIGH"
                            else:
                                outreach_hook = f"Standard lead audit (rating: {rating or 'N/A'})"
                                
                            # Generate personalized pitch based on specific hooks
                            if not website_up:
                                personalized_pitch = (
                                    f"Hi Team, I found {company_name} on Google Maps, but when I tried visiting your website, "
                                    f"it appears to be down. Site downtime costs business leads every hour. "
                                    f"We can help restore your site immediately. Let me know if you need urgent help?"
                                )
                            elif ssl_expiry_days >= 0 and ssl_expiry_days < 30:
                                personalized_pitch = (
                                    f"Hey Team, I was checking out {company_name} and noticed your SSL certificate is expiring in "
                                    f"{ssl_expiry_days} days. If not renewed, browsers will display a 'Not Secure' warning, "
                                    f"dropping visitor traffic. We can configure automated Let's Encrypt certificates for you. Let's connect?"
                                )
                            elif domain_expiry_days >= 0 and domain_expiry_days < 90:
                                personalized_pitch = (
                                    f"Hi Team, I noticed the domain registration for {company_name} is expiring in "
                                    f"{domain_expiry_days} days. If you are looking to revamp your web presence or migrate your hosting "
                                    f"before renewing, we build lightning-fast React websites that improve speed. Can we schedule a brief call?"
                                )
                            elif hiring_intent == "YES":
                                personalized_pitch = (
                                    f"Hello Team, I noticed you have active job openings posted on your site. "
                                    f"Since you are actively looking to expand your team, we'd love to help by providing "
                                    f"expert external React/Next.js developers to accelerate your project roadmap on-demand. "
                                    f"Are you open to a quick call to discuss your hiring/development needs?"
                                )
                            elif upgrade_priority == "HIGH":
                                personalized_pitch = (
                                    f"Hey Team, I visited {company_name} online and noticed you're currently using "
                                    f"{techs_str} for your site. Outdated setups can limit SEO performance. "
                                    f"By upgrading to a modern React/Next.js stack, we can increase your site speed by up to 300%. "
                                    f"Would you be open to a quick audit call this week?"
                                )
                            else:
                                personalized_pitch = (
                                    f"Hi Team, I found {company_name} on Google Maps in {location or 'your area'}. "
                                    f"Your profile shows a solid {rating or '4.0'}+ rating. We specialize in building "
                                    f"custom high-converting React landings that double client inquiries. Let's connect for a brief chat?"
                                )
                            
                        company_data = {
                            "name": company_name,
                            "website": website,
                            "website_domain": website_domain,
                            "business_type": business_type,
                            "domain_age_days": domain_age_days,
                            "domain_expiry_days": domain_expiry_days,
                            "dns_mx_valid": dns_mx_valid,
                            "website_up": website_up,
                            "ssl_expiry_days": ssl_expiry_days,
                            "phone": phone,
                            "address": address,
                            "rating": rating,
                            "reviews": reviews,
                            "query_tag": query.replace(" ", "-").lower(),
                            "real_emails": real_emails,
                            "linkedin": linkedin,
                            "facebook": facebook,
                            "twitter": twitter,
                            "instagram": instagram,
                            "tech_stack": tech_stack,
                            "upgrade_priority": upgrade_priority,
                            "personalized_pitch": personalized_pitch,
                            "outreach_hook": outreach_hook,
                            "hiring_intent": hiring_intent,
                            "hiring_intent_score": hiring_intent_score,
                            "careers_url": careers_url
                        }
                        
                        logger.info(f"Scraped details: {company_name} | URL: {website} | Phone: {phone}")
                        
                        if website or phone:
                            save_lead_to_mongo(company_data, user_id=user_id, batch_id=batch_id)
                            results.append(company_data)
                            send_progress_update(user_id, "PROGRESS", company=company_data, progress=len(results), total=max_results, message=f"Saved lead: {company_name}")
                            
                    except Exception as details_err:
                        logger.warning(f"Error parsing details for {aria_label}: {details_err}")
                        continue
                        
                # Smooth scroll to pull more results
                smooth_scroll_element(page, feed_selector)
                scroll_attempts += 1
                human_delay(2.0, 4.0)
                
                # Exit early if we did not process any new items in multiple scroll iterations
                if not new_items_processed and scroll_attempts > 6:
                    logger.info("Feed end reached or no new items found. Terminating scroll.")
                    break
                    
        except Exception as main_err:
            logger.error(f"Error during search navigation/parsing: {main_err}")
            send_progress_update(user_id, "FAILED", progress=len(results), total=max_results, message=f"Scraper error: {str(main_err)}")
            if batch_id:
                try:
                    from bson.objectid import ObjectId
                    db["scraperbatches"].update_one(
                        {"_id": ObjectId(batch_id)},
                        {"$set": {"status": "failed", "errorMessage": str(main_err)}}
                    )
                except Exception as batch_err:
                    logger.error(f"Failed to update batch status to failed: {batch_err}")
        finally:
            try:
                browser.close()
            except Exception:
                pass
                
    logger.info(f"Finished GMB scrape task. Added {len(results)} new leads.")
    send_progress_update(user_id, "COMPLETED", progress=len(results), total=max_results, message=f"Scraping completed. Added {len(results)} new leads.")
    if batch_id:
        try:
            from bson.objectid import ObjectId
            # Only update status to completed if it's currently 'running'
            db["scraperbatches"].update_one(
                {"_id": ObjectId(batch_id), "status": "running"},
                {"$set": {"status": "completed"}}
            )
        except Exception as batch_err:
            logger.error(f"Failed to update batch status to completed: {batch_err}")
    return results

@celery_app.task(name="app.workers.automation.scraper.daily_database_backup_task")
def daily_database_backup_task():
    """
    Query all collections from MongoDB and dump them as a JSON backup in the backups/ directory.
    """
    from bson import json_util
    logger.info("Starting database backup task...")
    try:
        client = MongoClient(MONGODB_URI)
        db = client.get_default_database()
        
        # Resolve path to backups/ directory in root of my-leadgen-app
        base_dir = os.path.dirname(os.path.abspath(__file__))
        # __file__ is at my-leadgen-app/backend/app/workers/automation/scraper.py
        # go up 5 levels to reach my-leadgen-app root
        root_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(base_dir)))))
        backup_dir = os.path.join(root_dir, "backups")
        os.makedirs(backup_dir, exist_ok=True)
        
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_filename = f"db_backup_{timestamp}.json"
        backup_file = os.path.join(backup_dir, backup_filename)
        
        backup_data = {}
        collections = db.list_collection_names()
        for col_name in collections:
            if col_name.startswith("system."):
                continue
            logger.info(f"Backing up collection: {col_name}")
            records = list(db[col_name].find())
            backup_data[col_name] = json.loads(json_util.dumps(records))
            
        with open(backup_file, "w", encoding="utf-8") as f:
            json.dump(backup_data, f, indent=2)
            
        logger.info(f"Database backup successfully saved to: {backup_file}")
        return backup_file
    except Exception as backup_err:
        logger.error(f"Failed to perform database backup: {backup_err}")
        raise backup_err
    finally:
        try:
            client.close()
        except Exception:
            pass

@celery_app.task(name="app.workers.automation.scraper.clean_trash_contacts_task")
def clean_trash_contacts_task():
    """
    Remove all lead contacts from MongoDB where email, phone, and website are missing or empty.
    Keep the database clean of 'empty shell' leads.
    """
    logger.info("Starting database cleaning task for trash leads...")
    try:
        client = MongoClient(MONGODB_URI)
        db = client.get_default_database()
        contacts_col = db["contacts"]
        
        # Clean contacts matching missing or empty contact details
        query = {
            "$or": [
                {
                    "email": {"$regex": "^info@"},
                    "$or": [
                        {"customFields.phone": {"$exists": False}},
                        {"customFields.phone": ""}
                    ],
                    "$or": [
                        {"customFields.website": {"$exists": False}},
                        {"customFields.website": ""}
                    ]
                },
                {
                    "email": {"$exists": False},
                    "phone": {"$exists": False},
                    "website": {"$exists": False}
                }
            ]
        }
        
        result = contacts_col.delete_many(query)
        logger.info(f"Database clean completed. Removed {result.deleted_count} trash contacts.")
        return result.deleted_count
    except Exception as err:
        logger.error(f"Failed to clean trash contacts: {err}")
        raise err
    finally:
        try:
            client.close()
        except Exception:
            pass


