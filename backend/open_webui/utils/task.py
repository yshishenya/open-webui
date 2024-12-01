import logging
import math
import re
from datetime import datetime
from typing import Optional
import uuid


from open_webui.utils.misc import get_last_user_message, get_messages_content

from open_webui.env import SRC_LOG_LEVELS
from open_webui.config import DEFAULT_RAG_TEMPLATE


log = logging.getLogger(__name__)
log.setLevel(SRC_LOG_LEVELS["RAG"])


def prompt_template(
    template: str, user_name: Optional[str] = None, user_location: Optional[str] = None
) -> str:
    # Get the current date
    current_date = datetime.now()

    # Format the date to YYYY-MM-DD
    formatted_date = current_date.strftime("%Y-%m-%d")
    formatted_time = current_date.strftime("%I:%M:%S %p")
    formatted_weekday = current_date.strftime("%A")

    template = template.replace("{{CURRENT_DATE}}", formatted_date)
    template = template.replace("{{CURRENT_TIME}}", formatted_time)
    template = template.replace(
        "{{CURRENT_DATETIME}}", f"{formatted_date} {formatted_time}"
    )
    template = template.replace("{{CURRENT_WEEKDAY}}", formatted_weekday)

    if user_name:
        # Replace {{USER_NAME}} in the template with the user's name
        template = template.replace("{{USER_NAME}}", user_name)
    else:
        # Replace {{USER_NAME}} in the template with "Unknown"
        template = template.replace("{{USER_NAME}}", "Unknown")

    if user_location:
        # Replace {{USER_LOCATION}} in the template with the current location
        template = template.replace("{{USER_LOCATION}}", user_location)
    else:
        # Replace {{USER_LOCATION}} in the template with "Unknown"
        template = template.replace("{{USER_LOCATION}}", "Unknown")

    return template


def replace_prompt_variable(template: str, prompt: str) -> str:
    """Replace prompt variables in a template string with corresponding values
    from a prompt.

    This function searches for specific prompt variable patterns within a
    given template string and replaces them with appropriate substrings from
    the provided prompt. The function supports four types of replacements:
    1. Replacing the variable `{{prompt}}` with the entire prompt. 2.
    Replacing `{{prompt:start:<n>}}` with the first `<n>` characters of the
    prompt. 3. Replacing `{{prompt:end:<n>}}` with the last `<n>` characters
    of the prompt. 4. Replacing `{{prompt:middletruncate:<n>}}` with a
    truncated version of the prompt, showing a portion from both    the
    start and end if the length of the prompt exceeds `<n>`.

    Args:
        template (str): The template string containing prompt variable patterns to be replaced.
        prompt (str): The prompt string from which substrings will be extracted for
            replacement.

    Returns:
        str: The template string with all prompt variables replaced by their
            corresponding values from the prompt.
    """

    def replacement_function(match):
        """Replace matched patterns in a string based on specified lengths.

        This function processes a regular expression match object and replaces
        the matched string with a portion of the `prompt` string. It handles
        different cases based on the lengths specified in the match groups,
        allowing for the return of the full prompt, a substring from the start,
        a substring from the end, or a shortened version of the prompt with
        ellipses in the middle.

        Args:
            match (re.Match): A match object containing the matched string and
                optional length specifications.

        Returns:
            str: The modified string based on the match and lengths provided.
        """

        full_match = match.group(
            0
        ).lower()  # Normalize to lowercase for consistent handling
        start_length = match.group(1)
        end_length = match.group(2)
        middle_length = match.group(3)

        if full_match == "{{prompt}}":
            return prompt
        elif start_length is not None:
            return prompt[: int(start_length)]
        elif end_length is not None:
            return prompt[-int(end_length) :]
        elif middle_length is not None:
            middle_length = int(middle_length)
            if len(prompt) <= middle_length:
                return prompt
            start = prompt[: math.ceil(middle_length / 2)]
            end = prompt[-math.floor(middle_length / 2) :]
            return f"{start}...{end}"
        return ""

    # Updated regex pattern to make it case-insensitive with the `(?i)` flag
    pattern = r"(?i){{prompt}}|{{prompt:start:(\d+)}}|{{prompt:end:(\d+)}}|{{prompt:middletruncate:(\d+)}}"
    template = re.sub(pattern, replacement_function, template)
    return template


