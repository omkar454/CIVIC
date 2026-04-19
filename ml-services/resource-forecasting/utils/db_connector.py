import os
from pymongo import MongoClient
import sys

# 🏛️ Singleton Engine: Prevents connection leaks and system crashes on Windows
_mongo_client = None

def get_db_collection():
    """
    Connects to MongoDB using a persistent Singleton pattern. 
    Returns the 'reports' collection for AI training.
    """
    global _mongo_client
    
    uri = os.getenv("MONGO_URI")
    if not uri:
        print("CRITICAL: MONGO_URI missing.")
        return None
    
    if _mongo_client is None:
        try:
            # Initialize the client only once
            _mongo_client = MongoClient(uri, serverSelectionTimeoutMS=5000)
            # Trigger a connection check
            _mongo_client.admin.command('ping')
            print("🚀 Persistent AI-Database Bridge established")
        except Exception as e:
            print(f"FAILED to connect to MongoDB: {e}")
            _mongo_client = None
            return None
            
    try:
        db = _mongo_client.get_default_database()
        return db["reports"]
    except Exception:
        # Fallback if no default DB is specified in URI
        return _mongo_client.get_database("test")["reports"]
