import os
import json
from dotenv import load_dotenv

load_dotenv()

from main import _fetch_reports_dataframe
from models.time_series import forecast_resource_demand
from models.notice_builder import generate_critical_notice_via_microservice

def run_forecasting_diagnostics():
    print("==========================================================")
    print("🧠 MICROSERVICE 2: RESOURCE & INTELLIGENCE DIAGNOSTICS")
    print("==========================================================\n")
    
    # 1. Test Resource Forecasting (Prophet)
    print("[1] RESOURCE DEMAND FORECASTING (Facebook Prophet)")
    try:
        df = _fetch_reports_dataframe(time_window_days=180)
        if df.empty:
            print(" -> No valid historical data retrieved.")
        else:
            print(" -> Analyzing historical workload...")
            forecasts = forecast_resource_demand(df, days_ahead=7)
            if not forecasts:
                print(" -> Data volume too low to fit Prophet models.")
            else:
                for category, data in forecasts.items():
                    print(f"   [Department: {category.upper()}]")
                    print(f"     Total Expected Load (Next 7 Days): ~{data['total_demand_forecast']} instances")
    except Exception as e:
        print(f" -> Error during Prophet Forecast: {e}")

    print("\n==========================================================\n")

    # 2. Test LLM Notice Generation (Microservice fetch)
    print("[2] PREDICTIVE NOTICE GENERATION (Google Gemini)")
    print(" -> Fetching bounding boxes from neighboring Hotspot Microservice (Port 8002)...\n")
    
    result = generate_critical_notice_via_microservice(days_window=90)
    
    if "error" in result:
        print(f"❌ Error: {result['error']}")
        print("💡 NOTE: Make sure the Hotspot Service is running on an active terminal tab `uvicorn main:app --port 8002`")
    elif "message" in result:
        print(f"ℹ️ {result['message']}")
        print(" -> (Tip: You can manually lower the CRITICAL risk threshold temporarily in hotspot-detection/models/clustering.py to force a test)")
    else:
        print(f"✅ Connection verified. Critical Zone isolated: {result['zone_data']['zone']}")
        print("📝 --- GENERATED LLM NOTICE --- 📝\n")
        print(result["llm_draft_html"])
        print("\n📝 ---------------------------- 📝")
        
    print("\n==========================================================")
    print("✅ TEST COMPLETE")
    print("==========================================================")

if __name__ == "__main__":
    run_forecasting_diagnostics()
