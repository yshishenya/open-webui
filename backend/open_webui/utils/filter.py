import inspect
from open_webui.utils.plugin import load_function_module_by_id
from open_webui.models.functions import Functions


def get_sorted_filter_ids(model):
    """Get sorted filter IDs based on the provided model.

    This function retrieves a list of filter IDs from the global filter
    functions and any additional filter IDs specified in the model's
    metadata. It then filters these IDs to include only those that are
    currently enabled. The resulting list is sorted based on the priority of
    the associated functions, which is determined by their valves attribute.

    Args:
        model (dict): A dictionary representing the model, which may contain
            additional filter IDs in its "info" -> "meta" section.

    Returns:
        list: A sorted list of enabled filter IDs.
    """

    def get_priority(function_id):
        """Get the priority of a function based on its ID.

        This function retrieves a function object using the provided function
        ID. If the function object has an attribute named 'valves', it attempts
        to return the priority value from that attribute. If the 'valves'
        attribute does not exist or is empty, it defaults to returning 0. If the
        function cannot be found, it also returns 0.

        Args:
            function_id (int): The unique identifier for the function.

        Returns:
            int: The priority of the function, or 0 if not found or if no priority
            is set.
        """

        function = Functions.get_function_by_id(function_id)
        if function is not None and hasattr(function, "valves"):
            # TODO: Fix FunctionModel to include vavles
            return (function.valves if function.valves else {}).get("priority", 0)
        return 0

    filter_ids = [function.id for function in Functions.get_global_filter_functions()]
    if "info" in model and "meta" in model["info"]:
        filter_ids.extend(model["info"]["meta"].get("filterIds", []))
        filter_ids = list(set(filter_ids))

    enabled_filter_ids = [
        function.id
        for function in Functions.get_functions_by_type("filter", active_only=True)
    ]

    filter_ids = [fid for fid in filter_ids if fid in enabled_filter_ids]
    filter_ids.sort(key=get_priority)
    return filter_ids


async def process_filter_functions(
    request, filter_ids, filter_type, form_data, extra_params
):
    """Process filter functions based on the provided filter IDs and type.

    This function iterates through a list of filter IDs, retrieves the
    corresponding function modules, and applies the necessary processing
    based on the filter type. It prepares parameters for the handler
    function and executes it, handling both synchronous and asynchronous
    functions. Additionally, it manages user parameters and performs file
    cleanup if necessary.

    Args:
        request (Request): The request object containing application state and context.
        filter_ids (list): A list of filter IDs to process.
        filter_type (str): The type of filter to apply (e.g., "inlet").
        form_data (dict): The form data to be processed by the handler.
        extra_params (dict): Additional parameters to be passed to the handler.

    Returns:
        tuple: A tuple containing the processed form data and an empty dictionary.

    Raises:
        Exception: If an error occurs during the execution of the handler function.
    """

    skip_files = None

    for filter_id in filter_ids:
        filter = Functions.get_function_by_id(filter_id)
        if not filter:
            continue

        if filter_id in request.app.state.FUNCTIONS:
            function_module = request.app.state.FUNCTIONS[filter_id]
        else:
            function_module, _, _ = load_function_module_by_id(filter_id)
            request.app.state.FUNCTIONS[filter_id] = function_module

        # Check if the function has a file_handler variable
        if filter_type == "inlet" and hasattr(function_module, "file_handler"):
            skip_files = function_module.file_handler

        # Apply valves to the function
        if hasattr(function_module, "valves") and hasattr(function_module, "Valves"):
            valves = Functions.get_function_valves_by_id(filter_id)
            function_module.valves = function_module.Valves(
                **(valves if valves else {})
            )

        # Prepare handler function
        handler = getattr(function_module, filter_type, None)
        if not handler:
            continue

        try:
            # Prepare parameters
            sig = inspect.signature(handler)
            params = {"body": form_data} | {
                k: v
                for k, v in {
                    **extra_params,
                    "__id__": filter_id,
                }.items()
                if k in sig.parameters
            }

            # Handle user parameters
            if "__user__" in sig.parameters:
                if hasattr(function_module, "UserValves"):
                    try:
                        params["__user__"]["valves"] = function_module.UserValves(
                            **Functions.get_user_valves_by_id_and_user_id(
                                filter_id, params["__user__"]["id"]
                            )
                        )
                    except Exception as e:
                        print(e)

            # Execute handler
            if inspect.iscoroutinefunction(handler):
                form_data = await handler(**params)
            else:
                form_data = handler(**params)

        except Exception as e:
            print(f"Error in {filter_type} handler {filter_id}: {e}")
            raise e

    # Handle file cleanup for inlet
    if skip_files and "files" in form_data.get("metadata", {}):
        del form_data["metadata"]["files"]

    return form_data, {}
