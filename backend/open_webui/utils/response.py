import json
from uuid import uuid4
from open_webui.utils.misc import (
    openai_chat_chunk_message_template,
    openai_chat_completion_message_template,
)


def convert_response_ollama_to_openai(ollama_response: dict) -> dict:
    """Convert an Ollama response dictionary to an OpenAI format.

    This function takes a response from the Ollama API and transforms it
    into a format compatible with OpenAI's chat completion API. It extracts
    relevant information such as the model name, message content, and usage
    statistics, including token usage rates and durations. The function also
    formats the total duration into a more human-readable format.

    Args:
        ollama_response (dict): A dictionary containing the response from the Ollama API, which includes
            model information,
            message content, and various evaluation metrics.

    Returns:
        dict: A dictionary formatted for OpenAI's chat completion API, containing the
            model, message content, and usage statistics.
    """

    model = ollama_response.get("model", "ollama")
    message_content = ollama_response.get("message", {}).get("content", "")

    data = ollama_response
    usage = {
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
        "prompt_eval_duration": data.get("prompt_eval_duration", 0),
        "eval_count": data.get("eval_count", 0),
        "eval_duration": data.get("eval_duration", 0),
        "approximate_total": (lambda s: f"{s // 3600}h{(s % 3600) // 60}m{s % 60}s")(
            (data.get("total_duration", 0) or 0) // 1_000_000_000
        ),
    }

    response = openai_chat_completion_message_template(model, message_content, usage)
    return response


async def convert_streaming_response_ollama_to_openai(ollama_streaming_response):
    """Convert a streaming response from Ollama to OpenAI format.

    This asynchronous generator function processes a streaming response from
    an Ollama service and converts it into a format compatible with OpenAI.
    It iterates over the body of the streaming response, extracting relevant
    information such as model details, message content, and any tool calls.
    If tool calls are present, it reformats them into the OpenAI structure.
    The function also calculates usage metrics based on the evaluation and
    prompt durations, yielding formatted data chunks until the streaming
    response is complete.

    Args:
        ollama_streaming_response (AsyncIterator): An asynchronous iterator

    Yields:
        str: A string representing the formatted data chunk for OpenAI.
    """

    async for data in ollama_streaming_response.body_iterator:
        data = json.loads(data)

        model = data.get("model", "ollama")
        message_content = data.get("message", {}).get("content", "")
        tool_calls = data.get("message", {}).get("tool_calls", None)
        openai_tool_calls = None

        if tool_calls:
            openai_tool_calls = []
            for tool_call in tool_calls:
                openai_tool_call = {
                    "index": tool_call.get("index", 0),
                    "id": tool_call.get("id", f"call_{str(uuid4())}"),
                    "type": "function",
                    "function": {
                        "name": tool_call.get("function", {}).get("name", ""),
                        "arguments": f"{tool_call.get('function', {}).get('arguments', {})}",
                    },
                }
                openai_tool_calls.append(openai_tool_call)

        done = data.get("done", False)

        usage = None
        if done:
            usage = {
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
                "prompt_eval_duration": data.get("prompt_eval_duration", 0),
                "eval_count": data.get("eval_count", 0),
                "eval_duration": data.get("eval_duration", 0),
                "approximate_total": (
                    lambda s: f"{s // 3600}h{(s % 3600) // 60}m{s % 60}s"
                )((data.get("total_duration", 0) or 0) // 1_000_000_000),
            }

        data = openai_chat_chunk_message_template(
            model, message_content if not done else None, openai_tool_calls, usage
        )

        line = f"data: {json.dumps(data)}\n\n"
        yield line

    yield "data: [DONE]\n\n"
