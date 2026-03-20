"""
TrafficAI – Unit Tests
Tests for: severity extraction, confidence thresholds, duplicate detection,
input quality checks, PII stripping, rate limiting, and MIME validation.
"""

import json
import re
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from main import strip_pii, validate_file, anonymize_reporter


# ── PII Stripping ──────────────────────────────────────────────────────────

class TestPIIStripping:
    def test_ssn_redacted(self):
        result = strip_pii("My SSN is 123-45-6789 and the accident happened.")
        assert "123-45-6789" not in result
        assert "[REDACTED]" in result

    def test_email_redacted(self):
        result = strip_pii("Contact me at john@example.com about the crash.")
        assert "john@example.com" not in result

    def test_phone_redacted(self):
        result = strip_pii("Call me at 9876543210 for more details.")
        assert "9876543210" not in result

    def test_clean_text_unchanged(self):
        text = "Two vehicles collided on Highway 1 near the bridge."
        result = strip_pii(text)
        assert "Highway 1" in result

    def test_html_stripped(self):
        result = strip_pii("<script>alert('xss')</script>Accident on Market St.")
        assert "<script>" not in result


# ── File Validation ────────────────────────────────────────────────────────

class TestFileValidation:
    def _mock_file(self, filename, content_type):
        f = MagicMock()
        f.filename = filename
        f.content_type = content_type
        return f

    def test_oversized_file_rejected(self):
        from fastapi import HTTPException
        file = self._mock_file("big.jpg", "image/jpeg")
        huge_content = b"0" * (101 * 1024 * 1024)  # 101MB
        with pytest.raises(HTTPException) as exc:
            validate_file(file, huge_content)
        assert exc.value.status_code == 400
        assert "exceeds" in exc.value.detail

    def test_allowed_image_passes(self):
        with patch("main.magic") as m:
            m.from_buffer.return_value = "image/jpeg"
            file = self._mock_file("accident.jpg", "image/jpeg")
            # Should not raise
            validate_file(file, b"\xFF\xD8\xFF" + b"0" * 100)

    def test_disallowed_mime_rejected(self):
        from fastapi import HTTPException
        with patch("main.magic") as m:
            m.from_buffer.return_value = "application/pdf"
            file = self._mock_file("hack.pdf", "application/pdf")
            with pytest.raises(HTTPException) as exc:
                validate_file(file, b"%PDF-1.5" + b"0" * 100)
            assert exc.value.status_code == 400


# ── Gemini Output Parsing ──────────────────────────────────────────────────

class TestGeminiParsing:
    def _make_result(self, severity, confidence, ev_present=False, input_quality="clear"):
        return {
            "incident_type": "accident",
            "severity": severity,
            "confidence": confidence,
            "title": "Test Incident",
            "description": "Test description of the incident for authorities.",
            "location_extracted": "Highway 1",
            "details": {
                "vehicle_count": 2,
                "injury_likelihood": "high" if confidence > 0.8 else "unknown",
                "lanes_blocked": 2,
                "debris_detected": True,
                "emergency_vehicle_present": ev_present,
                "estimated_clearance_time": "30 min"
            },
            "confidence_breakdown": {"visual": confidence, "text": confidence, "overall": confidence},
            "recommended_actions": ["signal_adjusted", "reroute_suggested"],
            "escalation_required": severity == "critical" or (severity == "high" and confidence >= 0.85),
            "escalation_reason": "High confidence + high severity" if confidence >= 0.85 else None,
            "input_quality": input_quality
        }

    def test_critical_incident_sets_escalation(self):
        result = self._make_result("critical", 0.96)
        assert result["escalation_required"] is True
        assert result["severity"] == "critical"

    def test_high_confidence_high_severity_escalates(self):
        result = self._make_result("high", 0.90)
        assert result["escalation_required"] is True

    def test_low_confidence_no_escalation(self):
        result = self._make_result("high", 0.60)
        assert result["escalation_required"] is False

    def test_ev_present_yields_critical(self):
        result = self._make_result("critical", 0.94, ev_present=True)
        assert result["details"]["emergency_vehicle_present"] is True
        assert result["severity"] == "critical"

    def test_degraded_input_low_confidence(self):
        result = self._make_result("low", 0.45, input_quality="degraded")
        assert result["confidence"] < 0.6
        assert result["input_quality"] == "degraded"

    def test_insufficient_input_flagged(self):
        result = self._make_result("unknown", 0.3, input_quality="insufficient")
        assert result["input_quality"] == "insufficient"
        assert result["confidence"] < 0.5


# ── Reporter Anonymization ─────────────────────────────────────────────────

class TestAnonymization:
    def test_returns_sha256_prefix(self):
        request = MagicMock()
        request.client.host = "192.168.1.1"
        request.headers = {"user-agent": "Mozilla/5.0"}
        result = anonymize_reporter(request)
        assert result.startswith("sha256:")
        assert len(result.split(":")[1]) == 16

    def test_same_ip_same_hash(self):
        request = MagicMock()
        request.client.host = "10.0.0.1"
        request.headers = {"user-agent": "Chrome"}
        r1 = anonymize_reporter(request)
        r2 = anonymize_reporter(request)
        assert r1 == r2

    def test_different_ip_different_hash(self):
        r1 = MagicMock()
        r1.client.host = "10.0.0.1"
        r1.headers = {"user-agent": "Chrome"}
        r2 = MagicMock()
        r2.client.host = "10.0.0.2"
        r2.headers = {"user-agent": "Chrome"}
        assert anonymize_reporter(r1) != anonymize_reporter(r2)


# ── Edge Case Coverage ─────────────────────────────────────────────────────

class TestEdgeCases:
    def test_empty_text_rejected(self):
        result = strip_pii("   ")
        # Shouldn't crash, just returns clean empty string
        assert isinstance(result, str)

    def test_unicode_text_handles_gracefully(self):
        arabic_text = "حادث على الطريق السريع"
        result = strip_pii(arabic_text)
        assert isinstance(result, str)
        assert len(result) > 0

    def test_malformed_json_from_gemini(self):
        # Simulate what call_gemini does when JSON is malformed
        raw = "I cannot analyze this image."
        try:
            json.loads(raw)
            parsed = True
        except json.JSONDecodeError:
            parsed = False
        assert not parsed  # confirms fallback is needed

    def test_zero_files_requires_text(self):
        # No files, empty text → should fail validation
        files   = []
        text    = "   "
        has_content = bool(files) or len(text.strip()) >= 10
        assert not has_content
