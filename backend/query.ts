import "dotenv/config";
import express from "express";
import {
  storageContextFromDefaults,
  VectorStoreIndex,
  QueryEngineTool,
  OpenAIAgent,
  VectorIndexRetriever,
  RetrieverQueryEngine,
  OpenAI,
} from "llamaindex";

import { mcpClient } from "./mcp-client";
import { createMCPTools } from "./mcp-tools";

let queryEngineTool: QueryEngineTool | null = null;
let chatEngines = new Map<string, OpenAIAgent>();
let lastActivityTimes = new Map<string, number>();

async function initializeEngine() {
  const storageContext = await storageContextFromDefaults({
    persistDir: "./storage",
  });

  const vectorIndex = await VectorStoreIndex.init({
    storageContext,
  });

  const retriever = new VectorIndexRetriever({
    index: vectorIndex,
    similarityTopK: 3,
  });

  const queryEngine = new RetrieverQueryEngine(retriever);

  queryEngineTool = new QueryEngineTool({
    queryEngine,
    metadata: {
      name: "druids_query_engine",
      description: "A query engine for the DRUIDS design system",
    },
  });
}

async function getChatEngine(userId: string): Promise<OpenAIAgent> {
  if (!chatEngines.has(userId)) {
    if (!queryEngineTool) {
      await initializeEngine();
    }

    if (!queryEngineTool) {
      throw new Error("Failed to initialize query engine");
    }

    if (!mcpClient.isReady()) {
      try {
        await mcpClient.connect();
        console.log("MCP client initialized for user:", userId);
      } catch (error) {
        console.warn("Failed to initialize MCP client:", error);
        // Continue without MCP tools - graceful degradation
      }
    }

    const mcpTools = createMCPTools();
    const allTools = [queryEngineTool, ...mcpTools];

    const chatEngine = new OpenAIAgent({
      tools: allTools,
      // 3.5 deprecated, use gpt-4
      llm: new OpenAI({
        model: process.env.OPENAI_MODEL || "gpt-4",
        apiKey: process.env.OPENAI_API_KEY,
      }),
      verbose: true,
      prefixMessages: [
        {
          content: `You are an agent designed to answer queries about the DRUIDS design system from Datadog. 
                    You have access to multiple tools:

                    1. **MCP Tools (Authoritative - Use First):**
                    - list_druids_components: Get all available components with official specs
                    - get_component_props: Get exact component props, types, and API details

                    2. **RAG Tool (Contextual - Use for Examples):**
                    - druids_query_engine: Search documentation for usage examples and implementation patterns

                    **Tool Selection Strategy:**
                    - For component specifications, props, API details → Use MCP tools FIRST
                    - For usage examples, tutorials, implementation help → Use RAG tool
                    - For comprehensive answers → Use MCP tools for specs + RAG for examples

                    Always try to use the authoritative MCP tools first for component information. Only use RAG when you need usage examples or when MCP tools don't have the information. Do not invent props or components not found in the tools. 

                    If DRUIDS doesn't support a requested use case, direct users to check with the #designops Slack channel.`,
          role: "system",
        },
      ],
    });
    chatEngines.set(userId, chatEngine);
  }

  // Update the last activity time for the user.
  lastActivityTimes.set(userId, Date.now());

  // Schedule a function to delete the OpenAIAgent after 10 minutes of inactivity.
  setTimeout(() => {
    const lastActivityTime = lastActivityTimes.get(userId);
    if (Date.now() - (lastActivityTime || 0) >= 10 * 60 * 1000) {
      chatEngines.delete(userId);
      lastActivityTimes.delete(userId);
    }
  }, 5 * 60 * 1000);

  return chatEngines.get(userId) as OpenAIAgent;
}

async function queryIndex(query: string, userId: string) {
  const chatEngine = await getChatEngine(userId);

  console.log("Query:", query);
  const response = await chatEngine.chat({
    message: query,
    stream: false,
  });

  console.log("active agents:", chatEngines);
  return response.toString();

  // return {response: response.toString(), metadata: response.sourceNodes?.map(node => node.metadata)};
}

async function* streamQueryIndex(query: string, userId: string) {
  const chatEngine = await getChatEngine(userId);

  console.log("Streamed Query:", query);
  const stream = await chatEngine.chat({
    message: query,
    stream: true,
  });

  for await (const chunk of stream.response) {
    yield chunk.response;
  }
}

// API Endpoints

const app = express();
app.use(express.json());

app.post("/query", async (req, res) => {
  const query = req.body.query;
  const userId = req.headers["x-user"];
  if (!userId) {
    res.status(400).json({ error: "Missing X-User header" });
    return;
  }
  try {
    const response = await queryIndex(query, userId.toString());
    res.json(response);
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.toString() });
    } else {
      res.status(500).json({ error: "An unknown error occurred" });
    }
  }
});

app.post("/stream-query", async (req, res) => {
  const query = req.body.query;
  const userId = req.headers["x-user"];
  if (!userId) {
    res.status(400).json({ error: "Missing X-User header" });
    return;
  }
  try {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    for await (const response of streamQueryIndex(query, userId.toString())) {
      res.write(`data: ${response}\n\n`);
    }
    res.end();
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.toString() });
    } else {
      res.status(500).json({ error: "An unknown error occurred" });
    }
  }
});

app.get("/", (req, res) => {
  res.send("Hello World. This is the Druids AI endpoint.");
});

console.log("initializing index...");
initializeEngine().then(() => {
  const port = 8000;
  app.listen(port, () => console.log(`Server running on port ${port}`));
});
