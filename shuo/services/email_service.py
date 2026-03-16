"""
Email notification service using Resend.

Sends notifications to the Imperium Decorating team for:
- New bookings
- New leads / enquiries
- Issue / complaint alerts
"""

import os
import json
from datetime import datetime
from typing import Optional

import urllib.request
import urllib.error

from ..log import ServiceLogger

log = ServiceLogger("Email")

RESEND_API_URL = "https://api.resend.com/emails"
FROM_ADDRESS = "Imperium Voice Agent <onboarding@resend.dev>"


def _send_via_resend(to: str, subject: str, html: str) -> dict:
    """Low-level Resend API call using stdlib (no extra dependency)."""
    api_key = os.getenv("RESEND_API_KEY", "")
    if not api_key:
        log.error("RESEND_API_KEY not set")
        return {"error": "RESEND_API_KEY not configured"}

    payload = json.dumps(
        {
            "from": FROM_ADDRESS,
            "to": [to],
            "subject": subject,
            "html": html,
        }
    ).encode("utf-8")

    req = urllib.request.Request(
        RESEND_API_URL,
        data=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            body = json.loads(resp.read().decode())
            log.info(f"Email sent: {subject} → {to}")
            return {"id": body.get("id"), "success": True}
    except urllib.error.HTTPError as e:
        err_body = e.read().decode()
        log.error(f"Resend HTTP {e.code}: {err_body}")
        return {"error": f"HTTP {e.code}: {err_body}"}
    except Exception as e:
        log.error("Email send failed", e)
        return {"error": str(e)}


# ── Email templates ──────────────────────────────────────────────────────────


def send_booking_notification(
    caller_name: str,
    phone_number: str,
    email: str,
    service_type: str,
    property_address: str,
    appointment_start: str,
    appointment_end: str,
    notes: str = "",
    event_link: str = "",
) -> dict:
    """Notify the team of a new confirmed booking."""
    business_email = os.getenv("BUSINESS_EMAIL", "info@imperiumdecorating.com")

    cal_link = f'<a href="{event_link}">View in Google Calendar</a>' if event_link else ""

    notes_row = f"<tr><td><b>Notes</b></td><td>{notes}</td></tr>" if notes else ""
    cal_row = f"<tr><td><b>Calendar</b></td><td>{cal_link}</td></tr>" if cal_link else ""

    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
      <div style="background:#1a1a2e;padding:20px;border-radius:8px 8px 0 0">
        <h1 style="color:#e8d5b7;margin:0">📅 New Booking Confirmed</h1>
        <p style="color:#aaa;margin:4px 0 0">Imperium Decorating – AI Voice Agent</p>
      </div>
      <div style="background:#fff;padding:24px;border:1px solid #eee;border-top:none">
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:8px 0;color:#555;width:140px"><b>Customer</b></td><td style="padding:8px 0">{caller_name}</td></tr>
          <tr><td style="padding:8px 0;color:#555"><b>Phone</b></td><td style="padding:8px 0">{phone_number}</td></tr>
          <tr><td style="padding:8px 0;color:#555"><b>Email</b></td><td style="padding:8px 0">{email or 'Not provided'}</td></tr>
          <tr><td style="padding:8px 0;color:#555"><b>Service</b></td><td style="padding:8px 0">{service_type}</td></tr>
          <tr><td style="padding:8px 0;color:#555"><b>Property</b></td><td style="padding:8px 0">{property_address}</td></tr>
          <tr><td style="padding:8px 0;color:#555"><b>Date &amp; Time</b></td><td style="padding:8px 0"><b style="color:#1a1a2e">{appointment_start} – {appointment_end}</b></td></tr>
          {notes_row}
          {cal_row}
        </table>
        <hr style="border:none;border-top:1px solid #eee;margin:20px 0">
        <p style="color:#888;font-size:12px">This booking was taken automatically by the Imperium AI Voice Agent. Please confirm with the customer if needed.</p>
      </div>
    </div>
    """

    return _send_via_resend(
        to=business_email,
        subject=f"📅 New Booking: {service_type} – {caller_name} – {appointment_start}",
        html=html,
    )


def send_lead_notification(
    caller_name: str,
    phone_number: str,
    email: str,
    service_type: str,
    property_address: str,
    message: str,
    urgency: str = "normal",
) -> dict:
    """Notify the team of a new lead / enquiry."""
    business_email = os.getenv("BUSINESS_EMAIL", "info@imperiumdecorating.com")

    urgency_colour = {"high": "#e74c3c", "normal": "#f39c12", "low": "#27ae60"}.get(
        urgency.lower(), "#f39c12"
    )
    urgency_label = urgency.upper()

    address_row = (
        f"<tr><td style='padding:8px 0;color:#555'><b>Property</b></td><td style='padding:8px 0'>{property_address}</td></tr>"
        if property_address
        else ""
    )

    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
      <div style="background:#1a1a2e;padding:20px;border-radius:8px 8px 0 0">
        <h1 style="color:#e8d5b7;margin:0">🔔 New Lead / Enquiry</h1>
        <p style="color:#aaa;margin:4px 0 0">Imperium Decorating – AI Voice Agent</p>
      </div>
      <div style="background:#fff;padding:24px;border:1px solid #eee;border-top:none">
        <div style="background:{urgency_colour};color:#fff;display:inline-block;padding:4px 12px;border-radius:4px;font-size:12px;font-weight:bold;margin-bottom:16px">
          URGENCY: {urgency_label}
        </div>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:8px 0;color:#555;width:140px"><b>Name</b></td><td style="padding:8px 0">{caller_name}</td></tr>
          <tr><td style="padding:8px 0;color:#555"><b>Phone</b></td><td style="padding:8px 0">{phone_number}</td></tr>
          <tr><td style="padding:8px 0;color:#555"><b>Email</b></td><td style="padding:8px 0">{email or 'Not provided'}</td></tr>
          <tr><td style="padding:8px 0;color:#555"><b>Service Interest</b></td><td style="padding:8px 0">{service_type}</td></tr>
          {address_row}
          <tr><td style="padding:8px 0;color:#555;vertical-align:top"><b>Message</b></td><td style="padding:8px 0">{message}</td></tr>
        </table>
        <hr style="border:none;border-top:1px solid #eee;margin:20px 0">
        <p style="color:#888;font-size:12px">This lead was captured automatically by the Imperium AI Voice Agent. Please follow up at your earliest convenience.</p>
      </div>
    </div>
    """

    return _send_via_resend(
        to=business_email,
        subject=f"🔔 New Lead [{urgency_label}]: {service_type} – {caller_name}",
        html=html,
    )


def send_issue_alert(
    caller_name: str,
    phone_number: str,
    issue_description: str,
    related_job: str = "",
) -> dict:
    """Notify the team of a complaint or issue raised by a caller."""
    business_email = os.getenv("BUSINESS_EMAIL", "info@imperiumdecorating.com")

    job_row = (
        f"<tr><td style='padding:8px 0;color:#555'><b>Related Job</b></td><td style='padding:8px 0'>{related_job}</td></tr>"
        if related_job
        else ""
    )

    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
      <div style="background:#c0392b;padding:20px;border-radius:8px 8px 0 0">
        <h1 style="color:#fff;margin:0">⚠️ Issue / Complaint Alert</h1>
        <p style="color:#f5b7b1;margin:4px 0 0">Imperium Decorating – AI Voice Agent</p>
      </div>
      <div style="background:#fff;padding:24px;border:1px solid #eee;border-top:none">
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:8px 0;color:#555;width:140px"><b>Customer</b></td><td style="padding:8px 0">{caller_name}</td></tr>
          <tr><td style="padding:8px 0;color:#555"><b>Phone</b></td><td style="padding:8px 0">{phone_number}</td></tr>
          {job_row}
          <tr><td style="padding:8px 0;color:#555;vertical-align:top"><b>Issue</b></td><td style="padding:8px 0">{issue_description}</td></tr>
        </table>
        <hr style="border:none;border-top:1px solid #eee;margin:20px 0">
        <p style="color:#888;font-size:12px">Please follow up urgently. This alert was generated by the Imperium AI Voice Agent.</p>
      </div>
    </div>
    """

    return _send_via_resend(
        to=business_email,
        subject=f"⚠️ COMPLAINT: {caller_name} – {phone_number}",
        html=html,
    )


def send_confirmation_to_customer(
    caller_name: str,
    customer_email: str,
    service_type: str,
    appointment_start: str,
    appointment_end: str,
    property_address: str,
) -> dict:
    """Send a booking confirmation email to the customer."""
    if not customer_email:
        return {"skipped": "No customer email provided"}

    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
      <div style="background:#1a1a2e;padding:20px;border-radius:8px 8px 0 0">
        <h1 style="color:#e8d5b7;margin:0">Imperium Decorating</h1>
        <p style="color:#aaa;margin:4px 0 0">Booking Confirmation</p>
      </div>
      <div style="background:#fff;padding:24px;border:1px solid #eee;border-top:none">
        <p>Dear {caller_name},</p>
        <p>Thank you for choosing Imperium Decorating! Your appointment has been confirmed.</p>
        <div style="background:#f8f9fa;border-left:4px solid #e8d5b7;padding:16px;margin:16px 0;border-radius:4px">
          <p style="margin:0 0 8px"><b>Service:</b> {service_type}</p>
          <p style="margin:0 0 8px"><b>Address:</b> {property_address}</p>
          <p style="margin:0"><b>Date &amp; Time:</b> {appointment_start} – {appointment_end}</p>
        </div>
        <p>Our team will arrive at the scheduled time. Please ensure access to the property.</p>
        <p>If you need to reschedule or have any questions, please contact us:</p>
        <ul>
          <li>📞 Phone: +44 7482 860007</li>
          <li>📧 Email: info@imperiumdecorating.com</li>
          <li>🌐 Website: imperiumdecorating.com</li>
        </ul>
        <p>We look forward to transforming your property!</p>
        <p style="margin-top:24px">Kind regards,<br><b>The Imperium Decorating Team</b></p>
        <hr style="border:none;border-top:1px solid #eee;margin:20px 0">
        <p style="color:#888;font-size:12px">Imperium Decorating – London &amp; Surrey | imperiumdecorating.com</p>
      </div>
    </div>
    """

    return _send_via_resend(
        to=customer_email,
        subject=f"Booking Confirmed – {service_type} on {appointment_start}",
        html=html,
    )
