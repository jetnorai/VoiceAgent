"""
LLM tool definitions and execution for Imperium Decorating AI voice agent.

Tools available to the LLM via function calling:
  - check_availability       : Check calendar for free slots
  - book_appointment         : Create calendar event + send emails
  - capture_lead             : Log enquiry + send lead email
  - report_issue             : Log complaint + send alert email
"""

import json
from typing import Any

from .services.calendar_service import check_availability, create_booking
from .services.email_service import (
    send_booking_notification,
    send_lead_notification,
    send_issue_alert,
    send_confirmation_to_customer,
)
from .log import ServiceLogger

log = ServiceLogger("Tools")

# ── Tool schemas (OpenAI function-calling format) ────────────────────────────

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "check_availability",
            "description": (
                "Check available appointment slots on a given date. "
                "Use this before booking to find out what times are free. "
                "Call this whenever the caller mentions a preferred date."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "date_preference": {
                        "type": "string",
                        "description": (
                            "The requested date, e.g. 'tomorrow', '2025-06-20', '20/06/2025', "
                            "'next Monday'. Required."
                        ),
                    },
                    "duration_hours": {
                        "type": "integer",
                        "description": "Estimated job duration in hours (default 2).",
                        "default": 2,
                    },
                },
                "required": ["date_preference"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "book_appointment",
            "description": (
                "Book a confirmed appointment. Creates a Google Calendar event and sends "
                "email notifications to both the business team and the customer. "
                "Only call this after confirming all details with the caller."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "caller_name": {
                        "type": "string",
                        "description": "Full name of the customer.",
                    },
                    "phone_number": {
                        "type": "string",
                        "description": "Customer's callback phone number.",
                    },
                    "email": {
                        "type": "string",
                        "description": "Customer's email address (empty string if not provided).",
                    },
                    "service_type": {
                        "type": "string",
                        "description": (
                            "Type of service required, e.g. 'Interior painting', "
                            "'Exterior painting', 'Wallpaper installation', 'Plastering', "
                            "'Wood restoration', 'Colour consultation', etc."
                        ),
                    },
                    "property_address": {
                        "type": "string",
                        "description": "Full address of the property to be worked on.",
                    },
                    "date_str": {
                        "type": "string",
                        "description": "Appointment date in YYYY-MM-DD or DD/MM/YYYY format.",
                    },
                    "time_str": {
                        "type": "string",
                        "description": "Start time in HH:MM format (24-hour).",
                    },
                    "notes": {
                        "type": "string",
                        "description": "Any additional notes from the caller (colours, rooms, special requirements).",
                    },
                    "duration_hours": {
                        "type": "integer",
                        "description": "Estimated duration in hours (default 2 for initial survey).",
                        "default": 2,
                    },
                },
                "required": [
                    "caller_name",
                    "phone_number",
                    "service_type",
                    "property_address",
                    "date_str",
                    "time_str",
                ],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "capture_lead",
            "description": (
                "Capture a lead or general enquiry when the caller is not ready to book "
                "but wants a quote, has questions, or wants a callback. "
                "Sends a notification email to the team."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "caller_name": {
                        "type": "string",
                        "description": "Full name of the caller.",
                    },
                    "phone_number": {
                        "type": "string",
                        "description": "Caller's phone number.",
                    },
                    "email": {
                        "type": "string",
                        "description": "Caller's email address (empty string if not provided).",
                    },
                    "service_type": {
                        "type": "string",
                        "description": "Service they are interested in.",
                    },
                    "property_address": {
                        "type": "string",
                        "description": "Property address if provided (empty string if not).",
                    },
                    "message": {
                        "type": "string",
                        "description": "Summary of what the caller wants or asked about.",
                    },
                    "urgency": {
                        "type": "string",
                        "enum": ["high", "normal", "low"],
                        "description": "Urgency level based on the caller's situation.",
                        "default": "normal",
                    },
                },
                "required": ["caller_name", "phone_number", "service_type", "message"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "report_issue",
            "description": (
                "Report a complaint or issue raised by an existing customer. "
                "Sends an urgent alert to the Imperium team."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "caller_name": {
                        "type": "string",
                        "description": "Name of the caller.",
                    },
                    "phone_number": {
                        "type": "string",
                        "description": "Caller's phone number.",
                    },
                    "issue_description": {
                        "type": "string",
                        "description": "Detailed description of the complaint or issue.",
                    },
                    "related_job": {
                        "type": "string",
                        "description": "Description of the related job/project if known.",
                    },
                },
                "required": ["caller_name", "phone_number", "issue_description"],
            },
        },
    },
]


