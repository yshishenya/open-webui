"""Administrator-only bounded diagnostics; no email transport controls."""

import asyncio
import logging
from collections.abc import Awaitable, Callable
from typing import Annotated, TypeVar

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.routing import APIRoute
from open_webui.models.email_observation_commands import ObservationCommandConflict
from open_webui.models.users import UserModel
from open_webui.utils.airis import email_observation_admin as service
from open_webui.utils.airis.email_observer import ObservationPageConflict, ObservationPageError, observe_scope_page
from open_webui.utils.auth import get_admin_user
from sqlalchemy.exc import SQLAlchemyError

log = logging.getLogger(__name__)
T = TypeVar('T')
NO_STORE = {'Cache-Control': 'no-store'}


class DiagnosticRoute(APIRoute):
    def get_route_handler(self) -> Callable[[Request], Awaitable[Response]]:
        """Disable caching for authentication/validation failures as well as success."""
        handler = super().get_route_handler()

        async def no_store(request: Request) -> Response:
            try:
                response = await handler(request)
            except RequestValidationError:
                raise HTTPException(422, 'Invalid diagnostic request', headers=NO_STORE) from None
            except HTTPException as error:
                error.headers = {**(error.headers or {}), **NO_STORE}
                raise
            response.headers.update(NO_STORE)
            return response

        return no_store


router = APIRouter(route_class=DiagnosticRoute)


async def _operation(operation: Awaitable[T]) -> T:
    try:
        return await operation
    except service.DiagnosticNotFound:
        raise HTTPException(404, 'Diagnostic group not found', headers=NO_STORE) from None
    except (ObservationCommandConflict, service.DiagnosticOperationConflict, ObservationPageConflict) as error:
        raise HTTPException(409, str(error), headers=NO_STORE) from None
    except ObservationPageError:
        raise HTTPException(503, 'Diagnostic page failed; reread group state', headers=NO_STORE) from None
    except ValueError:
        raise HTTPException(422, 'Diagnostic members or source bounds are invalid', headers=NO_STORE) from None
    except (SQLAlchemyError, TimeoutError) as error:
        log.warning('Mail diagnostic unavailable error_type=%s', type(error).__name__)
        raise HTTPException(503, 'Diagnostics temporarily unavailable', headers=NO_STORE) from None


@router.get('', response_model=service.DiagnosticScopes)
async def list_diagnostics(
    after: Annotated[service.Identifier | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=25)] = 10,
    admin: UserModel = Depends(get_admin_user),
) -> service.DiagnosticScopes:
    """Read fixed diagnostic populations; never expose recipients or lease credentials."""
    return await _operation(asyncio.wait_for(service.diagnostic_scopes(after, limit), 20))


@router.post('', response_model=service.DiagnosticScope)
async def declare_diagnostic(
    form: service.DiagnosticDeclaration, admin: UserModel = Depends(get_admin_user)
) -> service.DiagnosticScope:
    """Declare up to 500 ordinary accounts; preserve consent and email transport state."""
    return await _operation(asyncio.wait_for(service.declare_diagnostic(admin.id, form), 20))


@router.get('/{scope_id}', response_model=service.DiagnosticScope)
async def read_diagnostic(
    scope_id: service.Identifier, admin: UserModel = Depends(get_admin_user)
) -> service.DiagnosticScope:
    """Completed traversal does not establish historical or continuous eligibility."""
    return await _operation(asyncio.wait_for(service.diagnostic_scope(scope_id), 20))


@router.post('/{scope_id}/runs', response_model=service.DiagnosticLease)
async def start_diagnostic(
    scope_id: service.Identifier, form: service.DiagnosticStart, admin: UserModel = Depends(get_admin_user)
) -> service.DiagnosticLease:
    """Durably replay a start or resume; credentials are returned only to its author."""
    return await _operation(asyncio.wait_for(service.start_diagnostic(admin.id, scope_id, form), 20))


@router.post('/{scope_id}/pages', response_model=service.DiagnosticScope)
async def diagnostic_page(
    scope_id: service.Identifier, form: service.DiagnosticPage, admin: UserModel = Depends(get_admin_user)
) -> service.DiagnosticScope:
    """Observe at most 25 frozen members; stale requests cannot fail the live run."""
    claim = await _operation(asyncio.wait_for(service.owned_diagnostic_claim(admin.id, scope_id, form), 10))
    await _operation(observe_scope_page(scope_id, claim=claim, expected_cursor=form.expected_cursor))
    return await _operation(asyncio.wait_for(service.diagnostic_scope(scope_id), 20))


@router.post('/{scope_id}/closure', response_model=service.DiagnosticScope)
async def close_diagnostic(
    scope_id: service.Identifier, admin: UserModel = Depends(get_admin_user)
) -> service.DiagnosticScope:
    """Preserve diagnostic history and stop its unfinished traversal."""
    return await _operation(asyncio.wait_for(service.close_diagnostic(scope_id), 20))
