import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import structlog

LOG_DIR = Path("output/logs")
LOG_DIR.mkdir(parents=True, exist_ok=True)


def _log_filename() -> str:
    return LOG_DIR / f"pipeline_{datetime.now(timezone.utc).strftime('%Y%m%d')}.jsonl"


def _log_to_file(logger: logging.Logger, method_name: str, event_dict: dict) -> str:
    if os.environ.get("STRUCTLOG_FILE_DISABLED"):
        return event_dict
    timestamp = datetime.now(timezone.utc).isoformat()
    event_dict["timestamp"] = timestamp
    with open(_log_filename(), "a") as f:
        f.write(json.dumps(event_dict) + "\n")
    return event_dict


def setup_logging() -> None:
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.stdlib.add_log_level,
            structlog.stdlib.PositionalArgumentsFormatter(),
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.UnicodeDecoder(),
            _log_to_file,
            structlog.dev.ConsoleRenderer(),
        ],
        wrapper_class=structlog.stdlib.BoundLogger,
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )


def get_logger(name: str = "autotube") -> structlog.stdlib.BoundLogger:
    return structlog.get_logger(name)


class PipelineLogger:
    def __init__(self, topic_id: str, config: dict[str, Any] | None = None):
        self.topic_id = topic_id
        self.config = config or {}
        self.log = get_logger()

    def log_stage(self, stage: str, status: str, **kwargs) -> None:
        self.log.info(
            "pipeline_stage",
            topic_id=self.topic_id,
            stage=stage,
            status=status,
            **kwargs,
        )

    def log_error(self, stage: str, error: str, **kwargs) -> None:
        self.log.error(
            "pipeline_error",
            topic_id=self.topic_id,
            stage=stage,
            error=error,
            **kwargs,
        )

    def log_metric(self, name: str, value: float, **kwargs) -> None:
        self.log.info(
            "pipeline_metric",
            topic_id=self.topic_id,
            metric=name,
            value=value,
            **kwargs,
        )