# ── Tool execution ────────────────────────────────────────────────────────────


def execute_tool(tool_name: str, tool_args: dict) -> str:
    """
    Execute a named tool with the given arguments.
    Returns a JSON string result to feed back to the LLM.
    """
    log.info(f"Tool call: {tool_name}({json.dumps(tool_args, ensure_ascii=False)[:200]})")

    try:
        if tool_name == "check_availability":
            result = check_availability(
                date_preference=tool_args.get("date_preference", ""),
                duration_hours=tool_args.get("duration_hours", 2),
            )

        elif tool_name == "book_appointment":
            # 1. Create calendar event
            booking = create_booking(
                caller_name=tool_args.get("caller_name", ""),
                phone_number=tool_args.get("phone_number", ""),
                email=tool_args.get("email", ""),
                service_type=tool_args.get("service_type", ""),
                property_address=tool_args.get("property_address", ""),
                date_str=tool_args.get("date_str", ""),
                time_str=tool_args.get("time_str", ""),
                notes=tool_args.get("notes", ""),
                duration_hours=tool_args.get("duration_hours", 2),
            )

            if "error" in booking:
                result = booking
            else:
                # 2. Email team
                send_booking_notification(
                    caller_name=tool_args.get("caller_name", ""),
                    phone_number=tool_args.get("phone_number", ""),
                    email=tool_args.get("email", ""),
                    service_type=tool_args.get("service_type", ""),
                    property_address=tool_args.get("property_address", ""),
                    appointment_start=booking.get("start", ""),
                    appointment_end=booking.get("end", ""),
                    notes=tool_args.get("notes", ""),
                    event_link=booking.get("event_link", ""),
                )
                # 3. Email customer confirmation (if email provided)
                customer_email = tool_args.get("email", "")
                if customer_email:
                    send_confirmation_to_customer(
                        caller_name=tool_args.get("caller_name", ""),
                        customer_email=customer_email,
                        service_type=tool_args.get("service_type", ""),
                        appointment_start=booking.get("start", ""),
                        appointment_end=booking.get("end", ""),
                        property_address=tool_args.get("property_address", ""),
                    )
                result = {
                    "success": True,
                    "appointment": booking.get("start", ""),
                    "event_link": booking.get("event_link", ""),
                }

        elif tool_name == "capture_lead":
            email_result = send_lead_notification(
                caller_name=tool_args.get("caller_name", ""),
                phone_number=tool_args.get("phone_number", ""),
                email=tool_args.get("email", ""),
                service_type=tool_args.get("service_type", ""),
                property_address=tool_args.get("property_address", ""),
                message=tool_args.get("message", ""),
                urgency=tool_args.get("urgency", "normal"),
            )
            result = {
                "success": "error" not in email_result,
                "message": "Lead captured and team notified.",
            }

        elif tool_name == "report_issue":
            email_result = send_issue_alert(
                caller_name=tool_args.get("caller_name", ""),
                phone_number=tool_args.get("phone_number", ""),
                issue_description=tool_args.get("issue_description", ""),
                related_job=tool_args.get("related_job", ""),
            )
            result = {
                "success": "error" not in email_result,
                "message": "Issue reported to the team.",
            }

        else:
            result = {"error": f"Unknown tool: {tool_name}"}

    except Exception as e:
        log.error(f"Tool {tool_name} raised exception", e)
        result = {"error": str(e)}

    log.info(f"Tool result: {json.dumps(result, ensure_ascii=False)[:300]}")
    return json.dumps(result)
