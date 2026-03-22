TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "analyze_competitor",
            "description": "Run a comprehensive analysis on a competitor",
            "parameters": {
                "type": "object",
                "properties": {
                    "competitor_name": {"type": "string"},
                    "website": {"type": "string"},
                    "analysis_type": {"type": "string", "enum": ["full", "seo", "social", "ads", "content"]},
                },
                "required": ["competitor_name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "compare_competitors",
            "description": "Compare multiple competitors side by side",
            "parameters": {
                "type": "object",
                "properties": {
                    "competitor_ids": {"type": "array", "items": {"type": "string"}},
                    "metrics": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["competitor_ids"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "spy_competitor_ads",
            "description": "View what ads a competitor is currently running",
            "parameters": {
                "type": "object",
                "properties": {
                    "competitor_name": {"type": "string"},
                    "platform": {"type": "string", "enum": ["google", "meta", "all"]},
                },
                "required": ["competitor_name"],
            },
        },
    },
]
