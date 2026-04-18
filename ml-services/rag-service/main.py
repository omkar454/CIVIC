"""
main.py — CIVIC RAG Microservice
FastAPI application providing:
  POST /embed-store   — Embed a complaint and store in Pinecone + MongoDB
  POST /search        — Semantic search for similar complaints
  POST /batch-sync    — Bulk sync existing MongoDB complaints into Pinecone
  GET  /health        — Health check
"""

import os
import time
import logging
from datetime import datetime, timezone
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

from embedding import build_embedding_text, generate_embedding, generate_embeddings_batch
from db import get_pinecone_index, get_reports_collection, fetch_reports_by_ids

# ─── Logging Setup ───────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("rag-service")


# ─── Lifespan (Startup / Shutdown) ──────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Pre-load the embedding model and connect to databases on startup."""
    logger.info("🚀 RAG Service starting up...")
    try:
        # Pre-load model so the first request isn't slow
        from embedding import get_model
        get_model()
        # Test DB connections
        get_pinecone_index()
        get_reports_collection()
        logger.info("✅ RAG Service ready")
    except Exception as e:
        logger.error(f"⚠️ Startup warning (service will still run): {e}")
    yield
    logger.info("🛑 RAG Service shutting down...")


# ─── FastAPI App ─────────────────────────────────────────────────────────

app = FastAPI(
    title="CIVIC RAG Microservice",
    version="1.0.0",
    description="Retrieval Augmented Generation service for multilingual civic complaint search and duplicate detection.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Simple In-Memory Cache ─────────────────────────────────────────────

_search_cache = {}
CACHE_TTL_SECONDS = 300  # 5 minutes


# ─── Pydantic Models ────────────────────────────────────────────────────

class EmbedStoreRequest(BaseModel):
    """Input for storing a complaint embedding."""
    id: str = Field(..., description="MongoDB _id of the complaint")
    title: str = Field(..., description="Complaint title")
    description: str = Field(..., description="Complaint description")
    category: str = Field(default="other", description="Complaint category")
    address: str = Field(default="", description="Location/address text")
    status: str = Field(default="Open", description="Current status")
    department: str = Field(default="general", description="Assigned department")


class SearchRequest(BaseModel):
    """Input for semantic search."""
    query: str = Field(..., description="User's search query (any language)")
    top_k: int = Field(default=5, ge=1, le=20, description="Number of results to return")
    category_filter: Optional[str] = Field(default=None, description="Optional category filter")
    namespace: Optional[str] = Field(default="complaints", description="Pinecone namespace to query")


class BatchSyncRequest(BaseModel):
    """Input for batch syncing existing complaints."""
    limit: int = Field(default=500, ge=1, le=5000, description="Max complaints to sync")


# ─── Duplicate Detection Thresholds ─────────────────────────────────────

DUPLICATE_THRESHOLD = 0.80
RELATED_THRESHOLD = 0.65


# ─── Endpoints ───────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"status": "CIVIC RAG Microservice is running", "module": "RAG Engine"}


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "model": "paraphrase-multilingual-MiniLM-L12-v2",
        "dimension": 384,
        "cache_size": len(_search_cache),
    }


@app.post("/embed-store")
async def embed_store(req: EmbedStoreRequest):
    """
    Embed a complaint and upsert the vector into Pinecone.
    Metadata is stored alongside the vector for filtering and display.
    """
    try:
        # 1. Build the text to embed
        combined_text = build_embedding_text(
            text=f"{req.title} {req.description}",
            category=req.category,
            location=req.address,
        )

        # 2. Generate embedding
        embedding = generate_embedding(combined_text)

        # 3. Prepare metadata for Pinecone
        metadata = {
            "title": req.title[:200],  # Pinecone metadata limit
            "description": req.description[:500],
            "category": req.category,
            "address": req.address[:200],
            "status": req.status,
            "department": req.department,
            "indexed_at": datetime.now(timezone.utc).isoformat(),
        }

        # 4. Upsert into Pinecone
        index = get_pinecone_index()
        index.upsert(vectors=[(req.id, embedding, metadata)], namespace="complaints")

        logger.info(f"✅ Embedded & stored complaint {req.id} ({req.category})")

        # Invalidate relevant cache entries
        _search_cache.clear()

        return {
            "success": True,
            "id": req.id,
            "message": f"Complaint embedded and stored in Pinecone (dim={len(embedding)})",
        }

    except Exception as e:
        logger.error(f"❌ Embed-store error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/search")
