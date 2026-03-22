TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "research_keywords",
            "description": "Research keywords for a topic and return volume, difficulty, and suggestions",
            "parameters": {
                "type": "object",
                "properties": {
                    "seed_keywords": {"type": "array", "items": {"type": "string"}},
                    "language": {"type": "string", "default": "en"},
                    "country": {"type": "string", "default": "US"},
                },
                "required": ["seed_keywords"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "run_seo_audit",
            "description": "Run an SEO audit on a URL",
            "parameters": {
                "type": "object",
                "properties": {
                    "url": {"type": "string"},
                    "audit_type": {"type": "string", "enum": ["full", "technical", "content", "backlinks"]},
                },
                "required": ["url"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "check_rankings",
            "description": "Check current SERP rankings for tracked keywords",
            "parameters": {
                "type": "object",
                "properties": {
                    "keywords": {"type": "array", "items": {"type": "string"}},
                    "domain": {"type": "string"},
                },
                "required": ["domain"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_seo_recommendations",
            "description": "Get AI-powered SEO improvement recommendations",
            "parameters": {
                "type": "object",
                "properties": {
                    "url": {"type": "string"},
                    "focus_area": {"type": "string", "enum": ["on_page", "technical", "content_gaps", "backlinks"]},
                },
                "required": ["url"],
            },
        },
    },
]
