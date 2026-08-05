"""Worker Edge TTS untuk Apollonians Read - gratis, cepat, 24/7."""
from __future__ import annotations
import asyncio, io, queue, threading, time, uuid
import httpx
from fastapi import FastAPI, Header, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import edge_tts

SUPABASE_URL = "https://mvjcoumfhtrntcxfpuda.supabase.co"
SUPABASE_PUBLISHABLE_KEY = "sb_publishable_jsysknMPAi5adKSDidbxkw_OKL0GygW"
ALLOWED_ORIGINS = ["https://revisispace.github.io"]
JOB_TTL = 15 * 60

VOICE_MAP = {
    "Ryan": "en-US-GuyNeural", "Guy": "en-US-GuyNeural", "Davis": "en-US-DavisNeural",
    "Jenny": "en-US-JennyNeural", "Aria": "en-US-AriaNeural",
    "Serena": "en-US-AriaNeural", "Vivian": "en-US-JennyNeural",
}

app = FastAPI(title="Apollonians Edge TTS", docs_url=None, redoc_url=None)
app.add_middleware(CORSMiddleware, allow_origins=ALLOWED_ORIGINS, allow_credentials=False,
                   allow_methods=["GET", "POST"], allow_headers=["*"])

jobs = {}
jobs_lock = threading.Lock()
work_queue = queue.Queue()

class TtsRequest(BaseModel):
    text: str = Field(min_length=1, max_length=5000)
    book_id: str | None = None
    language: str = "English"
    speaker: str = "Ryan"

def supabase_call(path, token, payload=None):
    headers = {"apikey": SUPABASE_PUBLISHABLE_KEY, "Authorization": f"Bearer {token}"}
    with httpx.Client(timeout=30) as client:
        if payload is None:
            return client.get(f"{SUPABASE_URL}{path}", headers=headers)
        return client.post(f"{SUPABASE_URL}{path}", headers={**headers, "Content-Type": "application/json"}, json=payload)

def require_token(authorization):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Login diperlukan.")
    return authorization.removeprefix("Bearer ").strip()

def generate_edge(text, speaker):
    voice = VOICE_MAP.get(speaker, "en-US-GuyNeural")
    async def run():
        communicate = edge_tts.Communicate(text, voice)
        buf = io.BytesIO()
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                buf.write(chunk["data"])
        return buf.getvalue()
    return asyncio.run(run())

def worker_loop():
    while True:
        job_id = work_queue.get()
        with jobs_lock: job = jobs.get(job_id)
        if job is None: continue
        succeeded = False
        try:
            with jobs_lock: job["status"] = "processing"
            audio = generate_edge(job["text"], job["speaker"])
            with jobs_lock: job["audio"] = audio; job["status"] = "done"
            succeeded = True
        except Exception as exc:
            with jobs_lock: job["status"] = "failed"; job["error"] = str(exc)
        finally:
            supabase_call("/rest/v1/rpc/finish_generation", job["token"],
                          {"event_id": job["event_id"], "succeeded": succeeded})

def sweep_loop():
    while True:
        time.sleep(120); now = time.time()
        with jobs_lock:
            for k in [k for k, v in jobs.items() if now - v["created_at"] > JOB_TTL and v["status"] in ("done", "failed")]:
                del jobs[k]

threading.Thread(target=worker_loop, daemon=True).start()
threading.Thread(target=sweep_loop, daemon=True).start()

@app.get("/")
def root(): return {"ok": True, "engine": "edge-tts", "loaded": True}

@app.get("/health")
def health(): return {"ok": True, "engine": "edge-tts", "loaded": True}

@app.post("/v1/tts")
def tts(request: TtsRequest, authorization: str | None = Header(default=None)):
    token = require_token(authorization)
    if supabase_call("/auth/v1/user", token).status_code != 200:
        raise HTTPException(status_code=401, detail="Sesi tidak valid atau kedaluwarsa.")
    r = supabase_call("/rest/v1/rpc/reserve_generation", token,
                      {"requested_characters": len(request.text), "requested_engine": "qwen", "requested_book_id": request.book_id})
    if r.status_code >= 300:
        raise HTTPException(status_code=429, detail=r.json().get("message", "Kuota tidak tersedia."))
    job_id = uuid.uuid4().hex
    with jobs_lock:
        jobs[job_id] = {"status": "queued", "text": request.text, "speaker": request.speaker,
                        "token": token, "event_id": r.json(), "created_at": time.time()}
    work_queue.put(job_id)
    return {"job_id": job_id}

@app.get("/v1/tts/{job_id}/status")
def status(job_id: str, authorization: str | None = Header(default=None)):
    token = require_token(authorization)
    with jobs_lock: job = jobs.get(job_id)
    if job is None or job["token"] != token:
        raise HTTPException(status_code=404, detail="Job tidak ditemukan.")
    return {"status": job["status"], "error": job.get("error"), "model_loaded": True}

@app.get("/v1/tts/{job_id}/audio")
def audio(job_id: str, authorization: str | None = Header(default=None)):
    token = require_token(authorization)
    with jobs_lock: job = jobs.get(job_id)
    if job is None or job["token"] != token:
        raise HTTPException(status_code=404, detail="Job tidak ditemukan.")
    if job["status"] != "done":
        raise HTTPException(status_code=409, detail="Audio belum siap.")
    with jobs_lock:
        data = job.pop("audio", b""); jobs.pop(job_id, None)
    return Response(content=data, media_type="audio/mpeg")