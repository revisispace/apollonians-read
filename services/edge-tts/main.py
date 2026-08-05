"""Authenticated Edge TTS gateway for Apollonians Read.

Runs on the Oracle Free VM. The service verifies Supabase bearer tokens,
reserves character quota, processes one queued job at a time, and removes
completed audio from memory after download or expiration.
"""

from __future__ import annotations

import asyncio
import io
import os
import queue
import threading
import time
import uuid
from dataclasses import dataclass, field
from typing import Literal

import edge_tts
import httpx
from fastapi import FastAPI, Header, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

SUPABASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
SUPABASE_PUBLISHABLE_KEY = os.environ["SUPABASE_PUBLISHABLE_KEY"]
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "ALLOWED_ORIGINS",
        "https://apollonians.duckdns.org,http://localhost:3000",
    ).split(",")
    if origin.strip()
]
MAX_TEXT_LENGTH = int(os.getenv("MAX_TEXT_LENGTH", "4000"))
JOB_TTL_SECONDS = int(os.getenv("JOB_TTL_SECONDS", "900"))
PREVIEW_TEXT_LIMIT = int(os.getenv("PREVIEW_TEXT_LIMIT", "300"))

DEFAULT_VOICES = [
    {
        "id": "id-ID-ArdiNeural",
        "name": "Ardi",
        "locale": "id-ID",
        "gender": "Male",
        "label": "Ardi · Pria · Indonesia",
    },
    {
        "id": "id-ID-GadisNeural",
        "name": "Gadis",
        "locale": "id-ID",
        "gender": "Female",
        "label": "Gadis · Wanita · Indonesia",
    },
    {
        "id": "en-US-GuyNeural",
        "name": "Guy",
        "locale": "en-US",
        "gender": "Male",
        "label": "Guy · Male · English US",
    },
    {
        "id": "en-US-JennyNeural",
        "name": "Jenny",
        "locale": "en-US",
        "gender": "Female",
        "label": "Jenny · Female · English US",
    },
]
ALLOWED_VOICE_IDS = {voice["id"] for voice in DEFAULT_VOICES}

app = FastAPI(title="Apollonians Edge TTS", docs_url=None, redoc_url=None)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)


class VoiceOptions(BaseModel):
    text: str = Field(min_length=1, max_length=MAX_TEXT_LENGTH)
    voice: str = "id-ID-ArdiNeural"
    rate: int = Field(default=0, ge=-50, le=100)
    pitch: int = Field(default=0, ge=-50, le=50)
    volume: int = Field(default=0, ge=-100, le=100)


class GenerateRequest(VoiceOptions):
    book_id: str | None = None


class PreviewRequest(VoiceOptions):
    text: str = Field(
        default="Halo, ini contoh suara narator Apollonians Read.",
        min_length=1,
        max_length=PREVIEW_TEXT_LIMIT,
    )


JobStatus = Literal["queued", "processing", "done", "failed", "cancelled"]


@dataclass
class Job:
    id: str
    user_id: str
    token: str
    event_id: int
    text: str
    voice: str
    rate: int
    pitch: int
    volume: int
    created_at: float = field(default_factory=time.time)
    status: JobStatus = "queued"
    audio: bytes | None = None
    error: str | None = None
    cancelled: bool = False


jobs: dict[str, Job] = {}
jobs_lock = threading.Lock()
work_queue: queue.Queue[str] = queue.Queue()


def bearer_token(authorization: str | None) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Login diperlukan.")
    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(status_code=401, detail="Token sesi kosong.")
    return token


async def supabase_request(
    method: Literal["GET", "POST"],
    path: str,
    token: str,
    payload: dict | None = None,
) -> httpx.Response:
    headers = {
        "apikey": SUPABASE_PUBLISHABLE_KEY,
        "Authorization": f"Bearer {token}",
    }
    async with httpx.AsyncClient(timeout=25) as client:
        return await client.request(
            method,
            f"{SUPABASE_URL}{path}",
            headers={**headers, **({"Content-Type": "application/json"} if payload is not None else {})},
            json=payload,
        )


async def authenticated_user(token: str) -> str:
    response = await supabase_request("GET", "/auth/v1/user", token)
    if response.status_code != 200:
        raise HTTPException(status_code=401, detail="Sesi tidak valid atau kedaluwarsa.")
    user_id = response.json().get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Identitas pengguna tidak ditemukan.")
    return str(user_id)


async def reserve_quota(token: str, characters: int, book_id: str | None) -> int:
    response = await supabase_request(
        "POST",
        "/rest/v1/rpc/reserve_generation",
        token,
        {
            "requested_characters": characters,
            "requested_engine": "qwen",
            "requested_book_id": book_id,
        },
    )
    if response.status_code >= 300:
        try:
            detail = response.json().get("message", "Kuota Edge TTS tidak tersedia.")
        except ValueError:
            detail = "Kuota Edge TTS tidak tersedia."
        raise HTTPException(status_code=429, detail=detail)
    return int(response.json())


async def finish_quota(token: str, event_id: int, succeeded: bool) -> None:
    await supabase_request(
        "POST",
        "/rest/v1/rpc/finish_generation",
        token,
        {"event_id": event_id, "succeeded": succeeded},
    )


def signed_percent(value: int) -> str:
    return f"{value:+d}%"


