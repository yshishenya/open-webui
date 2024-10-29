from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel

from open_webui.apps.webui.models.users import Users, UserModel
from open_webui.apps.webui.models.feedbacks import (
    FeedbackModel,
    FeedbackResponse,
    FeedbackForm,
    Feedbacks,
)

from open_webui.constants import ERROR_MESSAGES
from open_webui.utils.utils import get_admin_user, get_verified_user

router = APIRouter()


############################
# GetConfig
############################


@router.get("/config")
async def get_config(request: Request, user=Depends(get_admin_user)):
    return {
        "ENABLE_EVALUATION_ARENA_MODELS": request.app.state.config.ENABLE_EVALUATION_ARENA_MODELS,
        "EVALUATION_ARENA_MODELS": request.app.state.config.EVALUATION_ARENA_MODELS,
    }


############################
# UpdateConfig
############################


class UpdateConfigForm(BaseModel):
    ENABLE_EVALUATION_ARENA_MODELS: Optional[bool] = None
    EVALUATION_ARENA_MODELS: Optional[list[dict]] = None


@router.post("/config")
async def update_config(
    request: Request,
    form_data: UpdateConfigForm,
    user=Depends(get_admin_user),
):
    config = request.app.state.config
    if form_data.ENABLE_EVALUATION_ARENA_MODELS is not None:
        config.ENABLE_EVALUATION_ARENA_MODELS = form_data.ENABLE_EVALUATION_ARENA_MODELS
    if form_data.EVALUATION_ARENA_MODELS is not None:
        config.EVALUATION_ARENA_MODELS = form_data.EVALUATION_ARENA_MODELS
    return {
        "ENABLE_EVALUATION_ARENA_MODELS": config.ENABLE_EVALUATION_ARENA_MODELS,
        "EVALUATION_ARENA_MODELS": config.EVALUATION_ARENA_MODELS,
    }


class FeedbackUserResponse(FeedbackResponse):
    user: Optional[UserModel] = None


@router.get("/feedbacks/all", response_model=list[FeedbackUserResponse])
async def get_all_feedbacks(user=Depends(get_admin_user)):
    """Retrieve all feedbacks and their associated user information.

    This function fetches all feedback entries from the database and
    constructs a list of `FeedbackUserResponse` objects. Each response
    object contains the feedback data along with the corresponding user
    details, which are obtained by querying the user database using the user
    ID associated with each feedback entry.

    Args:
        user (Depends): A dependency that provides the current admin user.

    Returns:
        list: A list of `FeedbackUserResponse` objects containing feedback data
            and user information.
    """

    feedbacks = Feedbacks.get_all_feedbacks()
    return [
        FeedbackUserResponse(
            **feedback.model_dump(), user=Users.get_user_by_id(feedback.user_id)
        )
        for feedback in feedbacks
    ]


@router.delete("/feedbacks/all")
async def delete_all_feedbacks(user=Depends(get_admin_user)):
    success = Feedbacks.delete_all_feedbacks()
    return success


@router.get("/feedbacks/all/export", response_model=list[FeedbackModel])
async def get_all_feedbacks(user=Depends(get_admin_user)):
    """Retrieve all feedbacks and their associated user information.

    This function fetches all feedback entries from the database and
    constructs a list of `FeedbackModel` instances, each containing the
    feedback data along with the corresponding user details. It utilizes
    dependency injection to obtain the current user context.

    Args:
        user (Depends): The user dependency, typically representing an admin user.

    Returns:
        list: A list of `FeedbackModel` instances, each representing a feedback
            entry along with its associated user information.
    """

    feedbacks = Feedbacks.get_all_feedbacks()
    return [
        FeedbackModel(
            **feedback.model_dump(), user=Users.get_user_by_id(feedback.user_id)
        )
        for feedback in feedbacks
    ]


@router.get("/feedbacks/user", response_model=list[FeedbackUserResponse])
async def get_feedbacks(user=Depends(get_verified_user)):
    """Retrieve feedbacks for a specified user.

    This function fetches all feedback entries associated with the given
    user's ID. It utilizes the `get_verified_user` dependency to ensure that
    the user is authenticated before attempting to retrieve their feedbacks.
    The feedbacks are then returned as a list.

    Args:
        user (Depends): A dependency that provides the verified user object.

    Returns:
        list: A list of feedback entries associated with the user.
    """

    feedbacks = Feedbacks.get_feedbacks_by_user_id(user.id)
    return feedbacks


@router.delete("/feedbacks", response_model=bool)
async def delete_feedbacks(user=Depends(get_verified_user)):
    """Delete feedbacks associated with a verified user.

    This function deletes all feedback entries linked to the specified user.
    It utilizes the user ID obtained from the verified user dependency to
    perform the deletion. The operation returns a success status indicating
    whether the deletion was successful or not.

    Args:
        user (User): A verified user object, automatically provided by

    Returns:
        bool: True if the feedbacks were successfully deleted, False otherwise.
    """

    success = Feedbacks.delete_feedbacks_by_user_id(user.id)
    return success


@router.post("/feedback", response_model=FeedbackModel)
async def create_feedback(
    request: Request,
    form_data: FeedbackForm,
    user=Depends(get_verified_user),
):
    feedback = Feedbacks.insert_new_feedback(user_id=user.id, form_data=form_data)
    if not feedback:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=ERROR_MESSAGES.DEFAULT(),
        )

    return feedback


@router.get("/feedback/{id}", response_model=FeedbackModel)
async def get_feedback_by_id(id: str, user=Depends(get_verified_user)):
    feedback = Feedbacks.get_feedback_by_id_and_user_id(id=id, user_id=user.id)

    if not feedback:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=ERROR_MESSAGES.NOT_FOUND
        )

    return feedback


@router.post("/feedback/{id}", response_model=FeedbackModel)
async def update_feedback_by_id(
    id: str, form_data: FeedbackForm, user=Depends(get_verified_user)
):
    feedback = Feedbacks.update_feedback_by_id_and_user_id(
        id=id, user_id=user.id, form_data=form_data
    )

    if not feedback:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=ERROR_MESSAGES.NOT_FOUND
        )

    return feedback


@router.delete("/feedback/{id}")
async def delete_feedback_by_id(id: str, user=Depends(get_verified_user)):
    if user.role == "admin":
        success = Feedbacks.delete_feedback_by_id(id=id)
    else:
        success = Feedbacks.delete_feedback_by_id_and_user_id(id=id, user_id=user.id)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=ERROR_MESSAGES.NOT_FOUND
        )

    return success
