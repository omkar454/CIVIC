import os
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
import pandas as pd
from datetime import datetime, timedelta, timezone

# 📡 Load Environment Variables (API Keys, DB URIs)
load_dotenv()

from utils.db_connector import get_db_collection
from models.time_series import forecast_resource_demand, aggregate_forecasts
from models.notice_builder import generate_critical_notice_via_microservice
from utils.resource_mapper import map_volume_to_resources, aggregate_resources

import traceback
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="CIVIC Resource & Operations Intelligence API", version="5.0.0")

# 🌐 Enable CORS for local cross-port communication (React to Python)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict to your domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def catch_exceptions_middleware(request, call_next):
    try:
        return await call_next(request)
    except Exception as e:
        print("--- CRITICAL MICROSERVICE ERROR ---")
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={"detail": str(e), "traceback": traceback.format_exc()}
        )

@app.get("/")
def read_root():
    return {"status": "Resource Forecasting & Intelligence Service is running", "module": "Module 5"}

def _fetch_reports_dataframe(time_window_days: int = None, department: str = None):
    collection = get_db_collection()
    if collection is None:
        raise HTTPException(status_code=500, detail="Database connection not configured.")

    query = {}
    if time_window_days:
        # 🕒 Use timezone-aware UTC to match MongoDB's BSON format exactly
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=time_window_days)
        query["createdAt"] = {"$gte": cutoff_date}
        
    if department:
        import re
        query["department"] = {"$regex": f"^{re.escape(department)}$", "$options": "i"}
        
    # 🛡️ Data Integrity: Only learn from Verified, Acknowledged, or Resolved reports.
    # Exclude Rejections and Inauthentic duplicates to prevent AI contamination.
    query["status"] = {"$nin": ["Rejected"]}

    reports_cursor = collection.find(query, {"category": 1, "createdAt": 1})
    
    data = []
    for r in reports_cursor:
        data.append({
            "id": str(r["_id"]),
            "category": r.get("category", "other"),
            "created_at": r.get("createdAt")
        })

    return pd.DataFrame(data)

@app.get("/api/predict/resources")
def get_resource_forecast(historical_days: int = 180, predict_days_ahead: int = 30, department: str = None):
    """
    Uses Facebook Prophet to forecast the volume of complaints per department over the next N days.
    Integrates Resource Optimization to calculate material and manpower requirements.
    """
    # 🕵️ Intelligence: If department is "General", we fetch all data to aggregate later
    fetch_dept = None if department and department.lower() == "general" else department
    df = _fetch_reports_dataframe(time_window_days=historical_days, department=fetch_dept)
    if df.empty:
        return {"forecasts": {}, "resource_requirements": {}, "weather_metadata": {}}

    forecasts, weather_data = forecast_resource_demand(df, days_ahead=predict_days_ahead)
    
    # 🏦 Integrate Resource Intelligence Layer
    resource_reqs = map_volume_to_resources(forecasts)
    
    # 🌍 Handle Omni-Department (General) Aggregation (Focused on Streetlight, Pothole, Garbage)
    if department and department.lower() == "general":
        target_categories = ["streetlight", "pothole", "garbage"]
        # Filter forecasts to only include matching categories
        filtered_forecasts = {
            cat: data for cat, data in forecasts.items() 
            if any(tc in cat.lower() for tc in target_categories)
        }
        
        aggregated_f = aggregate_forecasts(filtered_forecasts)
        aggregated_r = aggregate_resources(map_volume_to_resources(filtered_forecasts))
        
        # 🔗 Intelligence: Merge them! Keep the breakdown AND the City-Wide summary
        forecasts = {**filtered_forecasts, **aggregated_f}
        resource_reqs = {**map_volume_to_resources(filtered_forecasts), **aggregated_r}
    
    return {
        "forecasts": forecasts,
        "resource_requirements": resource_reqs,
        "weather_metadata": weather_data,
        "intelligence_source": "Facebook Prophet + OpenWeather Analytics",
        "scope": department if department else "All Departments"
    }

@app.get("/api/alerts/generate")
def generate_alerts(days: int = 90):
    """
    Microservice Endpoint: Pings the Hotspot Service (Port 8002) for active geographic issues,
    then uses Google Gemini to auto-draft administrative HTML alerts.
    """
    result = generate_critical_notice_via_microservice(days_window=days)
    if "error" in result:
        raise HTTPException(status_code=502, detail=result["error"])
    
    return result

if __name__ == "__main__":
    import uvicorn
    # Operates natively on Port 8003 as a distinct parallel microservice in the cluster!
    uvicorn.run(app, host="0.0.0.0", port=8003)
