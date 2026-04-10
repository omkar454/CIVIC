from fastapi import FastAPI, HTTPException
import pandas as pd
from datetime import datetime, timedelta

from utils.db_connector import get_db_collection
from models.time_series import forecast_resource_demand
from models.notice_builder import generate_critical_notice_via_microservice

app = FastAPI(title="CIVIC Resource & Operations Intelligence API", version="5.0.0")

@app.get("/")
def read_root():
    return {"status": "Resource Forecasting & Intelligence Service is running", "module": "Module 5"}

def _fetch_reports_dataframe(time_window_days: int = None):
    collection = get_db_collection()
    if collection is None:
        raise HTTPException(status_code=500, detail="Database connection not configured.")

    query = {}
    if time_window_days:
        cutoff_date = datetime.utcnow() - timedelta(days=time_window_days)
        query["createdAt"] = {"$gte": cutoff_date}
        
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
def get_resource_forecast(historical_days: int = 180, predict_days_ahead: int = 30):
    """
    Uses Facebook Prophet to forecast the volume of complaints per department over the next N days.
    """
    df = _fetch_reports_dataframe(time_window_days=historical_days)
    if df.empty:
        return {"forecasts": {}}

    forecasts = forecast_resource_demand(df, days_ahead=predict_days_ahead)
    return {"forecasts": forecasts}

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
