# docker-mcp

This repository provides a minimal container image that runs an LLM agent with access to a few tools. The agent is implemented in TypeScript and communicates with any provider that exposes an OpenAI‑compatible chat API (including Ollama). Pass an initial prompt when starting the container and the agent will attempt to complete it while calling the tools when appropriate.

The agent relies on the model's tool calling capability. Use a model that supports this feature and phrase your prompt so the agent knows it should take actions (e.g. "create a file named hello.txt containing 'hi'"). The system prompt encourages tool use, so the model should invoke the appropriate functions instead of simply describing the steps.

## Building the image

```bash
docker build -t docker-mcp .
```

## Running the agent

Set the `OPENAI_API_KEY` environment variable and provide the prompt as a command argument. When using a local provider such as Ollama, `OPENAI_API_KEY` may be left empty. In that case set `OPENAI_BASE_URL` to the provider's base URL and optionally `OPENAI_MODEL` to the desired model name:

```bash
docker run --rm \
  -e OPENAI_API_KEY=YOUR_KEY \
  -e OPENAI_BASE_URL=http://host.docker.internal:11434/v1 \
  -e OPENAI_MODEL=llama3 \
  docker-mcp "Write a greeting"
```

The agent supports calling the following tools via function calling:

- `shell(command)`: run a shell command
- `read_file(path)`: read a text file
- `write_file(path, content)`: write text to a file
- `http_request(method, url, body?)`: send an HTTP request

These tools let the agent perform simple MCP-style operations while servicing the prompt.

### MCP configuration

Tools and background servers can be defined in an `mcp.json` file placed next to the agent. Servers defined under `servers` are started when the container launches. Tools listed under `tools` expose additional commands that can be invoked by the agent. The default `mcp.json` starts a sample server and provides an `echo` tool.