def replace_messages_variable(
    template: str, messages: Optional[list[str]] = None
) -> str:
    """Replace placeholders in a template string with formatted message
    content.

    This function searches for specific placeholders in the given template
    string and replaces them with content derived from the provided list of
    messages. The placeholders can represent all messages, a specified
    number of messages from the start or end of the list, or a truncated set
    of messages from the middle of the list. If the messages list is None,
    it is treated as an empty list, resulting in no content being inserted.

    Args:
        template (str): The template string containing placeholders for messages.
        messages (Optional[list[str]]): A list of message strings to be inserted
            into the template. Defaults to None.

    Returns:
        str: The template string with placeholders replaced by the corresponding
            message content.
    """

    def replacement_function(match):
        """Replace placeholders in a string with formatted message content.

        This function processes a match object to determine how to replace the
        placeholder "{{MESSAGES}}" or its variants based on the specified
        lengths. It handles different cases for full, start, end, and middle
        truncation of messages. If the `messages` variable is None, it returns
        an empty string. The function utilizes helper functions to format the
        messages appropriately.

        Args:
            match (re.Match): A match object containing the full match and
                optional lengths for start, end, and middle
                message truncation.

        Returns:
            str: The formatted message content based on the specified lengths
                or an empty string if no valid replacement is found.
        """

        full_match = match.group(0)
        start_length = match.group(1)
        end_length = match.group(2)
        middle_length = match.group(3)
        # If messages is None, handle it as an empty list
        if messages is None:
            return ""

        # Process messages based on the number of messages required
        if full_match == "{{MESSAGES}}":
            return get_messages_content(messages)
        elif start_length is not None:
            return get_messages_content(messages[: int(start_length)])
        elif end_length is not None:
            return get_messages_content(messages[-int(end_length) :])
        elif middle_length is not None:
            mid = int(middle_length)

            if len(messages) <= mid:
                return get_messages_content(messages)
            # Handle middle truncation: split to get start and end portions of the messages list
            half = mid // 2
            start_msgs = messages[:half]
            end_msgs = messages[-half:] if mid % 2 == 0 else messages[-(half + 1) :]
            formatted_start = get_messages_content(start_msgs)
            formatted_end = get_messages_content(end_msgs)
            return f"{formatted_start}\n{formatted_end}"
        return ""

    template = re.sub(
        r"{{MESSAGES}}|{{MESSAGES:START:(\d+)}}|{{MESSAGES:END:(\d+)}}|{{MESSAGES:MIDDLETRUNCATE:(\d+)}}",
        replacement_function,
        template,
    )

    return template


# {{prompt:middletruncate:8000}}


def rag_template(template: str, context: str, query: str):
    """Generate a RAG (Retrieval-Augmented Generation) template.

    This function takes a template string and replaces placeholders for
    context and query with the provided context and query strings. It also
    performs checks for potential issues such as missing placeholders and
    potential prompt injection attacks. If the template is empty, it
    defaults to a predefined RAG template.

    Args:
        template (str): The template string containing placeholders for context
            and query.
        context (str): The context string to be inserted into the template.
        query (str): The query string to be inserted into the template.

    Returns:
        str: The generated template with placeholders replaced by the context
            and query.
    """

    if template.strip() == "":
        template = DEFAULT_RAG_TEMPLATE

    if "[context]" not in template and "{{CONTEXT}}" not in template:
        log.debug(
            "WARNING: The RAG template does not contain the '[context]' or '{{CONTEXT}}' placeholder."
        )

    if "<context>" in context and "</context>" in context:
        log.debug(
            "WARNING: Potential prompt injection attack: the RAG "
            "context contains '<context>' and '</context>'. This might be "
            "nothing, or the user might be trying to hack something."
        )

    query_placeholders = []
    if "[query]" in context:
        query_placeholder = "{{QUERY" + str(uuid.uuid4()) + "}}"
        template = template.replace("[query]", query_placeholder)
        query_placeholders.append(query_placeholder)

    if "{{QUERY}}" in context:
        query_placeholder = "{{QUERY" + str(uuid.uuid4()) + "}}"
        template = template.replace("{{QUERY}}", query_placeholder)
        query_placeholders.append(query_placeholder)

    template = template.replace("[context]", context)
    template = template.replace("{{CONTEXT}}", context)
    template = template.replace("[query]", query)
    template = template.replace("{{QUERY}}", query)

    for query_placeholder in query_placeholders:
        template = template.replace(query_placeholder, query)

    return template


