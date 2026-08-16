"""Semantic and linguistic analysis.

Two independent signals are produced per sentence:

* **Semantic similarity** — sentence-transformers cosine similarity against the
  natural-language concepts attached to each rule. This is what lets
  "users may revoke permission from account settings" be recognised as related
  to the concept "withdraw consent" even though it shares almost no vocabulary.

* **Negation** — spaCy dependency-parse scope detection. The Node backend runs
  its own cue-list negation detection independently; where the two disagree the
  backend lowers confidence rather than flipping a verdict.

Models are loaded lazily and cached, so the first request pays the cost and the
process stays cheap to start.
"""

from __future__ import annotations

import logging
import threading
from functools import lru_cache

import numpy as np

logger = logging.getLogger(__name__)

EMBEDDING_MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
SPACY_MODEL_NAME = "en_core_web_sm"

_lock = threading.Lock()
_embedder = None
_spacy_nlp = None
_embedder_failed = False
_spacy_failed = False


def get_embedder():
    """Loads the sentence-transformer once. Returns None if unavailable."""
    global _embedder, _embedder_failed
    if _embedder is not None or _embedder_failed:
        return _embedder
    with _lock:
        if _embedder is None and not _embedder_failed:
            try:
                from sentence_transformers import SentenceTransformer

                logger.info("loading embedding model %s", EMBEDDING_MODEL_NAME)
                _embedder = SentenceTransformer(EMBEDDING_MODEL_NAME)
                logger.info("embedding model ready")
            except Exception:  # noqa: BLE001 - any failure means "run without it"
                logger.exception("embedding model unavailable")
                _embedder_failed = True
    return _embedder


def get_spacy():
    """Loads the spaCy pipeline once. Returns None if unavailable."""
    global _spacy_nlp, _spacy_failed
    if _spacy_nlp is not None or _spacy_failed:
        return _spacy_nlp
    with _lock:
        if _spacy_nlp is None and not _spacy_failed:
            try:
                import spacy

                logger.info("loading spaCy model %s", SPACY_MODEL_NAME)
                # Only the parser is needed for negation scope; disabling NER
                # roughly halves the per-sentence cost.
                _spacy_nlp = spacy.load(SPACY_MODEL_NAME, disable=["ner", "lemmatizer"])
                logger.info("spaCy model ready")
            except Exception:  # noqa: BLE001
                logger.exception("spaCy model unavailable")
                _spacy_failed = True
    return _spacy_nlp


@lru_cache(maxsize=2048)
def _encode_concept(concept: str) -> tuple[float, ...]:
    """Concept embeddings are stable across requests, so they are cached."""
    embedder = get_embedder()
    if embedder is None:
        return ()
    vector = embedder.encode([concept], normalize_embeddings=True)[0]
    return tuple(float(x) for x in vector)


def encode_sentences(texts: list[str]) -> np.ndarray | None:
    embedder = get_embedder()
    if embedder is None or not texts:
        return None
    return embedder.encode(
        texts,
        normalize_embeddings=True,
        batch_size=64,
        show_progress_bar=False,
    )


def concept_matrix(concepts: list[str]) -> np.ndarray | None:
    vectors = [_encode_concept(c) for c in concepts]
    vectors = [v for v in vectors if v]
    if not vectors:
        return None
    return np.array(vectors, dtype=np.float32)


def similarity_matrix(sentence_vectors: np.ndarray, concepts: list[str]) -> np.ndarray | None:
    """Cosine similarity of every sentence against every concept.

    Both sides are L2-normalised at encode time, so the dot product *is* the
    cosine. Values are clamped to [0, 1]: cosine can be slightly negative for
    unrelated text, and a negative "similarity" is not meaningful downstream.
    """
    concepts_matrix = concept_matrix(concepts)
    if concepts_matrix is None or sentence_vectors is None:
        return None
    sims = sentence_vectors @ concepts_matrix.T
    return np.clip(sims, 0.0, 1.0)


def detect_negations(texts: list[str]) -> list[bool]:
    """Dependency-parse negation detection, one flag per sentence."""
    nlp = get_spacy()
    if nlp is None:
        return [False] * len(texts)

    flags: list[bool] = []
    for doc in nlp.pipe(texts, batch_size=64):
        flags.append(any(token.dep_ == "neg" for token in doc))
    return flags


def lemmas_for(texts: list[str]) -> list[list[str]]:
    nlp = get_spacy()
    if nlp is None:
        return [[] for _ in texts]
    out: list[list[str]] = []
    for doc in nlp.pipe(texts, batch_size=64):
        out.append([t.lemma_.lower() for t in doc if not t.is_stop and not t.is_punct])
    return out


def status() -> dict[str, object]:
    return {
        "model": EMBEDDING_MODEL_NAME if _embedder is not None else None,
        "embeddings": _embedder is not None,
        "spacy": _spacy_nlp is not None,
    }
