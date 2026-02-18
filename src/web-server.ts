import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface WebServerOptions {
  port: number;
  processPromptFunction: (prompt: string, apiKey: string, baseURL: string, conversationHistory: any[], enableSelfReflection: boolean) => Promise<any[]>;
  tools: Record<string, any>;
  apiKey: string;
  baseURL: string;
}

export class WebServer {
  private app: express.Application;
  private server: any;
  private wss!: WebSocketServer; // Use definite assignment assertion
  private processPrompt: WebServerOptions['processPromptFunction'];
  private tools: Record<string, any>;
  private apiKey: string;
  private baseURL: string;

  // Store conversation histories per WebSocket connection
  private conversationHistories = new WeakMap<any, any[]>();
  private enhancedModeSettings = new WeakMap<any, boolean>();

  constructor(options: WebServerOptions) {
    this.app = express();
    this.processPrompt = options.processPromptFunction;
    this.tools = options.tools;
    this.apiKey = options.apiKey;
    this.baseURL = options.baseURL;

    this.setupExpress();
    this.server = createServer(this.app);
    this.setupWebSocket();
  }

  private setupExpress() {
    this.app.use(express.static(path.join(__dirname, '../web')));

    // API endpoint to get available tools
    this.app.get('/api/tools', (req, res) => {
      res.json({
        tools: Object.keys(this.tools),
        count: Object.keys(this.tools).length
      });
    });

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({ status: 'healthy', timestamp: new Date().toISOString() });
    });
  }

  private setupWebSocket() {
    this.wss = new WebSocketServer({ server: this.server });

    this.wss.on('connection', (ws) => {
      console.log('💬 New WebSocket connection established');

      // Initialize conversation history for this connection
      this.conversationHistories.set(ws, []);
      this.enhancedModeSettings.set(ws, true); // Default to enhanced mode

      // Send welcome message
      ws.send(JSON.stringify({
        type: 'system',
        message: '🤖 Loop Genie connected! Type your message below.',
        tools: Object.keys(this.tools),
        mode: 'enhanced'
      }));

      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString());
          await this.handleWebSocketMessage(ws, message);
        } catch (error) {
          console.error('WebSocket message error:', error);
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Failed to parse message'
          }));
        }
      });

      ws.on('close', () => {
        console.log('💬 WebSocket connection closed');
        this.conversationHistories.delete(ws);
        this.enhancedModeSettings.delete(ws);
      });
    });
  }

  private async handleWebSocketMessage(ws: any, message: any) {
    const { type, content } = message;

    if (type === 'chat') {
      await this.handleChatMessage(ws, content);
    } else if (type === 'command') {
      await this.handleCommand(ws, content);
    } else {
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Unknown message type'
      }));
    }
  }

  private async handleCommand(ws: any, command: string) {
    const conversationHistory = this.conversationHistories.get(ws) || [];
    const isEnhanced = this.enhancedModeSettings.get(ws) || true;

    switch (command) {
      case 'clear':
        this.conversationHistories.set(ws, []);
        ws.send(JSON.stringify({
          type: 'system',
          message: '🧹 Conversation history cleared'
        }));
        break;

      case 'history':
        ws.send(JSON.stringify({
          type: 'system',
          message: `📊 Conversation History: ${conversationHistory.length} messages, ~${JSON.stringify(conversationHistory).length} chars`,
          historyData: {
            messageCount: conversationHistory.length,
            memorySize: JSON.stringify(conversationHistory).length,
            mode: isEnhanced ? 'enhanced' : 'simple'
          }
        }));
        break;

      case 'enhanced':
        this.enhancedModeSettings.set(ws, true);
        ws.send(JSON.stringify({
          type: 'system',
          message: '🧠 Enhanced reasoning mode enabled - agent will use multi-step analysis'
        }));
        break;

      case 'simple':
        this.enhancedModeSettings.set(ws, false);
        ws.send(JSON.stringify({
          type: 'system',
          message: '⚡ Simple mode enabled - agent will provide single responses'
        }));
        break;

      case 'tools':
        ws.send(JSON.stringify({
          type: 'system',
          message: `🔧 Available tools: ${Object.keys(this.tools).join(', ')}`
        }));
        break;

      default:
        ws.send(JSON.stringify({
          type: 'error',
          message: `Unknown command: ${command}`
        }));
    }
  }

  private async handleChatMessage(ws: any, prompt: string) {
    if (!prompt.trim()) return;

    const conversationHistory = this.conversationHistories.get(ws) || [];
    const isEnhanced = this.enhancedModeSettings.get(ws) || true;

    // Send thinking indicator
    ws.send(JSON.stringify({
      type: 'thinking',
      message: isEnhanced
        ? `🤔 Processing with ${conversationHistory.length} previous messages (enhanced mode)...`
        : `🤔 Processing with ${conversationHistory.length} previous messages...`
    }));

    try {
      // Create a custom response handler that streams responses back with better formatting
      let fullResponse = '';
      const originalConsoleLog = console.log;
      let isFirstChunk = true;

      console.log = (...args) => {
        const message = args.join(' ');
        if (message && message.trim()) {
          fullResponse += message + '\n';

          // Format the message for better presentation
          const formattedMessage = this.formatMessageForWeb(message);

          ws.send(JSON.stringify({
            type: 'response_chunk',
            message: formattedMessage,
            isFirst: isFirstChunk
          }));

          isFirstChunk = false;
        }
        originalConsoleLog(...args);
      };

      // Process the prompt
      const newHistory = await this.processPrompt(
        prompt,
        this.apiKey,
        this.baseURL,
        conversationHistory,
        isEnhanced
      );

      // Restore console.log
      console.log = originalConsoleLog;

      // Update conversation history
      this.conversationHistories.set(ws, [...conversationHistory, ...newHistory]);

      // Send completion message
      ws.send(JSON.stringify({
        type: 'response_complete',
        message: '✅ Response complete',
        historyCount: conversationHistory.length + newHistory.length
      }));

    } catch (error: any) {
      console.error('Chat processing error:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: `Error: ${error.message || error}`
      }));
    }
  }

  private formatMessageForWeb(message: string): string {
    // Enhanced formatting for web display - matching VSCode Copilot patterns
    let formatted = message;

    // Detect tool execution patterns (using VSCode Copilot style)
    if (message.includes('shell:') || message.includes('Running command:')) {
      formatted = `�️ **Tool Execution:** ${message}`;
    }

    // Detect file operations
    if (message.includes('read_file:') || message.includes('Reading file:')) {
      formatted = `📄 **File Operation:** ${message}`;
    }

    if (message.includes('write_file:') || message.includes('Writing to:')) {
      formatted = `✏️ **File Write:** ${message}`;
    }

    // Detect MCP tool calls (using VSCode Copilot emoji style)
    if (message.includes('mcp_') || message.startsWith('{') && message.includes('"type"')) {
      formatted = `🛠️ **MCP Tool:** ${message}`;
    }

    // Detect analysis or thinking patterns (using VSCode Copilot style)
    const thinkingPatterns = [
      'Let me', 'I will', 'I should', 'I need to', 'I\'ll', 'I\'m going to',
      'Next,', 'Now I', 'To', 'Additionally', 'Furthermore', 'Also',
      'Based on', 'Looking at', 'I can see', 'It appears', 'I notice'
    ];

    for (const pattern of thinkingPatterns) {
      if (message.startsWith(pattern)) {
        formatted = `🤔 **Step:** ${message}`;
        break;
      }
    }

    // Detect progress messages
    if (message.includes('Processing') || message.includes('Working on') ||
      message.includes('Getting ready') || message.includes('Almost ready')) {
      formatted = `⏳ **Progress:** ${message}`;
    }

    // Detect warnings or errors
    if (message.includes('Error:') || message.includes('Failed:') || message.includes('Warning:')) {
      formatted = `⚠️ **Notice:** ${message}`;
    }

    // Detect successful operations
    if (message.includes('Successfully') || message.includes('Complete') ||
      message.includes('Done') || message.includes('Finished')) {
      formatted = `✅ **Success:** ${message}`;
    }
    if (message.includes('read_file:') || message.includes('Reading file:')) {
      formatted = `📄 **File Operation:** ${message}`;
    }

    if (message.includes('write_file:') || message.includes('Writing to:')) {
      formatted = `✏️ **File Write:** ${message}`;
    }

    // Format JSON responses
    try {
      if (message.trim().startsWith('{') && message.trim().endsWith('}')) {
        const jsonObj = JSON.parse(message);
        formatted = `\`\`\`json\n${JSON.stringify(jsonObj, null, 2)}\n\`\`\``;
      }
    } catch (e) {
      // Not JSON, continue with original formatting
    }

    return formatted;
  }

  public start(): Promise<void> {
    return new Promise((resolve) => {
      this.server.listen(3000, () => {
        console.log('🌐 Web server started on http://localhost:3000');
        console.log('💬 WebSocket server ready for connections');
        resolve();
      });
    });
  }

  public stop(): Promise<void> {
    return new Promise((resolve) => {
      this.wss.close(() => {
        this.server.close(() => {
          console.log('🌐 Web server stopped');
          resolve();
        });
      });
    });
  }
}
