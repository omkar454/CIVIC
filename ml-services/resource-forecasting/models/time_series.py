import pandas as pd
from prophet import Prophet
from datetime import datetime

from utils.weather_service import WeatherIntelligence, get_forecast_multipliers
import requests
from utils.geo_utils import get_human_address

def forecast_resource_demand(reports_df: pd.DataFrame, days_ahead: int = 30):
    """
    Groups historical reports by category (department) and uses Facebook Prophet 
    to forecast resource demand (complaint volume) over the next N days.
    Integrates Weather Intelligence to adjust for imminent environmental risks.
    """
    if reports_df.empty:
        return {}

    reports_df['created_at'] = pd.to_datetime(reports_df['created_at'])
    reports_df['date'] = reports_df['created_at'].dt.date

    # 🌩️ Initialize Weather Intelligence
    weather_intel = WeatherIntelligence()
    weather_forecast = weather_intel.get_7day_forecast()
    multipliers = get_forecast_multipliers(weather_forecast)


    # 📍 Initialize Geospatial Attribution (Historical Context)
    # We fetch hotspot density to cross-reference WHERE the spikes will likely hit
    hotspot_density = {}
    try:
        hs_res = requests.get("http://localhost:8002/api/predict/infrastructure?days=180", timeout=2)
        if hs_res.status_code == 200:
            predictions = hs_res.json().get("predictions", [])
            for p in predictions:
                cat = p.get("primary_issues", ["other"])[0]
                if cat not in hotspot_density: hotspot_density[cat] = []
                
                # 🗺️ Intelligence: Pivot from raw coordinates to Human-Readable Addresses
                lat = p["zone"]["lat"]
                lng = p["zone"]["lng"]
                address = p.get("address") or get_human_address(lat, lng)
                
                hotspot_density[cat].append({
                    "lat": lat,
                    "lng": lng,
                    "risk_score": p["risk_score"],
                    "address": address
                })
    except Exception:
        pass # Fallback if hotspot service is offline

    forecasts = {}
    categories = reports_df['category'].unique()

    for category in categories:
        cat_df = reports_df[reports_df['category'] == category]
        daily_volume = cat_df.groupby('date').size().reset_index(name='volume')
        
        prophet_df = pd.DataFrame({
            'ds': pd.to_datetime(daily_volume['date']),
            'y': daily_volume['volume']
        })

        if len(prophet_df) < 5:
            continue
            
        try:
            m = Prophet(yearly_seasonality=False, daily_seasonality=False) 
            m.fit(prophet_df)

            future = m.make_future_dataframe(periods=days_ahead)
            forecast = m.predict(future)

            future_forecast = forecast[forecast['ds'] > prophet_df['ds'].max()]

            prediction_records = []
            for _, row in future_forecast.iterrows():
                ds_str = row['ds'].strftime('%Y-%m-%d')
                base_vol = max(0, int(round(row['yhat'])))
                
                # 🌡️ Apply AI-Driven Weather Adjustments (Intelligence Spike)
                adjusted_vol = base_vol
                reason = None
                
                daily_multiplier = next((m for m in multipliers if m["date"] == ds_str), None)
                if daily_multiplier:
                    # Target specific categories for multipliers based on keyword match
                    multiplier_key = next((k for k in daily_multiplier.keys() if k.lower() in category.lower()), None)
                    if multiplier_key:
                        mult = daily_multiplier[multiplier_key]
                        if mult != 1.0:
                            adjusted_vol = int(round(base_vol * mult))
                            reason = daily_multiplier["reason"]

                prediction_records.append({
                    "date": ds_str,
                    "predicted_volume": adjusted_vol,
                    "baseline_volume": base_vol,
                    "is_spike": adjusted_vol > base_vol,
                    "adjustment_reason": reason,
                    "lower_bound": max(0, int(round(row['yhat_lower']))),
                    "upper_bound": max(0, int(round(row['yhat_upper'])))
                })
            
            total_expected_demand = sum(p["predicted_volume"] for p in prediction_records)

            forecasts[category] = {
                "total_demand_forecast": total_expected_demand,
                "daily_predictions": prediction_records,
                "geospatial_risk_attribution": hotspot_density.get(category, [])[:3] # Map to top 3 vulnerable areas
            }
        except Exception as e:
            print(f"Error forecasting for {category}: {e}")
            continue

    return forecasts, weather_forecast

def aggregate_forecasts(forecasts: dict):
    """
    Merges multiple departmental forecasts into a single 'City-Wide' view.
    Sums predicted volumes for matching dates.
    """
    if not forecasts:
        return {}

    all_dates = {}
    total_demand = 0
    all_risks = []

    for cat, data in forecasts.items():
        total_demand += data["total_demand_forecast"]
        all_risks.extend(data.get("geospatial_risk_attribution", []))
        
        for pred in data.get("daily_predictions", []):
            dt = pred["date"]
            if dt not in all_dates:
                all_dates[dt] = {
                    "date": dt,
                    "predicted_volume": 0,
                    "baseline_volume": 0,
                    "is_spike": False,
                    "adjustment_reason": []
                }
            
            all_dates[dt]["predicted_volume"] += pred["predicted_volume"]
            all_dates[dt]["baseline_volume"] += pred["baseline_volume"]
            
            if pred["is_spike"]:
                all_dates[dt]["is_spike"] = True
                if pred["adjustment_reason"] not in all_dates[dt]["adjustment_reason"]:
                    all_dates[dt]["adjustment_reason"].append(f"{cat}: {pred['adjustment_reason']}")

    # Finalize records
    final_predictions = []
    for dt in sorted(all_dates.keys()):
        record = all_dates[dt]
        record["adjustment_reason"] = " | ".join(record["adjustment_reason"]) if record["adjustment_reason"] else None
        final_predictions.append(record)

    return {
        "City-Wide": {
            "total_demand_forecast": total_demand,
            "daily_predictions": final_predictions,
            "geospatial_risk_attribution": sorted(all_risks, key=lambda x: x.get("risk_score", 0), reverse=True)[:5]
        }
    }
