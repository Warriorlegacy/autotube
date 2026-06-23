#!/usr/bin/env python3
import sys
from pathlib import Path

from google.auth.transport.requests import Request as AuthRequest
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow

SCOPES = [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube",
]


def main() -> None:
    token_path = Path("token.json")
    creds = None

    if token_path.exists():
        creds = Credentials.from_authorized_user_file(str(token_path), SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(AuthRequest())
        else:
            creds_path = Path("credentials.json")
            if not creds_path.exists():
                print(
                    "ERROR: credentials.json not found.\n\n"
                    "To get credentials.json:\n"
                    "1. Go to https://console.cloud.google.com/apis/credentials\n"
                    "2. Create OAuth 2.0 Client ID (Desktop app type)\n"
                    "3. Download JSON and save as 'credentials.json' in this directory\n"
                )
                sys.exit(1)
            flow = InstalledAppFlow.from_client_secrets_file(str(creds_path), SCOPES)
            creds = flow.run_local_server(port=8080)

        with open(token_path, "w") as f:
            f.write(creds.to_json())
        print(f"Token saved to {token_path}")

    import base64

    token_b64 = base64.b64encode(creds.to_json().encode()).decode()
    print(
        "\nBase64-encoded token (store as YOUTUBE_TOKEN_BASE64 in .env or GitHub Secrets):"
    )
    print(token_b64)


if __name__ == "__main__":
    main()
