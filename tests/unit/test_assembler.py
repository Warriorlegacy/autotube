from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from modules.assembler import _generate_srt, _srt_time


def test_srt_time_format():
    result = _srt_time(3661.5)
    assert result == "01:01:01,500"


def test_generate_srt_creates_file(test_script, tmp_path):
    with patch("modules.assembler.Path.mkdir"):
        srt_path = _generate_srt(test_script)
        assert Path(srt_path).exists()
        content = Path(srt_path).read_text(encoding="utf-8")
        assert "--> " in content
        assert "Have you ever wondered" in content or "black hole" in content.lower()


def test_generate_srt_structure(test_script, tmp_path):
    with patch("modules.assembler.Path.mkdir"):
        srt_path = _generate_srt(test_script)
        content = Path(srt_path).read_text(encoding="utf-8")
        lines = content.strip().split("\n")
        assert len(lines) > 3
        assert lines[0].isdigit()
        assert "--> " in lines[1]
