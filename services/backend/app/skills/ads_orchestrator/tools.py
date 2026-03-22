TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "create_ad_campaign",
            "description": "Create a new ad campaign on a specified platform",
            "parameters": {
                "type": "object",
                "properties": {
                    "platform": {"type": "string", "enum": ["google", "meta", "snapchat", "youtube"]},
                    "name": {"type": "string"},
                    "objective": {"type": "string", "enum": ["awareness", "traffic", "engagement", "leads", "conversions", "sales"]},
                    "daily_budget": {"type": "number"},
                    "target_audience": {"type": "object", "properties": {
                        "age_min": {"type": "integer"}, "age_max": {"type": "integer"},
                        "gender": {"type": "string"}, "interests": {"type": "array", "items": {"type": "string"}},
                        "locations": {"type": "array", "items": {"type": "string"}},
                    }},
                    "start_date": {"type": "string"}, "end_date": {"type": "string"},
                },
                "required": ["platform", "name", "objective", "daily_budget"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_ad_performance",
            "description": "Get performance metrics for ad campaigns",
            "parameters": {
                "type": "object",
                "properties": {
                    "platform": {"type": "string", "enum": ["google", "meta", "snapchat", "youtube", "all"]},
                    "date_range": {"type": "string", "enum": ["today", "7d", "30d", "90d"]},
                    "campaign_id": {"type": "string", "description": "Specific campaign ID or 'all'"},
                },
                "required": ["platform", "date_range"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "optimize_ad_budget",
            "description": "Get AI recommendations for budget optimization across platforms",
            "parameters": {
                "type": "object",
                "properties": {
                    "total_budget": {"type": "number"},
                    "optimization_goal": {"type": "string", "enum": ["maximize_reach", "minimize_cpa", "maximize_roas"]},
                },
                "required": ["total_budget", "optimization_goal"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "pause_campaign",
            "description": "Pause an active ad campaign",
            "parameters": {
                "type": "object",
                "properties": {
                    "campaign_id": {"type": "string"},
                    "platform": {"type": "string"},
                },
                "required": ["campaign_id", "platform"],
            },
        },
    },
]
