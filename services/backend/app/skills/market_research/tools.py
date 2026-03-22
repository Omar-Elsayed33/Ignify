TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "analyze_market",
            "description": "Analyze a market segment or industry",
            "parameters": {
                "type": "object",
                "properties": {
                    "industry": {"type": "string"},
                    "region": {"type": "string"},
                    "analysis_depth": {"type": "string", "enum": ["overview", "detailed"]},
                },
                "required": ["industry"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "analyze_store_market",
            "description": "Analyze the local market for a physical store location",
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {"type": "string"},
                    "business_type": {"type": "string"},
                    "radius_km": {"type": "number", "default": 5},
                },
                "required": ["location", "business_type"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "analyze_sentiment",
            "description": "Analyze customer sentiment from reviews and social mentions",
            "parameters": {
                "type": "object",
                "properties": {
                    "brand_name": {"type": "string"},
                    "sources": {"type": "array", "items": {"type": "string", "enum": ["google_reviews", "social_media", "app_reviews"]}},
                },
                "required": ["brand_name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_industry_trends",
            "description": "Get current trends in an industry",
            "parameters": {
                "type": "object",
                "properties": {
                    "industry": {"type": "string"},
                    "region": {"type": "string"},
                },
                "required": ["industry"],
            },
        },
    },
]
