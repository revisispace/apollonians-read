"""Worker Qwen3-TTS privat untuk Apollonians Read.

Token pengguna diverifikasi ke Supabase. Setiap permintaan melakukan reservasi
kuota secara atomik sebelum inferensi dan menutup event sebagai selesai/gagal.
Tidak ada service-role key yang diperlukan oleh worker ini.
"""

from __future__ import annotations

import io
import os
from typing import Literal

import httpx
import soundfile as sf
import torch
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from qwen_tts import Qwen3TTSModel

SUPABASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
SUPABASE_PUBLISHABLE_KEY = os.environ["SUPABASE_PUBLISHABLE_KEY"]
MODEL_ID = os.getenv("QWEN_MODEL", "Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice")
DEVICE = os.getenv("QWEN_DEVICE", "cuda:0" if torch.cuda.is_available() else "cpu")
ALLOWED_ORIGINS = [item.strip() for item in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",") if item.strip()]

app = FastAPI(title="Apollonians Qwen TTS", docs_url=None, redoc_url=None)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)

model: Qwen3TTSModel | None = None


class TtsRequest(BaseModel):
    text: str = Field(min_length=1, max_length=1200)
    book_id: str | None = None
    language: str = "Auto"
    speaker: Literal["Serena", "Vivian", "Ryan", "Aiden"] = "Ryan"


def get_model() -> Qwen3TTSModel:
    global model
    if model is None:
        dtype = torch.bfloat16 if DEVICE.startswith("cuda") else torch.float32
        model = Qwen3TTSModel.from_pretrained(MODEL_ID, device_map=DEVICE, dtype=dtype)
    return model


def bearer_token(authorization: str | None) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Login diperlukan.")
    return authorization.removeprefix("Bearer ").strip()


async def supabase_call(path: str, token: str, payload: dict | None = None) -> httpx.Response:
    headers = {"apikey": SUPABASE_PUBLISHABLE_KEY, "Authorization": f"Bearer {token}"}
    async with httpx.AsyncClient(timeout=20) as client:
        if payload is None:
            return await client.get(f"{SUPABASE_URL}{path}", headers=headers)
        return await client.post(f"{SUPABASE_URL}{path}", headers={**headers, "Content-Type": "application/json"}, json=payload)


@app.get("/health")
async def health() -> dict:
    return {"ok": True, "model": MODEL_ID, "loaded": model is not None}


@app.post("/v1/tts")
async def tts(request: TtsRequest, authorization: str | None = Header(default=None)):
    token = bearer_token(authorization)
    user_response = await supabase_call("/auth/v1/user", token)
    if user_response.status_code != 200:
        raise HTTPException(status_code=401, detail="Sesi tidak valid atau kedaluwarsa.")

    reserve_response = await supabase_call(
        "/rest/v1/rpc/reserve_generation",
        token,
        {"requested_characters": len(request.text), "requested_engine": "qwen", "requested_book_id": request.book_id},
    )
    if reserve_response.status_code >= 300:
        detail = reserve_response.json().get("message", "Kuota Qwen tidak tersedia.")
        raise HTTPException(status_code=429, detail=detail)
    event_id = reserve_response.json()

    succeeded = False
    try:
        wavs, sample_rate = get_model().generate_custom_voice(
            text=request.text,
            language=request.language,
            speaker=request.speaker,
        )
        output = io.BytesIO()
        sf.write(output, wavs[0], sample_rate, format="WAV")
        output.seek(0)
        succeeded = True
        from fastapi.responses import StreamingResponse
        return StreamingResponse(output, media_type="audio/wav")
    finally:
        await supabase_call(
            "/rest/v1/rpc/finish_generation",
            token,
            {"event_id": event_id, "succeeded": succeeded},
        )
