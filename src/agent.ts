import fs from 'fs/promises';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { createInterface } from 'readline';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

const execAsync = promisify(exec);

const TOOLS: Record<string, any> = {
  shell: {
    name: 'shell',
    description: 'Run a shell command and return the output',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Command to run' }
      },
      required: ['command']
    }
  },
  read_file: {
    name: 'read_file',
    description: 'Read a text file',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path' }
      },
      required: ['path']
    }
  },
  write_file: {
    name: 'write_file',
    description: 'Write content to a text file',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path' },
        content: { type: 'string', description: 'Content to write' }
      },
      required: ['path', 'content']
    }
  },
  list_directory: {
    name: 'list_directory',
    description: 'List contents of a directory',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Directory path (default: current directory)' }
      },
      required: []
    }
  },
  analyze_file: {
    name: 'analyze_file',
    description: 'Get detailed information about a file (size, type, permissions)',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path to analyze' }
      },
      required: ['path']
    }
  },
  http_request: {
    name: 'http_request',
    description: 'Send an HTTP request',
    parameters: {
      type: 'object',
      properties: {
        method: { type: 'string', description: 'HTTP method' },
        url: { type: 'string', description: 'Request URL' },
        body: { type: 'string', description: 'Request body', nullable: true }
      },
      required: ['method', 'url']
    }
  }
};

async function runShell(command: string): Promise<string> {
  try {
    const { stdout, stderr } = await execAsync(command, { timeout: 30000 });
    return stdout + stderr;
  } catch (err: any) {
    return String(err);
  }
}

async function readFile(path: string): Promise<string> {
  try {
    return await fs.readFile(path, 'utf8');
  } catch (err: any) {
    return String(err);
  }
}

async function listDirectory(path: string = '.'): Promise<string> {
  try {
    const { stdout, stderr } = await execAsync(`ls -la "${path}"`, { timeout: 10000 });
    return stdout + stderr;
  } catch (err: any) {
    return String(err);
  }
}

async function analyzeFile(path: string): Promise<string> {
  try {
    const { stdout, stderr } = await execAsync(`file "${path}" && stat "${path}"`, { timeout: 10000 });
    return stdout + stderr;
  } catch (err: any) {
    return String(err);
  }
}

async function writeFile(path: string, content: string): Promise<string> {
  try {
    await fs.writeFile(path, content);
    return `Wrote to ${path}`;
  } catch (err: any) {
    return String(err);
  }
}

const FUNCTION_MAP: Record<string, (args: any) => Promise<string>> = {
  shell: (args) => runShell(args.command || ''),
  read_file: (args) => readFile(args.path || ''),
  write_file: (args) => writeFile(args.path || '', args.content || ''),
  list_directory: (args) => listDirectory(args.path),
  analyze_file: (args) => analyzeFile(args.path || ''),
  http_request: (args) => httpRequest(args.method || 'GET', args.url || '', args.body)
};

async function httpRequest(method: string, url: string, body: string | undefined): Promise<string> {
  try {
    const resp = await fetch(url, { method, body });
    return await resp.text();
  } catch (err: any) {
    return String(err);
  }
}

// Validate and clean conversation history to ensure proper message flow
function validateConversationHistory(history: any[]): any[] {
  const validatedHistory: any[] = [];
  
  for (let i = 0; i < history.length; i++) {
    const message = history[i];
    
    // If this is a tool message, ensure there's a preceding assistant message with tool_calls
    if (message.role === 'tool') {
      // Look backwards for the corresponding assistant message with tool_calls
      let foundToolCall = false;
      for (let j = validatedHistory.length - 1; j >= 0; j--) {
        const prevMsg = validatedHistory[j];
        if (prevMsg.role === 'assistant' && prevMsg.tool_calls) {
          // Check if this tool response corresponds to one of the tool calls
          const matchingCall = prevMsg.tool_calls.find((call: any) => call.id === message.tool_call_id);
          if (matchingCall) {
            foundToolCall = true;
            break;
          }
        }
      }
      
      // Only add tool message if we found its corresponding tool call
      if (foundToolCall) {
        validatedHistory.push(message);
      } else {
        console.warn('Skipping orphaned tool message:', message.name);
      }
    } else {
      // Add non-tool messages as-is
      validatedHistory.push(message);
    }
  }
  
  return validatedHistory;
}

const MCP_CONFIG_PATH = './mcp.json';
type MCPConfig = {
  servers?: Record<string, { 
    command?: string; 
    args?: string[]; 
    env?: Record<string, string>;
    type?: 'sse';
    url?: string;
  }>;
  tools?: Record<string, { command: string; args?: string[]; mcp?: boolean }>;
};