def signed_hertz(value: int) -> str:
    return f"{value:+d}Hz"


async def synthesize(request: VoiceOptions) -> bytes:
    if request.voice not in ALLOWED_VOICE_IDS:
        raise ValueError("Suara tidak diizinkan.")

    communicator = edge_tts.Communicate(
        request.text,
        request.voice,
        rate=signed_percent(request.rate),
        pitch=signed_hertz(request.pitch),
        volume=signed_percent(request.volume),
    )
    output = io.BytesIO()
    async for chunk in communicator.stream():
        if chunk["type"] == "audio":
            output.write(chunk["data"])
    audio = output.getvalue()
    if not audio:
        raise RuntimeError("Edge TTS tidak menghasilkan audio.")
    return audio


def process_job(job_id: str) -> None:
    with jobs_lock:
        job = jobs.get(job_id)
        if not job or job.cancelled:
            return
        job.status = "processing"

    succeeded = False
    try:
        audio = asyncio.run(
            synthesize(
                VoiceOptions(
                    text=job.text,
                    voice=job.voice,
                    rate=job.rate,
                    pitch=job.pitch,
                    volume=job.volume,
                )
            )
        )
        with jobs_lock:
            current = jobs.get(job_id)
            if not current:
                return
            if current.cancelled:
                current.status = "cancelled"
                return
            current.audio = audio
            current.status = "done"
            succeeded = True
    except Exception as exc:
        with jobs_lock:
            current = jobs.get(job_id)
            if current:
                current.error = str(exc)
                current.status = "cancelled" if current.cancelled else "failed"
    finally:
        asyncio.run(finish_quota(job.token, job.event_id, succeeded))


def worker_loop() -> None:
    while True:
        job_id = work_queue.get()
        try:
            process_job(job_id)
        finally:
            work_queue.task_done()


def sweeper_loop() -> None:
    while True:
        time.sleep(60)
        cutoff = time.time() - JOB_TTL_SECONDS
        with jobs_lock:
            expired = [job_id for job_id, job in jobs.items() if job.created_at < cutoff]
            for job_id in expired:
                jobs.pop(job_id, None)


threading.Thread(target=worker_loop, daemon=True, name="edge-tts-worker").start()
threading.Thread(target=sweeper_loop, daemon=True, name="edge-tts-sweeper").start()


@app.get("/api/health")
async def health() -> dict:
    return {
        "ok": True,
        "engine": "edge-tts",
        "queue_depth": work_queue.qsize(),
    }


@app.get("/api/voices")
async def voices(authorization: str | None = Header(default=None)) -> dict:
    token = bearer_token(authorization)
    await authenticated_user(token)
    return {"voices": DEFAULT_VOICES}


@app.post("/api/tts/preview")
async def preview(
    request: PreviewRequest,
    authorization: str | None = Header(default=None),
) -> Response:
    token = bearer_token(authorization)
    await authenticated_user(token)
    try:
        audio = await synthesize(request)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return Response(content=audio, media_type="audio/mpeg")


@app.post("/api/tts/generate")
async def generate(
    request: GenerateRequest,
    authorization: str | None = Header(default=None),
) -> dict:
    token = bearer_token(authorization)
    user_id = await authenticated_user(token)
    if request.voice not in ALLOWED_VOICE_IDS:
        raise HTTPException(status_code=400, detail="Suara tidak diizinkan.")

    event_id = await reserve_quota(token, len(request.text), request.book_id)
    job_id = uuid.uuid4().hex
    job = Job(
        id=job_id,
        user_id=user_id,
        token=token,
        event_id=event_id,
        text=request.text,
        voice=request.voice,
        rate=request.rate,
        pitch=request.pitch,
        volume=request.volume,
    )
    with jobs_lock:
        jobs[job_id] = job
    work_queue.put(job_id)
    return {"job_id": job_id, "status": job.status}


def owned_job(job_id: str, user_id: str) -> Job:
    with jobs_lock:
        job = jobs.get(job_id)
        if not job or job.user_id != user_id:
            raise HTTPException(status_code=404, detail="Job tidak ditemukan.")
        return job


@app.get("/api/jobs/{job_id}")
async def job_status(job_id: str, authorization: str | None = Header(default=None)) -> dict:
    token = bearer_token(authorization)
    user_id = await authenticated_user(token)
    job = owned_job(job_id, user_id)
    return {"status": job.status, "error": job.error}


@app.get("/api/jobs/{job_id}/audio")
async def job_audio(job_id: str, authorization: str | None = Header(default=None)) -> Response:
    token = bearer_token(authorization)
    user_id = await authenticated_user(token)
    job = owned_job(job_id, user_id)
    if job.status != "done" or job.audio is None:
        raise HTTPException(status_code=409, detail="Audio belum siap.")

    audio = job.audio
    with jobs_lock:
        jobs.pop(job_id, None)
    return Response(content=audio, media_type="audio/mpeg")


@app.delete("/api/jobs/{job_id}")
async def cancel_job(job_id: str, authorization: str | None = Header(default=None)) -> dict:
    token = bearer_token(authorization)
    user_id = await authenticated_user(token)
    job = owned_job(job_id, user_id)
    with jobs_lock:
        job.cancelled = True
        if job.status == "queued":
            job.status = "cancelled"
    return {"status": job.status}
