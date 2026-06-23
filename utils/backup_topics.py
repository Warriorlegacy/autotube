import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

from utils.db import get_supabase_client, reset_client

BACKUP_DIR = Path("data/backups")
BACKUP_DIR.mkdir(parents=True, exist_ok=True)


def backup_topics() -> str:
    supabase = get_supabase_client()
    result = supabase.table("topics").select("*").execute()
    topics = result.data if result.data else []
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d_%H%M%S")
    filename = BACKUP_DIR / f"topics_{timestamp}.json"
    with open(filename, "w") as f:
        json.dump(topics, f, indent=2, default=str)
    return str(filename)


def restore_topics(file_path: str) -> int:
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"Backup file not found: {file_path}")
    with open(path) as f:
        topics = json.load(f)
    supabase = get_supabase_client()
    restored = 0
    for topic in topics:
        topic_id = topic.pop("id", None)
        if topic_id:
            existing = (
                supabase.table("topics").select("id").eq("id", topic_id).execute()
            )
            if existing.data:
                supabase.table("topics").update(topic).eq("id", topic_id).execute()
            else:
                topic["id"] = topic_id
                supabase.table("topics").insert(topic).execute()
        else:
            supabase.table("topics").insert(topic).execute()
        restored += 1
    return restored


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Backup or restore topics table")
    parser.add_argument("action", choices=["backup", "restore"])
    parser.add_argument("--file", help="Backup file path for restore")
    args = parser.parse_args()

    if args.action == "backup":
        filepath = backup_topics()
        print(f"Backup saved to: {filepath}")
    elif args.action == "restore":
        if not args.file:
            print("Error: --file is required for restore")
            exit(1)
        count = restore_topics(args.file)
        print(f"Restored {count} topics from {args.file}")
    reset_client()
