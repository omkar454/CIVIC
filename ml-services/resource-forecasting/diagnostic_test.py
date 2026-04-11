import requests

def test_services():
    print("Checking Hotspot Service (8002)...")
    try:
        res = requests.get("http://localhost:8002/")
        print(f"8002 Status: {res.status_code}, Response: {res.json()}")
    except Exception as e:
        print(f"8002 Error: {e}")

    print("\nChecking Forecasting Service (8003)...")
    try:
        res = requests.get("http://localhost:8003/")
        print(f"8003 Status: {res.status_code}, Response: {res.json()}")
    except Exception as e:
        print(f"8003 Error: {e}")

    print("\nTesting Alert Generation (8003/api/alerts/generate)...")
    try:
        res = requests.get("http://localhost:8003/api/alerts/generate?days=90")
        print(f"Alert Status: {res.status_code}")
        print(f"Alert Response: {res.json()}")
    except Exception as e:
        print(f"Alert Error: {e}")

if __name__ == "__main__":
    test_services()
