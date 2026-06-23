import asyncio
import time
from functools import wraps
from typing import Any, Callable, TypeVar

F = TypeVar("F", bound=Callable[..., Any])


TRANSIENT_ERRORS = [
    "ConnectionTimeout",
    "ReadTimeout",
    "HTTPError 429",
    "HTTPError 500",
    "HTTPError 503",
    "TemporaryAPIError",
]

PERMANENT_ERRORS = [
    "HTTPError 401",
    "HTTPError 403",
    "InvalidAPIKey",
    "QAFailedError",
    "FFmpegCodecError",
    "InvalidTopicError",
]


def classify_error(exc: Exception) -> str:
    error_str = f"{type(exc).__name__}: {str(exc)}"
    for pattern in PERMANENT_ERRORS:
        if pattern in error_str:
            return "permanent"
    for pattern in TRANSIENT_ERRORS:
        if pattern in error_str:
            return "transient"
    return "transient"


def retry(
    func: Callable,
    max_retries: int = 3,
    base_delay: float = 30.0,
    classify_fn: Callable = classify_error,
) -> Any:
    last_exception = None
    for attempt in range(max_retries + 1):
        try:
            return func()
        except Exception as e:
            last_exception = e
            error_type = classify_fn(e)
            if error_type == "permanent":
                raise
            if attempt < max_retries:
                delay = base_delay * (2**attempt)
                time.sleep(delay)
    raise last_exception


def async_retry(
    func: Callable,
    max_retries: int = 3,
    base_delay: float = 30.0,
    classify_fn: Callable = classify_error,
) -> Any:
    async def wrapper() -> Any:
        last_exception = None
        for attempt in range(max_retries + 1):
            try:
                return await func()
            except Exception as e:
                last_exception = e
                error_type = classify_fn(e)
                if error_type == "permanent":
                    raise
                if attempt < max_retries:
                    delay = base_delay * (2**attempt)
                    await asyncio.sleep(delay)
        raise last_exception

    return wrapper()
