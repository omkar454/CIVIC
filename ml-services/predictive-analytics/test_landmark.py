import requests

payload = {
    'lat': 19.0511, 
    'lng': 72.8272, 
    'severity': 4, 
    'votes': 5, 
    'category': 'pothole'
}

try:
    res = requests.post('http://localhost:8001/api/predict/priority', json=payload)
    print("Response Status:", res.status_code)
    print("Response Data:", res.json())
except Exception as e:
    print("Error:", e)
