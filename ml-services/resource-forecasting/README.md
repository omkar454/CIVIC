# Module 5: Operations & Intelligence Engine

This represents an entirely separate Microservice inside the `ml-services` cluster, designed specifically to operate completely decoupled from the spatial analytics of Module 4 (`hotspot-detection`).

While Module 4 visually isolates problems on the map (DBSCAN), **Module 5 orchestrates government workflows** (Budgeting & Communications).

## 📊 1. Resource Demand Forecasting (Facebook Prophet)

**Goal:** Predict volume of complaints per department (Roads, Waste, Water) for the upcoming months to pre-allocate budget and staff.

**Architecture:** 
- The module extracts all historical database records directly from Mongo Atlas.
- It groups data by `category` (which maps functionally to departments) and aligns them chronologically.
- We pipe this data directly into **Facebook Prophet**, a powerful time-series forecasting algorithm natively designed to identify strong human "seasonal" traits. 
- Prophet automatically parses the data to pick up on weekly spikes (e.g., higher garbage dumps on weekends) or macro spikes (heavy water-logging in winter) and predicts the future `yhat` load over a set number of upcoming days.

**Endpoint:** `GET /api/predict/resources`

---

## 🤖 2. Predictive Notice Generation (Microservice + LLM)

**Goal:** Auto-draft context-aware HTML alerts for City Administrators warning them of impending infrastructure collapses.

**Architecture:**
- **Microservice Mesh:** This endpoint DOES NOT calculate geospatial bounds. Instead, it uses standard HTTP `requests` to ping the neighboring Hotspot Detection Service (`http://localhost:8002/api/predict/infrastructure`). 
- **LLM Integration:** If the Hotspot service flags a zone as `CRITICAL` (> 30 Risk Score), this service securely pings the Google `gemini-pro` Generative AI API using Prompt Engineering. 
- It forces the AI to construct an urgent, highly authoritative HTML memo natively embedding the isolated coordinates and failure probabilities. This memo can be dumped directly into an automated Notification pipeline or your React Dashboards.

**Endpoint:** `GET /api/alerts/generate`

## 🚀 Execution

Since this is decoupled, simply run this API instance simultaneously alongside your others:
```bash
cd desktop/civic/ml-services/resource-forecasting
uvicorn main:app --port 8003
```

