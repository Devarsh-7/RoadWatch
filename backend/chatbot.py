"""
chatbot.py — RAG-powered chatbot using LangChain + Google Gemini + FAISS.

Loads all road data into a FAISS vector store on startup.
Uses Gemini 1.5 Flash (free tier) to answer citizen questions
about roads, budgets, and authorities with cited sources.
"""

import os
from typing import List, Tuple

from dotenv import load_dotenv

load_dotenv()

# Lazy-loaded singletons — initialized on first chat request
_vector_store = None
_qa_chain = None
_initialized = False


def _build_road_documents(db) -> list:
    """
    Convert every road record into a text document for RAG ingestion.
    Each document includes all relevant fields so the LLM can answer
    questions about contractors, budgets, dates, and authorities.
    """
    from models import Road

    roads = db.query(Road).all()
    documents = []

    for r in roads:
        text = (
            f"Road: {r.road_name}\n"
            f"Type: {r.road_type}\n"
            f"State: {r.state}, District: {r.district}\n"
            f"Length: {r.length_km} km\n"
            f"Contractor: {r.contractor_name} (Contact: {r.contractor_contact})\n"
            f"Last Repair Date: {r.last_repair_date}\n"
            f"Current Condition: {r.condition}\n"
            f"Budget Sanctioned: ₹{r.budget_sanctioned} Crore\n"
            f"Budget Spent: ₹{r.budget_spent} Crore\n"
            f"Budget Utilization: {round((r.budget_spent / r.budget_sanctioned) * 100, 1) if r.budget_sanctioned else 'N/A'}%\n"
            f"Executive Engineer: {r.exec_engineer}\n"
            f"Engineer Contact: {r.engineer_contact}\n"
            f"Engineer Email: {r.engineer_email}\n"
            f"Data Source: {r.data_source}\n"
            f"Coordinates: ({r.latitude_start}, {r.longitude_start}) to ({r.latitude_end}, {r.longitude_end})\n"
        )
        documents.append({"text": text, "metadata": {"road_name": r.road_name, "source": r.data_source or "RoadWatch DB"}})

    return documents


def initialize_chatbot(db):
    """
    Build the FAISS vector store and LangChain QA chain.
    Called once on first /api/chat request.
    """
    global _vector_store, _qa_chain, _initialized

    if _initialized:
        return

    api_key = os.getenv("GOOGLE_API_KEY", "")

    if not api_key:
        print("[WARN] GOOGLE_API_KEY not set - chatbot will use fallback mode.")
        _initialized = True
        return

    try:
        from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings
        from langchain_community.vectorstores import FAISS
        try:
            from langchain.chains import RetrievalQA
        except ImportError:
            from langchain_classic.chains import RetrievalQA
        try:
            from langchain_core.documents import Document
            from langchain_core.prompts import PromptTemplate
        except ImportError:
            from langchain.schema import Document
            from langchain.prompts import PromptTemplate

        # Build documents from road data
        raw_docs = _build_road_documents(db)
        docs = [
            Document(page_content=d["text"], metadata=d["metadata"])
            for d in raw_docs
        ]

        # Create embeddings using Gemini
        embeddings = GoogleGenerativeAIEmbeddings(
            model="models/gemini-embedding-001",
            google_api_key=api_key,
        )

        # Build FAISS index
        _vector_store = FAISS.from_documents(docs, embeddings)

        # Custom prompt for road-focused Q&A
        prompt_template = PromptTemplate(
            input_variables=["context", "question"],
            template="""You are RoadWatch AI — an expert assistant on Indian road infrastructure,
maintenance budgets, and government accountability.

Use the following road data to answer the citizen's question accurately.
Always cite specific data points (road name, budget amounts, dates, engineer names).
If the question is a greeting or general inquiry about RoadWatch, answer politely and explain how you can help.
If the data doesn't contain the answer, say so honestly.

Road Data:
{context}

Citizen's Question: {question}

Answer:""",
        )

        # Build QA chain with Gemini Flash
        llm = ChatGoogleGenerativeAI(
            model="gemini-3.6-flash",
            google_api_key=api_key,
        )

        _qa_chain = RetrievalQA.from_chain_type(
            llm=llm,
            chain_type="stuff",
            retriever=_vector_store.as_retriever(search_kwargs={"k": 4}),
            return_source_documents=True,
            chain_type_kwargs={"prompt": prompt_template},
        )

        _initialized = True
        print("[OK] Chatbot initialized with FAISS + Gemini.")

    except Exception as e:
        print(f"[WARN] Chatbot initialization failed: {e}")
        _initialized = True  # Don't retry on every request


