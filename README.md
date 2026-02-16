# ⚒️ RuneSmith

**자연어로 마법을 만들고, 전투하고, 거래하는 Three.js 기반 스킬 크래프팅 게임**

OpenAI 해커톤 프로젝트 - LLM 컴파일러를 활용한 혁신적인 스킬 생성 시스템

---

## 🎮 게임 소개

RuneSmith는 플레이어가 **자연어로 스킬을 설명**하면 AI가 이를 **밸런스 잡힌 게임 스킬**로 변환하는 독특한 마법 전투 게임입니다.

### 핵심 3대 공간
- **🔨 Forge (대장간)**: 자연어 입력 → LLM 컴파일 → Three.js 프리뷰 → 저장
- **⚔️ Stage (전투장)**: 3웨이브 몬스터 전투, 원소 상성, VFX 열화 시스템
- **🏪 Market (마켓)**: 다른 플레이어의 스킬 구매, 원소별 필터링, 월드 잠금

---

## ✨ 주요 특징

### 🤖 LLM 기반 스킬 컴파일러
- **2단계 파이프라인**: GPT-4o Parser → Balance Engine
- 자연어 예시: *"적을 관통하는 불타는 창을 던진다"*
- 자동 생성: Mechanics (16 Delivery, 20 Effects, 14 Keywords) + VFX (20 Geometry, 16 Motion, 14 Materials)

### 🎨 Three.js VFX 렌더링
- 실시간 3D 스킬 프리뷰 (Projectile, Beam, Lightning, AoE)
- Bloom 포스트프로세싱
- 14가지 원소 색상 시스템

### ⚖️ 정교한 밸런스 시스템
- **Combat Budget**: 월드별 스케일링 (100 × 1.5^(W-1))
- **VFX Budget**: 비주얼 복잡도 과금 모델
- **원소 상성**: 7×7 매트릭스, 월드 진행에 따라 배율 증가
- **VFX 열화**: 구형 스킬의 데미지 감소 (최대 60% 페널티)

### 🌍 월드 시스템
- 5개 월드: 초원 → 동굴 → 화산 → 심연 → 천공
- 각 월드마다 Combat Budget 상한 증가
- VFX Budget 기본값 증가 (100 → 200)

---

## 🛠️ 기술 스택

### Frontend
- **Framework**: Next.js 15 (App Router) + TypeScript
- **3D Rendering**: Three.js r164+ + @react-three/fiber + @react-three/drei
- **State Management**: Zustand (게임 상태) + TanStack Query (서버 상태)
- **Styling**: Tailwind CSS v4

### Backend
- **API**: FastAPI 0.110+ (Python 3.11+)
- **AI**: OpenAI GPT-4o (temperature 0.3, JSON mode)
- **Database**: PostgreSQL 16+ (예정)
- **Cache**: Redis 7+ (예정)

### Monorepo
- **Build Tool**: Turborepo 2.5+
- **Package Manager**: npm workspaces
- **Shared Types**: TypeScript 공유 패키지

---

## 🚀 시작하기

### 1. 저장소 클론
```bash
git clone https://github.com/Jinhyeok33/RuneSmith.git
cd RuneSmith
```

### 2. 의존성 설치
```bash
npm install
```

### 3. 환경 변수 설정
```bash
# .env.example을 복사하여 .env 생성
cp .env.example .env

# .env 파일 편집
OPENAI_API_KEY=your_openai_api_key_here
```

### 4. 백엔드 Python 패키지 설치
```bash
cd backend
pip install -r requirements.txt
```

### 5. 개발 서버 실행

**프론트엔드** (터미널 1)
```bash
npm run dev:web
```
→ http://localhost:3000

**백엔드** (터미널 2)
```bash
npm run dev:backend
```
→ http://localhost:8000

---

## 📁 프로젝트 구조

```
RuneSmith/
├── apps/
│   └── web/                    # Next.js 프론트엔드
│       ├── src/
│       │   ├── app/            # App Router 페이지
│       │   │   ├── forge/      # 스킬 제작 페이지
│       │   │   ├── stage/      # 전투 페이지
│       │   │   └── market/     # 마켓 페이지
│       │   ├── components/
│       │   │   └── three/      # Three.js VFX 컴포넌트
│       │   └── lib/
│       │       ├── api/        # API 클라이언트
│       │       ├── combat/     # 전투 엔진
│       │       └── store/      # Zustand 스토어
├── backend/                    # FastAPI 백엔드
│   ├── app/
│   │   ├── api/                # API 라우터
│   │   ├── services/           # LLM 컴파일러
│   │   └── main.py
│   └── requirements.txt
├── packages/
│   └── shared/                 # 공유 타입 & 유틸리티
│       ├── src/
│       │   ├── types/          # 스킬, 전투, 월드, 마켓 타입
│       │   └── utils/          # Balance Engine
└── turbo.json
```

---

## 🎯 게임플레이

### Forge - 스킬 제작
1. 자연어로 스킬 설명 입력 (예: "3체의 적에게 연쇄하는 전기 화살")
2. **LLM 컴파일** 버튼 클릭
3. Three.js로 실시간 프리뷰 확인
4. 스탯 & Budget 확인 후 저장

### Stage - 전투
1. 인벤토리에서 최대 4개 스킬 선택 (덱 구성)
2. 3개 웨이브 클리어 (Mob → Elite → Boss)
3. 원소 상성 활용 (효과적! / 비효과적...)
4. 승리 시 포인트 획득

### Market - 마켓플레이스
1. 8개 프리셋 스킬 브라우징
2. 원소/가격/평점별 필터링
3. 월드 잠금: 상위 월드 스킬은 RC로 조기 해금
4. 포인트로 스킬 구매 → 인벤토리 추가

---

## 📊 게임 데이터

### Delivery Types (16종)
Projectile, Bolt, Beam, Strike, AoE_Circle, AoE_Cone, AoE_Line, AoE_Ring, AoE_Nova, Zone, Wall, Trap, Minion, Turret, Totem, Buff

### Effect Types (20종)
FlatDamage, DoT, PercentDamage, Execute, LifeSteal, Stun, Slow, Root, Silence, Knockback, Pull, Fear, Shield, Heal, HoT, DamageReduce, Haste, Cleanse, Mark, Teleport

### Keywords (14종)
Pierce, Chain, Homing, Explosive, Ricochet, Split, Delayed, Channeled, Chargeable, Consume, Crit_Boost, Multi_Hit, Lingering, Conversion

### Materials (14종)
Fire, Ice, Lightning, Water, Nature, Earth, Wind, Void, Arcane, Holy, Shadow, Blood, Metal, Crystal

---

## 🔮 향후 계획

- [ ] PostgreSQL 연동 (유저 데이터, 스킬 영구 저장)
- [ ] JWT 인증 시스템
- [ ] 실제 마켓플레이스 (유저간 거래)
- [ ] 스킬 평가 & 랭킹 시스템
- [ ] 나머지 12개 VFX Building Blocks 구현
- [ ] 텔레그래프 & 회피 메커닉
- [ ] 길드 시스템
- [ ] 리더보드 & 업적

---

## 📄 라이선스

MIT License

---

## 👤 제작자

**Jinhyeok Jeon** ([@Jinhyeok33](https://github.com/Jinhyeok33))

OpenAI 해커톤 출품작

---

**⚒️ Made with AI-powered skill crafting**
