import os
import requests
from google import genai
from dotenv import load_dotenv

load_dotenv()

# Configure Gemini API using the new google-genai structure
API_KEY = os.getenv("GEMINI_API_KEY")
if API_KEY:
    client = genai.Client(api_key=API_KEY)
else:
    client = None

def generate_critical_notice_via_microservice(days_window: int = 90) -> dict:
    """
    Acts as a microservice communication layer. Hits the Hotspot Detection service (Port 8002)
    to fetch infrastructure failure probabilities. If a CRITICAL risk exists, it utilizes 
    Google Gemini to auto-draft an urgent administrative memo.
    """
    if not client:
        return {"error": "GEMINI_API_KEY not configured. Cannot generate notice."}

    try:
        # Ping the neighboring Microservice (Hotspot Detection) to get raw ML bounds
        res = requests.get(f"http://localhost:8002/api/predict/infrastructure?days={days_window}")
        if res.status_code != 200:
            return {"error": "Hotspot Detection Service (8002) is offline or unreachable."}
            
        predictions = res.json().get("predictions", [])
    except Exception as e:
        return {"error": f"Failed to connect to Hotspot Microservice: {e}"}

    critical_zones = [p for p in predictions if p.get("trend_status") == "CRITICAL"]
    if not critical_zones:
        return {"message": "No critical zones detected currently across the jurisdiction."}

    # Grab the most severe critical zone to alert the administrators
    top_critical_zone = max(critical_zones, key=lambda x: x["risk_score"])
    
    days = top_critical_zone.get("predicted_failure_days", "Unknown")
    score = round(top_critical_zone.get("risk_score", 0), 2)
    issues = ", ".join(top_critical_zone.get("primary_issues", ["Multiple"]))
    lat = top_critical_zone.get("zone", {}).get("lat", "N/A")
    lng = top_critical_zone.get("zone", {}).get("lng", "N/A")

    prompt = f"""
    You are an automated Civic AI Assistant. A predictive ML algorithm has detected a CRITICAL 
    infrastructure collapse risk that requires immediate government intervention. 
    
    Data Output:
    - Expected System Failure: Within {days} days
    - Risk Severity Index: {score} / 100
    - Root Causes: {issues}
    - Geographic Zone: Lat {lat}, Lng {lng}
    
    Draft an urgent, professional, and slightly alarming (but standard bureaucratic) 3-paragraph memo 
    addressed to the 'Department of Public Works and Infrastructure'. 
    Format the response using safe HTML (with <b>, <p>, and <ul> tags only) so it can be directly 
    embedded into a React dashboard or sent as an HTML email. Do not include markdown code block syntax.
    """

    try:
        response = client.models.generate_content(
            model='gemini-3-flash-preview',
            contents=prompt
        )
        memo = response.text.replace("```html", "").replace("```", "").strip()
        
        return {
            "zone_data": top_critical_zone,
            "llm_draft_html": memo
        }
    except Exception as e:
        return {"error": f"Failed to generate notice via LLM: {str(e)}"}
