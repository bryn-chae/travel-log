# 🎒 일단 떠나는 스페인 배낭여행
### Just Go — Spain Backpacker Wallet

Google Sheet에 지출을 기록하면 GitHub Pages 대시보드에서 실시간으로 예산 현황을 확인할 수 있는 모바일 친화적 여행 가계부입니다.

---

## 📁 파일 구조

```
travel-log/
├── index.html               ← 대시보드 HTML
├── style.css                ← 모바일 우선 반응형 스타일
├── script.js                ← 데이터 처리 + 렌더링 + 시나리오 분석
├── google-sheet.txt         ← Google Sheet 공유 링크 (여기만 수정)
├── travel-log-template.xlsx ← 구글시트 업로드용 템플릿
└── README.md
```

---

## 🗂️ Google Sheet 탭 구조

탭 순서와 이름을 아래와 동일하게 맞춰주세요. 탭 이름으로 자동 인식합니다.

| 탭 번호 | 탭 이름 | 역할 |
|--------|---------|------|
| 1 | `지출내역` | 실제 지출 입력 (메인 데이터) |
| 2 | `예산 설정` | 총예산·공제 항목 설정 |
| 3 | `입력 가이드` | 컬럼 설명 참고용 |

---

## 📋 지출내역 탭 — 컬럼 구조

첫 줄은 반드시 아래 헤더 (소문자, 순서 동일).

| 컬럼 | 예시 | 설명 |
|------|------|------|
| `date` | `2026-06-10` | 결제일 또는 지출 시작일 (YYYY-MM-DD) |
| `city` | `Barcelona` | 도시명. 특수값 참고 ↓ |
| `category` | `accommodation` | 지출 분야 |
| `item` | `Barcelona hostel 3박` | 세부 항목명 |
| `amount` | `180000` | 결제 금액 (숫자만) |
| `currency` | `KRW` | 통화 (`KRW` 또는 `EUR`) |
| `days` | `3` | 몇 일에 나눠 반영할지 (숙소 3박 → 3) |
| `note` | `도시세 별도` | 메모 (선택) |

### city 특수값

| 입력값 | 역할 |
|--------|------|
| `Home` | 출발 전 한국 지출. 총지출엔 포함되지만 일평균 계산에서 제외. 예산에서 차감됨. |
| `Budget` | 총예산 선언 행 (예산 설정 탭이 없을 때 fallback으로 사용) |

### category 목록

`accommodation` · `food` · `transport` · `attraction` · `shopping` · `etc`

### days 일할 계산

숙소처럼 여러 날치를 한 번에 결제한 경우 days에 박수를 입력하면 일별로 균등 분배됩니다.

```
2026-06-10 / Barcelona hostel 3박 / 180,000 KRW / days=3
→  06-10: 60,000원
   06-11: 60,000원
   06-12: 60,000원
```

---

## 💰 예산 설정 탭 — 구조

대시보드가 자동으로 읽어옵니다. 첫 컬럼에 key, 두 번째 컬럼에 숫자 값.

| key | 예시 값 | 설명 |
|-----|--------|------|
| `total_budget` | `6500000` | 전체 여행 예산 (KRW) |
| `deduct_flight` | `1200000` | 항공권 공제 |
| `deduct_transport` | `300000` | 도시 간 이동 공제 |
| `deduct_emergency` | `500000` | 비상금 공제 |

**생활비 예산 계산식:**
```
생활비 = total_budget - deduct_flight - deduct_transport - deduct_emergency - Home 지출 합계
```

> 예산 설정 탭 fetch 실패 시 `script.js` 상단의 상수값이 자동으로 사용됩니다.

---

## 🔗 Google Sheet 연결 방법

### ① google-sheet.txt에 공유 링크 붙여넣기 (권장)

```
https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/edit?usp=sharing
```

아래 형식 모두 자동 인식:
- `/edit?usp=sharing` (일반 공유 링크) ✅
- `/edit#gid=123` (특정 탭 링크) ✅
- 탭 이름(`지출내역`, `예산 설정`)으로 직접 접근 — gid 불필요 ✅

