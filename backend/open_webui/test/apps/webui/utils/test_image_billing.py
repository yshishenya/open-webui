import base64
import io
from decimal import Decimal

from open_webui.utils.airis.image_billing import (
    estimate_gpt_image_2_edit_units,
    gpt_image_2_edit_units_from_usage,
)
from PIL import Image


def test_gpt_image_2_edit_hold_covers_provider_usage() -> None:
    image = Image.new('RGB', (1024, 1024), 'white')
    buffer = io.BytesIO()
    image.save(buffer, format='PNG')
    data_url = f'data:image/png;base64,{base64.b64encode(buffer.getvalue()).decode()}'

    usage = {
        'input_tokens_details': {'image_tokens': 1024, 'text_tokens': 21},
        'output_tokens': 1756,
    }
    actual_units = gpt_image_2_edit_units_from_usage(usage)
    estimated_units = estimate_gpt_image_2_edit_units(
        images=data_url,
        prompt='Change the blue square to a red circle. Keep the white background.',
        requested_count=1,
    )
    held_units = Decimal(1) + (estimated_units - Decimal(1)) * Decimal('1.10')

    assert actual_units == Decimal(60977) / Decimal(53000)
    assert estimated_units < held_units
    assert held_units >= actual_units
