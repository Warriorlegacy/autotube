#!/usr/bin/env python3
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))


def test_gemini() -> bool:
    try:
        import google.generativeai as genai

        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            print("  \u274c GEMINI_API_KEY not set")
            return False
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-2.0-flash")
        response = model.generate_content("Say 'Hello, AutoTube!' and nothing else.")
        if response and response.text:
            print(f"  \u2705 Gemini: {response.text.strip()}")
            return True
        print("  \u274c Gemini: empty response")
        return False
    except Exception as e:
        print(f"  \u274c Gemini: {e}")
        return False


def test_groq() -> bool:
    try:
        from groq import Groq

        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            print("  \u274c GROQ_API_KEY not set")
            return False
        client = Groq(api_key=api_key)
        response = client.chat.completions.create(
            model="llama-3.1-70b-versatile",
            messages=[
                {"role": "user", "content": "Say 'Hello, AutoTube!' and nothing else."}
            ],
        )
        if response and response.choices:
            print(f"  \u2705 Groq: {response.choices[0].message.content.strip()}")
            return True
        print("  \u274c Groq: empty response")
        return False
    except Exception as e:
        print(f"  \u274c Groq: {e}")
        return False


def test_edge_tts() -> bool:
    try:
        import asyncio
        import edge_tts

        async def test():
            communicate = edge_tts.Communicate("Hello, AutoTube!", "en-IN-NeerjaNeural")
            await communicate.save("output/test_tts.mp3")
            return Path("output/test_tts.mp3").exists()

        result = asyncio.run(test())
        if result:
            print("  \u2705 Edge-TTS: MP3 generated successfully")
            Path("output/test_tts.mp3").unlink(missing_ok=True)
            return True
        print("  \u274c Edge-TTS: file not created")
        return False
    except Exception as e:
        print(f"  \u274c Edge-TTS: {e}")
        return False


def test_supabase() -> bool:
    try:
        from utils.db import get_supabase_client

        client = get_supabase_client()
        result = client.table("topics").select("id", count="exact").limit(1).execute()
        print(f"  \u2705 Supabase: connected ({result.count or 0} topics)")
        return True
    except Exception as e:
        print(f"  \u274c Supabase: {e}")
        return False


def test_ffmpeg() -> bool:
    import subprocess

    try:
        result = subprocess.run(
            ["ffmpeg", "-version"], capture_output=True, text=True, timeout=10
        )
        if result.returncode == 0:
            version_line = result.stdout.split("\n")[0]
            print(f"  \u2705 FFmpeg: {version_line}")
            return True
        print("  \u274c FFmpeg: non-zero exit")
        return False
    except FileNotFoundError:
        print("  \u274c FFmpeg: not found (install with 'sudo apt install ffmpeg')")
        return False
    except Exception as e:
        print(f"  \u274c FFmpeg: {e}")
        return False


def test_env_vars() -> bool:
    required = ["GEMINI_API_KEY", "GROQ_API_KEY", "PEXELS_API_KEY", "PIXABAY_API_KEY"]
    all_ok = True
    for var in required:
        if os.getenv(var):
            print(f"  \u2705 {var}: set")
        else:
            print(f"  \u274c {var}: NOT SET")
            all_ok = False
    return all_ok


def main() -> None:
    from dotenv import load_dotenv

    load_dotenv()

    Path("output").mkdir(exist_ok=True)

    print("=" * 50)
    print("AutoTube API Connectivity Test")
    print("=" * 50)
    print()

    results = {
        "Environment Variables": test_env_vars(),
        "Gemini API": test_gemini(),
        "Groq API": test_groq(),
        "Edge-TTS": test_edge_tts(),
        "Supabase": test_supabase(),
        "FFmpeg": test_ffmpeg(),
    }
    print()
    print("=" * 50)
    print("Summary:")
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    print(f"  {passed}/{total} tests passed")
    if passed < total:
        print(f"  {total - passed} test(s) failed")
        sys.exit(1)
    else:
        print("  All tests passed!")
        sys.exit(0)


if __name__ == "__main__":
    main()
