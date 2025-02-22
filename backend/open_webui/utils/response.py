import json
from uuid import uuid4
from open_webui.utils.misc import (
    openai_chat_chunk_message_template,
    openai_chat_completion_message_template,
)


def convert_ollama_tool_call_to_openai(tool_calls: dict) -> dict:
    openai_tool_calls = []
    for tool_call in tool_calls:
        openai_tool_call = {
            "index": tool_call.get("index", 0),
            "id": tool_call.get("id", f"call_{str(uuid4())}"),
            "type": "function",
            "function": {
                "name": tool_call.get("function", {}).get("name", ""),
                "arguments": json.dumps(
                    tool_call.get("function", {}).get("arguments", {})
                ),
            },
        }
        openai_tool_calls.append(openai_tool_call)
    return openai_tool_calls


def convert_ollama_usage_to_openai(data: dict) -> dict:
    """Convert usage data from Ollama format to OpenAI format.

    This function takes a dictionary containing usage statistics from the
    Ollama system and transforms it into a format compatible with OpenAI. It
    calculates the response and prompt tokens per second based on the
    evaluation counts and durations provided in the input data. If the
    evaluation duration is zero, it returns "N/A" for the respective token
    rates. Additionally, it extracts and formats various duration metrics
    and token counts, ensuring that the output is structured for easy
    integration with OpenAI's API.

    Args:
        data (dict): A dictionary containing usage statistics with keys such as
            'eval_count', 'eval_duration', 'prompt_eval_count',
            'prompt_eval_duration', and others.

    Returns:
        dict: A dictionary containing the converted usage data in OpenAI format,
            including response tokens per second, prompt tokens per second,
            total durations, and token counts.
    """

    return {
        "response_token/s": (
            round(
                (
                    (
                        data.get("eval_count", 0)
                        / ((data.get("eval_duration", 0) / 10_000_000))
                    )
                    * 100
                ),
                2,
            )
            if data.get("eval_duration", 0) > 0
            else "N/A"
        ),
        "prompt_token/s": (
            round(
                (
                    (
                        data.get("prompt_eval_count", 0)
                        / ((data.get("prompt_eval_duration", 0) / 10_000_000))
                    )
                    * 100
                ),
                2,
            )
            if data.get("prompt_eval_duration", 0) > 0
            else "N/A"
        ),
        "total_duration": data.get("total_duration", 0),
        "load_duration": data.get("load_duration", 0),
        "prompt_eval_count": data.get("prompt_eval_count", 0),
        "prompt_tokens": int(
            data.get("prompt_eval_count", 0)
        ),  # This is the OpenAI compatible key
        "prompt_eval_duration": data.get("prompt_eval_duration", 0),
        "eval_count": data.get("eval_count", 0),
        "completion_tokens": int(
            data.get("eval_count", 0)
        ),  # This is the OpenAI compatible key
        "eval_duration": data.get("eval_duration", 0),
        "approximate_total": (lambda s: f"{s // 3600}h{(s % 3600) // 60}m{s % 60}s")(
            (data.get("total_duration", 0) or 0) // 1_000_000_000
        ),
        "total_tokens": int(  # This is the OpenAI compatible key
            data.get("prompt_eval_count", 0) + data.get("eval_count", 0)
        ),
        "completion_tokens_details": {  # This is the OpenAI compatible key
            "reasoning_tokens": 0,
            "accepted_prediction_tokens": 0,
            "rejected_prediction_tokens": 0,
        },
    }


def convert_response_ollama_to_openai(ollama_response: dict) -> dict:
    """Convert an Ollama response to OpenAI format.

    This function takes a response from the Ollama API, extracts relevant
    information such as the model, message content, and tool calls, and
    converts it into a format compatible with OpenAI's API. It handles the
    conversion of tool calls and usage statistics as well.

    Args:
        ollama_response (dict): A dictionary containing the response from

    Returns:
        dict: A dictionary formatted for OpenAI's API, including the
        model, message content, tool calls, and usage information.
    """

    model = ollama_response.get("model", "ollama")
    message_content = ollama_response.get("message", {}).get("content", "")
    tool_calls = ollama_response.get("message", {}).get("tool_calls", None)
    openai_tool_calls = None

    if tool_calls:
        openai_tool_calls = convert_ollama_tool_call_to_openai(tool_calls)

    data = ollama_response

    usage = convert_ollama_usage_to_openai(data)

    response = openai_chat_completion_message_template(
        model, message_content, openai_tool_calls, usage
    )
    return response


async def convert_streaming_response_ollama_to_openai(ollama_streaming_response):
    """Convert streaming response from Ollama format to OpenAI format.

    This asynchronous generator function processes a streaming response from
    an Ollama API, converting each chunk of data into a format compatible
    with OpenAI's API. It iterates over the body of the response, extracting
    relevant information such as the model, message content, and tool calls.
    If the response indicates completion, it also converts usage data. Each
    processed chunk is yielded in the OpenAI chat message format until the
    entire response is processed, at which point a final "DONE" message is
    yielded.

    Args:
        ollama_streaming_response (AsyncIterator): An asynchronous iterator

    Yields:
        str: A string formatted as a JSON object representing the converted
        message chunk for OpenAI, followed by a final "data: [DONE]\n\n"
        message when the streaming is complete.
    """

    async for data in ollama_streaming_response.body_iterator:
        data = json.loads(data)

        model = data.get("model", "ollama")
        message_content = data.get("message", {}).get("content", "")
        tool_calls = data.get("message", {}).get("tool_calls", None)
        openai_tool_calls = None

        if tool_calls:
            openai_tool_calls = convert_ollama_tool_call_to_openai(tool_calls)

        done = data.get("done", False)

        usage = None
        if done:
            usage = convert_ollama_usage_to_openai(data)

        data = openai_chat_chunk_message_template(
            model, message_content if not done else None, openai_tool_calls, usage
        )

        line = f"data: {json.dumps(data)}\n\n"
        yield line

    yield "data: [DONE]\n\n"