def title_generation_template(
    template: str, messages: list[dict], user: Optional[dict] = None
) -> str:
    prompt = get_last_user_message(messages)
    template = replace_prompt_variable(template, prompt)
    template = replace_messages_variable(template, messages)

    template = prompt_template(
        template,
        **(
            {"user_name": user.get("name"), "user_location": user.get("location")}
            if user
            else {}
        ),
    )

    return template


def tags_generation_template(
    template: str, messages: list[dict], user: Optional[dict] = None
) -> str:
    prompt = get_last_user_message(messages)
    template = replace_prompt_variable(template, prompt)
    template = replace_messages_variable(template, messages)

    template = prompt_template(
        template,
        **(
            {"user_name": user.get("name"), "user_location": user.get("location")}
            if user
            else {}
        ),
    )
    return template


def emoji_generation_template(
    template: str, prompt: str, user: Optional[dict] = None
) -> str:
    template = replace_prompt_variable(template, prompt)
    template = prompt_template(
        template,
        **(
            {"user_name": user.get("name"), "user_location": user.get("location")}
            if user
            else {}
        ),
    )

    return template


def autocomplete_generation_template(
    template: str,
    prompt: str,
    messages: Optional[list[dict]] = None,
    type: Optional[str] = None,
    user: Optional[dict] = None,
) -> str:
    """Generate an autocomplete template based on the provided parameters.

    This function takes a template string and replaces specific placeholders
    with the provided prompt, messages, and user information. It allows for
    dynamic generation of templates by substituting variables such as type,
    prompt, and user details into the template. The resulting string can be
    used for various purposes, such as generating user-specific prompts or
    messages in an application.

    Args:
        template (str): The template string containing placeholders to be replaced.
        prompt (str): The prompt string to replace the corresponding placeholder in the
            template.
        messages (Optional[list[dict]]): A list of message dictionaries to replace the corresponding placeholder
            in the template.
        type (Optional[str]): A string representing the type to replace the corresponding placeholder
            in the template.
        user (Optional[dict]): A dictionary containing user information, such as name and location.

    Returns:
        str: The generated template string with placeholders replaced by actual
            values.
    """

    template = template.replace("{{TYPE}}", type if type else "")
    template = replace_prompt_variable(template, prompt)
    template = replace_messages_variable(template, messages)

    template = prompt_template(
        template,
        **(
            {"user_name": user.get("name"), "user_location": user.get("location")}
            if user
            else {}
        ),
    )
    return template


def query_generation_template(
    template: str, messages: list[dict], user: Optional[dict] = None
) -> str:
    prompt = get_last_user_message(messages)
    template = replace_prompt_variable(template, prompt)
    template = replace_messages_variable(template, messages)

    template = prompt_template(
        template,
        **(
            {"user_name": user.get("name"), "user_location": user.get("location")}
            if user
            else {}
        ),
    )
    return template


def moa_response_generation_template(
    template: str, prompt: str, responses: list[str]
) -> str:
    def replacement_function(match):
        full_match = match.group(0)
        start_length = match.group(1)
        end_length = match.group(2)
        middle_length = match.group(3)

        if full_match == "{{prompt}}":
            return prompt
        elif start_length is not None:
            return prompt[: int(start_length)]
        elif end_length is not None:
            return prompt[-int(end_length) :]
        elif middle_length is not None:
            middle_length = int(middle_length)
            if len(prompt) <= middle_length:
                return prompt
            start = prompt[: math.ceil(middle_length / 2)]
            end = prompt[-math.floor(middle_length / 2) :]
            return f"{start}...{end}"
        return ""

    template = re.sub(
        r"{{prompt}}|{{prompt:start:(\d+)}}|{{prompt:end:(\d+)}}|{{prompt:middletruncate:(\d+)}}",
        replacement_function,
        template,
    )

    responses = [f'"""{response}"""' for response in responses]
    responses = "\n\n".join(responses)

    template = template.replace("{{responses}}", responses)
    return template


def tools_function_calling_generation_template(template: str, tools_specs: str) -> str:
    template = template.replace("{{TOOLS}}", tools_specs)
    return template
