"""Centralized SSRF-safe URL validation.

Every tenant-supplied URL (competitor scraper, webhook destinations, website
analyzer, SEO crawler) MUST be validated via `validate_public_url()` before
being fetched by the backend. Otherwise a tenant can make our backend probe
internal services — Docker hostnames like `redis`, `postgres`, `minio`;
cloud metadata endpoints at `169.254.169.254`; private RFC-1918 networks.

Use two entry points:
- `validate_public_url(url)` → raises `UnsafeURLError` on any violation.
- `is_public_url(url)` → bool wrapper for non-raising callsites.

What is rejected
----------------
1. Non-HTTP(S) schemes (`file://`, `gopher://`, `ftp://`, …).
2. Hostnames that resolve (via getaddrinfo) to IPs in:
   - loopback (127.0.0.0/8, ::1/128)
   - link-local (169.254.0.0/16, fe80::/10)
   - private (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, fc00::/7)
   - unspecified (0.0.0.0/8, ::/128)
   - reserved / multicast / broadcast
3. Bare Docker service hostnames without a dot (`redis`, `postgres`, `backend`,
   `minio`, `worker`, `dashboard`, `website`, `whatsapp`, `messenger`, etc.).
   These would resolve inside the Docker network and bypass IP checks.
4. URL-encoded or IP-literal variants of the above.

Design notes
------------
- We do DNS resolution with `getaddrinfo` and reject if ANY resolved address
  is private. This prevents DNS-rebinding where the attacker's domain first
  resolves to a public IP (passing the check) and then to 127.0.0.1 at fetch
  time. Callers should ideally resolve once here, then pass the resolved IP
  to httpx to eliminate the TOCTOU window — but for now we accept a small
  rebinding risk in exchange for simpler integration.
- Bare hostnames are rejected even if DNS resolution fails — an attacker
  can't cause a Docker service lookup if we refuse to look them up.
"""
from __future__ import annotations

import ipaddress
import logging
import socket
from urllib.parse import urlparse

logger = logging.getLogger(__name__)


class UnsafeURLError(ValueError):
    """Raised when a URL fails SSRF validation."""


# Docker service names that appear on our internal network. We refuse to
# resolve bare (no-dot) hostnames that match any of these — even if DNS
# resolution fails. The list is conservative; any bare hostname is rejected.
_KNOWN_INTERNAL_HOSTS: frozenset[str] = frozenset({
    "postgres", "redis", "minio", "backend", "worker", "worker-beat",
    "dashboard", "website", "whatsapp", "whatsapp-connector",
    "messenger", "messenger-connector",
    "instagram", "instagram-connector",
    "email", "email-connector",
    "slack", "slack-connector",
    "localhost", "host.docker.internal",
    # AWS / GCP / Azure instance metadata services
    "metadata", "metadata.google.internal",
    # pgbouncer / redis-sentinel / prometheus / sentry et al — fail-closed default
})

_ALLOWED_SCHEMES: frozenset[str] = frozenset({"http", "https"})


def _is_private_ip(ip_str: str) -> bool:
    """Return True if the IP is in any non-public range we must block."""
    try:
        ip = ipaddress.ip_address(ip_str)
    except ValueError:
        # Can't parse → treat as unsafe.
        return True
    return (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_multicast
        or ip.is_reserved
        or ip.is_unspecified
    )


def _resolved_ips(host: str) -> list[str]:
    """Return all A/AAAA addresses for `host`. Empty list on resolution failure."""
    try:
        infos = socket.getaddrinfo(host, None, proto=socket.IPPROTO_TCP)
    except socket.gaierror:
        return []
    out: list[str] = []
    for info in infos:
        sockaddr = info[4]
        ip = sockaddr[0]
        if ip and ip not in out:
            out.append(ip)
    return out


def validate_public_url(url: str, *, require_https: bool = False) -> str:
    """Normalize and validate a public URL. Returns the cleaned URL on success.

    Raises:
        UnsafeURLError if any check fails.

    Args:
        url: Tenant-supplied URL.
        require_https: If True, reject `http://` URLs (used for webhook
            destinations in production).
    """
    if not isinstance(url, str) or not url.strip():
        raise UnsafeURLError("URL is empty")

    url = url.strip()
    parsed = urlparse(url)

    if parsed.scheme.lower() not in _ALLOWED_SCHEMES:
        raise UnsafeURLError(f"Scheme not allowed: {parsed.scheme!r}")

    if require_https and parsed.scheme.lower() != "https":
        raise UnsafeURLError("HTTPS is required for this URL")

    host = (parsed.hostname or "").strip().lower()
    if not host:
        raise UnsafeURLError("URL has no host")

    # Reject usernames/passwords in URL (`http://user:pass@host/…`) — they can
    # be used to construct confusing URLs that bypass string-based allowlists.
    if parsed.username or parsed.password:
        raise UnsafeURLError("URL must not contain user info")

    # 1. Block known internal Docker service names regardless of DNS.
    if host in _KNOWN_INTERNAL_HOSTS:
        raise UnsafeURLError(f"Host {host!r} is an internal service")

    # 2. Block bare hostnames (no dot). "evil" or "redis" on their own would
    #    only resolve via container DNS inside our Docker network.
    if "." not in host and not _is_ip_literal(host):
        raise UnsafeURLError(
            f"Bare hostname {host!r} not allowed — use a fully-qualified domain"
        )

    # 3. If the host is an IP literal, check it directly.
    if _is_ip_literal(host):
        if _is_private_ip(host):
            raise UnsafeURLError(f"IP {host!r} is in a private/reserved range")
        return url

    # 4. DNS-resolve the hostname and reject if ANY resolved IP is private.
    ips = _resolved_ips(host)
    if not ips:
        raise UnsafeURLError(f"Could not resolve host {host!r}")
    bad = [ip for ip in ips if _is_private_ip(ip)]
    if bad:
        raise UnsafeURLError(
            f"Host {host!r} resolves to private IP(s): {', '.join(bad)}"
        )

    return url


def is_public_url(url: str, *, require_https: bool = False) -> bool:
    """Non-raising variant. Returns True if the URL is safe to fetch."""
    try:
        validate_public_url(url, require_https=require_https)
        return True
    except UnsafeURLError:
        return False


def _is_ip_literal(host: str) -> bool:
    """Return True if `host` is a literal IPv4 or IPv6 address."""
    # IPv6 arrives from urlparse() stripped of brackets.
    try:
        ipaddress.ip_address(host)
        return True
    except ValueError:
        return False
