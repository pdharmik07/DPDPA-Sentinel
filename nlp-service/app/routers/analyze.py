"""The /analyze endpoint.

Returns per-rule, per-sentence semantic signals. It never returns a compliance
verdict — see app/models/schemas.py for why that boundary is enforced in the
response model itself.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, status

from ..models.schemas import AnalyzeRequest, AnalyzeResponse, RuleSignal, SentenceSignal
from ..services import nlp

logger = logging.getLogger(__name__)
router = APIRouter()

#: Sentences below this similarity are dropped from the response — sending
#: thousands of near-zero scores back would bloat the payload for no benefit.
MIN_REPORTED_SIMILARITY = 0.35

#: Cap on how many sentences are reported per rule.
MAX_SENTENCES_PER_RULE = 12


# exclude_none keeps unset Optional fields out of the JSON entirely rather
# than emitting them as null, which is friendlier to strict clients.
@router.post("/analyze", response_model=AnalyzeResponse, response_model_exclude_none=True)
def analyze(request: AnalyzeRequest) -> AnalyzeResponse:
    if not request.sentences or not request.rules:
        return AnalyzeResponse(model=nlp.EMBEDDING_MODEL_NAME, byRule={})

    texts = [s.text for s in request.sentences]
    indices = [s.index for s in request.sentences]

    sentence_vectors = nlp.encode_sentences(texts)
    if sentence_vectors is None:
        # Embeddings are the entire point of this service. Rather than return
        # misleading zeroes, fail explicitly — the backend treats a non-OK
        # response as "NLP unavailable" and continues on deterministic rules.
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Embedding model is not available.",
        )

    negations = nlp.detect_negations(texts)

    by_rule: dict[str, RuleSignal] = {}

    for rule in request.rules:
        sims = nlp.similarity_matrix(sentence_vectors, rule.concepts)
        if sims is None:
            continue

        # Best concept match per sentence.
        per_sentence = sims.max(axis=1)

        ranked = sorted(
            (
                (float(score), position)
                for position, score in enumerate(per_sentence)
                if score >= MIN_REPORTED_SIMILARITY
            ),
            key=lambda pair: pair[0],
            reverse=True,
        )[:MAX_SENTENCES_PER_RULE]

        signals = [
            SentenceSignal(
                index=indices[position],
                similarity=round(score, 4),
                negated=bool(negations[position]),
            )
            for score, position in ranked
        ]

        by_rule[rule.ruleId] = RuleSignal(
            ruleId=rule.ruleId,
            bestSimilarity=round(float(per_sentence.max()), 4) if len(per_sentence) else 0.0,
            sentences=signals,
        )

    logger.info(
        "analysed %d sentence(s) against %d rule(s)",
        len(request.sentences),
        len(request.rules),
    )

    return AnalyzeResponse(model=nlp.EMBEDDING_MODEL_NAME, byRule=by_rule)
