import torch
from transformers import CLIPProcessor, CLIPModel
from sentence_transformers import SentenceTransformer, util

# ---------------------------------------------------------
# Feature 1: Zero-Touch Text Classification (AI Categorizer)
# ---------------------------------------------------------

# Load models (Reusable)
print("🧠 Loading NLP Intelligence Models...")
try:
    # CLIP for Zero-Shot Classification (already used in integrity.py)
    clip_model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
    clip_processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
    
    # Sentence-BERT for Semantic Similarity
    sbert_model = SentenceTransformer('all-MiniLM-L6-v2')
    print("✅ NLP Models Ready!")
except Exception as e:
    print(f"❌ Error loading NLP models: {e}")
    clip_model = None
    sbert_model = None

CIVIC_CATEGORIES = [
    "pothole", "garbage", "streetlight", "water-logging", 
    "toilet", "water-supply", "drainage", "waste-management", "park"
]

def predict_text_category(description: str) -> str:
    """
    Uses CLIP's zero-shot text encoder to find the best matching civic category.
    """
    if clip_model is None or not description:
        return "other"
        
    try:
        # Create prompts for CLIP
        prompts = [f"A civic issue regarding {cat}" for cat in CIVIC_CATEGORIES]
        
        # Tokenize
        inputs = clip_processor(text=prompts, return_tensors="pt", padding=True)
        
        # Get text features
        with torch.no_grad():
            text_outputs = clip_model.get_text_features(**inputs)
            # Unwrap if it's a BaseModelOutput object
            text_features = text_outputs.pooler_output if hasattr(text_outputs, "pooler_output") else text_outputs
            text_features = text_features / text_features.norm(dim=-1, keepdim=True)
            
        # Get description feature
        desc_input = clip_processor(text=[description], return_tensors="pt", padding=True)
        with torch.no_grad():
            desc_outputs = clip_model.get_text_features(**desc_input)
            # Unwrap if it's a BaseModelOutput object
            desc_features = desc_outputs.pooler_output if hasattr(desc_outputs, "pooler_output") else desc_outputs
            desc_features = desc_features / desc_features.norm(dim=-1, keepdim=True)
            
        # Calculate cosine similarity
        similarities = torch.nn.functional.cosine_similarity(desc_features, text_features)
        
        # Get winning index
        best_idx = torch.argmax(similarities).item()
        return CIVIC_CATEGORIES[best_idx]
        
    except Exception as e:
        print(f"Text Classification Error: {e}")
        return "other"

# ---------------------------------------------------------
# Feature 2: Smart Duplicate Detection (Semantic Fingerprint)
# ---------------------------------------------------------

def get_text_embedding(text: str) -> list:
    """
    Generates a 384-dimensional vector embedding for the given text.
    """
    if sbert_model is None or not text:
        return []
        
    try:
        embedding = sbert_model.encode(text)
        return embedding.tolist()
    except Exception as e:
        print(f"Embedding Error: {e}")
        return []

from PIL import Image
import requests
from io import BytesIO

def get_image_embedding(image_source: str) -> list:
    """
    Generates a 512-dimensional CLIP image embedding for the given source (URL or path).
    """
    if clip_model is None or not image_source:
        return []
        
    try:
        # Load image
        if image_source.startswith("http"):
            response = requests.get(image_source)
            image = Image.open(BytesIO(response.content)).convert("RGB")
        else:
            image = Image.open(image_source).convert("RGB")
            
        # Tokenize / Process
        inputs = clip_processor(images=image, return_tensors="pt")
        
        # Get image features
        with torch.no_grad():
            image_outputs = clip_model.get_image_features(**inputs)
            # Unwrap if it's a BaseModelOutput object
            image_features = image_outputs.pooler_output if hasattr(image_outputs, "pooler_output") else image_outputs
            # Normalize
            image_features = image_features / image_features.norm(dim=-1, keepdim=True)
            
        return image_features[0].tolist()
    except Exception as e:
        print(f"Image Embedding Error: {e}")
        return []

def check_civic_relevance(image_url: str, target_category: str) -> bool:
    """
    Checks if an image actually contains civic-related content.
    Used to catch officers uploading cats, dogs, or memes.
    """
    if clip_model is None or not image_url:
        return True # Fail safe: assume relevant if model is down
        
    try:
        # Load image
        response = requests.get(image_url, timeout=5)
        image = Image.open(BytesIO(response.content)).convert("RGB")
        
        # We compare the image against 'Civic' concepts vs 'Inauthentic' concepts
        labels = [
            f"a civic issue involving {target_category}",
            "a street or road environment",
            "an animal or pet",
            "a person's face",
            "a meme or digital text",
            "unrelated indoor furniture"
        ]
        
        inputs = clip_processor(text=labels, images=image, return_tensors="pt", padding=True)
        
        with torch.no_grad():
            outputs = clip_model(**inputs)
            logits_per_image = outputs.logits_per_image
            probs = logits_per_image.softmax(dim=1)
            
        # The first two labels are 'Civic'
        civic_prob = probs[0][0].item() + probs[0][1].item()
        # The rest are 'Inauthentic'
        inauthentic_prob = sum(probs[0][2:].tolist())
        
        print(f"🕵️ Relevance Audit: Civic={civic_prob:.2f}, Inauthentic={inauthentic_prob:.2f}")
        
        # If inauthentic concepts are significantly stronger than civic ones, flag it!
        return civic_prob > inauthentic_prob
        
    except Exception as e:
        print(f"Relevance Check Error: {e}")
        return True # Fail safe
