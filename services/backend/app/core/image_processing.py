"""Image post-processing utilities (logo overlay, etc)."""
from __future__ import annotations

import io

import httpx
from PIL import Image


async def overlay_logo(
    base_image_url: str,
    logo_url: str,
    position: str = "bottom-right",
    opacity: float = 0.8,
) -> bytes:
    """Download `base_image_url` + `logo_url`, overlay logo, return JPEG bytes.

    Logo is resized to ~15% of base width and placed at one of:
    top-left, top-right, bottom-left, bottom-right, center.
    """
    async with httpx.AsyncClient(timeout=60.0) as client:
        base_resp = await client.get(base_image_url)
        base_resp.raise_for_status()
        logo_resp = await client.get(logo_url)
        logo_resp.raise_for_status()

    base = Image.open(io.BytesIO(base_resp.content)).convert("RGBA")
    logo = Image.open(io.BytesIO(logo_resp.content)).convert("RGBA")

    # Resize logo to 15% of base width
    ratio = (base.width * 0.15) / max(logo.width, 1)
    new_size = (max(int(logo.width * ratio), 1), max(int(logo.height * ratio), 1))
    logo = logo.resize(new_size, Image.LANCZOS)

    # Apply opacity
    if opacity < 1.0:
        alpha = logo.split()[3].point(lambda p: int(p * opacity))
        logo.putalpha(alpha)

    padding = 20
    positions = {
        "top-left": (padding, padding),
        "top-right": (base.width - logo.width - padding, padding),
        "bottom-left": (padding, base.height - logo.height - padding),
        "bottom-right": (
            base.width - logo.width - padding,
            base.height - logo.height - padding,
        ),
        "center": (
            (base.width - logo.width) // 2,
            (base.height - logo.height) // 2,
        ),
    }
    pos = positions.get(position, positions["bottom-right"])
    base.paste(logo, pos, logo)

    buf = io.BytesIO()
    base.convert("RGB").save(buf, format="JPEG", quality=92)
    return buf.getvalue()
