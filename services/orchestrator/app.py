from __future__ import annotations

import hashlib
import os
import time
from typing import Any, Literal, TypedDict

import httpx
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field
from langgraph.graph import END, START, StateGraph

SUPABASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
SERVICE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
INTERNAL_KEY = os.environ["LEGAL_EYE_ORCHESTRATOR_KEY"]
LEGAL_API_URL = os.getenv("LEGAL_API_URL", f"{SUPABASE_URL}/functions/v1/legal-api")
TIMEOUT = float(os.getenv("ORCHESTRATOR_HTTP_TIMEOUT_SECONDS", "60"))

app = FastAPI(title="Legal Eye Orchestrator", version="1.0.0", docs_url=None, redoc_url=None)


class RunRequest(BaseModel):
    run_id: str
    user_jwt: str = Field(min_length=20)
    tasks: list[dict[str, Any]] = Field(default_factory=list, max_length=100)
    require_human_review: bool = True


class ResumeRequest(BaseModel):
    run_id: str
    decision: Literal["approve", "reject"]
    reviewer_id: str
    comment: str | None = Field(default=None, max_length=4000)


class RunState(TypedDict, total=False):
    run_id: str
    user_jwt: str
    organization_id: str
    matter_id: str | None
    objective: str
    tasks: list[dict[str, Any]]
    plan: list[dict[str, Any]]
    results: list[dict[str, Any]]
    require_human_review: bool
    phase: str
    evidence_gaps: list[str]


def service_headers(extra: dict[str, str] | None = None) -> dict[str, str]:
    return {
        "apikey": SERVICE_KEY,
        "authorization": f"Bearer {SERVICE_KEY}",
        **(extra or {}),
    }


def require_internal_key(value: str | None) -> None:
    if not value or not hashlib.sha256(value.encode()).digest() == hashlib.sha256(INTERNAL_KEY.encode()).digest():
        raise HTTPException(status_code=401, detail="Invalid service credential")


async def database(path: str, method: str = "GET", body: Any | None = None, prefer: str | None = None) -> Any:
    headers = service_headers({"content-type": "application/json"})
    if prefer:
        headers["Prefer"] = prefer
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        response = await client.request(method, f"{SUPABASE_URL}/rest/v1/{path}", headers=headers, json=body)
    if response.is_error:
        raise RuntimeError(f"Database request failed with {response.status_code}")
    return response.json() if response.content else None


async def event(state: RunState, event_type: str, summary: str, metadata: dict[str, Any] | None = None) -> None:
    await database(
        "agent_events",
        "POST",
        {
            "agent_run_id": state["run_id"],
            "event_type": event_type,
            "tool_name": "langgraph",
            "summary": summary[:500],
            "metadata": {"phase": state.get("phase"), **(metadata or {})},
        },
        "return=minimal",
    )


