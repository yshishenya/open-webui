import black
import markdown

from open_webui.models.chats import ChatTitleMessagesForm
from open_webui.config import DATA_DIR, ENABLE_ADMIN_EXPORT
from open_webui.constants import ERROR_MESSAGES
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel
from starlette.responses import FileResponse


from open_webui.utils.misc import get_gravatar_url
from open_webui.utils.pdf_generator import PDFGenerator
from open_webui.utils.auth import get_admin_user, get_verified_user
from open_webui.utils.code_interpreter import execute_code_jupyter


router = APIRouter()


@router.get("/gravatar")
async def get_gravatar(email: str, user=Depends(get_verified_user)):
    return get_gravatar_url(email)


class CodeForm(BaseModel):
    code: str


@router.post("/code/format")
async def format_code(form_data: CodeForm, user=Depends(get_verified_user)):
    """Format the provided code using the Black code formatter.

    This function takes a CodeForm object containing code as input and
    formats it using the Black formatter. If the code has not changed after
    formatting, it returns the original code. In case of any exceptions
    during formatting, it raises an HTTPException with a 400 status code.

    Args:
        form_data (CodeForm): An object containing the code to be formatted.
        user (Depends): The user making the request, verified through dependency injection.

    Returns:
        dict: A dictionary containing the formatted code under the key "code".

    Raises:
        HTTPException: If an error occurs during formatting, a 400 status code is raised with
            the error detail.
    """

    try:
        formatted_code = black.format_str(form_data.code, mode=black.Mode())
        return {"code": formatted_code}
    except black.NothingChanged:
        return {"code": form_data.code}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/code/execute")
async def execute_code(
    request: Request, form_data: CodeForm, user=Depends(get_verified_user)
):
    """Execute code using the specified execution engine.

    This function checks the configuration to determine which code execution
    engine to use. If the engine is set to "jupyter", it calls the
    `execute_code_jupyter` function with the appropriate parameters,
    including the code to be executed and any necessary authentication
    tokens. If the configured engine is not supported, it raises an
    HTTPException.

    Args:
        request (Request): The HTTP request object containing application state and configuration.
        form_data (CodeForm): The form data containing the code to be executed.
        user: The verified user, obtained through dependency injection.

    Returns:
        Any: The output from the code execution.

    Raises:
        HTTPException: If the code execution engine is not supported.
    """

    if request.app.state.config.CODE_EXECUTION_ENGINE == "jupyter":
        output = await execute_code_jupyter(
            request.app.state.config.CODE_EXECUTION_JUPYTER_URL,
            form_data.code,
            (
                request.app.state.config.CODE_EXECUTION_JUPYTER_AUTH_TOKEN
                if request.app.state.config.CODE_EXECUTION_JUPYTER_AUTH == "token"
                else None
            ),
            (
                request.app.state.config.CODE_EXECUTION_JUPYTER_AUTH_PASSWORD
                if request.app.state.config.CODE_EXECUTION_JUPYTER_AUTH == "password"
                else None
            ),
        )

        return output
    else:
        raise HTTPException(
            status_code=400,
            detail="Code execution engine not supported",
        )


class MarkdownForm(BaseModel):
    md: str


@router.post("/markdown")
async def get_html_from_markdown(
    form_data: MarkdownForm, user=Depends(get_verified_user)
):
    return {"html": markdown.markdown(form_data.md)}


class ChatForm(BaseModel):
    title: str
    messages: list[dict]


@router.post("/pdf")
async def download_chat_as_pdf(
    form_data: ChatTitleMessagesForm, user=Depends(get_verified_user)
):
    """Download chat messages as a PDF file.

    This function generates a PDF document containing chat messages based on
    the provided form data. It utilizes the PDFGenerator class to create the
    PDF and returns it as a downloadable response. If an error occurs during
    the PDF generation, an HTTPException is raised with a status code of
    400.

    Args:
        form_data (ChatTitleMessagesForm): The form data containing chat title and messages.
        user: The verified user making the request (default is obtained from the
            Depends function).

    Returns:
        Response: A FastAPI Response object containing the PDF file as content.

    Raises:
        HTTPException: If an error occurs during PDF generation, a 400 status code is raised
            with the error details.
    """

    try:
        pdf_bytes = PDFGenerator(form_data).generate_chat_pdf()

        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment;filename=chat.pdf"},
        )
    except Exception as e:
        print(e)
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/db/download")
async def download_db(user=Depends(get_admin_user)):
    if not ENABLE_ADMIN_EXPORT:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=ERROR_MESSAGES.ACCESS_PROHIBITED,
        )
    from open_webui.internal.db import engine

    if engine.name != "sqlite":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=ERROR_MESSAGES.DB_NOT_SQLITE,
        )
    return FileResponse(
        engine.url.database,
        media_type="application/octet-stream",
        filename="webui.db",
    )


@router.get("/litellm/config")
async def download_litellm_config_yaml(user=Depends(get_admin_user)):
    return FileResponse(
        f"{DATA_DIR}/litellm/config.yaml",
        media_type="application/octet-stream",
        filename="config.yaml",
    )
