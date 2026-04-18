"""
moderation.py — Semantic Vulgarity Detection
Uses a specialized XLM-RoBERTa model to detect toxicity and profanity 
across multiple languages (multilingual).
"""

import logging
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch

logger = logging.getLogger(__name__)

# ─── Model Configuration ───────────────────────────────────────────────

# This is a lightweight DistilBERT-based multilingual toxicity classifier (~500MB)
MODERATION_MODEL_NAME = "gravitee-io/distilbert-multilingual-toxicity-classifier"
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

_moderation_tokenizer = None
_moderation_model = None

# ─── Model Loader ──────────────────────────────────────────────────────

def get_moderation_model():
    """Lazy-load the moderation model and tokenizer."""
    global _moderation_tokenizer, _moderation_model
    if _moderation_model is None:
        logger.info(f"⏳ Loading semantic moderation model '{MODERATION_MODEL_NAME}' on {DEVICE}...")
        try:
            _moderation_tokenizer = AutoTokenizer.from_pretrained(MODERATION_MODEL_NAME)
            _moderation_model = AutoModelForSequenceClassification.from_pretrained(MODERATION_MODEL_NAME).to(DEVICE)
            logger.info("✅ Moderation model loaded successfully")
        except Exception as e:
            logger.error(f"❌ Failed to load moderation model: {e}")
            raise e
    return _moderation_tokenizer, _moderation_model


# ─── Scan Function ──────────────────────────────────────────────────────

def scan_vulgarity(text: str, threshold: float = 0.7) -> dict:
    """
    Scans text for toxicity/vulgarity.
    Returns: { 'is_toxic': bool, 'score': float, 'model': str }
    """
    if not text or not text.strip():
        return {"is_toxic": False, "score": 0.0, "reason": "Empty text"}

    try:
        tokenizer, model = get_moderation_model()

        # Tokenize and predict
        inputs = tokenizer(text, return_tensors="pt", truncation=True, padding=True).to(DEVICE)
        
        with torch.no_grad():
            outputs = model(**inputs)
        
        # Binary classification: index 1 is usually 'toxic'
        probabilities = torch.nn.functional.softmax(outputs.logits, dim=-1)
        toxicity_score = probabilities[0][1].item()
        
        is_toxic = toxicity_score >= threshold
        
        logger.info(f"🛡️ Moderation Scan: '{text[:40]}...' Score: {toxicity_score:.4f} (Toxic: {is_toxic})")
        
        return {
            "is_toxic": is_toxic,
            "score": round(toxicity_score, 4),
            "threshold": threshold,
            "model": MODERATION_MODEL_NAME
        }
    except Exception as e:
        logger.error(f"⚠️ Moderation scan failed: {e}")
        return {"is_toxic": False, "score": 0.0, "error": str(e)}
