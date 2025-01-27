from typing import Optional, Union, List, Dict, Any
from open_webui.models.users import Users, UserModel
from open_webui.models.groups import Groups


from open_webui.config import DEFAULT_USER_PERMISSIONS
import json


def fill_missing_permissions(
    permissions: Dict[str, Any], default_permissions: Dict[str, Any]
) -> Dict[str, Any]:
    """Recursively fills in missing properties in the permissions dictionary.

    This function takes a permissions dictionary and a default permissions
    dictionary. It iterates through the default permissions, checking for
    any keys that are missing in the permissions dictionary. If a key is
    missing, it adds the corresponding value from the default permissions.
    If both the permissions and default permissions for a key are
    dictionaries, the function is called recursively to fill in any missing
    properties in the nested dictionaries.

    Args:
        permissions (Dict[str, Any]): A dictionary representing the current
            permissions.
        default_permissions (Dict[str, Any]): A dictionary representing the
            default permissions to use as a template.

    Returns:
        Dict[str, Any]: The updated permissions dictionary with missing
            properties filled in.
    """
    for key, value in default_permissions.items():
        if key not in permissions:
            permissions[key] = value
        elif isinstance(value, dict) and isinstance(
            permissions[key], dict
        ):  # Both are nested dictionaries
            permissions[key] = fill_missing_permissions(permissions[key], value)

    return permissions


def get_permissions(
    user_id: str,
    default_permissions: Dict[str, Any],
) -> Dict[str, Any]:
    """Get all permissions for a user by combining the permissions of all
    groups the user is a member of.

    This function retrieves the permissions associated with a specific user
    by aggregating the permissions from all groups that the user belongs to.
    If a permission exists in multiple groups, the function prioritizes the
    most permissive value, ensuring that True takes precedence over False.
    The permissions are structured as a nested dictionary, where each key
    represents a permission and its corresponding value is a boolean
    indicating whether the permission is granted.

    Args:
        user_id (str): The unique identifier of the user whose permissions are to be retrieved.
        default_permissions (Dict[str, Any]): A dictionary containing the default permissions to be used
            as a baseline.

    Returns:
        Dict[str, Any]: A dictionary containing the combined permissions for the user.
    """

    def combine_permissions(
        permissions: Dict[str, Any], group_permissions: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Combine permissions from multiple groups by taking the most permissive
        value.

        This function merges two dictionaries of permissions. It iterates
        through the `group_permissions` dictionary and updates the `permissions`
        dictionary. If a permission key is associated with a dictionary, the
        function calls itself recursively to combine the nested permissions. For
        non-dictionary values, it sets the permission to the most permissive
        value, where `True` is considered more permissive than `False`.

        Args:
            permissions (Dict[str, Any]): The existing permissions to be updated.
            group_permissions (Dict[str, Any]): The permissions from a group to combine.

        Returns:
            Dict[str, Any]: The updated permissions after combining with group permissions.
        """
        for key, value in group_permissions.items():
            if isinstance(value, dict):
                if key not in permissions:
                    permissions[key] = {}
                permissions[key] = combine_permissions(permissions[key], value)
            else:
                if key not in permissions:
                    permissions[key] = value
                else:
                    permissions[key] = (
                        permissions[key] or value
                    )  # Use the most permissive value (True > False)
        return permissions

    user_groups = Groups.get_groups_by_member_id(user_id)

    # Deep copy default permissions to avoid modifying the original dict
    permissions = json.loads(json.dumps(default_permissions))

    # Combine permissions from all user groups
    for group in user_groups:
        group_permissions = group.permissions
        permissions = combine_permissions(permissions, group_permissions)

    # Ensure all fields from default_permissions are present and filled in
    permissions = fill_missing_permissions(permissions, default_permissions)

    return permissions


def has_permission(
    user_id: str,
    permission_key: str,
    default_permissions: Dict[str, Any] = {},
) -> bool:
    """Check if a user has a specific permission based on group permissions.

    This function checks whether a user has a specified permission by
    examining the permissions associated with the user's groups. If the
    permission is not found in any of the user's group permissions, it falls
    back to the provided default permissions. The permission keys can be
    hierarchical, allowing for structured permission management.

    Args:
        user_id (str): The unique identifier of the user whose permissions are being checked.
        permission_key (str): The key representing the permission to check, which can be hierarchical.
        default_permissions (Dict[str, Any]?): A dictionary of default permissions to check if
            group permissions do not grant access. Defaults to an empty dictionary.

    Returns:
        bool: True if the user has the specified permission, False otherwise.
    """

    def get_permission(permissions: Dict[str, Any], keys: List[str]) -> bool:
        """Check access permissions based on a hierarchy of keys.

        This function traverses a nested dictionary of permissions using a list
        of keys, which represent a dot-split permission key. It checks if each
        key exists in the permissions dictionary and moves one level deeper in
        the hierarchy. If any key is missing, access is denied. The function
        returns a boolean indicating whether access is granted at the final
        level of the hierarchy.

        Args:
            permissions (Dict[str, Any]): A dictionary representing the permissions hierarchy.
            keys (List[str]): A list of keys to traverse the permissions dictionary.

        Returns:
            bool: True if access is granted at the final level, False otherwise.
        """
        for key in keys:
            if key not in permissions:
                return False  # If any part of the hierarchy is missing, deny access
            permissions = permissions[key]  # Traverse one level deeper

        return bool(permissions)  # Return the boolean at the final level

    permission_hierarchy = permission_key.split(".")

    # Retrieve user group permissions
    user_groups = Groups.get_groups_by_member_id(user_id)

    for group in user_groups:
        group_permissions = group.permissions
        if get_permission(group_permissions, permission_hierarchy):
            return True

    # Check default permissions afterward if the group permissions don't allow it
    default_permissions = fill_missing_permissions(
        default_permissions, DEFAULT_USER_PERMISSIONS
    )
    return get_permission(default_permissions, permission_hierarchy)


def has_access(
    user_id: str,
    type: str = "write",
    access_control: Optional[dict] = None,
) -> bool:
    if access_control is None:
        return type == "read"

    user_groups = Groups.get_groups_by_member_id(user_id)
    user_group_ids = [group.id for group in user_groups]
    permission_access = access_control.get(type, {})
    permitted_group_ids = permission_access.get("group_ids", [])
    permitted_user_ids = permission_access.get("user_ids", [])

    return user_id in permitted_user_ids or any(
        group_id in permitted_group_ids for group_id in user_group_ids
    )


# Get all users with access to a resource
def get_users_with_access(
    type: str = "write", access_control: Optional[dict] = None
) -> List[UserModel]:
    if access_control is None:
        return Users.get_users()

    permission_access = access_control.get(type, {})
    permitted_group_ids = permission_access.get("group_ids", [])
    permitted_user_ids = permission_access.get("user_ids", [])

    user_ids_with_access = set(permitted_user_ids)

    for group_id in permitted_group_ids:
        group_user_ids = Groups.get_group_user_ids_by_id(group_id)
        if group_user_ids:
            user_ids_with_access.update(group_user_ids)

    return Users.get_users_by_user_ids(list(user_ids_with_access))