function startServers(config: MCPConfig): void {
  // No longer start servers here - we'll connect to them directly as MCP clients
}

async function connectToMCPServers(config: MCPConfig): Promise<void> {
  // Connect to servers in the servers section
  for (const [serverName, serverConfig] of Object.entries(config.servers || {})) {
    try {
      console.log(`Connecting to MCP server: ${serverName}`);
      const client = new Client({ 
        name: serverName, 
        version: '1.0.0',
        requestTimeout: 300000  // 5 minutes for browser automation tasks
      });
      
      let transport;
      
      // Check if this is an SSE server
      if (serverConfig.type === 'sse' && serverConfig.url) {
        console.log(`  Using SSE transport for ${serverName} at ${serverConfig.url}`);
        transport = new SSEClientTransport(new URL(serverConfig.url));
      } else if (serverConfig.command) {
        // Create stdio transport with environment variables if specified
        const transportOptions: any = { 
          command: serverConfig.command, 
          args: serverConfig.args ?? [] 
        };
        
        if (serverConfig.env) {
          transportOptions.env = { ...process.env, ...serverConfig.env };
        }
        
        transport = new StdioClientTransport(transportOptions);
      } else {
        console.error(`❌ Invalid configuration for MCP server ${serverName}: must have either 'command' or 'type: sse' with 'url'`);
        continue;
      }
      
      // Add timeout for connection
      const connectPromise = client.connect(transport);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`Connection timeout for ${serverName}`)), 10000)
      );
      
      await Promise.race([connectPromise, timeoutPromise]);
      
      const serverTools = await client.listTools();
      console.log(`✅ Loaded ${serverTools.tools.length} tools from ${serverName}:`, serverTools.tools.map(t => t.name).join(', '));
      
      for (const st of serverTools.tools) {
        TOOLS[st.name] = {
          name: st.name,
          description: st.description ?? '',
          parameters: st.inputSchema ?? { type: 'object', properties: {}, required: [] }
        };
        FUNCTION_MAP[st.name] = async (args: any) => {
          const res = await client.callTool({ name: st.name, arguments: args });
          return JSON.stringify(res);
        };
      }
    } catch (error: any) {
      console.error(`❌ Failed to connect to MCP server ${serverName}:`, error?.message || error);
      // Continue with other servers even if one fails
    }
  }

  // Also handle legacy tools in the tools section with mcp: true
  const tools = config.tools as Record<string, { command: string; args?: string[]; mcp?: boolean }> | undefined;
  for (const [name, tool] of Object.entries(tools || {})) {
    if (tool.mcp) {
      try {
        console.log(`Connecting to MCP tool: ${name}`);
        const client = new Client({ 
          name, 
          version: '1.0.0',
          requestTimeout: 300000  // 5 minutes for browser automation tasks
        });
        const transport = new StdioClientTransport({ command: tool.command, args: tool.args ?? [] });
        
        // Add timeout for connection
        const connectPromise = client.connect(transport);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error(`Connection timeout for ${name}`)), 10000)
        );
        
        await Promise.race([connectPromise, timeoutPromise]);
        
        const serverTools = await client.listTools();
        console.log(`✅ Loaded ${serverTools.tools.length} tools from MCP tool ${name}:`, serverTools.tools.map(t => t.name).join(', '));
        
        for (const st of serverTools.tools) {
          TOOLS[st.name] = {
            name: st.name,
            description: st.description ?? '',
            parameters: st.inputSchema ?? { type: 'object', properties: {}, required: [] }
          };
          FUNCTION_MAP[st.name] = async (args: any) => {
            const res = await client.callTool({ name: st.name, arguments: args });
            return JSON.stringify(res);
          };
        }
      } catch (error: any) {
        console.error(`❌ Failed to connect to MCP tool ${name}:`, error?.message || error);
      }
    } else {
      // Handle non-MCP command-line tools
      TOOLS[name] = {
        name,
        description: `Run ${name} tool`,
        parameters: {
          type: 'object',
          properties: {
            args: { type: 'string', description: 'Arguments to pass' }
          },
          required: []
        }
      };
      FUNCTION_MAP[name] = async (args: any) => {
        const extra = args.args ? String(args.args) : '';
        const cmd = tool.command;
        const cmdArgs = [...(tool.args || []), ...(extra ? [extra] : [])];
        try {
          const { stdout, stderr } = await execAsync([cmd, ...cmdArgs].join(' '));
          return stdout + stderr;
        } catch (err: any) {
          return String(err);
        }
      };
    }
  }
}

