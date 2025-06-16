# DRUIDS AI Backend

This directory contains all files to deploy the DRUIDS AI backend to https://druids-ai.us1.staging.dog/ using [Howler](https://howler.us1.staging.dog/).

The DRUIDS AI backend uses Llamaindex.ai as underlying framework.

## Steps for updating files and redeploying the service

1. Navigate to the `druids-ai-backend` directory. `cd teams/designops/druids-ai-backend`
2. Add file modifications
3. Bundle the files by running `tar cfz /tmp/context.tgz --exclude='.git' .`
4. Upload the files using curl by running `curl https://howler.us1.staging.dog/api/services/160/builds/ -F build-context.tgz=@/tmp/context.tgz`

For a fresh and new deployment, only a new _OPEN_AI_API_KEY_ needs to be provided to howler.

## Steps for running in a docker container locally

Build container using `docker image build -t express_docker .`
Run container with `docker run -p 8000:8000 --env OPENAI_API_KEY="<API KEY>" express_docker`

## How to use

Currently, only single requests are supported. 
Each request will load the index from the storage repository and perform the query. (This should be improved to handle multithreading)

You can post a questions to the `/query` endpoint.

Example

```bash
curl -X POST -H "Content-Type: application/json" -d '{"text":"Give me an example how to use the table component"}' https://druids-ai.us1.staging.dog/query
```
