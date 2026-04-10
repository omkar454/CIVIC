import requests
import json

base_url = 'http://localhost:8001/api/predict/priority'

scenarios = [
    {
        "name": "🌱 VERY LOW PRIORITY (Quiet Lane)",
        "payload": {
            "lat": 19.0660,
            "lng": 72.8250,
            "severity": 1,
            "votes": 0,
            "category": "park"
        }
    },
    {
        "name": "🏡 RESIDENTIAL / NO LANDMARK (Pali Hill)",
        "payload": {
            "lat": 19.0637,
            "lng": 72.8277,
            "severity": 2,
            "votes": 1,
            "category": "other"
        }
    },
    {
        "name": "🏫 SENSITIVE SCHOOL ZONE (St. Andrews)",
        "payload": {
            "lat": 19.0538,
            "lng": 72.8286,
            "severity": 3,
            "votes": 0,
            "category": "garbage"
        }
    },
    {
        "name": "🚦 HIGH TRAFFIC JUNCTION (SV Road)",
        "payload": {
            "lat": 19.0544,
            "lng": 72.8400,
            "severity": 4,
            "votes": 10,
            "category": "pothole"
        }
    },
    {
        "name": "🏥 EMERGENCY HUB (Holy Family Hospital)",
        "payload": {
            "lat": 19.0558,
            "lng": 72.8306,
            "severity": 3,
            "votes": 2,
            "category": "garbage"
        }
    },
    {
        "name": "🚨 TOP PRIORITY: FIRE STATION PROXIMITY",
        "payload": {
            "lat": 19.0565,
            "lng": 72.8358,
            "severity": 5,
            "votes": 8,
            "category": "drainage"
        }
    },
    {
        "name": "🌊 EXTREME: FLOOD HOTSPOT + RAIN + HIGH IMPACT",
        "payload": {
            "lat": 19.0834,
            "lng": 72.8427,
            "severity": 5,
            "votes": 25,
            "category": "water-logging"
        }
    }
]

def run_tests():
    print("🚀 Running AI Smart Priority Scenario Analysis...")
    print("-" * 60)
    
    for s in scenarios:
        print(f"\nTEST CASE: {s['name']}")
        try:
            res = requests.post(base_url, json=s['payload'])
            data = res.json()
            
            print(f"📍 Location      : {s['payload']['lat']}, {s['payload']['lng']}")
            print(f"🏆 Score         : {data.get('smartPriorityScore', 'N/A')}")
            print(f"🚩 Landmark      : {data.get('nearestLandmark', 'NONE')}")
            print(f"🌦️ Rain Impact   : {'YES 🌧️' if data.get('isRaining') else 'NO ☀️'}")
            print(f"📋 AI Drivers    : {', '.join(data.get('priorityFactors', []))}")
            
        except Exception as e:
            print(f"❌ Error: {e}")

if __name__ == "__main__":
    run_tests()
