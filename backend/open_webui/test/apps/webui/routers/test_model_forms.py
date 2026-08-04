from open_webui.models.models import ModelForm
from open_webui.models.prompts import PromptForm
from open_webui.models.tools import ToolForm


def test_model_form_accepts_explicit_null_access_grants() -> None:
    form = ModelForm(
        id="gpt-5.6-luna",
        name="GPT 5.6 Luna",
        meta={},
        params={},
        access_grants=None,
    )

    assert form.access_grants is None


def test_other_optional_acl_forms_accept_explicit_null_access_grants() -> None:
    prompt = PromptForm(command="/test", name="Test", content="content", access_grants=None)
    tool = ToolForm(id="tool", name="Tool", content="content", meta={}, access_grants=None)

    assert prompt.access_grants is None
    assert tool.access_grants is None
