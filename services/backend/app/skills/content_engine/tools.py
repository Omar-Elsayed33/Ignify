TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "generate_blog_post",
            "description": "Generate an SEO-optimized blog post on a given topic",
            "parameters": {
                "type": "object",
                "properties": {
                    "topic": {"type": "string", "description": "Blog post topic"},
                    "keywords": {"type": "array", "items": {"type": "string"}, "description": "Target SEO keywords"},
                    "tone": {"type": "string", "enum": ["professional", "casual", "friendly", "authoritative"], "description": "Writing tone"},
                    "word_count": {"type": "integer", "description": "Target word count", "default": 1000},
                    "language": {"type": "string", "enum": ["en", "ar"], "default": "en"},
                },
                "required": ["topic"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "generate_social_caption",
            "description": "Generate a social media caption for a specific platform",
            "parameters": {
                "type": "object",
                "properties": {
                    "platform": {"type": "string", "enum": ["instagram", "facebook", "twitter", "linkedin", "tiktok"]},
                    "topic": {"type": "string", "description": "What the post is about"},
                    "include_hashtags": {"type": "boolean", "default": True},
                    "include_emoji": {"type": "boolean", "default": True},
                    "cta": {"type": "string", "description": "Call to action"},
                    "language": {"type": "string", "enum": ["en", "ar"], "default": "en"},
                },
                "required": ["platform", "topic"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "generate_email_copy",
            "description": "Generate email marketing copy (subject + body)",
            "parameters": {
                "type": "object",
                "properties": {
                    "email_type": {"type": "string", "enum": ["newsletter", "promotional", "welcome", "follow_up", "drip"]},
                    "topic": {"type": "string"},
                    "audience": {"type": "string", "description": "Target audience description"},
                    "cta": {"type": "string"},
                    "language": {"type": "string", "enum": ["en", "ar"], "default": "en"},
                },
                "required": ["email_type", "topic"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "generate_ad_copy",
            "description": "Generate ad copy for Google Ads or Meta Ads",
            "parameters": {
                "type": "object",
                "properties": {
                    "platform": {"type": "string", "enum": ["google_ads", "meta_ads", "snapchat_ads"]},
                    "product": {"type": "string", "description": "Product or service name"},
                    "usp": {"type": "string", "description": "Unique selling proposition"},
                    "target_audience": {"type": "string"},
                    "variations": {"type": "integer", "default": 3, "description": "Number of variations to generate"},
                    "language": {"type": "string", "enum": ["en", "ar"], "default": "en"},
                },
                "required": ["platform", "product"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "rewrite_content",
            "description": "Rewrite existing content with a different tone or for a different platform",
            "parameters": {
                "type": "object",
                "properties": {
                    "original_content": {"type": "string"},
                    "target_tone": {"type": "string"},
                    "target_platform": {"type": "string"},
                    "language": {"type": "string", "enum": ["en", "ar"], "default": "en"},
                },
                "required": ["original_content"],
            },
        },
    },
]
