TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "schedule_social_post",
            "description": "Schedule a post to one or more social media platforms",
            "parameters": {
                "type": "object",
                "properties": {
                    "platforms": {"type": "array", "items": {"type": "string", "enum": ["instagram", "facebook", "twitter", "linkedin", "tiktok", "snapchat"]}},
                    "content": {"type": "string"},
                    "media_urls": {"type": "array", "items": {"type": "string"}},
                    "scheduled_at": {"type": "string", "description": "ISO datetime"},
                    "hashtags": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["platforms", "content", "scheduled_at"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_social_metrics",
            "description": "Get engagement metrics for social media posts",
            "parameters": {
                "type": "object",
                "properties": {
                    "platform": {"type": "string", "enum": ["instagram", "facebook", "twitter", "linkedin", "tiktok", "all"]},
                    "date_range": {"type": "string", "enum": ["7d", "30d", "90d"]},
                },
                "required": ["platform", "date_range"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "suggest_hashtags",
            "description": "Suggest relevant hashtags for a topic",
            "parameters": {
                "type": "object",
                "properties": {
                    "topic": {"type": "string"},
                    "platform": {"type": "string"},
                    "count": {"type": "integer", "default": 15},
                },
                "required": ["topic"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_best_posting_time",
            "description": "Get the optimal posting times based on audience engagement data",
            "parameters": {
                "type": "object",
                "properties": {
                    "platform": {"type": "string"},
                    "timezone": {"type": "string", "default": "UTC"},
                },
                "required": ["platform"],
            },
        },
    },
]
