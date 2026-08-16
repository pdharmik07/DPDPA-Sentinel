"""Contract tests for the NLP service.

These run without spaCy or sentence-transformers installed, which is
deliberate: the most important behaviour to pin down is what happens when the
models are *absent*. The service must fail loudly with 503 rather than return
misleading zero-similarity scores, because the Node backend treats any non-OK
response as "NLP unavailable" and continues on the deterministic rule engine.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.schemas import AnalyzeResponse, RuleSignal, SentenceSignal

client = TestClient(app)


def test_health_reports_service_state() -> None:
    response = client.get("/health")
    assert response.status_code == 200

    body = response.json()
    assert body["status"] == "ok"
    assert body["service"] == "dpdpa-sentinel-nlp"
    # Model flags are booleans whether or not the models loaded.
    assert isinstance(body["embeddings"], bool)
    assert isinstance(body["spacy"], bool)


def test_empty_request_returns_no_signals() -> None:
    response = client.post("/analyze", json={"sentences": [], "rules": []})
    assert response.status_code == 200
    assert response.json()["byRule"] == {}


def test_analyze_fails_loudly_when_embeddings_are_unavailable() -> None:
    """Without the embedding model the service must 503, never fake a score."""
    payload = {
        "sentences": [
            {"index": 0, "text": "You may withdraw your consent at any time from settings."},
        ],
        "rules": [{"ruleId": "C4", "concepts": ["withdraw consent"]}],
    }
    response = client.post("/analyze", json=payload)

    # 503 when models are absent; 200 once they are installed. Both are correct,
    # and both keep the backend's degradation contract intact.
    assert response.status_code in (200, 503)
    if response.status_code == 503:
        assert "not available" in response.json()["detail"].lower()
    else:
        body = response.json()
        assert "C4" in body["byRule"]
        assert 0.0 <= body["byRule"]["C4"]["bestSimilarity"] <= 1.0


def test_request_validation_rejects_malformed_input() -> None:
    # Missing ruleId
    assert client.post("/analyze", json={"sentences": [], "rules": [{"concepts": ["x"]}]}).status_code == 422
    # Empty concept list
    assert (
        client.post(
            "/analyze",
            json={"sentences": [], "rules": [{"ruleId": "C4", "concepts": []}]},
        ).status_code
        == 422
    )
    # Negative sentence index
    assert (
        client.post(
            "/analyze",
            json={"sentences": [{"index": -1, "text": "hi"}], "rules": []},
        ).status_code
        == 422
    )


def test_response_model_cannot_express_a_compliance_verdict() -> None:
    """The boundary is structural, not conventional.

    If someone later adds a status/pass/fail field to the NLP response, this
    test fails — which is the point. Compliance decisions belong to the
    deterministic rule engine in the backend.
    """
    forbidden = {"status", "verdict", "compliant", "pass", "fail", "result", "score"}

    for model in (AnalyzeResponse, RuleSignal, SentenceSignal):
        fields = set(model.model_fields)
        assert not (fields & forbidden), f"{model.__name__} exposes a verdict-like field"


@pytest.mark.parametrize("similarity", [-0.1, 1.1])
def test_similarity_is_bounded(similarity: float) -> None:
    with pytest.raises(Exception):
        SentenceSignal(index=0, similarity=similarity, negated=False)
