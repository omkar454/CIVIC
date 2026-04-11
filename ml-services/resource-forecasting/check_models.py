import os
from google import genai
from dotenv import load_dotenv

load_dotenv()
API_KEY = os.getenv("GEMINI_API_KEY")

def list_my_models():
    if not API_KEY:
        print("Error: No API Key found in .env")
        return

    client = genai.Client(api_key=API_KEY)
    print("Fetching available models...")
    try:
        # The new SDK uses client.models.list()
        for model in client.models.list():
            print(f"- {model.name} (Supported: {model.supported_generation_methods})")
    except Exception as e:
        print(f"Error fetching models: {e}")

if __name__ == "__main__":
    list_my_models()
