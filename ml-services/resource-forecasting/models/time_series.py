import pandas as pd
from prophet import Prophet
import datetime

def forecast_resource_demand(reports_df: pd.DataFrame, days_ahead: int = 30):
    """
    Groups historical reports by category (department) and uses Facebook Prophet 
    to forecast resource demand (complaint volume) over the next N days.
    """
    if reports_df.empty:
        return {}

    reports_df['created_at'] = pd.to_datetime(reports_df['created_at'])
    reports_df['date'] = reports_df['created_at'].dt.date

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
                pred_vol = max(0, int(round(row['yhat'])))
                lower = max(0, int(round(row['yhat_lower'])))
                upper = max(0, int(round(row['yhat_upper'])))

                prediction_records.append({
                    "date": row['ds'].strftime('%Y-%m-%d'),
                    "predicted_volume": pred_vol,
                    "lower_bound": lower,
                    "upper_bound": upper
                })
            
            total_expected_demand = sum(p["predicted_volume"] for p in prediction_records)

            forecasts[category] = {
                "total_demand_forecast": total_expected_demand,
                "daily_predictions": prediction_records
            }
        except Exception as e:
            print(f"Error forecasting for {category}: {e}")
            continue

    return forecasts
