import io

from open_webui.utils.rate_card_xlsx import parse_import_workbook, parse_price_kopeks
from openpyxl import Workbook


def test_price_and_workbook_validation_preserve_exact_values_and_errors() -> None:
    cases: list[tuple[object, tuple[int | None, str | None]]] = [
        (None, (None, None)),
        ('  ', (None, None)),
        (True, (None, 'Price must be a number')),
        (False, (None, 'Price must be a number')),
        (-1, (None, 'Price must be >= 0')),
        ('-1.0', (None, 'Price must be >= 0')),
        (0, (0, None)),
        (150.0, (150, None)),
        (' 150.0 ', (150, None)),
        (2**100, (2**100, None)),
        (str(2**100), (2**100, None)),
        (150.5, (None, 'Price must be an integer (or *.0)')),
        (float('nan'), (None, 'Price must be an integer (or *.0)')),
        (float('inf'), (None, 'Price must be an integer (or *.0)')),
        ('1,5', (None, 'Price must be a number')),
        ('1e3', (None, 'Price must be a number')),
        ('1.0e3', (1000, None)),
    ]
    for value, expected in cases:
        assert parse_price_kopeks(value) == expected, repr(value)

    wb = Workbook()
    ws = wb.active
    assert ws is not None
    ws.title = 'RateCards'
    ws.append(['model_id', 'modality', 'unit', 'raw_cost_per_unit_kopeks'])
    ws.append(['model', 'text', 'token_in', 0])
    stream = io.BytesIO()
    wb.save(stream)
    rows, errors = parse_import_workbook(stream.getvalue())
    assert not errors and len(rows) == 1
    assert rows[0].is_active and rows[0].raw_cost_per_unit_kopeks == 0
    assert rows[0].provider is rows[0].model_tier is rows[0].is_default is None

    ws.delete_rows(1, ws.max_row)
    ws.append(
        [
            'model_id',
            'modality',
            'unit',
            'raw_cost_per_unit_kopeks',
            'model_id',
            'provider',
            'model_tier',
            'is_active',
            'is_default',
            None,
        ]
    )
    ws.append(['ignored', 'text', 'token_in', False, 'model', '  ', '', 'yes', 'no'])
    ws.append(['ignored', 'unknown', 'wrong', '-2', '', None, None, None, None])
    ws.append(['ignored', 'text', 'wrong', '', 'disabled', None, None, False, None])
    ws.append(['ignored', 'TEXT', 'TOKEN_OUT', 0, 'zero', 0, '  ', True, 'yes'])
    stream = io.BytesIO()
    wb.save(stream)
    rows, errors = parse_import_workbook(stream.getvalue())
    assert [row.model_id for row in rows] == ['model', '', 'disabled', 'zero']
    assert [(error.row_number, error.code, error.column) for error in errors] == [
        (2, 'invalid_price', 'raw_cost_per_unit_kopeks'),
        (2, 'missing_price', 'raw_cost_per_unit_kopeks'),
        (3, 'missing_model_id', 'model_id'),
        (3, 'invalid_modality', 'modality'),
        (3, 'invalid_price', 'raw_cost_per_unit_kopeks'),
        (3, 'missing_price', 'raw_cost_per_unit_kopeks'),
        (4, 'invalid_unit', 'unit'),
    ]
    assert not rows[2].is_active and rows[2].raw_cost_per_unit_kopeks is None
    assert rows[0].is_default is False and rows[3].is_default is True
    assert rows[3].provider == '0' and rows[3].model_tier is None
    assert rows[3].modality == 'text' and rows[3].unit == 'token_out'
