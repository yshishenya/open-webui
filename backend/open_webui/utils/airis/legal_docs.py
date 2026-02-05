from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class LegalDoc:
    key: str
    title: str
    url: str
    version: str
    required: bool = True


LEGAL_DOCS: tuple[LegalDoc, ...] = (
    LegalDoc(
        key="terms_offer",
        title="Лицензионный договор‑оферта",
        url="/terms",
        version="2026-02-05",
        required=True,
    ),
    LegalDoc(
        key="privacy_policy",
        title="Политика конфиденциальности",
        url="/privacy",
        version="2026-02-05",
        required=True,
    ),
)


def get_legal_doc(key: str) -> LegalDoc | None:
    for doc in LEGAL_DOCS:
        if doc.key == key:
            return doc
    return None


def required_legal_docs() -> tuple[LegalDoc, ...]:
    return tuple(doc for doc in LEGAL_DOCS if doc.required)

