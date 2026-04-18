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

    # 6. Authenticity & Fairness Rule
    # We only trigger the "Inauthentic" strike loop if the text category is something
    # the AI is actually trained to detect (Pothole, Garbage, Streetlight).
    # This prevents unfair strikes for valid issues (like "Water Leakage") that YOLO can't see yet.
    SUPPORTED_AI_CLASSES = ["pothole", "garbage", "streetlight"]
    
    if text_category in SUPPORTED_AI_CLASSES:
        # If it's a supported class, we expect the AI to see SOMETHING.
        # If it sees nothing, it's flagged as potentially inauthentic (fraud).
        is_authentic = len(detected_tags) > 0
    else:
        # If it's an unsupported class, we mark it as authentic to avoid an unfair strike.
        # It will still fail is_ai_verified and go to manual admin review.
        is_authentic = True

    return {
        "imageCategory": image_category,
        "textCategory": text_category,
        "isAIVerified": is_ai_verified,
        "visionSeverityScore": severity_score,
        "isImageAuthentic": is_authentic, 
        "detectedObjects": detected_tags,
        "hasMultipleObjects": len(detected_tags) > 1,
        "textEmbedding": text_embedding,
        "imageEmbedding": image_embedding,
        "annotatedImageUrl": cat_results.get("annotatedImageUrl")
    }

@app.post("/api/text/embed")
async def embed_text(request: VisionAnalysisRequest):
    """
    Generates a semantic fingerprint for duplicate detection.
    """
    embedding = get_text_embedding(request.description)
    return {"embedding": embedding}

from services.validation import validate_work_resolution
from services.intelligence import check_civic_relevance

@app.post("/api/vision/validate")
async def validate_work(request: WorkValidationRequest):
    """
    Validates officer work by comparing before and after images via Siamese Networks.
    Implementing Inauthentic Content detection (Cats/Dogs/Memes).
    """
    # 1. Location Match (CLIP Semantic Similarity)
    print(f"🔄 Starting Zero-Touch Validation for {request.originalClass}...")
    val_status = validate_work_resolution(request.beforeImageUrl, request.afterImageUrl)
    sim_score = val_status["similarityScore"]
    
    # 2. Duplicate Photo Check (Dual-Gate Fraud Detection)
    # Gate 1: CLIP Semantic Identity (>0.98)
    # Gate 2: Strict Pixel Identity (MSE Grid Match)
    is_pixel_duplicate = val_status.get("isStrictDuplicate", False)
    print(f"🕵️ [AI ENGINE] Duplicity Check: CLIP={sim_score:.4f}, PixelMatch={is_pixel_duplicate}")

    if sim_score > 0.98 or is_pixel_duplicate:
        print("🚨 FRAUD DETECTED: Officer uploaded a duplicate or near-identical photo!")
        val_status["officerValidationPass"] = False
        val_status["status"] = "AI Fraud Alert: Duplicate Photo Uploaded"
        return val_status

    # 3. Authenticity Check (Civic Relevance)
    # If similarity is very low, check if it's even a civic issue (e.g. not a cat/dog)
    is_authentic = True
    if sim_score < 0.45:
        print(f"🧐 Low similarity ({sim_score}). Running Civic Relevance Audit...")
        is_authentic = check_civic_relevance(request.afterImageUrl, request.originalClass)
        if not is_authentic:
            print("🚨 INAUTHENTIC CONTENT: Image unrelated to civic infrastructure detected!")
            val_status["officerValidationPass"] = False
            val_status["isInauthentic"] = True
            val_status["status"] = "AI Security Alert: Inauthentic Content Detected"
            return val_status

    # 4. Issue Removal Audit (YOLO Scan on After Photo)
    print(f"📍 Location Similarity: {sim_score}. Auditing {request.originalClass} removal via YOLOv8...")
    after_cat = detect_objects_yolo(request.afterImageUrl, text_hint=request.originalClass.lower())
    target = request.originalClass.lower()
    is_still_there = any(target in tag.lower() for tag in after_cat.get("tags", []))
    
    # 5. THE ZERO-TOUCH CONSENSUS LOGIC
    # Rule A: High Similarity (0.55+) -> Auto Pass
    if sim_score >= 0.55:
        if is_still_there:
            val_status["officerValidationPass"] = False
            val_status["status"] = f"Incomplete Fix: {target.capitalize()} still detected at location."
        else:
            val_status["officerValidationPass"] = True
            val_status["status"] = "AI Auto-Approved: Verified Location + Issue Removed."
            
    # Rule B: Borderline Similarity (0.40 - 0.55) + SUCCESSFUL AUDIT -> Auto Pass
    elif sim_score >= 0.40 and not is_still_there:
        val_status["officerValidationPass"] = True
        val_status["status"] = "AI Consensus Pass: Context match confirmed + Issue Removed."
        
    # Rule C: Low Similarity or Audit Fail -> Flag for Admin
    else:
        val_status["officerValidationPass"] = False
        if is_still_there:
            val_status["status"] = f"Action Required: {target.capitalize()} still visible in proof."
        else:
            val_status["status"] = "Manual Review: Low Location Similarity."
    
    print(f"📊 Final Consensus: Passed={val_status['officerValidationPass']}, Status='{val_status['status']}'")
    return val_status
    
    return val_status

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
