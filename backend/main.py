"""
TrafficAI – FastAPI Backend
Production-grade API server for multimodal incident analysis via Gemini 2.0 Flash.
Runs on Cloud Run. Handles: input validation, GCS upload, Gemini call, Firestore write, Pub/Sub publish.
"""

import os
import re
import time
import uuid
import json
import hashlib
import logging
from datetime import datetime, timezone
from typing import Optional, List

import magic                        # python-magic for MIME sniffing
import bleach                       # text sanitization
import vertexai                     # Vertex AI SDK
from fastapi import (
    FastAPI, File, Form, UploadFile, HTTPException, Request, Depends, status
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from firebase_admin import auth as firebase_auth, credentials, initialize_app, firestore
from google.cloud import pubsub_v1, storage
from google.cloud.firestore import SERVER_TIMESTAMP
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from vertexai.generative_models import GenerativeModel, Part

# ── App setup ──────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("trafficai")

limiter = Limiter(key_func=get_remote_address)
app = FastAPI(
    title="TrafficAI API",
    description="Gemini-powered real-time traffic incident analysis",
    version="1.0.0",
    docs_url="/api/docs"
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── CORS (restrict to known origins in production) ─────────────────────────
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "https://mineral-liberty-490805-r0.uc.r.appspot.com").split(",")
app.add_middleware(CORSMiddleware, allow_origins=ALLOWED_ORIGINS,
                   allow_methods=["GET", "POST", "PATCH"], allow_headers=["Authorization", "Content-Type"])
app.add_middleware(TrustedHostMiddleware, allowed_hosts=["*"])  # Restrict in prod via Cloud Armor

# ── Firebase Admin SDK ─────────────────────────────────────────────────────
try:
    cred = credentials.ApplicationDefault()  # Uses Workload Identity Federation on Cloud Run
    initialize_app(cred, {"projectId": os.getenv("GCP_PROJECT", "mineral-liberty-490805-r0")})
    db = firestore.client()
    logger.info("Firebase Admin SDK initialized")
except Exception as e:
    logger.warning(f"Firebase Admin init failed (demo mode): {e}")
    db = None

# ── Google Cloud clients ───────────────────────────────────────────────────
PROJECT_ID  = os.getenv("GCP_PROJECT", "mineral-liberty-490805-r0")
BUCKET_NAME = os.getenv("GCS_BUCKET", f"{PROJECT_ID}-incidents")
gcs_client  = storage.Client()
ps_client   = pubsub_v1.PublisherClient()

# ── Vertex AI / Gemini ─────────────────────────────────────────────────────
vertexai.init(project=PROJECT_ID, location="us-central1")
gemini_model = GenerativeModel("gemini-2.0-flash-001")

# ── Constants ──────────────────────────────────────────────────────────────
ALLOWED_MIMES  = {"image/jpeg","image/png","image/webp","video/mp4","video/quicktime","video/webm",
                  "audio/wav","audio/mpeg","audio/ogg","audio/webm"}
MAX_FILE_MB    = 100
GEMINI_TIMEOUT = 30  # seconds
ROLES_REQUIRED = {"authority", "admin"}

PII_PATTERNS = [
    r"\b\d{3}-\d{2}-\d{4}\b",
    r"\b[A-Z]{2}\d{6,9}\b",
    r"\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b",
    r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b",
    r"\b\d{10}\b"
]


# ── Helpers ────────────────────────────────────────────────────────────────

def anonymize_reporter(request: Request) -> str:
    raw = request.client.host + request.headers.get("user-agent", "")
    return "sha256:" + hashlib.sha256(raw.encode()).hexdigest()[:16]


def strip_pii(text: str) -> str:
    for pattern in PII_PATTERNS:
        text = re.sub(pattern, "[REDACTED]", text, flags=re.IGNORECASE)
    return bleach.clean(text, tags=[], strip=True)


def validate_file(file: UploadFile, content: bytes) -> None:
    size_mb = len(content) / (1024 ** 2)
    if size_mb > MAX_FILE_MB:
        raise HTTPException(400, f"File '{file.filename}' exceeds {MAX_FILE_MB}MB limit ({size_mb:.1f}MB)")
    detected = magic.from_buffer(content, mime=True)
    if detected not in ALLOWED_MIMES:
        raise HTTPException(400, f"File '{file.filename}' has unsupported type: {detected}")


async def upload_to_gcs(content: bytes, filename: str, incident_id: str, mime: str) -> str:
    bucket = gcs_client.bucket(BUCKET_NAME)
    date   = datetime.now(timezone.utc).strftime("%Y/%m/%d")
    path   = f"incidents/{date}/{incident_id}/{filename}"
    blob   = bucket.blob(path)
    blob.upload_from_string(content, content_type=mime)
    return f"gs://{BUCKET_NAME}/{path}"


def verify_firebase_token(request: Request) -> dict:
    token = request.headers.get("Authorization", "").removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Authentication required")
    try:
        decoded = firebase_auth.verify_id_token(token, check_revoked=True)
        return decoded
    except Exception as e:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, f"Invalid token: {e}")


