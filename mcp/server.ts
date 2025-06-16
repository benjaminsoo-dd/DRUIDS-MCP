/* eslint-disable @typescript-eslint/no-require-imports */

const {
    listAvailableDruidsComponents,
} = require('./tools/list-available-druids-components');
const {
    getDruidsComponentProps,
} = require('./tools/get-druids-component-props');

const { Server } = require('@modelcontextprotocol/sdk/server/index');
const {
    StdioServerTransport,
} = require('@modelcontextprotocol/sdk/server/stdio');
const {
    ListToolsRequestSchema,
    CallToolRequestSchema,
} = require('@modelcontextprotocol/sdk/types');

// Create an MCP server
const server = new Server(
    {
        name: 'DRUIDS',
        version: '1.1.1',
    },
    {
        capabilities: {
            tools: {},
        },
    },
);

// Define available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: 'list-available-druids-components',
                description:
                    'Lists all available DRUIDS design system components with their description, status level, directory path, and import path.',
                inputSchema: {
                    type: 'object',
                    properties: {},
                },
            },
            {
                name: 'get-druids-component-props',
                description:
                    'Given a list of component names, retrieves their props from the Design System. This is useful to understand the props of a component. If a component is not found, the tool will return a "notFound" property with the component name.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        names: {
                            type: 'array',
                            items: { type: 'string' },
                            description:
                                'List of component names to retrieve props for',
                        },
                    },
                    required: ['names'],
                },
            },
        ],
    };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
    if (request.params.name === 'list-available-druids-components') {
        const components = await listAvailableDruidsComponents();
        return {
            content: [
                { type: 'text', text: JSON.stringify(components, null, 2) },
            ],
        };
    }

    if (request.params.name === 'get-druids-component-props') {
        const { names } = request.params.arguments as { names: string[] };
        const result = await getDruidsComponentProps(names);
        return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
    }

    throw new Error(`Tool not found: ${request.params.name}`);
});

// Start receiving messages on stdin and sending messages on stdout
const transport = new StdioServerTransport();

// Use IIFE to allow using async/await
(async () => {
    try {
        await server.connect(transport);
    } catch (error: unknown) {
        // Use stderr instead of stdout to avoid interfering with MCP protocol messages
        process.stderr.write(
            `Failed to start MCP Server: ${
                error instanceof Error ? error.message : String(error)
            }\n`,
        );
    }
})();
