import time

from open_webui.utils.airis.billing_reporting import (
    amount_to_kopeks,
    normalize_range,
    safe_csv_cell,
)


def test_amount_to_kopeks_uses_decimal_conversion() -> None:
    assert amount_to_kopeks('12.34') == 1234
    assert amount_to_kopeks('0.10') == 10


def test_normalize_range_defaults_and_rejects_large_ranges() -> None:
    start, end = normalize_range(100, 200)
    assert (start, end) == (100, 200)

    try:
        now = int(time.time())
        normalize_range(now - 367 * 86400, now)
    except ValueError as error:
        assert '366 days' in str(error)
    else:
        raise AssertionError('expected oversized reporting range to fail')


def test_safe_csv_cell_blocks_formula_execution() -> None:
    assert safe_csv_cell('=SUM(A1)') == "'=SUM(A1)"
    assert safe_csv_cell('+100') == "'+100"
    assert safe_csv_cell('customer@example.com') == 'customer@example.com'
