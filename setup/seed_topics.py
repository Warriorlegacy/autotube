#!/usr/bin/env python3
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path

DATA_DIR = Path("data")
TOPICS_FILE = DATA_DIR / "topics.json"

SAMPLE_TOPICS = [
    {
        "title": "How Do Black Holes Form?",
        "keywords": ["black holes", "space", "astronomy", "gravity"],
        "niche": "science",
    },
    {
        "title": "Top 10 Facts About Ancient Egypt",
        "keywords": ["ancient egypt", "pyramids", "pharaohs", "history"],
        "niche": "history",
    },
    {
        "title": "How the Internet Actually Works",
        "keywords": ["internet", "networking", "technology", "explainer"],
        "niche": "technology",
    },
    {
        "title": "The Story of the Roman Empire",
        "keywords": ["roman empire", "ancient rome", "history", "civilization"],
        "niche": "history",
    },
    {
        "title": "Why Do We Dream? The Science of Sleep",
        "keywords": ["dreams", "sleep", "brain", "psychology", "science"],
        "niche": "science",
    },
    {
        "title": "How Photosynthesis Keeps Us Alive",
        "keywords": ["photosynthesis", "plants", "biology", "oxygen", "science"],
        "niche": "science",
    },
    {
        "title": "The Complete History of Video Games",
        "keywords": ["video games", "gaming history", "technology", "retro gaming"],
        "niche": "technology",
    },
    {
        "title": "How Does GPS Actually Work?",
        "keywords": ["gps", "satellite", "navigation", "technology"],
        "niche": "technology",
    },
    {
        "title": "Top 10 Unsolved Mysteries of Science",
        "keywords": ["unsolved mysteries", "science", "questions", "discovery"],
        "niche": "science",
    },
    {
        "title": "The Psychology of Habits: How to Change Your Life",
        "keywords": ["habits", "psychology", "self improvement", "brain"],
        "niche": "psychology",
    },
    {
        "title": "How Vaccines Train Your Immune System",
        "keywords": ["vaccines", "immune system", "health", "science", "medicine"],
        "niche": "science",
    },
    {
        "title": "The History of the Silk Road",
        "keywords": ["silk road", "ancient trade", "history", "asia"],
        "niche": "history",
    },
    {
        "title": "How Do Airplanes Fly?",
        "keywords": ["airplanes", "aviation", "aerodynamics", "physics", "technology"],
        "niche": "technology",
    },
    {
        "title": "Top 10 Facts About the Human Brain",
        "keywords": ["brain", "neuroscience", "psychology", "human body"],
        "niche": "science",
    },
    {
        "title": "How Electric Cars Are Changing the World",
        "keywords": ["electric cars", "ev", "technology", "environment", "automotive"],
        "niche": "technology",
    },
    {
        "title": "The Great Wall of China: History and Facts",
        "keywords": ["great wall", "china", "history", "ancient", "architecture"],
        "niche": "history",
    },
    {
        "title": "How Your Heart Works: A Simple Guide",
        "keywords": ["heart", "circulatory system", "biology", "health", "human body"],
        "niche": "science",
    },
    {
        "title": "Top 10 Programming Languages in 2026",
        "keywords": ["programming", "coding", "software development", "technology"],
        "niche": "technology",
    },
    {
        "title": "How Do Earthquakes Happen?",
        "keywords": ["earthquakes", "geology", "natural disasters", "science"],
        "niche": "science",
    },
    {
        "title": "The History of the Internet: From ARPANET to AI",
        "keywords": ["internet history", "arpanet", "web", "technology"],
        "niche": "technology",
    },
]


def seed_topics(output: str = "json") -> int:
    topics = []
    for t in SAMPLE_TOPICS:
        topics.append(
            {
                "id": str(uuid.uuid4()),
                "title": t["title"],
                "keywords": t["keywords"],
                "niche": t["niche"],
                "status": "queued",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "processed_at": None,
                "youtube_video_id": None,
                "error_message": None,
                "retry_count": 0,
            }
        )

    if output == "json":
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        with open(TOPICS_FILE, "w") as f:
            json.dump(topics, f, indent=2)
        print(f"Seeded {len(topics)} topics to {TOPICS_FILE}")
        return len(topics)

    if output == "supabase":
        from utils.db import get_supabase_client

        client = get_supabase_client()
        result = client.table("topics").insert(topics).execute()
        print(f"Seeded {len(result.data)} topics to Supabase")
        return len(result.data)

    return 0


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Seed topics into queue")
    parser.add_argument("--output", choices=["json", "supabase"], default="json")
    args = parser.parse_args()
    seed_topics(output=args.output)
