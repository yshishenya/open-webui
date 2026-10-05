from collections.abc import Callable
from copy import deepcopy

import pytest
from open_webui.utils.payload import (
    apply_model_params_to_body_ollama,
    apply_model_params_to_body_openai,
)


@pytest.mark.parametrize(
    'convert, options',
    [(apply_model_params_to_body_openai, False), (apply_model_params_to_body_ollama, True)],
    ids=['openai', 'ollama'],
)
@pytest.mark.parametrize(
    'value, expected',
    [
        ('END', ['END']),
        ('END,STOP', ['END,STOP']),
        ('СТОП', ['СТОП']),
        (['СТОП', '结束', 'café', '😀'], ['СТОП', '结束', 'café', '😀']),
        ([r'\n\n', r'\t', r'\\', r'\u042f', r'\U0001f600', r'\x41'], ['\n\n', '\t', '\\', 'Я', '😀', 'A']),
        (r'\nСТОП\t', ['\nСТОП\t']),
        ([r'\Я', r'C:\Путь', r'\\Я', r'\\u042f', r'\😀', r'\é'], [r'\Я', r'C:\Путь', '\\Я', r'\u042f', r'\😀', r'\é']),
        ([r'\101', r'\N{CYRILLIC CAPITAL LETTER YA}', '\\\n'], ['A', 'Я', '']),
        (['END', 'STOP'], ['END', 'STOP']),
        ('', []),
        ([], []),
        ([''], ['']),
    ],
)
def test_provider_model_stops_preserve_sequences_and_unicode(
    convert: Callable[[dict, dict], dict], options: bool, value: object, expected: list[str]
) -> None:
    body = {'model': 'test-model', 'messages': [], 'options': {'top_k': 77}}
    result = convert({'stop': deepcopy(value), 'temperature': 0.4}, body)
    output = result['options'] if options else result
    assert output['stop'] == expected
    assert output['temperature'] == 0.4
    assert result['model'] == 'test-model'
    assert result['messages'] == []
    assert result['options']['top_k'] == 77


@pytest.mark.parametrize('convert', [apply_model_params_to_body_openai, apply_model_params_to_body_ollama])
def test_custom_stop_override_and_unset_use_actual_provider_mapping(
    convert: Callable[[dict, dict], dict],
) -> None:
    result = convert({'stop': ['default'], 'custom_params': {'stop': '["СТОП","END"]'}}, {})
    output = result.get('options', result)
    assert output['stop'] == ['СТОП', 'END']
    unset = convert({'stop': None, 'seed': 9}, {})
    output = unset.get('options', unset)
    assert 'stop' not in output
    assert output['seed'] == 9


@pytest.mark.parametrize('convert', [apply_model_params_to_body_openai, apply_model_params_to_body_ollama])
@pytest.mark.parametrize('value', [7, True, ['END', 7], {'stop': 'END'}])
def test_provider_model_stops_reject_invalid_types(convert: Callable[[dict, dict], dict], value: object) -> None:
    with pytest.raises(ValueError):
        convert({'stop': value}, {})


@pytest.mark.parametrize('convert', [apply_model_params_to_body_openai, apply_model_params_to_body_ollama])
@pytest.mark.parametrize('value', ['\\', r'\xZ1', r'\u12', r'\U00110000', r'\N{NOT A UNICODE NAME}', r'\uЯ'])
def test_provider_model_stops_reject_malformed_escapes(convert: Callable[[dict, dict], dict], value: str) -> None:
    with pytest.raises(ValueError):
        convert({'stop': value}, {})
