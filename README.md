# Docker MCP Agent

An AI agent running in Docker with Model Context Protocol (MCP) support that can accept commands interactively or as single commands, featuring **enhanced reasoning capabilities** for multi-step analysis and self-reflection.

This repository provides a minimal container image that runs an LLM agent with access to a few tools. The agent is implemented in TypeScript and communicates with any provider that exposes an OpenAI‑compatible chat API (including Ollama). You can run it in interactive mode for continuous commands or pass an initial prompt when starting the container for single-command execution.

The agent relies on the model's tool calling capability. Use a model that supports this feature and phrase your prompt so the agent knows it should take actions (e.g. "create a file named hello.txt containing 'hi'"). The system prompt encourages tool use, so the model should invoke the appropriate functions instead of simply describing the steps.

## Features

- **🌐 Web-Based Chat Interface**: Modern, responsive web UI with real-time WebSocket communication  
- **🧠 Enhanced Reasoning Mode**: Multi-step analysis, self-reflection, and proactive task completion (like GitHub Copilot)
- **💬 Interactive CLI Mode**: Command-line interface with unlimited conversation history
- **⚡ Single Command Mode**: Execute one command and exit (original behavior)
- **🔧 MCP Tool Support**: Integrates with MCP servers for extended functionality
- **🐳 Docker Support**: Runs reliably in containerized environment
- **📊 Conversation Management**: History tracking with validation and integrity checks

## Enhanced vs Simple Mode

### Enhanced Mode (Default in Interactive)
- 🧠 **Multi-step reasoning**: Breaks down complex tasks into logical steps
- 🔄 **Self-reflection**: Analyzes results and determines if additional actions are needed
- 🎯 **Proactive completion**: Continues working until task is fully complete
- 📊 **Comprehensive analysis**: Provides thorough investigation and suggestions
- 🔍 **Follow-up actions**: Automatically performs related tasks and validation

### Simple Mode
- ⚡ **Single response**: Executes one action and stops (original behavior)
- 🎯 **Direct execution**: Focused on the immediate request only
- 📝 **Minimal output**: Concise responses without extended analysis

## Usage

### Prerequisites

Set your OpenAI API key:
```bash
export OPENAI_API_KEY="your-api-key-here"
```

### Interactive Mode with Enhanced Reasoning (Recommended!)

**Windows (PowerShell):**
```powershell
.\run-interactive.ps1
```

**Linux/macOS:**
```bash
chmod +x run-interactive.sh
./run-interactive.sh
```

**Manual Docker run:**
```bash
docker run --rm -it \
  -e OPENAI_API_KEY="your-key" \
  -e OPENAI_BASE_URL="https://api.openai.com/v1" \
  -e OPENAI_MODEL="gpt-4" \
  docker-mcp --interactive --enhanced
```

### Single Command Mode

**Enhanced reasoning for complex tasks:**
```bash
docker run --rm \
  -e OPENAI_API_KEY="your-key" \
  docker-mcp --enhanced "Analyze the project structure and suggest improvements"
```

**Windows (PowerShell):**
```powershell
.\run-command.ps1 -Command "List the files in the current directory"
```

**Manual Docker run:**
```bash
docker run --rm \
  -e OPENAI_API_KEY="your-key" \
  docker-mcp "List the files in the current directory"
```

### Interactive Commands

Once in interactive mode, you can use these built-in commands:
- `help` - Show available commands
- `tools` - List available MCP tools
- `/cls` - Clear conversation history
- `/history` - Show conversation history statistics
- `/enhanced` - Enable enhanced reasoning mode (multi-step analysis)
- `/simple` - Enable simple mode (single responses)
- `exit` or `quit` - Exit the agent

Or type any natural language command for the AI to process.

### Enhanced Mode Features

When enhanced mode is enabled (default in interactive), the agent exhibits sophisticated behavior:

**🔄 Self-Reflection Loop**: After each tool execution, the agent analyzes results and determines next steps:
```
> Analyze this project and suggest improvements
[Agent reads files, analyzes structure]
Let me also check the dependencies and security...
[Agent continues with package.json analysis]
I should also verify the Docker configuration...
[Agent examines Dockerfile and suggests optimizations]
```

**🎯 Proactive Task Completion**: Goes beyond the immediate request:
```
> Create a backup of important files
[Agent creates backup]
Let me also verify the backup integrity and create a restore script...
[Agent validates backup and provides restore instructions]
```

**📊 Comprehensive Analysis**: Provides thorough investigation:
```
> Check if the server is running
[Agent checks process, ports, logs]
I notice some performance issues, let me analyze the system resources...
[Agent provides optimization recommendations]
```

**🔍 Follow-up Actions**: Automatically performs related tasks:
- Validation of completed actions
- Related file checks
- Error prevention measures
- Performance optimizations

### Conversation History

The agent maintains unlimited conversation history in interactive mode, allowing for contextual conversations. Features:

- **Persistent Context**: Each interaction remembers all previous messages in the session
- **History Management**: Use `/cls` to clear history when starting a new topic
- **Unlimited Memory**: No automatic trimming - full conversation context maintained
- **History Stats**: Use `/history` to see current memory usage and message statistics
- **Memory Monitoring**: Monitor memory usage with `/history` command

Example conversation:
```
> Create a file called test.txt with "Hello World"
[Agent creates the file]
> Now read the contents back to me
[Agent reads the file - remembers the previous context about test.txt]
> /history
📊 Conversation History Stats:
  - Messages: 8
  - Memory usage: ~1,234 chars
> /cls
🧹 Conversation history cleared
```

### Available Tools

The agent comes with built-in tools:
- **shell**: Execute shell commands
- **read_file**: Read text files
- **write_file**: Write content to files
- **http_request**: Send HTTP requests

Plus any MCP tools configured in `mcp.json`.


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

## Extended Examples

### Interactive Session with History
```bash
$ docker run --rm -it -e OPENAI_API_KEY="your-key" docker-mcp --interactive

🤖 Agent started in interactive mode. Type "exit" to quit.
💡 Available tools: shell, read_file, write_file, http_request, [MCP tools...]
📝 Commands: help, tools, /cls (clear history), /history (show stats), exit
ℹ️  Note: Conversation history has no limit - use /cls to clear if needed
---
> Create a file called project-notes.txt with a TODO list
[Agent uses write_file tool to create the file]
---
> Now add a timestamp to the file
💭 Processing with 4 previous messages...
[Agent remembers the file from previous context and modifies it]
---
> What's in the file now?
💭 Processing with 8 previous messages...
[Agent reads and shows the updated file contents]
---
> /history
📊 Conversation History Stats:
  - Messages: 12
  - Memory usage: ~3,456 chars
  - Message types: {"user": 3, "assistant": 3, "tool": 6}
---
> /cls
🧹 Conversation history cleared
---
> exit
👋 Goodbye!
```

### Single Command Mode
```bash
# Execute one-off commands
docker run --rm -e OPENAI_API_KEY="your-key" docker-mcp \
  "Check if Docker is running and show me the version"

docker run --rm -e OPENAI_API_KEY="your-key" docker-mcp \
  "Create a backup of all .json files to a backup directory"
```
