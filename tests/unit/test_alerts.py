from unittest.mock import MagicMock, patch

import pytest

from utils.alerts import (
    send_failure_alert,
    send_queue_empty_alert,
    send_quota_alert,
    send_success_alert,
    send_weekly_summary,
)


@patch("utils.alerts._send_telegram_message")
def test_send_success_alert(mock_send):
    mock_send.return_value = True
    result = send_success_alert("Test Topic", "abc123", 300.0, 50.0)
    assert result is True


@patch("utils.alerts._send_telegram_message")
def test_send_failure_alert(mock_send):
    mock_send.return_value = True
    result = send_failure_alert("Test Topic", "VIDEO_ASSEMBLING", "FFmpeg error", 2)
    assert result is True


@patch("utils.alerts._send_telegram_message")
def test_send_quota_alert(mock_send):
    mock_send.return_value = True
    result = send_quota_alert(8500, 10000)
    assert result is True


@patch("utils.alerts._send_telegram_message")
def test_send_queue_empty_alert(mock_send):
    mock_send.return_value = True
    result = send_queue_empty_alert()
    assert result is True


@patch("utils.alerts._send_telegram_message")
def test_send_weekly_summary(mock_send):
    mock_send.return_value = True
    stats = {"uploaded": 5, "failed": 1, "queued": 10, "avg_quota_usage": 3200}
    result = send_weekly_summary(stats)
    assert result is True
