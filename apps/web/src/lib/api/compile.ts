const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface CompileRequest {
  user_input: string;
  world_tier: number;
  extra_vfx_budget: number;
}

export interface CompileResponse {
  success: boolean;
  blueprint: {
    llm_output: Record<string, unknown>;
    world_tier: number;
    extra_vfx_budget: number;
  } | null;
  error: string | null;
}

export async function compileSkill(req: CompileRequest): Promise<CompileResponse> {
  const res = await fetch(`${API_URL}/api/compile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }

  return res.json();
}
