"""
embedding.py — Multilingual Embedding Engine
Uses sentence-transformers (paraphrase-multilingual-MiniLM-L12-v2)
to generate 384-dim normalized embeddings for civic complaints.
Supports: English, Hindi, Marathi, Gujarati, Hinglish
"""

import numpy as np
from sentence_transformers import SentenceTransformer
import logging

logger = logging.getLogger(__name__)

# ─── Singleton Model Loader ─────────────────────────────────────────────

_model = None

def get_model() -> SentenceTransformer:
    """Lazy-load the multilingual sentence transformer model (cached)."""
    global _model
    if _model is None:
        logger.info("📦 Loading multilingual embedding model...")
        _model = SentenceTransformer("paraphrase-multilingual-MiniLM-L12-v2")
        logger.info("✅ Embedding model loaded successfully (384-dim)")
    return _model


# ─── Core Embedding Functions ───────────────────────────────────────────

def build_embedding_text(text: str, category: str = "", location: str = "") -> str:
    """
    Combines complaint fields into a single string for embedding.
    Format: "{text} | category: {category} | location: {location}"
    """
    parts = [text.strip()]
    if category:
        parts.append(f"category: {category.strip()}")
    if location:
        parts.append(f"location: {location.strip()}")
    return " | ".join(parts)


def generate_embedding(text: str) -> list[float]:
    """
    Generate a single normalized embedding vector from text.
    Returns a list of 384 floats.
    """
    model = get_model()
    embedding = model.encode(text, normalize_embeddings=True)
    return embedding.tolist()


def generate_embeddings_batch(texts: list[str]) -> list[list[float]]:
    """
    Generate normalized embeddings for a batch of texts.
    Efficient for bulk upsert operations.
    """
    model = get_model()
    embeddings = model.encode(texts, normalize_embeddings=True, batch_size=32, show_progress_bar=True)
    return embeddings.tolist()
