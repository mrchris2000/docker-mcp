import fs from 'fs/promises';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import OpenAI from 'openai';

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

const MCP_CONFIG_PATH = './mcp.json';
type MCPConfig = {
  servers?: Record<string, { command: string; args?: string[] }>;
  tools?: Record<string, { command: string; args?: string[] }>;
};

function startServers(config: MCPConfig): void {
  for (const srv of Object.values(config.servers || {})) {
    const child = spawn(srv.command, srv.args ?? [], { stdio: 'inherit' });
    child.on('error', (err) => console.error('Server failed to start', err));
  }
}

async function main() {
  const prompt = process.argv[2];
  if (!prompt) {
    console.log('Usage: agent "<initial prompt>"');
    return;
  }

  try {
    const text = await fs.readFile(MCP_CONFIG_PATH, 'utf8');
    const cfg: MCPConfig = JSON.parse(text);
    startServers(cfg);
    const tools = cfg.tools as Record<string, { command: string; args?: string[] }> | undefined;
    for (const [name, tool] of Object.entries(tools || {})) {
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
  } catch {
    // ignore missing config
  }

  const apiKey = process.env.OPENAI_API_KEY || '';
  const baseURL = process.env.OPENAI_BASE_URL;
  if (!apiKey && !baseURL) {
    console.log('Set OPENAI_API_KEY or OPENAI_BASE_URL to reach a provider');
    return;
  }

  const client = new OpenAI({ apiKey, baseURL });

  const messages: any[] = [
    { role: 'system', content: 'You are a helpful agent with access to tools.' },
    { role: 'user', content: prompt }
  ];

  for (let i = 0; i < 10; i++) {
    const resp = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo-0125',
      messages,
      functions: Object.values(TOOLS) as any,
      function_call: 'auto'
    });

    const choice = resp.choices[0];

    if (choice.finish_reason === 'stop') {
      console.log(choice.message.content);
      break;
    }

    if (choice.finish_reason === 'function_call' && choice.message.function_call) {
      const func = choice.message.function_call.name;
      let args: any = {};
      try {
        args = JSON.parse(choice.message.function_call.arguments || '{}');
      } catch {
        args = {};
      }
      const result = await (FUNCTION_MAP[func] ? FUNCTION_MAP[func](args) : Promise.resolve('Unknown function'));
      messages.push(choice.message as any);
      messages.push({ role: 'function', name: func, content: result } as any);
    } else {
      console.log(choice.message.content);
      break;
    }
  }
}

main().catch((err) => console.error(err));
