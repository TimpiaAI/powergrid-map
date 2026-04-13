from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from agent import create_agent
from dotenv import load_dotenv
from langchain_core.messages import HumanMessage
import os

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


class ChatResponse(BaseModel):
    response: str
    session_id: str


agent = None


@app.on_event("startup")
async def startup():
    global agent
    if os.getenv("CEREBRAS_API_KEY"):
        agent = create_agent()
        print("Agent initialized with Cerebras LLM")
    else:
        print("WARNING: CEREBRAS_API_KEY not set.")


@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    if not agent:
        return ChatResponse(
            response="Agentul AI nu este configurat. Setati CEREBRAS_API_KEY.",
            session_id=request.session_id,
        )

    history = chat_histories.get(request.session_id, [])

    # LangGraph agent uses messages format
    messages = history + [HumanMessage(content=request.message)]

    result = agent.invoke({"messages": messages})

    # Extract the last AI message
    ai_messages = [m for m in result["messages"] if m.type == "ai" and m.content]
    response_text = ai_messages[-1].content if ai_messages else "Nu am putut genera un raspuns."

    # Update history
    history = result["messages"][-20:]  # Keep last 20
    chat_histories[request.session_id] = history

    return ChatResponse(
        response=response_text,
        session_id=request.session_id,
    )


@app.get("/api/health")
async def health():
    return {"status": "ok", "agent_ready": agent is not None}