async def search(req: SearchRequest):
    """
    Semantic search for similar complaints.
    Returns top_k results with duplicate detection scores.
    """
    try:
        start_time = time.time()

        # Check cache
        cache_key = f"{req.query}:{req.top_k}:{req.category_filter}:{req.namespace}"
        if cache_key in _search_cache:
            cached_entry = _search_cache[cache_key]
            if time.time() - cached_entry["timestamp"] < CACHE_TTL_SECONDS:
                logger.info(f"♻️ Cache hit for query: '{req.query[:50]}...'")
                return cached_entry["data"]

        # 1. Generate query embedding
        query_embedding = generate_embedding(req.query)

        # 2. Build Pinecone filter
        pinecone_filter = {}
        if req.category_filter:
            pinecone_filter["category"] = req.category_filter

        # 3. Query Pinecone
        index = get_pinecone_index()
        query_params = {
            "namespace": req.namespace,
            "vector": query_embedding,
            "top_k": req.top_k,
            "include_metadata": True,
        }
        if pinecone_filter:
            query_params["filter"] = pinecone_filter

        results = index.query(**query_params)

        # 4. Fetch full documents from MongoDB
        matched_ids = [match.id for match in results.matches]
        mongo_docs = fetch_reports_by_ids(matched_ids) if matched_ids else {}

        # 5. Build response with duplicate detection
        similar_issues = []
        has_duplicate = False

        for match in results.matches:
            score = round(match.score, 4)
            is_duplicate = score >= DUPLICATE_THRESHOLD
            is_related = score >= RELATED_THRESHOLD

            if is_duplicate:
                has_duplicate = True

            issue_data = {
                "id": match.id,
                "score": score,
                "is_duplicate": is_duplicate,
                "is_related": is_related,
                "label": "duplicate" if is_duplicate else ("related" if is_related else "new"),
                "metadata": match.metadata or {},
            }

            # Merge full MongoDB document if available
            if match.id in mongo_docs:
                mongo_doc = mongo_docs[match.id]
                issue_data["full_data"] = {
                    "title": mongo_doc.get("title", ""),
                    "description": mongo_doc.get("description", ""),
                    "category": mongo_doc.get("category", ""),
                    "status": mongo_doc.get("status", ""),
                    "department": mongo_doc.get("department", ""),
                    "address": mongo_doc.get("address", ""),
                    "severity": mongo_doc.get("severity"),
                    "votes": mongo_doc.get("votes", 0),
                    "createdAt": str(mongo_doc.get("createdAt", "")),
                }

            similar_issues.append(issue_data)

        elapsed_ms = round((time.time() - start_time) * 1000, 2)

        response_data = {
            "query": req.query,
            "duplicate": has_duplicate,
            "results_count": len(similar_issues),
            "results": similar_issues,
            "search_time_ms": elapsed_ms,
        }

        # Cache the result
        _search_cache[cache_key] = {
            "data": response_data,
            "timestamp": time.time(),
        }

        logger.info(
            f"🔍 Search completed: '{req.query[:50]}...' → {len(similar_issues)} results "
            f"(duplicate={has_duplicate}) in {elapsed_ms}ms"
        )

        return response_data

    except Exception as e:
        logger.error(f"❌ Search error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/batch-sync")
async def batch_sync(req: BatchSyncRequest):
    """
    Bulk sync existing MongoDB complaints into Pinecone.
    Useful for initial setup or re-indexing.
    """
    try:
        collection = get_reports_collection()
        index = get_pinecone_index()

        # Fetch complaints from MongoDB
        cursor = collection.find(
            {"status": {"$nin": ["Rejected"]}},
            {
                "title": 1,
                "description": 1,
                "category": 1,
                "address": 1,
                "status": 1,
                "department": 1,
            },
        ).limit(req.limit)

        complaints = list(cursor)
        if not complaints:
            return {"success": True, "synced": 0, "message": "No complaints found to sync"}

        logger.info(f"📦 Batch syncing {len(complaints)} complaints...")

        # Build texts for batch embedding
        texts = []
        ids = []
        metadata_list = []
        for doc in complaints:
            doc_id = str(doc["_id"])
            title = doc.get("title", "")
            description = doc.get("description", "")
            category = doc.get("category", "other")
            address = doc.get("address", "")

            combined = build_embedding_text(
                text=f"{title} {description}",
                category=category,
                location=address,
            )
            texts.append(combined)
            ids.append(doc_id)
            metadata_list.append({
                "title": title[:200],
                "description": description[:500],
                "category": category,
                "address": address[:200],
                "status": doc.get("status", "Open"),
                "department": doc.get("department", "general"),
                "indexed_at": datetime.now(timezone.utc).isoformat(),
            })

        # Generate embeddings in batch
        embeddings = generate_embeddings_batch(texts)

        # Upsert in batches of 100 (Pinecone recommended)
        batch_size = 100
        total_upserted = 0
        for i in range(0, len(ids), batch_size):
            batch_vectors = [
                (ids[j], embeddings[j], metadata_list[j])
                for j in range(i, min(i + batch_size, len(ids)))
            ]
            index.upsert(vectors=batch_vectors, namespace="complaints")
            total_upserted += len(batch_vectors)
            logger.info(f"  ↳ Upserted batch {i // batch_size + 1}: {len(batch_vectors)} vectors")

        # Clear cache after bulk sync
        _search_cache.clear()

        logger.info(f"✅ Batch sync complete: {total_upserted} complaints indexed")
        return {
            "success": True,
            "synced": total_upserted,
            "message": f"Successfully synced {total_upserted} complaints into Pinecone",
        }

    except Exception as e:
        logger.error(f"❌ Batch sync error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ─── Run ─────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8004))
    uvicorn.run(app, host="0.0.0.0", port=port)
