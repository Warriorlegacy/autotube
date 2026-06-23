import asyncio
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest


@pytest.mark.asyncio
async def test_generate_tts_creates_file(test_script, tmp_path):
    from modules.tts_engine import generate_tts

    with patch("edge_tts.Communicate") as MockCommunicate:
        mock_comm = AsyncMock()
        MockCommunicate.return_value = mock_comm

        with patch("modules.tts_engine.get_audio_duration", return_value=60.0):
            output_dir = str(tmp_path / "audio")
            file_path, duration = await generate_tts(
                test_script, voice_key="en-IN", output_dir=output_dir
            )

            assert Path(file_path).parent.exists()
            assert duration == 60.0


def test_get_audio_duration():
    from modules.tts_engine import get_audio_duration
    import subprocess
    import tempfile

    with tempfile.NamedTemporaryFile(suffix=".mp3") as f:
        duration = get_audio_duration(f.name)
        assert isinstance(duration, float)
