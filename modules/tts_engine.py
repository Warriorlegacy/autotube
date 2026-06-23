import asyncio
import json
import subprocess
from pathlib import Path

import edge_tts

from modules.scripter import VideoScript

VOICES = {
    "en-IN": "en-IN-NeerjaNeural",
    "en-US-female": "en-US-JennyNeural",
    "en-US-male": "en-US-GuyNeural",
    "en-GB": "en-GB-SoniaNeural",
}


async def generate_tts(
    script: VideoScript,
    voice_key: str = "en-IN",
    output_dir: str = "./output/audio",
) -> tuple[str, float]:
    voice = VOICES.get(voice_key, VOICES["en-IN"])
    output_path = Path(output_dir) / f"{script.topic_id}.mp3"
    output_path.parent.mkdir(parents=True, exist_ok=True)

    communicate = edge_tts.Communicate(script.full_text, voice=voice)
    await communicate.save(str(output_path))

    duration = get_audio_duration(str(output_path))
    return str(output_path), duration


def get_audio_duration(file_path: str) -> float:
    result = subprocess.run(
        ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_streams", file_path],
        capture_output=True,
        text=True,
    )
    data = json.loads(result.stdout)
    if data.get("streams"):
        return float(data["streams"][0].get("duration", 0))
    return 0.0


def run_generate_tts(
    script: VideoScript, voice_key: str = "en-IN", output_dir: str = "./output/audio"
) -> tuple[str, float]:
    return asyncio.run(generate_tts(script, voice_key, output_dir))
