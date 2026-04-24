"""Phase 11: provider audit — regression guard against direct-provider drift.

Greps the `app/` tree for patterns that would indicate a direct provider
client outside the whitelisted files. If a future PR adds `import openai`
or `ChatAnthropic(...)` in a module that isn't in the allowlist, this
test fails loudly.

Whitelisted files (reason documented in docs/AI_PROVIDER_POLICY.md):
- app/core/llm.py        → uses ChatOpenAI as OpenRouter transport
- app/core/embeddings.py → OpenAI direct for embeddings only (not text gen)
"""
from __future__ import annotations

import re
from pathlib import Path

import pytest


pytestmark = pytest.mark.unit


# Files that LEGITIMATELY contain OpenAI/Anthropic-related tokens.
ALLOWLIST = {
    "app/core/llm.py",            # OpenRouter via ChatOpenAI transport
    "app/core/llm_json.py",       # Helper that imports from app.core.llm
    "app/core/embeddings.py",     # Embeddings only (not text gen)
    "app/core/config.py",         # Declares the deprecated env vars
    "app/core/openrouter_provisioning.py",  # OpenRouter itself
    "app/modules/ops/router.py",  # Reports which providers are configured
    "app/modules/campaigns/router.py",  # Phase 11-migrated; legacy refs scrubbed
    "app/modules/seo/router.py",  # Phase 11-migrated; legacy refs scrubbed
}


# Patterns that indicate DIRECT provider usage (not OpenRouter).
FORBIDDEN_PATTERNS = [
    # Direct SDK imports
    re.compile(r"^\s*from\s+openai\s+import", re.MULTILINE),
    re.compile(r"^\s*import\s+openai\b", re.MULTILINE),
    re.compile(r"^\s*from\s+anthropic\s+import", re.MULTILINE),
    re.compile(r"^\s*import\s+anthropic\b", re.MULTILINE),
    re.compile(r"^\s*from\s+google\.generativeai", re.MULTILINE),
    re.compile(r"^\s*import\s+google\.generativeai", re.MULTILINE),
    # Direct LangChain provider wrappers
    re.compile(r"\bChatAnthropic\b"),
    re.compile(r"\bChatGoogleGenerativeAI\b"),
    re.compile(r"\blangchain_anthropic\b"),
    re.compile(r"\blangchain_google_genai\b"),
    # Direct API key usage for LLM generation (distinct from embeddings).
    re.compile(r"settings\.ANTHROPIC_API_KEY"),
    re.compile(r"settings\.GOOGLE_API_KEY"),
    re.compile(r"settings\.GEMINI_API_KEY"),
]


def _app_root() -> Path:
    # tests/unit/ → tests → services/backend → ... → app/
    here = Path(__file__).resolve()
    root = here.parents[2]  # services/backend
    return root / "app"


def _scan_file(path: Path) -> list[str]:
    """Return the list of forbidden-pattern matches found in the file."""
    try:
        text = path.read_text(encoding="utf-8")
    except (UnicodeDecodeError, OSError):
        return []
    found: list[str] = []
    for pat in FORBIDDEN_PATTERNS:
        for m in pat.finditer(text):
            found.append(m.group(0))
    return found


class TestNoDirectProviderUsage:
    def test_no_forbidden_provider_imports_outside_allowlist(self):
        root = _app_root()
        assert root.exists(), f"app root not found: {root}"

        violations: dict[str, list[str]] = {}
        for py_file in root.rglob("*.py"):
            rel = py_file.relative_to(root.parent).as_posix()
            if rel in ALLOWLIST:
                continue
            matches = _scan_file(py_file)
            if matches:
                violations[rel] = matches

        assert not violations, (
            "Direct provider usage found outside allowlist — all LLM text "
            "generation must route through app.core.llm.\n\nViolations:\n"
            + "\n".join(
                f"  {path}:\n    " + "\n    ".join(sorted(set(matches)))
                for path, matches in sorted(violations.items())
            )
            + "\n\nIf this is a new legitimate exception, add it to ALLOWLIST in "
            "tests/unit/test_provider_audit.py and document the reason in "
            "docs/AI_PROVIDER_POLICY.md."
        )

    def test_allowlist_files_exist(self):
        """Guard against typos — every allowlisted file must actually exist."""
        root = _app_root().parent  # services/backend
        for rel in ALLOWLIST:
            path = root / rel
            assert path.exists(), (
                f"Allowlisted path does not exist: {rel} — remove it or fix the path."
            )


class TestCentralLLMAccessor:
    """The centralized OpenRouter transport lives in exactly one place. If
    someone splits it, readers (and auditors) won't know where to look."""

    def test_get_llm_is_in_core_llm_module(self):
        from app.core.llm import get_llm, get_llm_for_tenant
        assert callable(get_llm)
        assert callable(get_llm_for_tenant)

    def test_llm_json_helper_routes_via_core_llm(self):
        # Just confirm the module imports cleanly and uses get_llm_for_tenant.
        import app.core.llm_json as llm_json_mod
        assert hasattr(llm_json_mod, "llm_json")
        src = (Path(llm_json_mod.__file__)).read_text(encoding="utf-8")
        assert "get_llm_for_tenant" in src, (
            "llm_json.py must delegate to get_llm_for_tenant — otherwise it "
            "could bypass the OpenRouter-only policy."
        )
