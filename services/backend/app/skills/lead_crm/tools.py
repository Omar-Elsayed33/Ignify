TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "capture_lead",
            "description": "Capture a new lead from any channel",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "email": {"type": "string"},
                    "phone": {"type": "string"},
                    "company": {"type": "string"},
                    "source": {"type": "string", "enum": ["whatsapp", "messenger", "instagram", "website", "ads", "manual"]},
                    "notes": {"type": "string"},
                },
                "required": ["name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "score_lead",
            "description": "Calculate AI-based lead score",
            "parameters": {
                "type": "object",
                "properties": {
                    "lead_id": {"type": "string"},
                },
                "required": ["lead_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "update_lead_status",
            "description": "Move a lead to a different pipeline stage",
            "parameters": {
                "type": "object",
                "properties": {
                    "lead_id": {"type": "string"},
                    "status": {"type": "string", "enum": ["new", "contacted", "qualified", "proposal", "won", "lost"]},
                    "notes": {"type": "string"},
                },
                "required": ["lead_id", "status"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_lead_summary",
            "description": "Get a summary of leads by status and source",
            "parameters": {
                "type": "object",
                "properties": {
                    "date_range": {"type": "string", "enum": ["7d", "30d", "90d", "all"]},
                },
                "required": [],
            },
        },
    },
]
