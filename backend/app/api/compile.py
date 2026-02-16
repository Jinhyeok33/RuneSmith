import os

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.llm_compiler import LLMCompiler

router = APIRouter(prefix="/api", tags=["compile"])


class CompileRequest(BaseModel):
    user_input: str
    world_tier: int = 1
    extra_vfx_budget: int = 0


class CompileResponse(BaseModel):
    success: bool
    blueprint: dict | None = None
    error: str | None = None


@router.post("/compile", response_model=CompileResponse)
async def compile_skill(req: CompileRequest):
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY not set")

    try:
        compiler = LLMCompiler(api_key)
        llm_output = await compiler.compile(req.user_input)

        return CompileResponse(
            success=True,
            blueprint={
                "llm_output": llm_output,
                "world_tier": req.world_tier,
                "extra_vfx_budget": req.extra_vfx_budget,
            },
        )
    except Exception as e:
        return CompileResponse(success=False, error=str(e))