async function processPrompt(prompt: string, apiKey: string, baseURL: string, conversationHistory: any[] = [], enableSelfReflection: boolean = true): Promise<any[]> {
  const systemPrompt = enableSelfReflection 
    ? `You are an AI programming assistant.
When asked for your name, you must respond with "GitHub Copilot".
Follow the user's requirements carefully & to the letter.
Follow Microsoft content policies.
Avoid content that violates copyrights.
If you are asked to generate content that is harmful, hateful, racist, sexist, lewd, or violent, only respond with "Sorry, I can't assist with that."
Keep your answers short and impersonal.

You have access to a comprehensive Model Context Protocol (MCP) environment with multiple specialized tools and servers.
You can help users with plan management, test execution, memory/knowledge management, sequential thinking, file operations, database queries, web automation, and more.

The user works in an IDE called Visual Studio Code which has a concept for editors with open files, integrated unit test support, an output pane that shows the output of running the code as well as an integrated terminal.

Use Markdown formatting in your answers.
For code blocks use triple backticks to start and end.
Avoid wrapping the whole response in triple backticks.

The current date is ${new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}.

You should:
1. Analyze the user's request thoroughly
2. Break down complex tasks into steps
3. Execute tools to gather information or perform actions
4. Reflect on the results and determine if additional actions are needed
5. Continue working until the task is complete or you've provided a comprehensive answer
6. Be proactive - if you see related issues or improvements, address them
7. Always explain your reasoning and next steps

When using tools, consider:
- Are there follow-up actions needed based on the results?
- Should you verify or validate the information?
- Are there related tasks that would be helpful?
- Can you provide more comprehensive assistance?

Continue working until you've fully addressed the user's needs.`
    : `You are an AI programming assistant.
When asked for your name, you must respond with "GitHub Copilot".
Follow the user's requirements carefully & to the letter.
Keep your answers short and impersonal.

You have access to various MCP (Model Context Protocol) tools and servers.
The user works in Visual Studio Code with integrated terminal and file management.
Use Markdown formatting in your answers and available tools to perform actions.

The current date is ${new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}.`;

  const messages: any[] = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory,
    { role: 'user', content: prompt }
  ];

  // Track the starting point for new conversation history
  const historyStartIndex = messages.length - 1; // Index of the current user message

  for (let i = 0; i < 20; i++) {
    const body = {
      model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo-0125',
      messages,
      tools: Object.values(TOOLS).map((t) => ({ type: 'function', function: t })),
      tool_choice: 'auto'
    } as any;

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    const resp = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    const data = await resp.json();
    if (!resp.ok) {
      console.error('API error', resp.status, data?.error?.message || data);
      break;
    }

    const message = data.choices?.[0]?.message || data.message;
    const finishReason = data.choices?.[0]?.finish_reason ?? (data.done ? 'stop' : (message?.tool_calls ? 'tool_calls' : 'stop'));

    if (finishReason === 'tool_calls' && Array.isArray(message?.tool_calls)) {
      messages.push(message);
      for (const call of message!.tool_calls) {
        const func = call.function.name as string;
        let args: any = {};
        try {
          args = JSON.parse(call.function.arguments || '{}');
        } catch {
          args = {};
        }
        const result = await (FUNCTION_MAP[func] ? FUNCTION_MAP[func](args) : Promise.resolve('Unknown function'));
        messages.push({ role: 'tool', tool_call_id: call.id, name: func, content: result } as any);
      }
      // Continue the loop to allow the agent to analyze results and potentially make more tool calls
    } else {
      // Add final assistant response to messages
      if (message?.content) {
        messages.push(message);
        
        // Check if the agent is indicating it wants to continue working
        const content = message.content.toLowerCase();
        const continueIndicators = [
          'let me also',
          'i should also',
          'next, i will',
          'additionally',
          'furthermore',
          'i notice',
          'i should check',
          'let me verify',
          'i will now',
          'to complete this',
          'to be thorough'
        ];
        
        const shouldContinue = continueIndicators.some(indicator => content.includes(indicator));
        
        if (shouldContinue && enableSelfReflection && i < 19) {
          // Agent indicated it wants to continue - give it another turn
          messages.push({ 
            role: 'user', 
            content: 'Please continue with your analysis or next steps.' 
          });
          continue;
        }
      }
      console.log(message?.content || '');
      break;
    }
  }

  // Return only the new conversation history (from the current user message onward)
  // This ensures we maintain proper message flow integrity
  return messages.slice(historyStartIndex);
}

