"""AI processing stub.

=====================================================================
  THIS IS A PLACEHOLDER. Replace the body of `analyze_image` with your
  Google Gemini scripts when ready. The rest of the app only depends on
  the RETURN SHAPE below, so as long as you keep that shape, nothing else
  needs to change.
=====================================================================

Expected return shape for each image:
    {
        "title": str,
        "description": str,
        "bullet_points": list[str],
        "keywords": list[str],
    }
"""
import time


def analyze_image(image_path: str, image_name: str) -> dict:
    """Analyze a single image and return listing fields.

    TODO: plug in your Gemini prompt/training pipeline here.
    For the prototype we simulate work with a short delay and fake data.
    """
    time.sleep(0.4)  # simulate model latency so the progress bar is visible

    stem = image_name.rsplit(".", 1)[0]
    return {
        "title": f"[SAMPLE TITLE] Product from {stem}",
        "description": (
            f"[SAMPLE DESCRIPTION] Auto-generated description for {image_name}. "
            "Replace with real Gemini output."
        ),
        "bullet_points": [
            "[SAMPLE] Bullet point 1",
            "[SAMPLE] Bullet point 2",
            "[SAMPLE] Bullet point 3",
        ],
        "keywords": ["sample", "keyword", stem.lower()],
    }
