import os
import subprocess
from pathlib import Path
from typing import Optional

from modules.media_fetcher import MediaAsset
from modules.scripter import VideoScript


def assemble_video(
    script: VideoScript,
    audio_path: str,
    media_assets: list[MediaAsset],
    output_dir: str = "./output/video",
    resolution: tuple = (1920, 1080),
    fps: int = 30,
    subtitle_enabled: bool = True,
    bg_music_path: Optional[str] = None,
    bg_music_volume: float = 0.20,
    codec: str = "libx264",
    audio_codec: str = "aac",
) -> str:
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    concat_file = output_path / f"{script.topic_id}_concat.txt"
    temp_output = output_path / f"{script.topic_id}_noaudio.mp4"
    final_output = output_path / f"{script.topic_id}.mp4"

    try:
        _create_concat_file(concat_file, media_assets, audio_path, script)
        _concat_clips(str(concat_file), str(temp_output), resolution, fps, codec)
        audio_mixed = _mix_audio(audio_path, bg_music_path, bg_music_volume)
        _mux_audio(str(temp_output), audio_mixed, str(final_output), audio_codec)
        if subtitle_enabled:
            srt_path = _generate_srt(script)
            _burn_subtitles(str(final_output), srt_path)
    finally:
        for p in [concat_file, temp_output]:
            if p.exists():
                p.unlink()

    return str(final_output)


def _create_concat_file(
    concat_file: Path,
    media_assets: list[MediaAsset],
    audio_path: str,
    script: VideoScript,
) -> None:
    with open(concat_file, "w") as f:
        for i, asset in enumerate(media_assets):
            section_index = min(i, len(script.sections) - 1)
            section_duration = (
                script.sections[section_index].estimated_duration_seconds
                if script.sections
                else 30
            )
            if asset.asset_type == "video":
                f.write(f"file '{asset.file_path}'\n")
                f.write(f"duration {section_duration}\n")
            else:
                f.write(f"file '{asset.file_path}'\n")
                f.write(f"duration {section_duration}\n")


def _concat_clips(
    concat_file: str, output: str, resolution: tuple, fps: int, codec: str
) -> None:
    cmd = [
        "ffmpeg",
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        concat_file,
        "-vf",
        f"scale={resolution[0]}:{resolution[1]}:force_original_aspect_ratio=decrease,pad={resolution[0]}:{resolution[1]}:(ow-iw)/2:(oh-ih)/2",
        "-r",
        str(fps),
        "-c:v",
        codec,
        "-pix_fmt",
        "yuv420p",
        "-preset",
        "fast",
        "-crf",
        "23",
        output,
    ]
    _run_ffmpeg(cmd)


def _mix_audio(audio_path: str, bg_music_path: Optional[str], bg_volume: float) -> str:
    if not bg_music_path or not os.path.exists(bg_music_path):
        return audio_path

    mixed_path = audio_path.replace(".mp3", "_mixed.mp3")
    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        audio_path,
        "-i",
        bg_music_path,
        "-filter_complex",
        f"[1:a]volume={bg_volume}[bg];[0:a][bg]amix=inputs=2:duration=first[a]",
        "-map",
        "[a]",
        "-acodec",
        "libmp3lame",
        mixed_path,
    ]
    _run_ffmpeg(cmd)
    return mixed_path


def _mux_audio(video_path: str, audio_path: str, output: str, audio_codec: str) -> None:
    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        video_path,
        "-i",
        audio_path,
        "-c:v",
        "copy",
        "-c:a",
        audio_codec,
        "-shortest",
        output,
    ]
    _run_ffmpeg(cmd)


def _burn_subtitles(video_path: str, srt_path: str) -> None:
    temp_path = video_path.replace(".mp4", "_subs.mp4")
    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        video_path,
        "-vf",
        f"subtitles={srt_path}:force_style='FontName=Montserrat,FontSize=36,PrimaryColour=&HFFFFFF,OutlineColour=&H000000,BorderStyle=3'",
        "-c:a",
        "copy",
        temp_path,
    ]
    _run_ffmpeg(cmd)
    os.replace(temp_path, video_path)


def _generate_srt(script: VideoScript) -> str:
    srt_path = f"./output/media/{script.topic_id}.srt"
    Path(srt_path).parent.mkdir(parents=True, exist_ok=True)

    lines = []
    current_time = 0.0
    index = 1

    hook_words = script.hook.split()
    hook_duration = max(len(hook_words) * 0.4, 10.0)
    lines.extend(_words_to_srt(index, current_time, hook_duration, script.hook))
    index += len(lines) // 3
    current_time += hook_duration

    for section in script.sections:
        section_duration = section.estimated_duration_seconds
        lines.extend(
            _words_to_srt(index, current_time, section_duration, section.content)
        )
        index += len(section.content.split()) // 10 + 1
        current_time += section_duration

    outro_words = script.outro.split()
    outro_duration = max(len(outro_words) * 0.4, 10.0)
    lines.extend(_words_to_srt(index, current_time, outro_duration, script.outro))

    with open(srt_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    return srt_path


def _words_to_srt(
    start_index: int, start_time: float, duration: float, text: str
) -> list[str]:
    lines = []
    words = text.split()
    chunk_size = 10
    chunks = [words[i : i + chunk_size] for i in range(0, len(words), chunk_size)]
    chunk_duration = duration / max(len(chunks), 1)

    for i, chunk in enumerate(chunks):
        chunk_start = start_time + (i * chunk_duration)
        chunk_end = chunk_start + chunk_duration
        lines.append(str(start_index + i))
        lines.append(f"{_srt_time(chunk_start)} --> {_srt_time(chunk_end)}")
        lines.append(" ".join(chunk))
        lines.append("")

    return lines


def _srt_time(seconds: float) -> str:
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    ms = int((seconds - int(seconds)) * 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def _run_ffmpeg(cmd: list[str]) -> None:
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(
            f"FFmpeg exited with code {result.returncode}: {result.stderr[:500]}"
        )
