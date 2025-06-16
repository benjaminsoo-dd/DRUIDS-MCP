import 'dotenv/config';
import express from 'express';
import { 
    storageContextFromDefaults, 
    VectorStoreIndex, 
    QueryEngineTool, 
    OpenAIAgent, 
    VectorIndexRetriever, 
    RetrieverQueryEngine 
} from 'llamaindex';

let queryEngineTool: QueryEngineTool | null = null;
let chatEngines = new Map<string, OpenAIAgent>();
let lastActivityTimes = new Map<string, number>();

async function initializeEngine() {
    const storageContext = await storageContextFromDefaults({
        persistDir: './storage',
    });

    const vectorIndex = await VectorStoreIndex.init({
        storageContext,
    })

    const retriever = new VectorIndexRetriever({
        index: vectorIndex,
        similarityTopK: 3,
    })

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
                throw new Error('Failed to initialize query engine');
        }

        const chatEngine = new OpenAIAgent({
            tools: [queryEngineTool],
            verbose: true,
            prefixMessages: [
                      {
                        content:
                          "You are an agent designed to answer queries about the DRUIDS design system from Datadog. Always try to use the given context to answer your questions. It is important that you do not come up with new props or new components, that you do not have information about. In such a case reply that you cannot answer the question.  The component name should be always found in the metadata. If DRUIDS does not support the requested use case, tell to in your answer to check in with the #designops Slack channel",
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

    console.log('Query:', query);
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

    console.log('Streamed Query:', query);
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

app.post('/query', async (req, res) => {
    const query = req.body.query;
    const userId = req.headers['x-user'];
    if (!userId) {
        res.status(400).json({ error: 'Missing X-User header' });
        return;
    }
    try {
        const response = await queryIndex(query, userId.toString());
        res.json(response);
    } catch (error) {
        if (error instanceof Error) {
            res.status(500).json({ error: error.toString() });
        } else {
            res.status(500).json({ error: 'An unknown error occurred' });
        }
    }
});

app.post('/stream-query', async (req, res) => {
    const query = req.body.query;
    const userId = req.headers['x-user'];
    if (!userId) {
        res.status(400).json({ error: 'Missing X-User header' });
        return;
    }
    try {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        for await (const response of streamQueryIndex(query, userId.toString())) {
            res.write(`data: ${response}\n\n`);
        }
        res.end();
    } catch (error) {
        if (error instanceof Error) {
            res.status(500).json({ error: error.toString() });
        } else {
            res.status(500).json({ error: 'An unknown error occurred' });
        }
    }
});


app.get('/', (req, res) => {
    res.send('Hello World. This is the Druids AI endpoint.');
});

console.log("initializing index...");
initializeEngine().then(() => {
    const port = 8000;
    app.listen(port, () => console.log(`Server running on port ${port}`));
});
