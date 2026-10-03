from __future__ import annotations

import unittest

from check_backend_lint_delta import Diagnostic, new_diagnostics, unchanged_lines


def diagnostic(row: int, column: int = 1) -> Diagnostic:
    return {
        'filename': 'test.py',
        'code': 'F401',
        'message': 'unused import',
        'location': {'row': row, 'column': column},
    }


class TestBackendLintDelta(unittest.TestCase):
    def test_shifted_existing_error_is_preserved(self) -> None:
        mapping = unchanged_lines('import old\nbody', '# comment\nimport old\nbody')
        self.assertEqual(new_diagnostics([diagnostic(1)], [diagnostic(2)], mapping), [])

    def test_modified_error_line_is_new(self) -> None:
        mapping = unchanged_lines('import old\nbody', 'import new\nbody')
        self.assertEqual(len(new_diagnostics([diagnostic(1)], [diagnostic(1)], mapping)), 1)

    def test_duplicate_error_is_not_hidden(self) -> None:
        mapping = unchanged_lines('import old\nbody', 'import old\nimport old\nbody')
        self.assertEqual(len(new_diagnostics([diagnostic(1)], [diagnostic(1), diagnostic(2)], mapping)), 1)

    def test_new_rule_or_column_is_not_hidden(self) -> None:
        changed = diagnostic(1, column=2)
        self.assertEqual(len(new_diagnostics([diagnostic(1)], [changed], {1: 1})), 1)
        changed = diagnostic(1)
        changed['code'] = 'F821'
        self.assertEqual(len(new_diagnostics([diagnostic(1)], [changed], {1: 1})), 1)

    def test_removed_error_cannot_offset_another_error(self) -> None:
        self.assertEqual(len(new_diagnostics([diagnostic(1)], [diagnostic(2)], {2: 2})), 1)

    def test_new_file_requires_zero_errors(self) -> None:
        self.assertEqual(len(new_diagnostics([], [diagnostic(1)], {})), 1)
