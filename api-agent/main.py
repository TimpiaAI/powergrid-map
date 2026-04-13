from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from agent import create_agent
from dotenv import load_dotenv
from langchain_core.messages import HumanMessage, AIMessageChunk
import os, json, asyncio

load_dotenv()

app = FastAPI(title="PowerGrid AI Agent")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

chat_histories: dict[str, list] = {}


class ChatRequest(BaseModel):
    message: str
    session_id: str = "default"


agent = None


@app.on_event("startup")
async def startup():
    global agent
    if os.getenv("CEREBRAS_API_KEY"):
        agent = create_agent()
        print("Agent initialized with Cerebras LLM")
    else:
        print("WARNING: CEREBRAS_API_KEY not set.")


async def stream_response(request: ChatRequest):
    """Stream agent response token by token via SSE."""
    history = chat_histories.get(request.session_id, [])
    messages = history + [HumanMessage(content=request.message)]

    full_response = ""

    try:
        # Use astream_events for real-time token streaming
        async for event in agent.astream_events(
            {"messages": messages},
            version="v2",
        ):
            kind = event["event"]

            # Stream LLM tokens as they arrive
            if kind == "on_chat_model_stream":
                chunk = event["data"]["chunk"]
                if hasattr(chunk, "content") and chunk.content:
                    token = chunk.content
                    full_response += token
                    yield f"data: {json.dumps({'token': token})}\n\n"

            # When a tool is called, notify the frontend
            elif kind == "on_tool_start":
                tool_name = event.get("name", "tool")
                yield f"data: {json.dumps({'tool': tool_name, 'status': 'start'})}\n\n"

            elif kind == "on_tool_end":
                tool_name = event.get("name", "tool")
                yield f"data: {json.dumps({'tool': tool_name, 'status': 'done'})}\n\n"

        # Save full response to history
        result = agent.invoke({"messages": messages})
        chat_histories[request.session_id] = result["messages"][-20:]

    except Exception as e:
        yield f"data: {json.dumps({'error': str(e)})}\n\n"

    yield f"data: {json.dumps({'done': True})}\n\n"


@app.post("/api/chat/stream")
async def chat_stream(request: ChatRequest):
    """SSE streaming endpoint for real-time token delivery."""
    if not agent:
        async def error_stream():
            yield f"data: {json.dumps({'token': 'Agentul AI nu este configurat. Setati CEREBRAS_API_KEY.'})}\n\n"
            yield f"data: {json.dumps({'done': True})}\n\n"
        return StreamingResponse(error_stream(), media_type="text/event-stream")

    return StreamingResponse(
        stream_response(request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.post("/api/chat")
async def chat(request: ChatRequest):
    """Non-streaming fallback endpoint."""
    if not agent:
        return {"response": "Agentul AI nu este configurat.", "session_id": request.session_id}

    history = chat_histories.get(request.session_id, [])
    messages = history + [HumanMessage(content=request.message)]

    result = agent.invoke({"messages": messages})

    ai_messages = [m for m in result["messages"] if m.type == "ai" and m.content]
    response_text = ai_messages[-1].content if ai_messages else "Nu am putut genera un raspuns."

    chat_histories[request.session_id] = result["messages"][-20:]

    return {"response": response_text, "session_id": request.session_id}


@app.get("/api/health")
async def health():
    return {"status": "ok", "agent_ready": agent is not None}
