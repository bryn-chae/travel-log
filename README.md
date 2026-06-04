# 🗺️ 스페인·포르투갈 여행 지출 대시보드

Google Sheet에 지출 내역을 입력하면 GitHub Pages에서 모바일 친화적 대시보드로 확인할 수 있습니다.

---

## 📁 파일 구조

```
travel-log/
├── index.html    ← 대시보드 화면 (HTML 구조)
├── style.css     ← 스타일 (모바일 우선 반응형)
├── script.js     ← 데이터 처리 + 렌더링 로직
└── README.md     ← 이 파일
```

---

## 📋 Google Sheet 컬럼 구조

시트 첫 줄은 반드시 아래 헤더로 설정하세요 (소문자, 순서 동일).

| 컬럼 | 예시 | 설명 |
|------|------|------|
| `date` | `2026-06-10` | 결제일 또는 지출 시작일 (YYYY-MM-DD) |
| `city` | `Barcelona` | 도시명 |
| `category` | `accommodation` | 지출 분야 (아래 목록 참고) |
| `item` | `Barcelona hostel 3 nights` | 세부 항목명 |
| `amount` | `180000` | 결제 금액 (숫자만) |
| `currency` | `KRW` | 통화 (KRW 또는 EUR) |
| `days` | `3` | 몇 일에 나눠 반영할지 (숙소 3박이면 3, 일반은 1) |
| `note` | `맛있었음` | 메모 (선택) |

**카테고리 예시:**
- `accommodation` 숙소
- `food` 식비
- `transport` 교통
- `attraction` 관광/입장료
- `shopping` 쇼핑
- `etc` 기타

---

## 🔗 Google Sheet 연결 방법 (가장 쉬운 방법)

### ✅ google-sheet.txt에 주소만 붙여넣기 (권장)

`google-sheet.txt` 파일에 Google Sheet 공유 링크를 그대로 넣으면 됩니다. CSV 변환은 자동입니다.

```
https://docs.google.com/spreadsheets/d/1uToczZlxBdxCOf--8M3BEpyUp-6s-1JIjYg5zsvyirU/edit?usp=sharing
```

아래 형식들을 모두 인식합니다:
- `/edit?usp=sharing` 형태 (일반 공유 링크) ✅
- `/edit#gid=123` 형태 (특정 시트 탭) ✅
- `/export?format=csv` 형태 (이미 변환된 주소) ✅
- `/pub?output=csv` 형태 ("웹에 게시" 링크) ✅

> ⚠️ **필수:** 시트가 **"링크가 있는 사용자 모두 보기"** 로 공유되어 있어야 합니다.
> Google Sheet → 오른쪽 상단 **공유** → **"링크가 있는 모든 사용자"** → **뷰어** 선택

---

## ⚙️ 기타 설정 (script.js)

환율·예산 등은 `script.js` 상단에서 수정합니다:

```js
// EUR → KRW 환율 (여행 전 최신 환율로 업데이트)
const EUR_TO_KRW = 1500;

// 일 예산 목표 (KRW)
const DAILY_BUDGET = 100000;

// 여행 시작일 (선택 - 비워두면 첫 지출일 기준)
const TRIP_START_DATE = "2026-06-10";
```

---

## 🏨 숙소비 일할 계산 방식 (`days` 컬럼)

숙소처럼 한 번에 여러 날치를 결제할 경우, `days` 컬럼에 박수를 입력하면 일별 지출에 균등 분배됩니다.

**예시:**
| date | item | amount | currency | days |
|------|------|--------|----------|------|
| 2026-06-10 | Barcelona hostel | 180000 | KRW | 3 |

→ 일별 차트에 반영되는 금액:
- 2026-06-10: 60,000원
- 2026-06-11: 60,000원
- 2026-06-12: 60,000원

식비·교통 등 단건 지출은 `days`를 `1`로 입력하면 됩니다.

---

## 🚀 GitHub Pages 배포 방법

1. GitHub에서 새 저장소(repository) 생성
2. 이 폴더의 파일 4개(`index.html`, `style.css`, `script.js`, `README.md`)를 업로드
3. 저장소 **Settings → Pages** 로 이동
4. **Source** 를 `main` 브랜치 / `/ (root)` 로 설정 후 **Save**
5. 잠시 후 `https://[username].github.io/[repo-name]/` 에서 접속 가능

> 💡 **CORS 주의:** GitHub Pages는 HTTPS이므로, Google Sheet CSV URL도 HTTPS여야 합니다. "웹에 게시" 방식으로 얻은 URL은 자동으로 HTTPS입니다.

---

## 🔄 데이터 갱신

- Google Sheet에 새 행을 추가하면, 페이지를 **새로고침(F5)** 하면 자동으로 최신 데이터가 반영됩니다.
- 환율 변경 시 `script.js`의 `EUR_TO_KRW` 값만 수정하고 다시 커밋·푸시하면 됩니다.
"# travek-log" 
"# travel-log" 
