import logging
import time
from typing import Optional

from open_webui.internal.db import Base, JSONField, get_db
from open_webui.models.users import Users
from open_webui.env import SRC_LOG_LEVELS
from pydantic import BaseModel, ConfigDict
from sqlalchemy import BigInteger, Boolean, Column, String, Text

log = logging.getLogger(__name__)
log.setLevel(SRC_LOG_LEVELS["MODELS"])

####################
# Functions DB Schema
####################


class Function(Base):
    __tablename__ = "function"

    id = Column(String, primary_key=True)
    user_id = Column(String)
    name = Column(Text)
    type = Column(Text)
    content = Column(Text)
    meta = Column(JSONField)
    valves = Column(JSONField)
    is_active = Column(Boolean)
    is_global = Column(Boolean)
    updated_at = Column(BigInteger)
    created_at = Column(BigInteger)


class FunctionMeta(BaseModel):
    description: Optional[str] = None
    manifest: Optional[dict] = {}


class FunctionModel(BaseModel):
    id: str
    user_id: str
    name: str
    type: str
    content: str
    meta: FunctionMeta
    is_active: bool = False
    is_global: bool = False
    updated_at: int  # timestamp in epoch
    created_at: int  # timestamp in epoch

    model_config = ConfigDict(from_attributes=True)


####################
# Forms
####################


class FunctionResponse(BaseModel):
    id: str
    user_id: str
    type: str
    name: str
    meta: FunctionMeta
    is_active: bool
    is_global: bool
    updated_at: int  # timestamp in epoch
    created_at: int  # timestamp in epoch


class FunctionForm(BaseModel):
    id: str
    name: str
    content: str
    meta: FunctionMeta


class FunctionValves(BaseModel):
    valves: Optional[dict] = None


