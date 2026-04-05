from fastapi import FastAPI
from pydantic import BaseModel
import uvicorn

app = FastAPI(title="CIVIC Vision Engine API", version="1.0.0")

class VisionAnalysisRequest(BaseModel):
    imageUrl: str
    description: str = ""

class WorkValidationRequest(BaseModel):
    beforeImageUrl: str
    afterImageUrl: str
    originalClass: str = "pothole" # <-- NEW: The category reported by the citizen

@app.get("/")
def read_root():
    return {"status": "Vision Engine is running", "module": "Module 2"}

from services.categorization import detect_objects_yolo
from services.severity import estimate_severity
from services.intelligence import predict_text_category, get_text_embedding, get_image_embedding

@app.post("/api/vision/analyze")
async def analyze_image(request: VisionAnalysisRequest):
    """
    Automated Category Mapping (Module 1 + 2 Consensus) + Multimodal Embedding
    """
    # 1. Text-Based Categorization (CLIP Zero-Shot) - STEP 1 (Context Priming)
    text_category = predict_text_category(request.description)

    # 2. Image-Based Categorization (YOLO) - STEP 2 (Context-Aware Detection)
    # The 'text_category' hint tells YOLO whether to be Strict (Pothole) or Sensitive (Garbage).
    cat_results = detect_objects_yolo(request.imageUrl, text_hint=text_category)
    detected_tags = cat_results["tags"]
    
    # Identify the primary image-predicted category
    image_category = detected_tags[0] if detected_tags else "other"
    
    # 3. CONSENSUS CHECK (The Zero-Touch Logic)
    is_ai_verified = (image_category == text_category)
    
    # 4. Severity Estimation (Based on Image Brain)
    severity_score = estimate_severity(
        request.imageUrl, 
        area_ratio=cat_results["total_area_ratio"],
        detected_class=image_category
    )
    
    # 5. Multimodal Fingerprinting (For Duplicate Detection)
    text_embedding = get_text_embedding(request.description)
    image_embedding = get_image_embedding(request.imageUrl)

    # 6. Authenticity Rule
    is_authentic = len(detected_tags) > 0

    return {
        "imageCategory": image_category,
        "textCategory": text_category,
        "isAIVerified": is_ai_verified,
        "visionSeverityScore": severity_score,
        "isImageAuthentic": is_authentic and is_ai_verified,
        "detectedObjects": detected_tags,
        "hasMultipleObjects": len(detected_tags) > 1,
        "textEmbedding": text_embedding,
        "imageEmbedding": image_embedding
    }

@app.post("/api/text/embed")
async def embed_text(request: VisionAnalysisRequest):
    """
    Generates a semantic fingerprint for duplicate detection.
    """
    embedding = get_text_embedding(request.description)
    return {"embedding": embedding}

from services.validation import validate_work_resolution

@app.post("/api/vision/validate")
async def validate_work(request: WorkValidationRequest):
    """
    Validates officer work by comparing before and after images via Siamese Networks.
    Performs a secondary YOLO check to ensure the problem was actually removed.
    """
    # 1. Location Match (Siamese Similarity)
    val_status = validate_work_resolution(request.beforeImageUrl, request.afterImageUrl)
    
    # 2. Duplicate Photo Check (Extreme Similarity Fraud)
    if val_status["similarityScore"] > 0.98:
        print("🚨 FRAUD DETECTED: Officer uploaded a duplicate photo!")
        val_status["officerValidationPass"] = False
        val_status["status"] = "Issue Not Resolved (Duplicate Photo Uploaded)"

    # 3. Issue Removal Audit (YOLO Scan on After Photo)
    elif val_status["officerValidationPass"]:
        print(f"📍 Location Match Success. Auditing {request.originalClass} removal...")
        after_cat = detect_objects_yolo(request.afterImageUrl)
        
        # Check if the original problem is STILL visible in the "After" photo
        target = request.originalClass.lower()
        is_still_there = any(target in tag.lower() for tag in after_cat["tags"])
        
        if is_still_there:
            print(f"⚠️ AUDIT FAIL: {target} still detected in after photo!")
            val_status["officerValidationPass"] = False
            val_status["status"] = f"Incomplete Fix: {target.capitalize()} still detected at location."
    
    return val_status

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
