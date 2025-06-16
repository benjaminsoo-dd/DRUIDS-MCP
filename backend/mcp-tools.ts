import { BaseTool } from "llamaindex";
import { mcpClient } from "./mcp-client";

export class ListComponentsTool implements BaseTool {
  metadata = {
    name: "list_druids_components",
    description:
      "Lists all available DRUIDS design system components with their description, status level, directory path, and import path. Use this for authoritative component information.",
    parameters: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  };

  async call(): Promise<string> {
    try {
      if (!mcpClient.isReady()) {
        await mcpClient.connect();
      }

      const components = await mcpClient.listAvailableComponents();

      return JSON.stringify(
        {
          success: true,
          components: components,
          total: components.length,
          message: `Found ${components.length} available DRUIDS components`,
        },
        null,
        2
      );
    } catch (error) {
      console.error("Error in ListComponentsTool:", error);
      return JSON.stringify({
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
        message:
          "Failed to retrieve component list. Please try again or use the RAG tool for general component information.",
      });
    }
  }
}

export class GetComponentPropsTool implements BaseTool {
  metadata = {
    name: "get_component_props",
    description:
      "Gets authoritative props and specifications for specific DRUIDS components. Use this for exact component API information, prop types, required fields, and default values.",
    parameters: {
      type: "object" as const,
      properties: {
        names: {
          type: "array" as const,
          items: { type: "string" as const },
          description:
            'List of component names to retrieve props for (e.g., ["Button", "Input", "Modal"])',
        },
      },
      required: ["names"],
    },
  };

  async call(input: { names: string[] }): Promise<string> {
    try {
      if (
        !input.names ||
        !Array.isArray(input.names) ||
        input.names.length === 0
      ) {
        return JSON.stringify({
          success: false,
          error:
            "Invalid input: names must be a non-empty array of component names",
          message:
            'Please provide component names as an array, e.g., ["Button", "Input"]',
        });
      }

      if (!mcpClient.isReady()) {
        await mcpClient.connect();
      }

      const componentProps = await mcpClient.getComponentProps(input.names);

      const foundComponents = componentProps.filter((comp) => !comp.notFound);
      const notFoundComponents = componentProps.filter((comp) => comp.notFound);

      return JSON.stringify(
        {
          success: true,
          components: foundComponents,
          notFound: notFoundComponents.map((comp) => comp.name),
          message: `Retrieved props for ${foundComponents.length} components. ${
            notFoundComponents.length > 0
              ? `Could not find: ${notFoundComponents
                  .map((c) => c.name)
                  .join(", ")}`
              : ""
          }`,
        },
        null,
        2
      );
    } catch (error) {
      console.error("Error in GetComponentPropsTool:", error);
      return JSON.stringify({
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
        message:
          "Failed to retrieve component props. Please try again or use the RAG tool for general component information.",
      });
    }
  }
}

// Factory function to create MCP tools
export function createMCPTools(): BaseTool[] {
  return [new ListComponentsTool(), new GetComponentPropsTool()];
}