async def planning(state: RunState) -> RunState:
    plan = state.get("tasks") or [
        {"id": "research", "action": "research", "query": state["objective"]},
        {"id": "synthesis", "action": "draft", "instructions": state["objective"], "depends_on": ["research"]},
    ]
    state.update(plan=plan, results=[], phase="planning", evidence_gaps=[])
    await event(state, "planning_complete", f"Prepared {len(plan)} auditable steps", {"step_count": len(plan)})
    await database(
        f"agent_runs?id=eq.{state['run_id']}",
        "PATCH",
        {"status": "running", "plan": plan, "started_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())},
    )
    return state


async def executing(state: RunState) -> RunState:
    state["phase"] = "executing"
    results: list[dict[str, Any]] = []
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        for index, task in enumerate(state["plan"]):
            action = str(task.get("action", "research"))
            payload = {
                **task,
                "action": action,
                "organization_id": state["organization_id"],
                "matter_id": state.get("matter_id"),
                "data_classification": task.get("data_classification", "confidential"),
            }
            response = await client.post(
                LEGAL_API_URL,
                headers={"apikey": SERVICE_KEY, "authorization": f"Bearer {state['user_jwt']}", "content-type": "application/json"},
                json=payload,
            )
            result = response.json() if response.content else {}
            record = {"task_id": task.get("id", str(index + 1)), "action": action, "status": response.status_code, "result": result}
            results.append(record)
            await event(state, "step_complete" if response.is_success else "step_failed", f"{action} step {'completed' if response.is_success else 'failed'}", {"task_id": record["task_id"], "http_status": response.status_code})
    state["results"] = results
    return state


async def reviewing(state: RunState) -> RunState:
    state["phase"] = "reviewing"
    gaps = []
    for result in state.get("results", []):
        body = result.get("result") or {}
        if result.get("status", 500) >= 400:
            gaps.append(f"Step {result.get('task_id')} failed")
        if body.get("provider") == "evidence-only" or body.get("evidenceCount") == 0:
            gaps.append(f"Step {result.get('task_id')} has insufficient verified evidence")
    state["evidence_gaps"] = gaps
    await event(state, "verification_complete", "Evidence verification completed", {"gap_count": len(gaps)})
    return state


def review_route(state: RunState) -> str:
    return "awaiting_human" if state.get("require_human_review", True) else "delivering"


async def awaiting_human(state: RunState) -> RunState:
    state["phase"] = "awaiting_human"
    result = {"workflow_state": {key: value for key, value in state.items() if key != "user_jwt"}, "evidence_gaps": state.get("evidence_gaps", [])}
    await database(f"agent_runs?id=eq.{state['run_id']}", "PATCH", {"status": "awaiting_review", "result": result})
    await event(state, "human_review_required", "Lawyer approval is required before delivery")
    return state


async def delivering(state: RunState) -> RunState:
    state["phase"] = "delivering"
    result = {"workflow_state": {key: value for key, value in state.items() if key != "user_jwt"}, "evidence_gaps": state.get("evidence_gaps", [])}
    await database(
        f"agent_runs?id=eq.{state['run_id']}",
        "PATCH",
        {"status": "complete", "result": result, "completed_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())},
    )
    await event(state, "completed", "Verified output delivered")
    return state


builder = StateGraph(RunState)
builder.add_node("planning", planning)
builder.add_node("executing", executing)
builder.add_node("reviewing", reviewing)
builder.add_node("awaiting_human", awaiting_human)
builder.add_node("delivering", delivering)
builder.add_edge(START, "planning")
builder.add_edge("planning", "executing")
builder.add_edge("executing", "reviewing")
builder.add_conditional_edges("reviewing", review_route, {"awaiting_human": "awaiting_human", "delivering": "delivering"})
builder.add_edge("awaiting_human", END)
builder.add_edge("delivering", END)
graph = builder.compile()


@app.get("/healthz")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "legal-eye-orchestrator"}


@app.post("/v1/runs/execute")
async def execute_run(body: RunRequest, x_legal_eye_orchestrator_key: str | None = Header(default=None)) -> dict[str, Any]:
    require_internal_key(x_legal_eye_orchestrator_key)
    rows = await database(f"agent_runs?select=*&id=eq.{body.run_id}")
    if not rows:
        raise HTTPException(status_code=404, detail="Agent run not found")
    run = rows[0]
    state: RunState = {
        "run_id": run["id"], "user_jwt": body.user_jwt, "organization_id": run["organization_id"],
        "matter_id": run.get("matter_id"), "objective": run["objective"], "tasks": body.tasks,
        "require_human_review": body.require_human_review,
    }
    result = await graph.ainvoke(state)
    return {"run_id": body.run_id, "status": result.get("phase"), "evidence_gaps": result.get("evidence_gaps", [])}


@app.post("/v1/runs/resume")
async def resume_run(body: ResumeRequest, x_legal_eye_orchestrator_key: str | None = Header(default=None)) -> dict[str, Any]:
    require_internal_key(x_legal_eye_orchestrator_key)
    rows = await database(f"agent_runs?select=*&id=eq.{body.run_id}")
    if not rows or rows[0].get("status") != "awaiting_review":
        raise HTTPException(status_code=409, detail="Run is not awaiting review")
    run = rows[0]
    await database("agent_events", "POST", {"agent_run_id": body.run_id, "event_type": f"review_{body.decision}", "tool_name": "human_checkpoint", "summary": body.comment or body.decision, "metadata": {"reviewer_id": body.reviewer_id}}, "return=minimal")
    if body.decision == "reject":
        await database(f"agent_runs?id=eq.{body.run_id}", "PATCH", {"status": "blocked", "completed_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())})
        return {"run_id": body.run_id, "status": "blocked"}
    stored = run.get("result", {}).get("workflow_state", {})
    state: RunState = {**stored, "run_id": body.run_id, "organization_id": run["organization_id"], "matter_id": run.get("matter_id"), "phase": "delivering"}
    await delivering(state)
    return {"run_id": body.run_id, "status": "complete"}