> ⚠️ Google Sheet → **공유** → **"링크가 있는 모든 사용자"** → **뷰어** 로 설정 필수

### ② script.js 상수로 직접 입력 (txt 없을 때 fallback)

```js
const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/YOUR_ID/edit?usp=sharing";
```

**우선순위:** 예산 설정 탭 > city=Budget 행 > script.js 상수

---

## ⚙️ script.js 주요 설정값

```js
// 총 여행 예산 (예산 설정 탭 없을 때 사용)
const TOTAL_BUDGET = 6500000;

// EUR → KRW 환율 (여행 전 최신 환율로 업데이트)
const EUR_TO_KRW = 1784;

// 일 예산 목표 — 캘린더 히트맵 색상 기준선
const DAILY_BUDGET = 100000;

// 고정 공제 항목
const DEDUCT_FLIGHT    = 1200000; // 항공권
const DEDUCT_TRANSPORT =  300000; // 도시 간 이동
const DEDUCT_EMERGENCY =  500000; // 비상금

// 시나리오 정의
const SCENARIOS = [
  { id: 1, label: "시나리오 1", daily: 100000, note: "10만원/일" },
  { id: 2, label: "시나리오 2", daily: 125000, note: "12.5만원/일" },
  { id: 3, label: "시나리오 3", daily: 150000, note: "15만원/일" },
];
```

---

## 📊 대시보드 기능 요약

### 전체 요약
- 총 지출 (Home 포함)
- 여행 전체 일평균 · 오늘까지 일평균 (Home 제외)
- 여행 시작 전이면 "여행 시작 전 / 출발일" 표시

### 🎯 예산 시나리오 분석
- 시나리오 3개 탭 전환 (10만/12.5만/15만원 일)
- 총예산 → 공제 후 생활비 → 잔여 생활비 흐름
- 예산 사용 진행 바
- 여행 중: 현재 페이스 유지 시 몇 일 가능한지 자동 분석

### 🔍 날짜별 상세 내역
- 맨 앞에 🏠 Home 칩 (한국 지출 모아보기)
- 날짜 칩 클릭 → 해당일 항목별 내역 + 예산 초과 여부
- **페이지 로드 시 자동 프리셋:**
  - 여행 시작 전 → Home 자동 선택
  - 여행 중 → 오늘 날짜 자동 선택
  - 여행 종료 후 → 마지막 날 자동 선택

### 📅 일별 지출 — 캘린더 히트맵
- 월간 캘린더 뷰, ‹ › 화살표로 월 이동
- 지출 없음 / ~5만 / ~10만 / ~15만 / 15만+ 색상 구분
- 각 날짜 칸에 금액 축약 표시 (2만, 18만 등)
- 날짜 클릭 → 상세 내역 연동

### 🏙️ 도시별 지출
- 숙박일수 · 예산 한도 표시 (accommodation days × 일예산)
- 클릭 → 카테고리별 항목 상세 (accommodation → food → transport 순)
- 예산 대비 초과/절약 표시

### 🗂️ 카테고리별 지출
- 클릭 → 해당 카테고리 전체 항목 (날짜순 정렬)

### 🧾 최근 지출 내역
- 최근 15건 날짜 내림차순

---

## 🚀 GitHub Pages 배포

1. GitHub 저장소 생성 후 파일 업로드
2. **Settings → Pages → Source**: `main` 브랜치 / `/ (root)` → Save
3. `https://[username].github.io/[repo-name]/` 접속

**데이터 갱신:** Google Sheet에 행 추가 후 페이지 새로고침(F5)만 하면 됩니다.

---

## 📱 모바일 사용 팁

- iPhone Safari에서 홈 화면에 추가하면 앱처럼 사용 가능
- 여행 중 지출 직후 Google Sheet 모바일 앱에서 행 추가 → 대시보드 새로고침
