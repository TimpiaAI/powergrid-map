import os
from langchain_openai import ChatOpenAI
from langgraph.prebuilt import create_react_agent
from tools import (
    search_station,
    get_grid_stats,
    list_stations_by_capacity,
    get_station_projects,
    analyze_capacity_by_type,
)


SYSTEM_PROMPT = """Esti un asistent AI expert in reteaua electrica din Romania si Europa.
Ai acces la date despre:
- Linii electrice, statii de transformare, stalpi din OpenStreetMap
- Proiecte energie (ATR, contracte) din Transelectrica
- Parcuri solare si turbine eoliene detectate din satelit (Microsoft GRW)
- Centrale electrice din toata Europa (WRI Global Power Plant Database)

Raspunde intotdeauna in limba romana.
Foloseste tool-urile disponibile pentru a cauta date concrete.
Cand nu ai informatia exacta, spune clar.
Fii concis si util pentru ingineri electrici."""


def create_agent():
    llm = ChatOpenAI(
        model="qwen-3-235b-a22b-instruct-2507",
        api_key=os.getenv("CEREBRAS_API_KEY"),
        base_url="https://api.cerebras.ai/v1",
        temperature=0.3,
    )

    tools = [
        search_station,
        get_grid_stats,
        list_stations_by_capacity,
        get_station_projects,
        analyze_capacity_by_type,
    ]

    agent = create_react_agent(llm, tools, prompt=SYSTEM_PROMPT)
    return agent