class FunctionsTable:
    def insert_new_function(
        self, user_id: str, type: str, form_data: FunctionForm
    ) -> Optional[FunctionModel]:
        """Insert a new function into the database.

        This method creates a new function entry using the provided user ID,
        type, and form data. It constructs a FunctionModel instance with the
        necessary attributes, including timestamps for creation and updates. The
        function is then added to the database, and if successful, the validated
        model of the newly created function is returned. If any error occurs
        during the database operation, it logs the exception and returns None.

        Args:
            user_id (str): The ID of the user creating the function.
            type (str): The type of the function being created.
            form_data (FunctionForm): The form data containing the function's attributes.

        Returns:
            Optional[FunctionModel]: The validated model of the newly created function, or None if
            the operation fails.
        """

        function = FunctionModel(
            **{
                **form_data.model_dump(),
                "user_id": user_id,
                "type": type,
                "updated_at": int(time.time()),
                "created_at": int(time.time()),
            }
        )

        try:
            with get_db() as db:
                result = Function(**function.model_dump())
                db.add(result)
                db.commit()
                db.refresh(result)
                if result:
                    return FunctionModel.model_validate(result)
                else:
                    return None
        except Exception as e:
            log.exception(f"Error creating a new function: {e}")
            return None

    def get_function_by_id(self, id: str) -> Optional[FunctionModel]:
        try:
            with get_db() as db:
                function = db.get(Function, id)
                return FunctionModel.model_validate(function)
        except Exception:
            return None

    def get_functions(self, active_only=False) -> list[FunctionModel]:
        with get_db() as db:
            if active_only:
                return [
                    FunctionModel.model_validate(function)
                    for function in db.query(Function).filter_by(is_active=True).all()
                ]
            else:
                return [
                    FunctionModel.model_validate(function)
                    for function in db.query(Function).all()
                ]

    def get_functions_by_type(
        self, type: str, active_only=False
    ) -> list[FunctionModel]:
        with get_db() as db:
            if active_only:
                return [
                    FunctionModel.model_validate(function)
                    for function in db.query(Function)
                    .filter_by(type=type, is_active=True)
                    .all()
                ]
            else:
                return [
                    FunctionModel.model_validate(function)
                    for function in db.query(Function).filter_by(type=type).all()
                ]

    def get_global_filter_functions(self) -> list[FunctionModel]:
        with get_db() as db:
            return [
                FunctionModel.model_validate(function)
                for function in db.query(Function)
                .filter_by(type="filter", is_active=True, is_global=True)
                .all()
            ]

    def get_global_action_functions(self) -> list[FunctionModel]:
        with get_db() as db:
            return [
                FunctionModel.model_validate(function)
                for function in db.query(Function)
                .filter_by(type="action", is_active=True, is_global=True)
                .all()
            ]

    def get_function_valves_by_id(self, id: str) -> Optional[dict]:
        """Retrieve the valves associated with a function by its ID.

        This method queries the database for a function using the provided ID.
        If the function is found, it returns its associated valves. If no valves
        are found, it returns an empty dictionary. In case of any exceptions
        during the database operation, it logs the error and returns None.

        Args:
            id (str): The unique identifier of the function.

        Returns:
            Optional[dict]: A dictionary of valves associated with the function,
            or None if an error occurs during retrieval.
        """

        with get_db() as db:
            try:
                function = db.get(Function, id)
                return function.valves if function.valves else {}
            except Exception as e:
                log.exception(f"Error getting function valves by id {id}: {e}")
                return None

    def update_function_valves_by_id(
        self, id: str, valves: dict
    ) -> Optional[FunctionValves]:
        with get_db() as db:
            try:
                function = db.get(Function, id)
                function.valves = valves
                function.updated_at = int(time.time())
                db.commit()
                db.refresh(function)
                return self.get_function_by_id(id)
            except Exception:
                return None

    def get_user_valves_by_id_and_user_id(
        self, id: str, user_id: str
    ) -> Optional[dict]:
        """Retrieve user valve settings by valve ID and user ID.

        This function fetches the valve settings for a specific user identified
        by their user ID and a valve ID. It first retrieves the user object and
        checks if the user has any settings related to functions and valves. If
        these settings do not exist, it initializes them accordingly. Finally,
        it returns the valve settings associated with the provided valve ID.

        Args:
            id (str): The ID of the valve to retrieve settings for.
            user_id (str): The ID of the user whose valve settings are being retrieved.

        Returns:
            Optional[dict]: A dictionary containing the valve settings if found,
            or an empty dictionary if no settings exist for the given valve ID.
            Returns None if an error occurs during the retrieval process.
        """

        try:
            user = Users.get_user_by_id(user_id)
            user_settings = user.settings.model_dump() if user.settings else {}

            # Check if user has "functions" and "valves" settings
            if "functions" not in user_settings:
                user_settings["functions"] = {}
            if "valves" not in user_settings["functions"]:
                user_settings["functions"]["valves"] = {}

            return user_settings["functions"]["valves"].get(id, {})
        except Exception as e:
            log.exception(
                f"Error getting user values by id {id} and user id {user_id}: {e}"
            )
            return None

    def update_user_valves_by_id_and_user_id(
        self, id: str, user_id: str, valves: dict
    ) -> Optional[dict]:
        """Update the valves settings for a user by their user ID and valve ID.

        This function retrieves the user settings from the database using the
        provided user ID. It checks if the user has existing "functions" and
        "valves" settings, and if not, initializes them. The specified valves
        are then updated in the user's settings, and the updated settings are
        saved back to the database. If successful, the function returns the
        updated valves settings.

        Args:
            id (str): The ID of the valve to be updated.
            user_id (str): The ID of the user whose valve settings are to be updated.
            valves (dict): A dictionary containing the new valve settings.

        Returns:
            Optional[dict]: The updated valve settings if the operation is successful,
                or None if an error occurs during the update process.
        """

        try:
            user = Users.get_user_by_id(user_id)
            user_settings = user.settings.model_dump() if user.settings else {}

            # Check if user has "functions" and "valves" settings
            if "functions" not in user_settings:
                user_settings["functions"] = {}
            if "valves" not in user_settings["functions"]:
                user_settings["functions"]["valves"] = {}

            user_settings["functions"]["valves"][id] = valves

            # Update the user settings in the database
            Users.update_user_by_id(user_id, {"settings": user_settings})

            return user_settings["functions"]["valves"][id]
        except Exception as e:
            log.exception(
                f"Error updating user valves by id {id} and user_id {user_id}: {e}"
            )
            return None

    def update_function_by_id(self, id: str, updated: dict) -> Optional[FunctionModel]:
        with get_db() as db:
            try:
                db.query(Function).filter_by(id=id).update(
                    {
                        **updated,
                        "updated_at": int(time.time()),
                    }
                )
                db.commit()
                return self.get_function_by_id(id)
            except Exception:
                return None

    def deactivate_all_functions(self) -> Optional[bool]:
        with get_db() as db:
            try:
                db.query(Function).update(
                    {
                        "is_active": False,
                        "updated_at": int(time.time()),
                    }
                )
                db.commit()
                return True
            except Exception:
                return None

    def delete_function_by_id(self, id: str) -> bool:
        with get_db() as db:
            try:
                db.query(Function).filter_by(id=id).delete()
                db.commit()

                return True
            except Exception:
                return False


Functions = FunctionsTable()
