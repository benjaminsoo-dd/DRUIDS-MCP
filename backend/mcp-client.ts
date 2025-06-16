import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "path";

interface AvailableComponent {
  name: string;
  description?: string;
  statusLevel?: string;
  directoryPath: string;
  importPath?: string;
}

interface AIFriendlyProp {
  name: string;
  type: string;
  required?: boolean;
  defaultValue?: unknown;
  description?: string;
  possibleValues?: string[];
}

interface AIFriendlyComponentProps {
  name: string;
  props?: AIFriendlyProp[];
  notFound?: boolean;
}

class MCPClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private isConnected = false;

  async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    try {
      // Path to the MCP server - using Node.js to run the server
      const mcpServerPath = path.join(__dirname, "../mcp");

      // Create transport with command and args
      this.transport = new StdioClientTransport({
        command: "node",
        args: ["index.js"],
        cwd: mcpServerPath,
      });

      // Create client
      this.client = new Client(
        {
          name: "druids-backend-client",
          version: "1.0.0",
        },
        {
          capabilities: {},
        }
      );

      // Connect to the server
      await this.client.connect(this.transport);
      this.isConnected = true;

      console.log("MCP Client connected successfully");
    } catch (error) {
      console.error("Failed to connect MCP client:", error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.isConnected || !this.client) {
      return;
    }

    try {
      await this.client.close();
      this.transport = null;
      this.client = null;
      this.isConnected = false;
      console.log("MCP Client disconnected");
    } catch (error) {
      console.error("Error disconnecting MCP client:", error);
    }
  }

  async listAvailableComponents(): Promise<AvailableComponent[]> {
    if (!this.isConnected || !this.client) {
      throw new Error("MCP Client not connected");
    }

    try {
      const response = await this.client.callTool({
        name: "list-available-druids-components",
        arguments: {},
      });

      if (
        response.content &&
        Array.isArray(response.content) &&
        response.content.length > 0
      ) {
        const content = response.content[0];
        if (content.type === "text") {
          return JSON.parse(content.text) as AvailableComponent[];
        }
      }

      return [];
    } catch (error) {
      console.error("Error listing components:", error);
      throw error;
    }
  }

  async getComponentProps(
    names: string[]
  ): Promise<AIFriendlyComponentProps[]> {
    if (!this.isConnected || !this.client) {
      throw new Error("MCP Client not connected");
    }

    try {
      const response = await this.client.callTool({
        name: "get-druids-component-props",
        arguments: { names },
      });

      if (
        response.content &&
        Array.isArray(response.content) &&
        response.content.length > 0
      ) {
        const content = response.content[0];
        if (content.type === "text") {
          return JSON.parse(content.text) as AIFriendlyComponentProps[];
        }
      }

      return [];
    } catch (error) {
      console.error("Error getting component props:", error);
      throw error;
    }
  }

  isReady(): boolean {
    return this.isConnected;
  }
}

// Singleton instance
export const mcpClient = new MCPClient();