async function main() {
  const interactiveMode = process.argv.includes('--interactive') || process.argv.includes('-i');
  const webMode = process.argv.includes('--web') || process.argv.includes('-w');
  const showHelp = process.argv.includes('--help') || process.argv.includes('-h');
  const enhancedMode = process.argv.includes('--enhanced') || process.argv.includes('-e');
  const simpleMode = process.argv.includes('--simple') || process.argv.includes('-s');
  const prompt = process.argv[2];
  
  if (showHelp) {
    console.log('Docker MCP Agent');
    console.log('');
    console.log('Usage:');
    console.log('  agent --interactive          Run in interactive mode');
    console.log('  agent -i                     Run in interactive mode (short)');
    console.log('  agent --web                  Run web-based chat interface');
    console.log('  agent -w                     Run web-based chat interface (short)');
    console.log('  agent --enhanced             Enable enhanced reasoning (default in interactive)');
    console.log('  agent -e                     Enable enhanced reasoning (short)');
    console.log('  agent --simple               Disable enhanced reasoning');
    console.log('  agent -s                     Disable enhanced reasoning (short)');
    console.log('  agent "<command>"            Execute single command');
    console.log('  agent --help                 Show this help');
    console.log('');
    console.log('Interactive Mode Commands:');
    console.log('  help                         Show available commands');
    console.log('  tools                        List available tools');
    console.log('  /cls                         Clear conversation history');
    console.log('  /history                     Show conversation history stats');
    console.log('  /enhanced                    Toggle enhanced reasoning mode');
    console.log('  /simple                      Toggle simple mode');
    console.log('  exit, quit                   Exit the agent');
    console.log('');
    console.log('Web Mode:');
    console.log('  Starts a web server on port 3000 with chat interface');
    console.log('  Access via http://localhost:3000');
    console.log('  Features real-time WebSocket communication');
    console.log('  Supports all interactive commands via web UI');
    console.log('');
    console.log('Enhanced Mode Features:');
    console.log('  - Multi-step reasoning and analysis');
    console.log('  - Self-reflection on results');
    console.log('  - Proactive task completion');
    console.log('  - Comprehensive problem solving');
    console.log('');
    console.log('Environment Variables:');
    console.log('  OPENAI_API_KEY              Your OpenAI API key (required)');
    console.log('  OPENAI_BASE_URL             API base URL (default: https://api.openai.com/v1)');
    console.log('  OPENAI_MODEL                Model to use (default: gpt-3.5-turbo-0125)');
    console.log('');
    console.log('Examples:');
    console.log('  agent --interactive --enhanced');
    console.log('  agent --web                          # Start web interface');
    console.log('  agent "Analyze the project structure and suggest improvements"');
    return;
  }
  
  if (!interactiveMode && !webMode && !prompt) {
    console.log('Usage: agent "<initial prompt>" or agent --interactive or agent --web');
    console.log('Use --help for more information');
    return;
  }

  try {
    const text = await fs.readFile(MCP_CONFIG_PATH, 'utf8');
    const cfg: MCPConfig = JSON.parse(text);
    await connectToMCPServers(cfg);
  } catch (error: any) {
    console.log('No MCP configuration found or failed to load MCP servers:', error?.message || error);
  }

  const apiKey = process.env.OPENAI_API_KEY || '';
  const baseURL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';

  if (webMode) {
    // Dynamic import to avoid TypeScript errors during compilation
    const { WebServer } = await import('./web-server.js');
    
    const webServer = new WebServer({
      port: 3000,
      processPromptFunction: processPrompt,
      tools: TOOLS,
      apiKey,
      baseURL
    });

    console.log('🌐 Starting web-based chat interface...');
    console.log('💡 Available tools:', Object.keys(TOOLS).join(', '));
    console.log('📝 Enhanced reasoning enabled by default');
    
    await webServer.start();
    
    // Keep the process running
    process.on('SIGINT', async () => {
      console.log('\n👋 Shutting down web server...');
      await webServer.stop();
      process.exit(0);
    });
    
    return; // Don't continue to other modes
  }

  if (interactiveMode) {
    // Default to enhanced mode in interactive, unless simple mode is explicitly requested
    let useEnhancedMode = simpleMode ? false : true;
    if (enhancedMode) useEnhancedMode = true;
    
    console.log('🤖 Agent started in interactive mode. Type "exit" to quit.');
    console.log('💡 Available tools:', Object.keys(TOOLS).join(', '));
    console.log('📝 Commands: help, tools, /cls (clear history), /history (show stats), /enhanced, /simple, exit');
    console.log('ℹ️  Note: Conversation history has no limit - use /cls to clear if needed');
    console.log(`🧠 Mode: ${useEnhancedMode ? 'Enhanced (multi-step reasoning)' : 'Simple (single response)'}`);
    console.log('---');
    
    // Maintain conversation history across interactions
    let conversationHistory: any[] = [];
    
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '> '
    });

    rl.prompt();

    rl.on('line', async (input) => {
      const trimmed = input.trim();
      
      if (trimmed === 'exit' || trimmed === 'quit') {
        console.log('👋 Goodbye!');
        rl.close();
        process.exit(0);
      }
      
      if (trimmed === '') {
        rl.prompt();
        return;
      }

      if (trimmed === '/cls') {
        conversationHistory = [];
        console.log('🧹 Conversation history cleared');
        rl.prompt();
        return;
      }

      if (trimmed === '/history') {
        console.log('📊 Conversation History Stats:');
        console.log(`  - Messages: ${conversationHistory.length}`);
        console.log(`  - Memory usage: ~${JSON.stringify(conversationHistory).length} chars`);
        if (conversationHistory.length > 0) {
          const messageTypes = conversationHistory.reduce((acc, msg) => {
            acc[msg.role] = (acc[msg.role] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);
          console.log(`  - Message types:`, messageTypes);
          
          // Check for orphaned tool messages
          let orphanedTools = 0;
          for (let i = 0; i < conversationHistory.length; i++) {
            const msg = conversationHistory[i];
            if (msg.role === 'tool') {
              // Look backwards for corresponding tool call
              let foundCall = false;
              for (let j = i - 1; j >= 0; j--) {
                const prevMsg = conversationHistory[j];
                if (prevMsg.role === 'assistant' && prevMsg.tool_calls) {
                  const matchingCall = prevMsg.tool_calls.find((call: any) => call.id === msg.tool_call_id);
                  if (matchingCall) {
                    foundCall = true;
                    break;
                  }
                }
              }
              if (!foundCall) orphanedTools++;
            }
          }
          if (orphanedTools > 0) {
            console.log(`  - ⚠️  Orphaned tool messages: ${orphanedTools}`);
          } else {
            console.log(`  - ✅ Message flow integrity: OK`);
          }
        }
        rl.prompt();
        return;
      }

      if (trimmed === '/enhanced') {
        useEnhancedMode = true;
        console.log('🧠 Enhanced reasoning mode enabled - agent will use multi-step analysis');
        rl.prompt();
        return;
      }

      if (trimmed === '/simple') {
        useEnhancedMode = false;
        console.log('⚡ Simple mode enabled - agent will provide single responses');
        rl.prompt();
        return;
      }

      if (trimmed === 'help') {
        console.log('Available commands:');
        console.log('  help       - Show this help');
        console.log('  exit       - Exit the agent');
        console.log('  tools      - List available tools');
        console.log('  /cls       - Clear conversation history');
        console.log('  /history   - Show conversation history stats');
        console.log('  /enhanced  - Enable enhanced reasoning mode');
        console.log('  /simple    - Enable simple mode');
        console.log('  Or type any natural language command');
        console.log('📊 Current history:', conversationHistory.length, 'messages (unlimited)');
        console.log(`🧠 Current mode: ${useEnhancedMode ? 'Enhanced' : 'Simple'}`);
        rl.prompt();
        return;
      }

      if (trimmed === 'tools') {
        console.log('Available tools:', Object.keys(TOOLS).join(', '));
        rl.prompt();
        return;
      }

      try {
        if (conversationHistory.length > 0) {
          console.log('💭 Processing with', conversationHistory.length, 'previous messages...');
        }
        
        // Validate conversation history before processing
        conversationHistory = validateConversationHistory(conversationHistory);
        
        const newHistory = await processPrompt(trimmed, apiKey, baseURL, conversationHistory, useEnhancedMode);
        
        // Append new conversation to existing history
        conversationHistory.push(...newHistory);
        
        // Validate the updated history to ensure integrity
        conversationHistory = validateConversationHistory(conversationHistory);
      } catch (error) {
        console.error('Error:', error);
      }
      
      console.log('---');
      rl.prompt();
    });

    rl.on('close', () => {
      console.log('👋 Goodbye!');
      process.exit(0);
    });
  } else {
    // Single command mode - determine mode from flags
    const useEnhancedMode = enhancedMode || (!simpleMode && prompt?.length > 50); // Default to enhanced for complex prompts
    await processPrompt(prompt, apiKey, baseURL, [], useEnhancedMode);
  }
}

main().catch((err) => console.error(err));
