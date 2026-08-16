"""Request/response contracts for the DPDPA Sentinel NLP service.

Note what is deliberately absent from every response model: there is no
compliance status, no pass/fail, no score. The NLP service surfaces linguistic
and semantic signals only. The decision on whether a requirement is satisfied
belongs to the deterministic rule engine in the Node backend, and keeping the
verdict out of this contract is what makes that boundary structural rather than
a matter of convention.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class SentenceIn(BaseModel):
    index: int = Field(..., ge=0, description="Position of the sentence in the document.")
    text: str = Field(..., min_length=1, max_length=4000)


class RuleIn(BaseModel):
    ruleId: str = Field(..., min_length=1, max_length=32)
    concepts: list[str] = Field(..., min_length=1, max_length=12)


class AnalyzeRequest(BaseModel):
    sentences: list[SentenceIn] = Field(..., max_length=6000)
    rules: list[RuleIn] = Field(..., max_length=200)


class SentenceSignal(BaseModel):
    index: int
    #: Cosine similarity against the best-matching concept for this rule, 0..1.
    similarity: float = Field(..., ge=0.0, le=1.0)
    #: True when a dependency-parse scope indicates the sentence is negated.
    negated: bool
    lemmas: list[str] | None = None


class RuleSignal(BaseModel):
    ruleId: str
    bestSimilarity: float = Field(..., ge=0.0, le=1.0)
    sentences: list[SentenceSignal]


class AnalyzeResponse(BaseModel):
    model: str
    byRule: dict[str, RuleSignal]


class HealthResponse(BaseModel):
    status: str
    service: str
    model: str | None = None
    spacy: bool = False
    embeddings: bool = False
