import subprocess
import sys

from open_webui.utils.chat_variables import (
    CHAT_VARIABLE_ANY_RE,
    USER_VARIABLE_ANY_RE,
    collect_chat_variable_fields,
    render_chat_variables,
    render_user_variables,
)


def test_variable_tokens_preserve_fields_and_handle_unclosed_input() -> None:
    prompt = '{{ chat.variables.topic | text:default="hello {world" }}'
    assert collect_chat_variable_fields(prompt)['topic']['default'] == 'hello {world'
    assert render_chat_variables(prompt, {}) == 'hello {world'
    assert render_chat_variables('{{chat.variables.topic}}', {'topic': 'value'}) == 'value'
    assert render_user_variables('{{ user.variables.name }}', {'name': 'Jan'}) == 'Jan'
    select = '{{chat.variables.choice | select:options=["A","B"]:default="A"}}'
    assert render_chat_variables(select, {}) == 'A'
    assert render_chat_variables(select, {'choice': 'B'}) == 'B'
    assert render_chat_variables('before {{chat.variables.topic}} after', {'topic': 'value'}) == 'before value after'

    # Use a child process so a backtracking regression fails instead of hanging pytest.
    for pattern in (CHAT_VARIABLE_ANY_RE, USER_VARIABLE_ANY_RE):
        script = (
            f'import re; p = re.compile({pattern.pattern!r}); '
            'prefix = "{{chat.variables." if "chat" in p.pattern else "{{user.variables."; '
            'inputs = [prefix * 20000, (prefix + "key|") * 20000, '
            'prefix + "!" + " " * 200000]; '
            'assert all(p.sub("", value) == value for value in inputs)'
        )
        subprocess.run([sys.executable, '-c', script], check=True, timeout=3)
