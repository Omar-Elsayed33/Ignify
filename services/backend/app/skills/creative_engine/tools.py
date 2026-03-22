TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "generate_image",
            "description": "Generate a marketing image using AI",
            "parameters": {
                "type": "object",
                "properties": {
                    "prompt": {"type": "string", "description": "Image generation prompt"},
                    "style": {"type": "string", "enum": ["photorealistic", "illustration", "flat_design", "3d_render", "minimalist"]},
                    "size": {"type": "string", "enum": ["1024x1024", "1792x1024", "1024x1792"], "default": "1024x1024"},
                    "purpose": {"type": "string", "enum": ["social_post", "ad_banner", "story", "logo", "product_mockup", "thumbnail"]},
                    "brand_colors": {"type": "array", "items": {"type": "string"}, "description": "Brand colors to include"},
                },
                "required": ["prompt"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "generate_banner",
            "description": "Generate an ad banner for a specific platform",
            "parameters": {
                "type": "object",
                "properties": {
                    "platform": {"type": "string", "enum": ["google_display", "facebook", "instagram_story", "snapchat", "youtube_thumbnail"]},
                    "headline": {"type": "string"},
                    "subtext": {"type": "string"},
                    "cta_text": {"type": "string"},
                    "style": {"type": "string"},
                },
                "required": ["platform", "headline"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "resize_image",
            "description": "Resize an existing image for different platforms",
            "parameters": {
                "type": "object",
                "properties": {
                    "asset_id": {"type": "string", "description": "ID of the existing asset"},
                    "target_platforms": {"type": "array", "items": {"type": "string"}, "description": "Platforms to resize for"},
                },
                "required": ["asset_id", "target_platforms"],
            },
        },
    },
]