def require_role(minimum: set = ROLES_REQUIRED):
    def dep(request: Request):
        claims = verify_firebase_token(request)
        role   = claims.get("role", "citizen")
        if role not in minimum and role != "admin":
            raise HTTPException(status.HTTP_403_FORBIDDEN, f"Requires role: {minimum}")
        return claims
    return dep


GEMINI_PROMPT = """
You are TrafficAI, an expert traffic incident analyst. Analyze the provided content
(images, video frames, audio transcripts, text reports) and return ONLY valid JSON matching:

{
  "incident_type": "accident|congestion|hazard|emergency|stalled_vehicle|weather|unknown",
  "severity": "low|medium|high|critical",
  "confidence": 0.0-1.0,
  "title": "short 6-word max title",
  "description": "2-3 sentence factual summary for authorities",
  "location_extracted": "address or landmark if mentioned, else null",
  "details": {
    "vehicle_count": null,
    "injury_likelihood": "none|low|high|unknown",
    "lanes_blocked": 0,
    "debris_detected": false,
    "emergency_vehicle_present": false,
    "estimated_clearance_time": "unknown"
  },
  "confidence_breakdown": { "visual": 0.0, "text": 0.0, "overall": 0.0 },
  "recommended_actions": [],
  "escalation_required": false,
  "escalation_reason": null,
  "input_quality": "clear|degraded|insufficient"
}

RULES:
- Do not include any personal identifying information.
- Emergency vehicles (ambulance/fire/police) → severity MUST be critical.
- If input is insufficient → set input_quality=insufficient, reduce confidence below 0.5.
- Output ONLY valid JSON. No markdown, no code fences, no explanations.
"""


async def call_gemini(parts: List, text: str = "") -> dict:
    prompt_parts = [GEMINI_PROMPT]
    if text:
        prompt_parts.append(f"Text report: {text}")
    prompt_parts.extend(parts)
    try:
        start    = time.time()
        response = gemini_model.generate_content(prompt_parts, generation_config={"max_output_tokens": 1024})
        elapsed  = round((time.time() - start) * 1000)
        raw      = response.text.strip()
        # Strip markdown code fences if present
        if raw.startswith("```"):
            raw = "\n".join(raw.split("\n")[1:-1])
        result   = json.loads(raw)
        result["processing_ms"] = elapsed
        return result
    except json.JSONDecodeError:
        return {"error": "parse_failed", "severity": "unknown", "confidence": 0.0, "input_quality": "insufficient"}
    except Exception as e:
        logger.error(f"Gemini error: {e}")
        return {"error": str(e), "severity": "unknown", "confidence": 0.0}


def publish_event(topic: str, incident_id: str, data: dict) -> None:
    try:
        topic_path = ps_client.topic_path(PROJECT_ID, topic)
        payload    = json.dumps({"incident_id": incident_id, **data}).encode()
        ps_client.publish(topic_path, payload)
    except Exception as e:
        logger.warning(f"Pub/Sub publish failed ({topic}): {e}")


# ── Routes ─────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "service": "trafficai-api", "version": "1.0.0",
            "timestamp": datetime.now(timezone.utc).isoformat()}


