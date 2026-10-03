from __future__ import annotations

from fastapi import HTTPException
from open_webui.models.models import Models
from open_webui.models.users import UserModel
from open_webui.utils.access_control import check_model_access


async def check_image_model_access(user: UserModel | None, model_id: str) -> None:
    """Reject unavailable image models before billing or loading source images."""
    if user is None:
        raise HTTPException(status_code=401, detail='Authentication required')
    model = await Models.get_model_by_id(model_id)
    current = model
    seen: set[str] = set()
    while current is not None:
        if not current.is_active:
            raise HTTPException(
                status_code=403,
                detail={'error': 'model_disabled', 'message': 'Image model is disabled'},
            )
        if current.id in seen:
            raise HTTPException(status_code=403, detail='Model not found')
        seen.add(current.id)
        if not current.base_model_id:
            break
        current = await Models.get_model_by_id(current.base_model_id)
    # Keep existing owner/group/base grants and admin-only unregistered access.
    await check_model_access(user, model)


async def can_use_configured_image_model(user: UserModel, *, enabled: bool, engine: str, model_id: str) -> bool:
    """Resolve named-engine defaults without adding provider I/O to /api/config."""
    if not enabled:
        return False
    if engine in {'', 'automatic1111'}:
        # The running checkpoint is resolved by Automatic1111 at request time.
        return True
    resolved_model = model_id or {
        'openai': 'dall-e-2',
        'gemini': 'imagen-3.0-generate-002',
    }.get(engine, '')
    try:
        await check_image_model_access(user, resolved_model)
    except HTTPException as exc:
        if exc.status_code == 403:
            return False
        raise
    return True