async def chat(message: str, db) -> Tuple[str, List[str]]:
    """
    Process a user message and return (reply, sources).
    Falls back to a keyword-based lookup if Gemini is unavailable.
    """
    if not _initialized:
        initialize_chatbot(db)

    # ── Gemini + RAG path ──
    if _qa_chain is not None:
        try:
            result = _qa_chain.invoke({"query": message})
            reply = str(result.get("result", "I couldn't find an answer."))
            sources = list({
                doc.metadata.get("source", "RoadWatch DB")
                for doc in result.get("source_documents", [])
            })
            return reply, sources
        except Exception as e:
            return f"Sorry, I encountered an error: {str(e)}", []

    # ── Fallback: keyword-based lookup ──
    return _fallback_search(message, db)


def _fallback_search(message: str, db) -> Tuple[str, List[str]]:
    """
    Simple keyword search when Gemini API is not available.
    Searches road names and returns basic info.
    """
    from models import Road

    msg_lower = message.lower().strip()
    roads = db.query(Road).all()

    # Friendly greeting / guidance
    if any(greet in msg_lower for greet in ["hello", "hi", "hey", "who are you", "what can you do"]):
        return (
            "Hello! I am RoadWatch AI. I can help you find information about road projects, budgets, "
            "contractors, and road conditions across India. Try asking about a specific road like NH-44, NH-8, "
            "or ask about roads in a specific state or district!",
            ["RoadWatch DB"],
        )

    if any(q in msg_lower for q in ["how to report", "file complaint", "report pothole", "report road"]):
        return (
            "To report an issue or complaint about a road, navigate to the **Report Road** section in the navigation bar. "
            "You can upload photos, specify the road and location, and track authority responses directly.",
            ["RoadWatch Portal"],
        )

    matches = []
    for road in roads:
        if (road.road_name.lower() in msg_lower or
                (road.state and road.state.lower() in msg_lower) or
                (road.district and road.district.lower() in msg_lower) or
                any(word in road.road_name.lower() for word in msg_lower.split() if len(word) > 2)):
            matches.append(road)

    if not matches:
        return (
            "I couldn't find specific road data matching your question. "
            "Try asking about a specific road like NH-44, NH-8, or SH-49, or searching by state or district. "
            "You can also search roads on the Search page.",
            [],
        )

    lines = []
    sources = set()
    for r in matches[:3]:
        utilization = round((r.budget_spent / r.budget_sanctioned) * 100, 1) if r.budget_sanctioned else "N/A"
        lines.append(
            f"**{r.road_name}** ({r.road_type})\n"
            f"- State: {r.state}, District: {r.district}\n"
            f"- Condition: {r.condition}\n"
            f"- Last Repair: {r.last_repair_date}\n"
            f"- Budget: ₹{r.budget_sanctioned} Cr sanctioned, ₹{r.budget_spent} Cr spent ({utilization}%)\n"
            f"- Contractor: {r.contractor_name}\n"
            f"- Executive Engineer: {r.exec_engineer} ({r.engineer_contact})\n"
        )
        if r.data_source:
            sources.add(r.data_source)

    reply = "Here's what I found:\n\n" + "\n".join(lines)
    return reply, list(sources)
