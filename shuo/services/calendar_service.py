"""
Google Calendar service for Imperium Decorating.

Checks availability and creates booking events using a service account.
"""

import os
import json
import asyncio
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from pathlib import Path

from ..log import ServiceLogger

log = ServiceLogger("Calendar")

# Lazy-load google libs so the rest of the app still starts if not installed
_CALENDAR_SERVICE = None


def _get_calendar_service():
    """
    Build and return a Google Calendar API service (cached).

    Credentials are loaded from (in order of priority):
      1. GOOGLE_SERVICE_ACCOUNT_JSON env var (base64-encoded JSON string)
      2. GOOGLE_CREDENTIALS_FILE env var (path to JSON file)
      3. google_credentials.json in the project root (local dev convenience)
    """
    global _CALENDAR_SERVICE
    if _CALENDAR_SERVICE is not None:
        return _CALENDAR_SERVICE

    try:
        from google.oauth2 import service_account
        from googleapiclient.discovery import build

        credentials = None
        scopes = ["https://www.googleapis.com/auth/calendar"]

        # 1. From environment variable (base64-encoded JSON)
        sa_json_b64 = os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON", "")
        if sa_json_b64:
            import base64
            sa_info = json.loads(base64.b64decode(sa_json_b64).decode())
            credentials = service_account.Credentials.from_service_account_info(
                sa_info, scopes=scopes
            )

        # 2. From file path
        if credentials is None:
            creds_path = os.getenv(
                "GOOGLE_CREDENTIALS_FILE",
                str(Path(__file__).parent.parent.parent / "google_credentials.json"),
            )
            if Path(creds_path).exists():
                credentials = service_account.Credentials.from_service_account_file(
                    creds_path, scopes=scopes
                )

        if credentials is None:
            log.error(
                "No Google credentials found. Set GOOGLE_SERVICE_ACCOUNT_JSON "
                "or provide google_credentials.json"
            )
            return None

        _CALENDAR_SERVICE = build("calendar", "v3", credentials=credentials)
        log.info("Google Calendar service ready")
        return _CALENDAR_SERVICE
    except Exception as e:
        log.error("Failed to build Calendar service", e)
        return None


# Business working hours (London, Monday-Friday)
WORK_START_HOUR = 8   # 8 AM
WORK_END_HOUR = 18    # 6 PM
SLOT_DURATION_HOURS = 2  # Default slot size


def _london_now() -> datetime:
    """Return current time in UTC (calendar events stored in UTC)."""
    return datetime.now(tz=timezone.utc)


def _parse_date_preference(date_pref: str) -> Optional[datetime]:
    """
    Parse a date preference string into a datetime.
    Handles: 'tomorrow', 'next Monday', 'YYYY-MM-DD', 'DD/MM/YYYY'.
    Returns a datetime at WORK_START_HOUR UTC on that day.
    """
    date_pref = date_pref.strip().lower()
    now = _london_now()

    if date_pref in ("today",):
        target = now.replace(hour=WORK_START_HOUR, minute=0, second=0, microsecond=0)
    elif date_pref in ("tomorrow",):
        target = (now + timedelta(days=1)).replace(
            hour=WORK_START_HOUR, minute=0, second=0, microsecond=0
        )
    else:
        # Try ISO and UK formats
        for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"):
            try:
                d = datetime.strptime(date_pref, fmt)
                target = d.replace(
                    hour=WORK_START_HOUR, minute=0, second=0, microsecond=0,
                    tzinfo=timezone.utc,
                )
                break
            except ValueError:
                continue
        else:
            return None

    return target


