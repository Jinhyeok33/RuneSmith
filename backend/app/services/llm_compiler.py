import json
import hashlib
from typing import Any

from openai import AsyncOpenAI

SKILL_COMPILER_SYSTEM = """You are a game skill compiler for RuneSmith. Convert natural language skill descriptions into a fixed JSON schema.

## Output Schema (respond ONLY with valid JSON, no markdown):
{
  "intent": {
    "name": "string (skill name, max 20 chars)",
    "description": "string (1-2 sentence description)",
    "tags": ["string"] // e.g. ["damage", "fire", "projectile"]
  },
  "mechanics": {
    "delivery": "Projectile|Bolt|Beam|Strike|AoE_Circle|AoE_Cone|AoE_Line|AoE_Ring|AoE_Nova|Zone|Wall|Trap|Minion|Turret|Totem|Buff",
    "effects": [
      {
        "type": "FlatDamage|DoT|PercentDamage|Execute|LifeSteal|Stun|Slow|Root|Silence|Knockback|Pull|Fear|Shield|Heal|HoT|DamageReduce|Haste|Cleanse|Mark|Teleport",
        "value": number,
        "duration": number (ms, optional),
        "percent": number (optional),
        "distance": number (optional),
        "bonus": number (optional)
      }
    ],
    "keywords": [
      {
        "keyword": "Pierce|Chain|Homing|Explosive|Ricochet|Split|Delayed|Channeled|Chargeable|Consume|Crit_Boost|Multi_Hit|Lingering|Conversion",
        "n": number (optional, for Chain/Split/Multi_Hit)
      }
    ]
  },
  "vfx": {
    "geometry": "Spear|Blade|Needle|Arrow|Shard|Sphere|Orb|Bubble|Meteor|Ring|Disc|Sigil|Wave|Beam_Geo|Whip|Chain_Geo|Arc|Swarm|Vortex|Fractal",
    "motion": "Straight|Accelerate|Decelerate|Spiral|Wave_Sine|Boomerang|Orbit|Homing_Direct|Homing_Lazy|Homing_Swarm|Expand_Sphere|Expand_Ring|Scatter|Teleport_Blink|Pendulum|Float_Rise",
    "material": "Fire|Ice|Lightning|Void|Nature|Arcane|Water|Earth|Wind|Holy|Shadow|Blood|Metal|Crystal",
    "rhythm": "Burst|Sustained|Pulsing|Ramp_Up|Ramp_Down|Staccato|Delayed|Cascade|Heartbeat|Chaotic",
    "palette": {
      "primary": "#hex",
      "secondary": "#hex"
    },
    "intensity": 0.0-1.0
  },
  "seed": number (hash of input for reproducibility)
}

## Rules:
1. Choose delivery type that best matches the described skill
2. Assign appropriate effects with reasonable values (damage 50-200, duration 1000-5000ms)
3. Add keywords ONLY if explicitly or strongly implied in the description
4. Choose geometry, motion, material that visually match the skill concept
5. Pick colors that match the material element
6. Set intensity based on described power level (0.3 = subtle, 0.7 = normal, 1.0 = epic)

## Element Color Guide:
- Fire: #f97316, #fbbf24
- Ice: #38bdf8, #e0f2fe
- Lightning: #facc15, #ffffff
- Void: #6b21a8, #1e1b4b
- Nature: #22c55e, #86efac
- Arcane: #a855f7, #e9d5ff
- Water: #0ea5e9, #bae6fd
- Earth: #92400e, #d97706
- Wind: #e2e8f0, #94a3b8
- Holy: #fef08a, #ffffff
- Shadow: #171717, #404040
- Blood: #dc2626, #450a0a
- Metal: #d4d4d8, #71717a
- Crystal: #e879f9, #67e8f9"""


class LLMCompiler:
    def __init__(self, api_key: str):
        self.client = AsyncOpenAI(api_key=api_key)

    async def compile(self, user_input: str) -> dict[str, Any]:
        seed = int(hashlib.md5(user_input.encode()).hexdigest()[:8], 16)

        response = await self.client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": SKILL_COMPILER_SYSTEM},
                {"role": "user", "content": user_input},
            ],
            response_format={"type": "json_object"},
            temperature=0.3,
            max_tokens=1000,
        )

        content = response.choices[0].message.content
        if content is None:
            raise ValueError("LLM returned empty response")

        result = json.loads(content)
        result["seed"] = seed
        return result
