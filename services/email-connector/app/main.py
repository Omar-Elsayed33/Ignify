"""
Ignify Email Connector - IMAP/SMTP email channel.
Polls IMAP for new emails, forwards to backend, sends replies via SMTP.
"""

import asyncio
import imaplib
import email as email_lib
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from fastapi import FastAPI, BackgroundTasks
from pydantic import BaseModel
import httpx
import os

app = FastAPI(title="Ignify Email Connector", version="1.0.0")

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")

# Store email account configs per tenant
email_accounts: dict = {}
polling_tasks: dict = {}


class EmailAccountConfig(BaseModel):
    tenant_id: str
    channel_id: str
    imap_host: str
    imap_port: int = 993
    smtp_host: str
    smtp_port: int = 587
    email_address: str
    password: str
    poll_interval: int = 30


class SendEmailRequest(BaseModel):
    to: str
    subject: str
    body: str
    html: bool = False


async def poll_emails(config: EmailAccountConfig):
    """Poll IMAP for new emails and forward to backend."""
    while config.tenant_id in email_accounts:
        try:
            imap = imaplib.IMAP4_SSL(config.imap_host, config.imap_port)
            imap.login(config.email_address, config.password)
            imap.select("INBOX")

            _, message_ids = imap.search(None, "UNSEEN")
            for msg_id in message_ids[0].split():
                if not msg_id:
                    continue

                _, msg_data = imap.fetch(msg_id, "(RFC822)")
                raw_email = msg_data[0][1]
                msg = email_lib.message_from_bytes(raw_email)

                sender = email_lib.utils.parseaddr(msg["From"])[1]
                subject = msg.get("Subject", "")

                body = ""
                if msg.is_multipart():
                    for part in msg.walk():
                        if part.get_content_type() == "text/plain":
                            body = part.get_payload(decode=True).decode("utf-8", errors="replace")
                            break
                else:
                    body = msg.get_payload(decode=True).decode("utf-8", errors="replace")

                # Forward to backend
                async with httpx.AsyncClient() as client:
                    try:
                        resp = await client.post(
                            f"{BACKEND_URL}/api/v1/conversations/inbound",
                            json={
                                "channel_type": "email",
                                "channel_id": config.channel_id,
                                "tenant_id": config.tenant_id,
                                "external_id": sender,
                                "customer_name": sender,
                                "message": f"Subject: {subject}\n\n{body}",
                            },
                        )
                        reply = resp.json().get("reply")
                        if reply:
                            send_email(config, sender, f"Re: {subject}", reply)
                    except Exception as e:
                        print(f"Error forwarding email: {e}")

                imap.store(msg_id, "+FLAGS", "\\Seen")

            imap.logout()
        except Exception as e:
            print(f"IMAP poll error for {config.tenant_id}: {e}")

        await asyncio.sleep(config.poll_interval)


def send_email(config: EmailAccountConfig, to: str, subject: str, body: str, html: bool = False):
    """Send an email via SMTP."""
    msg = MIMEMultipart("alternative")
    msg["From"] = config.email_address
    msg["To"] = to
    msg["Subject"] = subject

    if html:
        msg.attach(MIMEText(body, "html"))
    else:
        msg.attach(MIMEText(body, "plain"))

    with smtplib.SMTP(config.smtp_host, config.smtp_port) as server:
        server.starttls()
        server.login(config.email_address, config.password)
        server.send_message(msg)


@app.post("/register")
async def register_account(config: EmailAccountConfig, background_tasks: BackgroundTasks):
    email_accounts[config.tenant_id] = config
    background_tasks.add_task(poll_emails, config)
    return {"status": "registered", "polling": True}


@app.post("/send/{tenant_id}")
async def send(tenant_id: str, req: SendEmailRequest):
    config = email_accounts.get(tenant_id)
    if not config:
        return {"error": "No email account registered for tenant"}

    send_email(config, req.to, req.subject, req.body, req.html)
    return {"status": "sent"}


@app.delete("/disconnect/{tenant_id}")
async def disconnect(tenant_id: str):
    email_accounts.pop(tenant_id, None)
    return {"status": "disconnected"}


@app.get("/health")
async def health():
    return {"status": "ok", "service": "ignify-email-connector", "accounts": len(email_accounts)}
