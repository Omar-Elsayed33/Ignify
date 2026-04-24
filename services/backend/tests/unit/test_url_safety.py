"""P1-3: Unit tests for the centralized SSRF-safe URL validator.

Coverage:
- All private/loopback/link-local IP ranges are rejected (IPv4 + IPv6).
- Bare hostnames (Docker service names) are rejected.
- Cloud instance-metadata IPs are rejected.
- Non-HTTP schemes rejected.
- URL user-info rejected.
- Valid public URLs pass.
- `require_https` enforcement.
"""
from __future__ import annotations

from unittest.mock import patch

import pytest

from app.core.url_safety import (
    UnsafeURLError,
    is_public_url,
    validate_public_url,
)


pytestmark = pytest.mark.unit


class TestInternalHostnames:
    @pytest.mark.parametrize("host", [
        "localhost",
        "postgres",
        "redis",
        "minio",
        "backend",
        "worker",
        "dashboard",
        "whatsapp-connector",
        "host.docker.internal",
        "metadata",
    ])
    def test_known_docker_hosts_rejected(self, host):
        with pytest.raises(UnsafeURLError):
            validate_public_url(f"http://{host}/api")

    @pytest.mark.parametrize("host", [
        "evil",       # no-dot bare hostname
        "admin",
        "internal",
        "db",
    ])
    def test_bare_hostnames_rejected(self, host):
        with pytest.raises(UnsafeURLError, match="Bare hostname"):
            validate_public_url(f"http://{host}/")


class TestPrivateIPs:
    @pytest.mark.parametrize("ip", [
        "127.0.0.1",      # loopback
        "127.1.2.3",
        "10.0.0.1",       # RFC1918
        "10.255.255.255",
        "172.16.0.1",
        "172.31.255.255",
        "192.168.0.1",
        "192.168.255.255",
        "169.254.169.254",  # AWS/Azure/GCP instance metadata
        "169.254.0.1",      # link-local
        "0.0.0.0",          # unspecified
    ])
    def test_ipv4_private_rejected(self, ip):
        with pytest.raises(UnsafeURLError):
            validate_public_url(f"http://{ip}:8080/")

    @pytest.mark.parametrize("ip", [
        "::1",              # loopback
        "fe80::1",          # link-local
        "fc00::1",          # unique-local
        "fd12:3456:789a::1",
    ])
    def test_ipv6_private_rejected(self, ip):
        with pytest.raises(UnsafeURLError):
            validate_public_url(f"http://[{ip}]/")


class TestSchemes:
    @pytest.mark.parametrize("scheme", [
        "file", "gopher", "ftp", "ldap", "dict", "sftp", "ssh",
    ])
    def test_non_http_rejected(self, scheme):
        with pytest.raises(UnsafeURLError, match="Scheme"):
            validate_public_url(f"{scheme}://example.com/")

    def test_require_https_rejects_http(self):
        # Mock DNS to avoid real network resolution in the test.
        with patch("app.core.url_safety._resolved_ips", return_value=["93.184.216.34"]):
            with pytest.raises(UnsafeURLError, match="HTTPS"):
                validate_public_url("http://example.com/", require_https=True)

    def test_require_https_accepts_https(self):
        with patch("app.core.url_safety._resolved_ips", return_value=["93.184.216.34"]):
            assert validate_public_url("https://example.com/", require_https=True)


class TestMalformedInput:
    def test_empty_string_rejected(self):
        with pytest.raises(UnsafeURLError):
            validate_public_url("")

    def test_whitespace_only_rejected(self):
        with pytest.raises(UnsafeURLError):
            validate_public_url("   ")

    def test_url_with_userinfo_rejected(self):
        with patch("app.core.url_safety._resolved_ips", return_value=["93.184.216.34"]):
            with pytest.raises(UnsafeURLError, match="user info"):
                validate_public_url("http://admin:secret@example.com/")

    def test_non_string_rejected(self):
        with pytest.raises(UnsafeURLError):
            validate_public_url(None)  # type: ignore[arg-type]


class TestPublicURLsPass:
    def test_public_domain_with_dns_accepted(self):
        # Mock DNS to return a safe public IP.
        with patch("app.core.url_safety._resolved_ips", return_value=["93.184.216.34"]):
            result = validate_public_url("https://example.com/path?q=1")
            assert result == "https://example.com/path?q=1"

    def test_subdomain_accepted(self):
        with patch("app.core.url_safety._resolved_ips", return_value=["185.199.108.153"]):
            assert validate_public_url("https://docs.ignify.ai/") == "https://docs.ignify.ai/"

    def test_public_ipv4_literal_accepted(self):
        # Google DNS — unambiguously public.
        assert validate_public_url("http://8.8.8.8/") == "http://8.8.8.8/"

    def test_dns_resolution_failure_rejected(self):
        """If DNS returns nothing, we can't prove the host is safe — reject."""
        with patch("app.core.url_safety._resolved_ips", return_value=[]):
            with pytest.raises(UnsafeURLError, match="Could not resolve"):
                validate_public_url("https://definitely-not-a-real-domain.invalid/")


class TestDNSRebinding:
    def test_hostname_resolves_to_mixed_public_and_private_rejected(self):
        """Defense-in-depth: if any A record is private, refuse — don't let
        the attacker pick which address we connect to."""
        with patch(
            "app.core.url_safety._resolved_ips",
            return_value=["93.184.216.34", "127.0.0.1"],
        ):
            with pytest.raises(UnsafeURLError, match="private IP"):
                validate_public_url("https://evil.example.com/")


class TestIsPublicURL:
    def test_wrapper_returns_true_on_safe(self):
        with patch("app.core.url_safety._resolved_ips", return_value=["93.184.216.34"]):
            assert is_public_url("https://example.com/") is True

    def test_wrapper_returns_false_on_unsafe(self):
        assert is_public_url("http://localhost/") is False
        assert is_public_url("file:///etc/passwd") is False
        assert is_public_url("") is False
