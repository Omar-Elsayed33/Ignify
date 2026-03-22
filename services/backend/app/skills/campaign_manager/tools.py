TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "create_campaign",
            "description": "Create a new marketing campaign",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "campaign_type": {"type": "string", "enum": ["email_drip", "social", "ads", "multi_channel"]},
                    "target_audience": {"type": "string"},
                    "start_date": {"type": "string"},
                    "end_date": {"type": "string"},
                    "budget": {"type": "number"},
                },
                "required": ["name", "campaign_type"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "add_campaign_step",
            "description": "Add a step to a campaign workflow",
            "parameters": {
                "type": "object",
                "properties": {
                    "campaign_id": {"type": "string"},
                    "action_type": {"type": "string", "enum": ["send_email", "post_social", "run_ad", "wait", "condition", "sms"]},
                    "config": {"type": "object"},
                    "delay_hours": {"type": "integer", "default": 0},
                },
                "required": ["campaign_id", "action_type"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "launch_campaign",
            "description": "Launch a campaign that is in draft status",
            "parameters": {
                "type": "object",
                "properties": {
                    "campaign_id": {"type": "string"},
                },
                "required": ["campaign_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_campaign_analytics",
            "description": "Get analytics for a specific campaign",
            "parameters": {
                "type": "object",
                "properties": {
                    "campaign_id": {"type": "string"},
                },
                "required": ["campaign_id"],
            },
        },
    },
]