def check_availability(date_preference: str, duration_hours: int = 2) -> dict:
    """
    Check available slots on a given date.

    Args:
        date_preference: e.g. "tomorrow", "2025-06-15", "15/06/2025"
        duration_hours: length of appointment in hours

    Returns:
        dict with 'available_slots' list or 'error'.
    """
    service = _get_calendar_service()
    calendar_id = os.getenv("GOOGLE_CALENDAR_ID", "primary")

    target = _parse_date_preference(date_preference)
    if not target:
        return {"error": f"Could not understand date: {date_preference}"}

    # Work-day window
    day_start = target.replace(hour=WORK_START_HOUR, minute=0, second=0, microsecond=0)
    day_end = target.replace(hour=WORK_END_HOUR, minute=0, second=0, microsecond=0)

    if service is None:
        # Fallback: return standard slots without calendar check
        log.info("Calendar unavailable — returning default slots")
        slots = _generate_slots(day_start, day_end, duration_hours, busy=[])
        return {"date": day_start.strftime("%A %d %B %Y"), "available_slots": slots}

    try:
        # Query existing events
        events_result = (
            service.events()
            .list(
                calendarId=calendar_id,
                timeMin=day_start.isoformat(),
                timeMax=day_end.isoformat(),
                singleEvents=True,
                orderBy="startTime",
            )
            .execute()
        )
        events = events_result.get("items", [])

        busy = []
        for ev in events:
            start_str = ev["start"].get("dateTime", ev["start"].get("date"))
            end_str = ev["end"].get("dateTime", ev["end"].get("date"))
            try:
                s = datetime.fromisoformat(start_str.replace("Z", "+00:00"))
                e = datetime.fromisoformat(end_str.replace("Z", "+00:00"))
                busy.append((s, e))
            except Exception:
                pass

        slots = _generate_slots(day_start, day_end, duration_hours, busy)
        return {"date": day_start.strftime("%A %d %B %Y"), "available_slots": slots}

    except Exception as e:
        log.error("availability check failed", e)
        return {"error": str(e)}


def _generate_slots(
    day_start: datetime,
    day_end: datetime,
    duration_hours: int,
    busy: list,
) -> List[str]:
    """Generate free time slots on a day given busy periods."""
    slots = []
    cursor = day_start
    slot_delta = timedelta(hours=duration_hours)

    while cursor + slot_delta <= day_end:
        slot_end = cursor + slot_delta
        # Check overlap with any busy period
        overlap = any(
            not (slot_end <= b_start or cursor >= b_end)
            for b_start, b_end in busy
        )
        if not overlap:
            slots.append(cursor.strftime("%H:%M"))
        cursor += timedelta(hours=1)

    return slots


def create_booking(
    caller_name: str,
    phone_number: str,
    email: str,
    service_type: str,
    property_address: str,
    date_str: str,
    time_str: str,
    notes: str = "",
    duration_hours: int = 2,
) -> dict:
    """
    Create a Google Calendar event for a booking.

    Returns dict with 'event_id', 'event_link', or 'error'.
    """
    service = _get_calendar_service()
    calendar_id = os.getenv("GOOGLE_CALENDAR_ID", "primary")

    # Parse datetime
    try:
        dt_str = f"{date_str} {time_str}"
        for fmt in ("%Y-%m-%d %H:%M", "%d/%m/%Y %H:%M", "%d-%m-%Y %H:%M"):
            try:
                start_dt = datetime.strptime(dt_str, fmt).replace(tzinfo=timezone.utc)
                break
            except ValueError:
                continue
        else:
            return {"error": f"Could not parse date/time: {dt_str}"}
    except Exception as e:
        return {"error": str(e)}

    end_dt = start_dt + timedelta(hours=duration_hours)

    description_parts = [
        f"Customer: {caller_name}",
        f"Phone: {phone_number}",
        f"Email: {email}",
        f"Service: {service_type}",
        f"Property: {property_address}",
    ]
    if notes:
        description_parts.append(f"Notes: {notes}")
    description = "\n".join(description_parts)

    event = {
        "summary": f"Imperium – {service_type} – {caller_name}",
        "location": property_address,
        "description": description,
        "start": {
            "dateTime": start_dt.isoformat(),
            "timeZone": "UTC",
        },
        "end": {
            "dateTime": end_dt.isoformat(),
            "timeZone": "UTC",
        },
        "reminders": {
            "useDefault": False,
            "overrides": [
                {"method": "email", "minutes": 24 * 60},
                {"method": "popup", "minutes": 60},
            ],
        },
    }

    if service is None:
        log.info("Calendar unavailable — booking simulated")
        return {
            "event_id": "simulated",
            "event_link": "",
            "start": start_dt.strftime("%A %d %B %Y at %H:%M"),
            "end": end_dt.strftime("%H:%M"),
            "simulated": True,
        }

    try:
        created = (
            service.events()
            .insert(calendarId=calendar_id, body=event)
            .execute()
        )
        log.info(f"Calendar event created: {created.get('id')}")
        return {
            "event_id": created.get("id"),
            "event_link": created.get("htmlLink", ""),
            "start": start_dt.strftime("%A %d %B %Y at %H:%M"),
            "end": end_dt.strftime("%H:%M"),
        }
    except Exception as e:
        log.error("create_booking failed", e)
        return {"error": str(e)}
