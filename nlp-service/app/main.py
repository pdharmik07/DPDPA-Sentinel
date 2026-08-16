"""DPDPA Sentinel NLP service.

Advisory semantic layer for the compliance engine. It assists the deterministic
rule engine; it never decides compliance.

Run:
    uvicorn app.main:app --reload --port 8000
"""

from __future__ import annotations

import logging
import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Load .env BEFORE any os.getenv below, or the settings this service documents
# in .env.example (LOG_LEVEL, ALLOWED_ORIGINS, NLP_WARM_START) are silently
# ignored — the file existed and was advertised, but nothing ever read it.
load_dotenv()

from .models.schemas import HealthResponse  # noqa: E402
from .routers import analyze  # noqa: E402
from .services import nlp  # noqa: E402

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)

@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    """Optionally preload models so the first scan is not slow.

    Off by default: the model download is ~90 MB and a cold `uvicorn --reload`
    should not block on it.
    """
    if os.getenv("NLP_WARM_START", "false").lower() == "true":
        logger = logging.getLogger(__name__)
        logger.info("warm start: preloading models")
        nlp.get_embedder()
        nlp.get_spacy()
    yield


app = FastAPI(
    title="DPDPA Sentinel NLP Service",
    version="1.0.0",
    lifespan=lifespan,
    description=(
        "Semantic similarity and negation signals for the DPDPA Sentinel rule engine. "
        "Returns evidence signals only — never a compliance verdict."
    ),
)

# Only the backend talks to this service; it is not browser-facing.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:4000").split(",")],
    allow_methods=["POST", "GET"],
    allow_headers=["Content-Type"],
)

app.include_router(analyze.router)


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    state = nlp.status()
    return HealthResponse(
        status="ok",
        service="dpdpa-sentinel-nlp",
        model=state["model"],
        spacy=bool(state["spacy"]),
        embeddings=bool(state["embeddings"]),
    )