@app.post("/api/incidents/analyze")
@limiter.limit("10/hour")
async def analyze_incident(
    request: Request,
    files:    List[UploadFile] = File(default=[]),
    text:     str              = Form(default=""),
    location: str              = Form(default=""),
    severity: str              = Form(default="medium")
):
    incident_id = f"INC-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
    logger.info(f"Analyzing incident {incident_id}")

    # ── Input validation ───────────────────────────────────────────────────
    if not files and len(text.strip()) < 10:
        raise HTTPException(400, "Please provide at least one file or a text description (min 10 chars).")
    if severity not in ("low", "medium", "high", "critical"):
        raise HTTPException(400, "Invalid severity. Must be: low, medium, high, critical.")

    # ── Process files ─────────────────────────────────────────────────────
    gcs_refs    = []
    gemini_parts = []
    for file in files[:5]:
        content = await file.read()
        validate_file(file, content)
        detected_mime = magic.from_buffer(content, mime=True)
        gcs_ref = await upload_to_gcs(content, file.filename, incident_id, detected_mime)
        gcs_refs.append(gcs_ref)
        gemini_parts.append(Part.from_data(data=content, mime_type=detected_mime))

    # ── Sanitize text ─────────────────────────────────────────────────────
    clean_text = strip_pii(text)

    # ── Gemini analysis ───────────────────────────────────────────────────
    ai_result = await call_gemini(gemini_parts, clean_text)

    # ── Build incident document ───────────────────────────────────────────
    incident = {
        "id":             incident_id,
        "schema_version": "1.0",
        "created_at":     SERVER_TIMESTAMP,
        "status":         "active" if ai_result.get("severity") in ("critical", "high") else "monitoring",
        "input": {
            "types":        [f.content_type for f in files] + (["text"] if clean_text else []),
            "storage_refs": gcs_refs,
            "text":         clean_text,
            "severity_user": severity
        },
        "ai_analysis":  ai_result,
        "location": { "address": location or ai_result.get("location_extracted", ""), "geocoding_pending": True },
        "actions":      ai_result.get("recommended_actions", []),
        "escalation":   {"required": ai_result.get("escalation_required", False),
                         "reason": ai_result.get("escalation_reason")},
        "reporter_id_hash": anonymize_reporter(request),
        "privacy_cleared":  True
    }

    # ── Write to Firestore ────────────────────────────────────────────────
    if db:
        db.collection("incidents").document(incident_id).set(incident)

    # ── Publish events ────────────────────────────────────────────────────
    publish_event("incident-created", incident_id,
                  {"severity": ai_result.get("severity"), "confidence": ai_result.get("confidence", 0)})
    if ai_result.get("escalation_required"):
        publish_event("authority-alerts", incident_id,
                      {"severity": ai_result.get("severity"), "reason": ai_result.get("escalation_reason")})
    if ai_result.get("details", {}).get("emergency_vehicle_present"):
        publish_event("ev-corridor-request", incident_id,
                      {"location": location or ai_result.get("location_extracted", "")})

    logger.info(f"Incident {incident_id} processed: severity={ai_result.get('severity')}, confidence={ai_result.get('confidence')}")
    return JSONResponse(status_code=201, content={
        "incident_id":      incident_id,
        "severity":         ai_result.get("severity", "unknown"),
        "confidence":       ai_result.get("confidence", 0),
        "title":            ai_result.get("title", "Incident reported"),
        "actions":          ai_result.get("recommended_actions", []),
        "escalated":        ai_result.get("escalation_required", False),
        "structured_json":  ai_result
    })


@app.get("/api/incidents")
async def list_incidents(
    severity: Optional[str] = None,
    status:   Optional[str] = None,
    limit:    int           = 20
):
    if not db:
        return {"incidents": [], "note": "Firestore not available in demo mode"}
    query = db.collection("incidents").order_by("created_at", direction="DESCENDING").limit(min(limit, 100))
    if severity: query = query.where("ai_analysis.severity", "==", severity)
    if status:   query = query.where("status", "==", status)
    docs = query.stream()
    return {"incidents": [d.to_dict() | {"id": d.id} for d in docs]}


@app.patch("/api/incidents/{incident_id}/status")
async def update_status(
    incident_id: str,
    request: Request,
    claims: dict = Depends(require_role({"authority", "admin", "responder"}))
):
    body = await request.json()
    new_status = body.get("status")
    if new_status not in ("active", "monitoring", "resolved", "false_alarm"):
        raise HTTPException(400, "Invalid status value")
    if db:
        db.collection("incidents").document(incident_id).update({
            "status":     new_status,
            "updated_at": SERVER_TIMESTAMP,
            "updated_by": claims.get("uid")
        })
        # Audit log
        db.collection("audit_log").add({
            "incident_id": incident_id,
            "action":      f"Status changed to {new_status}",
            "actor":       claims.get("email", "authority"),
            "timestamp":   SERVER_TIMESTAMP
        })
    publish_event("incident-resolved", incident_id, {"status": new_status})
    return {"success": True, "incident_id": incident_id, "new_status": new_status}


@app.get("/api/stats/summary")
async def stats_summary():
    if not db:
        return {"total": 12, "critical": 2, "high": 4, "avg_confidence": 0.89, "note": "demo"}
    all_docs = list(db.collection("incidents").stream())
    total    = len(all_docs)
    critical = sum(1 for d in all_docs if d.to_dict().get("ai_analysis", {}).get("severity") == "critical")
    high     = sum(1 for d in all_docs if d.to_dict().get("ai_analysis", {}).get("severity") == "high")
    confs    = [d.to_dict().get("ai_analysis", {}).get("confidence", 0) for d in all_docs]
    avg_conf = round(sum(confs) / max(len(confs), 1), 3)
    return {"total": total, "critical": critical, "high": high, "avg_confidence": avg_conf}
