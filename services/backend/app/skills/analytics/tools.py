TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_marketing_overview",
            "description": "Get a high-level overview of all marketing metrics",
            "parameters": {
                "type": "object",
                "properties": {
                    "date_range": {"type": "string", "enum": ["7d", "30d", "90d", "ytd"]},
                },
                "required": ["date_range"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_channel_performance",
            "description": "Compare performance across marketing channels",
            "parameters": {
                "type": "object",
                "properties": {
                    "channels": {"type": "array", "items": {"type": "string"}},
                    "metrics": {"type": "array", "items": {"type": "string", "enum": ["impressions", "clicks", "conversions", "spend", "revenue", "roi"]}},
                    "date_range": {"type": "string"},
                },
                "required": ["date_range"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "generate_report",
            "description": "Generate a marketing report (PDF)",
            "parameters": {
                "type": "object",
                "properties": {
                    "report_type": {"type": "string", "enum": ["weekly", "monthly", "campaign", "custom"]},
                    "date_range": {"type": "string"},
                    "sections": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["report_type"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "calculate_roi",
            "description": "Calculate ROI for campaigns or channels",
            "parameters": {
                "type": "object",
                "properties": {
                    "scope": {"type": "string", "enum": ["campaign", "channel", "overall"]},
                    "scope_id": {"type": "string"},
                    "date_range": {"type": "string"},
                },
                "required": ["scope"],
            },
        },
    },
]
