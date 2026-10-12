import pytest
from open_webui.retrieval.vector.dbs.mariadb_vector import MariaDBVectorClient


def test_mariadb_filter_preserves_sql_parameters_and_operator_priority() -> None:
    client = object.__new__(MariaDBVectorClient)
    build = client._build_filter_sql_qmark
    field = "JSON_UNQUOTE(JSON_EXTRACT(vmetadata, '$.file_id'))"
    attack = "file' OR 1=1 --"
    single = f'({field} = ?)'
    for expr, expected in (
        (None, ('', [])),
        ([], ('', [])),
        ({}, ('', [])),
        ({'$unknown': 'ignored'}, ('', [])),
        ({'file_id': attack}, (single, [attack])),
        ({'file_id': None}, (single, ['None'])),
        (
            {'file_id': {'$in': [False, 0, None, attack]}},
            (f'(({" OR ".join([field + " = ?"] * 4)}))', ['False', '0', 'None', attack]),
        ),
        ({'file_id': {'$in': 'ab'}}, (f'(({field} = ? OR {field} = ?))', ['a', 'b'])),
        ({'file_id': {'$in': []}}, ('(0=1)', [])),
        ({'file_id': {'$in': None}}, ('(0=1)', [])),
        (
            {'$and': [{}, {'file_id': 'first'}, {'file_id': 'second'}]},
            (f'({single} AND {single})', ['first', 'second']),
        ),
        ({'$or': [{'file_id': 'first'}, {'file_id': 'second'}]}, (f'({single} OR {single})', ['first', 'second'])),
        ({'$and': [], '$or': [{'file_id': 'ignored'}], 'file_id': 'also ignored'}, ('', [])),
        ({'$and': [{'file_id': 'first'}], '$or': [{'file_id': 'ignored'}]}, (f'({single})', ['first'])),
        ({'$or': None}, ('', [])),
    ):
        assert build(expr) == expected
    for expr in ({'$and': 1}, {'$or': True}, {'file_id': {'$in': 2}}):
        with pytest.raises(TypeError):
            build(expr)
