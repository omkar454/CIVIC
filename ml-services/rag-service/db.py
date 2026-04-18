"""
db.py — Database Connectors (Pinecone + MongoDB)
Handles:
  - Pinecone index creation / connection
  - MongoDB connection for fetching full report documents
"""

import os
import logging
from dotenv import load_dotenv
from pinecone import Pinecone, ServerlessSpec
from pymongo import MongoClient
from bson import ObjectId

load_dotenv()
logger = logging.getLogger(__name__)

# ─── Configuration ──────────────────────────────────────────────────────

PINECONE_API_KEY = os.getenv("PINECONE_API_KEY", "")
PINECONE_INDEX_NAME = os.getenv("PINECONE_INDEX_NAME", "civic-issues")
MONGO_URI = os.getenv("MONGO_URI", "")
EMBEDDING_DIMENSION = 384

# ─── Pinecone ────────────────────────────────────────────────────────────

_pinecone_index = None

def get_pinecone_index():
    """Initialize and return the Pinecone index. Creates it if it doesn't exist."""
    global _pinecone_index
    if _pinecone_index is not None:
        return _pinecone_index

    if not PINECONE_API_KEY:
        logger.error("❌ PINECONE_API_KEY not set in .env")
        raise ValueError("PINECONE_API_KEY is required")

    pc = Pinecone(api_key=PINECONE_API_KEY)

    # Create the index if it does not exist
    existing_indexes = [idx.name for idx in pc.list_indexes()]
    if PINECONE_INDEX_NAME not in existing_indexes:
        logger.info(f"📦 Creating Pinecone index '{PINECONE_INDEX_NAME}' (dim={EMBEDDING_DIMENSION}, cosine)...")
        pc.create_index(
            name=PINECONE_INDEX_NAME,
            dimension=EMBEDDING_DIMENSION,
            metric="cosine",
            spec=ServerlessSpec(cloud="aws", region="us-east-1"),
        )
        logger.info(f"✅ Pinecone index '{PINECONE_INDEX_NAME}' created")
    else:
        logger.info(f"✅ Pinecone index '{PINECONE_INDEX_NAME}' already exists")

    _pinecone_index = pc.Index(PINECONE_INDEX_NAME)
    return _pinecone_index


# ─── MongoDB ─────────────────────────────────────────────────────────────

_mongo_client = None
_mongo_db = None

def get_mongo_db():
    """Initialize and return the MongoDB database object."""
    global _mongo_client, _mongo_db
    if _mongo_db is not None:
        return _mongo_db

    if not MONGO_URI:
        logger.error("❌ MONGO_URI not set in .env")
        raise ValueError("MONGO_URI is required")

    _mongo_client = MongoClient(MONGO_URI)
    # Extract DB name from the URI (everything after the last '/')
    db_name = MONGO_URI.rsplit("/", 1)[-1].split("?")[0] or "CIVIC"
    _mongo_db = _mongo_client[db_name]
    logger.info(f"✅ MongoDB connected to database: '{db_name}'")
    return _mongo_db


def get_reports_collection():
    """Return the MongoDB 'reports' collection."""
    db = get_mongo_db()
    return db["reports"]


def fetch_reports_by_ids(ids: list[str]) -> dict:
    """
    Fetch full report documents from MongoDB by their string _id values.
    Returns a dict mapping string id -> document.
    """
    collection = get_reports_collection()
    object_ids = []
    for doc_id in ids:
        try:
            object_ids.append(ObjectId(doc_id))
        except Exception:
            logger.warning(f"⚠️ Invalid ObjectId: {doc_id}")
            continue

    cursor = collection.find({"_id": {"$in": object_ids}})
    results = {}
    for doc in cursor:
        doc_id = str(doc["_id"])
        doc["_id"] = doc_id  # Convert ObjectId to string for JSON serialization
        # Convert any nested ObjectId fields
        if "reporter" in doc:
            doc["reporter"] = str(doc["reporter"])
        if "assignedTo" in doc and doc["assignedTo"]:
            doc["assignedTo"] = str(doc["assignedTo"])
        # Remove heavy fields not needed for RAG context
        doc.pop("textEmbedding", None)
        doc.pop("imageEmbedding", None)
        doc.pop("statusHistory", None)
        doc.pop("comments", None)
        doc.pop("voters", None)
        results[doc_id] = doc
    return results
