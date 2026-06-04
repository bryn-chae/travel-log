// ============================================================
// 설정값 - 이 부분만 수정하면 됩니다
// ============================================================

// Google Sheet 주소를 아래에 붙여넣으세요 (edit 공유 링크 그대로 붙여넣어도 됩니다).
// google-sheet.txt 파일에 넣어도 같은 효과입니다 (txt가 우선 적용됨).
const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/1uToczZlxBdxCOf--8M3BEpyUp-6s-1JIjYg5zsvyirU/edit?usp=sharing";

// 환율 설정 (EUR -> KRW 환산)
// 여행 전에 현재 환율로 업데이트하세요
const EUR_TO_KRW = 1784;

// 여행 목표 일예산 (KRW) — 시나리오 기본값 / 일별 차트 초과 기준선
const DAILY_BUDGET = 100000;

// 여행 시작일 (데이터가 없을 경우 첫 지출일 기준)
// 형식: "YYYY-MM-DD"
const TRIP_START_DATE = "";

// ============================================================
// 예산 시나리오 설정
// ============================================================

// 총 여행 예산 (구글시트 "예산 설정" 탭의 total_budget과 같은 값)
// city=Budget 행이 시트에 있으면 그 값이 우선 적용됩니다
const TOTAL_BUDGET = 6500000;

// 고정 공제 항목 (총예산에서 먼저 빼는 항목들)
// Google Sheet "예산 설정" 탭과 동일한 값으로 맞춰주세요
const DEDUCT_FLIGHT    = 1200000; // 항공권 (왕복 포함)
const DEDUCT_TRANSPORT =  300000; // 도시 간 이동 (버스·기차 등)
const DEDUCT_EMERGENCY =  500000; // 비상금
const TOTAL_DEDUCTIONS = DEDUCT_FLIGHT + DEDUCT_TRANSPORT + DEDUCT_EMERGENCY;
// ※ Home 지출(한국에서 쓴 비용)도 livingBudget에서 자동 공제됩니다

// 시나리오 목록 (일예산 · 가능 일수)
// livingBudget(총예산-공제) 기준으로 자동 계산하므로 days는 참고값
const SCENARIOS = [
  { id: 1, label: "시나리오 1", daily: 100000, note: "10만원/일" },
  { id: 2, label: "시나리오 2", daily: 125000, note: "12.5만원/일" },
  { id: 3, label: "시나리오 3", daily: 150000, note: "15만원/일" },
];

// ============================================================
// 샘플 데이터 - URL이 없거나 fetch 실패 시 보여줍니다
// ============================================================
const SAMPLE_DATA = [
  { date: "2026-06-10", city: "Barcelona", category: "accommodation", item: "Barcelona hostel 3 nights", amount: 180000, currency: "KRW", days: 3, note: "" },
  { date: "2026-06-10", city: "Barcelona", category: "food",          item: "Tapas dinner",              amount: 35,     currency: "EUR", days: 1, note: "맛있었음" },
  { date: "2026-06-11", city: "Barcelona", category: "transport",     item: "Metro day pass",            amount: 11.35,  currency: "EUR", days: 1, note: "" },
  { date: "2026-06-11", city: "Barcelona", category: "attraction",    item: "Sagrada Familia",           amount: 36,     currency: "EUR", days: 1, note: "" },
  { date: "2026-06-12", city: "Barcelona", category: "food",          item: "Lunch + coffee",            amount: 22,     currency: "EUR", days: 1, note: "" },
  { date: "2026-06-13", city: "Madrid",    category: "accommodation", item: "Madrid hostel 2 nights",   amount: 90000,  currency: "KRW", days: 2, note: "" },
  { date: "2026-06-13", city: "Madrid",    category: "food",          item: "Churros con chocolate",    amount: 6,      currency: "EUR", days: 1, note: "" },
  { date: "2026-06-14", city: "Madrid",    category: "attraction",    item: "Prado Museum",             amount: 15,     currency: "EUR", days: 1, note: "" },
  { date: "2026-06-15", city: "Lisbon",    category: "transport",     item: "Bus Madrid-Lisbon",        amount: 35,     currency: "EUR", days: 1, note: "" },
  { date: "2026-06-15", city: "Lisbon",    category: "accommodation", item: "Lisbon hostel 3 nights",   amount: 135000, currency: "KRW", days: 3, note: "" },
  { date: "2026-06-16", city: "Lisbon",    category: "food",          item: "Pastel de nata + lunch",   amount: 18,     currency: "EUR", days: 1, note: "" },
  { date: "2026-06-17", city: "Lisbon",    category: "shopping",      item: "기념품",                   amount: 30000,  currency: "KRW", days: 1, note: "" },
];

// ============================================================
// 유틸리티 함수
// ============================================================

// 금액을 KRW로 환산
function toKRW(amount, currency) {
  const num = parseFloat(amount);
  if (isNaN(num)) return 0;
  if (currency === "EUR") return Math.round(num * EUR_TO_KRW);
  return Math.round(num); // KRW는 그대로
}

// 숫자를 한국 원화 형식으로 표시 (예: 150,000원)
function formatKRW(amount) {
  return Math.round(amount).toLocaleString("ko-KR") + "원";
}

// YYYY-MM-DD 문자열을 Date 객체로 변환
function parseDate(str) {
  if (!str) return null;
  const parts = str.trim().split("-");
  if (parts.length !== 3) return null;
  const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  return isNaN(d.getTime()) ? null : d;
}

// Date 객체를 YYYY-MM-DD 문자열로 변환
function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// 날짜 + n일
function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

// 두 날짜 사이의 일수 (inclusive 시작, exclusive 종료)
function daysBetween(a, b) {
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

// ============================================================
// 데이터 처리 함수
// ============================================================

// CSV 한 행을 필드 배열로 분리 (RFC 4180 따옴표 처리)
// gviz API는 모든 값을 "..." 로 감싸서 반환하므로 따옴표 제거 필수
function splitCSVRow(line) {
  const fields = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') { cur += '"'; i++; } // escaped quote
      else inQuote = !inQuote;
    } else if (ch === "," && !inQuote) {
      fields.push(cur.trim()); cur = "";
    } else {
      cur += ch;
    }
  }
  fields.push(cur.trim());
  return fields;
}

// CSV 텍스트를 파싱해서 행 배열로 변환
function parseCSV(text) {
  // \r 제거 후 줄 분리
  const lines = text.replace(/\r/g, "").trim().split("\n");
  if (lines.length < 2) return [];

  // 헤더 행 탐지: "date" 필드가 포함된 첫 번째 줄을 헤더로 인식
  // gviz 출력 시 안내문+date가 같은 셀에 합쳐질 수 있으므로 endsWith/includes로 처리
  const headerLineIdx = lines.findIndex(l => {
    const fields = splitCSVRow(l).map(f => f.toLowerCase());
    return fields.some(f => f === "date" || f.endsWith("date"));
  });
  if (headerLineIdx === -1) return [];

  // 헤더 정규화: "...date" 같은 합쳐진 셀에서 "date"만 추출
  const headers = splitCSVRow(lines[headerLineIdx]).map(h => {
    const clean = h.toLowerCase().trim();
    // 안내문 텍스트가 붙어있으면 마지막 단어(실제 컬럼명)만 추출
    const known = ["date","city","category","item","amount","currency","days","note"];
    const found = known.find(k => clean === k || clean.endsWith(k));
    return found || clean;
  });

  const rows = [];
  for (let i = headerLineIdx + 1; i < lines.length; i++) {
    const values = splitCSVRow(lines[i]);
    if (values.every(v => v === "")) continue; // 빈 줄 무시

    const row = {};
    headers.forEach((h, idx) => { row[h] = values[idx] || ""; });
    rows.push(row);
  }
  return rows;
}

// 원시 행 데이터를 정규화
function normalizeRow(row) {
  return {
    date:     row.date     || "",
    city:     row.city     || "",
    category: row.category || "etc",
    item:     row.item     || "",
    amount:   parseFloat(row.amount) || 0,
    currency: (row.currency || "KRW").toUpperCase(),
    days:     parseInt(row.days) || 1,
    note:     row.note     || "",
  };
}

// days 분산 처리: 하나의 항목을 여러 날짜로 펼침
// 예) days=3이면 3일에 걸쳐 동일 금액/days씩 배분
function expandByDays(entries) {
  const expanded = [];
  for (const entry of entries) {
    const startDate = parseDate(entry.date);
    if (!startDate) continue; // 날짜 파싱 실패 시 건너뜀

    const krwTotal = toKRW(entry.amount, entry.currency);
    const perDay = Math.round(krwTotal / entry.days);

    for (let i = 0; i < entry.days; i++) {
      const d = addDays(startDate, i);
      expanded.push({
        ...entry,
        date:    formatDate(d),
        amountKRW: perDay,
      });
    }
  }
  return expanded;
}

// ============================================================
// 집계 함수
// ============================================================

// 일별 지출 집계 { "2026-06-10": 60000, ... }
function aggregateByDate(expanded) {
  const map = {};
  for (const e of expanded) {
    map[e.date] = (map[e.date] || 0) + e.amountKRW;
  }
  return map;
}

// 도시별 지출 집계
function aggregateByCity(expanded) {
  const map = {};
  for (const e of expanded) {
    map[e.city] = (map[e.city] || 0) + e.amountKRW;
  }
  return map;
}

// 도시별 숙박 일수 집계 (accommodation 항목의 days 합산)
// 예: { Barcelona: 3, Madrid: 2, Lisbon: 3 }
function aggregateCityDays(entries) {
  const map = {};
  for (const e of entries) {
    if (e.category === "accommodation" && e.city) {
      map[e.city] = (map[e.city] || 0) + (parseInt(e.days) || 1);
    }
  }
  return map;
}

// 카테고리별 지출 집계
function aggregateByCategory(expanded) {
  const map = {};
  for (const e of expanded) {
    map[e.category] = (map[e.category] || 0) + e.amountKRW;
  }
  return map;
}

// ============================================================
// 렌더링 함수
// ============================================================

// 요약 카드 렌더링
// 특수 도시명 판별 (집계·차트에서 제외)
const isMetaCity = e => ["home", "budget"].includes(e.city.trim().toLowerCase());
const isHome     = e => e.city.trim().toLowerCase() === "home";
const isBudget   = e => e.city.trim().toLowerCase() === "budget";

// 요약 카드 렌더링 (시나리오 분석 포함)
// settingsMap: "예산 설정" 탭에서 읽은 key-value (없으면 script.js 상수 사용)
function renderSummary(expanded, entries, settingsMap) {
  if (expanded.length === 0) {
    document.getElementById("summary").innerHTML = "<p class='empty-msg'>데이터가 없습니다.</p>";
    return;
  }

  // ── 총예산: "예산 설정" 탭 → city=Budget 행 → 상수 순서로 우선 적용 ──
  const sm = settingsMap || {};
  const budgetEntry  = entries.find(isBudget);
  const totalBudget  = sm["total_budget"]
    || (budgetEntry ? toKRW(budgetEntry.amount, budgetEntry.currency) : 0)
    || TOTAL_BUDGET;

  // 공제 항목도 "예산 설정" 탭 값 우선
  const deductFlight    = sm["deduct_flight"]    || DEDUCT_FLIGHT;
  const deductTransport = sm["deduct_transport"] || DEDUCT_TRANSPORT;
  const deductEmergency = sm["deduct_emergency"] || DEDUCT_EMERGENCY;
  const totalDeductions = deductFlight + deductTransport + deductEmergency;

  // ── 지출 집계 (Home·Budget 제외) ──
  const travelEntries  = entries.filter(e => !isMetaCity(e));
  const travelExpanded = expanded.filter(e => !isMetaCity(e));

  const totalKRW  = entries.filter(e => !isBudget(e)).reduce((sum, e) => sum + toKRW(e.amount, e.currency), 0);
  const travelKRW = travelEntries.reduce((sum, e) => sum + toKRW(e.amount, e.currency), 0);
  const homeKRW   = entries.filter(isHome).reduce((sum, e) => sum + toKRW(e.amount, e.currency), 0);
  const hasHome   = homeKRW > 0;

  // ── 생활비 예산: 총예산 - 고정공제 - Home 지출 ──
  const livingBudget = Math.max(0, totalBudget - totalDeductions - homeKRW);

  // ── 여행 기간 (Home·Budget 제외 날짜 기준) ──
  const dates        = travelExpanded.map(e => e.date).sort();
  const firstDateStr = TRIP_START_DATE || dates[0];
  const lastDateStr  = dates[dates.length - 1];
  const firstDate    = parseDate(firstDateStr);
  const lastDate     = parseDate(lastDateStr);
  const today        = new Date();
  today.setHours(0, 0, 0, 0);

  const totalTripDays = daysBetween(firstDate, addDays(lastDate, 1));
  const tripStarted   = today >= firstDate;
  const daysElapsed   = tripStarted
    ? Math.min(daysBetween(firstDate, today) + 1, totalTripDays)
    : 0;

  const avgAll     = totalTripDays > 0 ? travelKRW / totalTripDays : 0;
  const avgToday   = daysElapsed   > 0 ? travelKRW / daysElapsed   : 0;
  // (diffPerDay, isOver는 제거된 목표 대비 셀용이었으나 변수 유지)

  // ── 셀 렌더링 ──
  const avgTodayCell = tripStarted
    ? `<div class="summary-item">
        <span class="label">오늘까지 일평균</span>
        <span class="value">${formatKRW(avgToday)}</span>
        <span class="sub">${daysElapsed}일 경과</span>
       </div>`
    : `<div class="summary-item">
        <span class="label">오늘까지 일평균</span>
        <span class="value soft">여행 시작 전</span>
        <span class="sub">${firstDateStr} 출발</span>
       </div>`;

  // 목표 대비 항목 제거 — 시나리오 분석 카드에서 상세히 확인 가능
  const budgetCell = "";

  const excludeNote = hasHome
    ? `<p class="summary-exclude-note">* 일평균·예산 비교: Home 항목(${formatKRW(homeKRW)}) 제외</p>`
    : "";

  document.getElementById("summary").innerHTML = `
    <div class="summary-grid">
      <div class="summary-item full-width">
        <span class="label">총 지출</span>
        <span class="value big">${formatKRW(totalKRW)}</span>
      </div>
      <div class="summary-item">
        <span class="label">여행 전체 일평균</span>
        <span class="value">${formatKRW(avgAll)}</span>
        <span class="sub">${totalTripDays}일 기준</span>
      </div>
      ${avgTodayCell}
      ${budgetCell}
    </div>
    ${excludeNote}
  `;

  // ── 시나리오 섹션 렌더링 ──
  renderScenarioSection({
    totalBudget, livingBudget, travelKRW, homeKRW, daysElapsed, tripStarted, firstDateStr,
    deductFlight, deductTransport, deductEmergency, totalDeductions
  });
}

// ============================================================
// 시나리오 분석
// ============================================================

// 전역 상태: 선택된 시나리오 id
let _selectedScenarioId = SCENARIOS[0].id;

function renderScenarioSection(ctx) {
  const el = document.getElementById("scenario-section");
  if (!el) return;

  const {
    totalBudget, livingBudget, travelKRW, homeKRW, daysElapsed, tripStarted, firstDateStr,
    deductFlight = DEDUCT_FLIGHT,
    deductTransport = DEDUCT_TRANSPORT,
    deductEmergency = DEDUCT_EMERGENCY,
    totalDeductions = TOTAL_DEDUCTIONS,
  } = ctx;

  // totalBudget이 0이면 상수도 0인 경우 → 안내
  if (totalBudget === 0) {
    el.innerHTML = `<p class="empty-msg" style="padding:12px 0">
      💡 <code>script.js</code>의 <strong>TOTAL_BUDGET</strong>에 총예산을 입력하면 시나리오 분석이 활성화됩니다.
    </p>`;
    return;
  }

  // 탭 버튼
  const tabs = SCENARIOS.map(s => {
    const possibleDays = livingBudget > 0 ? Math.floor(livingBudget / s.daily) : 0;
    const active = s.id === _selectedScenarioId ? "active" : "";
    return `<button class="scenario-tab ${active}" data-sid="${s.id}">
      <span class="stab-label">${s.note}</span>
      <span class="stab-days">${possibleDays}일</span>
    </button>`;
  }).join("");

  // 선택된 시나리오 분석
  const sc = SCENARIOS.find(s => s.id === _selectedScenarioId) || SCENARIOS[0];
  const possibleDays    = livingBudget > 0 ? Math.floor(livingBudget / sc.daily) : 0;
  const remainingBudget = livingBudget - travelKRW;
  const remainingDays   = remainingBudget > 0 ? Math.floor(remainingBudget / sc.daily) : 0;
  const usedPct         = livingBudget > 0 ? Math.min(100, Math.round(travelKRW / livingBudget * 100)) : 0;

  // 현재 페이스 기반 예측 (여행 중일 때만)
  let projectionHtml = "";
  if (tripStarted && daysElapsed > 0) {
    const pace         = travelKRW / daysElapsed;          // 일평균 실제 지출
    const projDays     = livingBudget > 0 ? Math.floor(livingBudget / pace) : 0;
    const diffDays     = projDays - possibleDays;
    const paceIsOk     = pace <= sc.daily;
    const diffStr      = Math.abs(diffDays) + "일";
    const diffLabel    = diffDays >= 0
      ? `<span class="text-success">+${diffStr} 더 가능</span>`
      : `<span class="text-danger">${diffStr} 부족</span>`;
    const advice = paceIsOk
      ? `✅ 현재 페이스(${formatKRW(pace)}/일)로는 계획보다 ${diffLabel}`
      : `⚠️ 현재 페이스(${formatKRW(pace)}/일)로는 계획보다 ${diffLabel} — 지출 조정 필요`;

    projectionHtml = `<div class="scenario-advice">${advice}</div>`;
  } else if (!tripStarted) {
    projectionHtml = `<div class="scenario-advice soft-advice">📅 ${firstDateStr} 여행 시작 후 페이스 분석이 시작됩니다.</div>`;
  }

  el.innerHTML = `
    <div class="scenario-tabs">${tabs}</div>
    <div class="scenario-body">
      <div class="scenario-budget-row">
        <div class="sb-item">
          <span class="sb-label">총예산</span>
          <span class="sb-value">${formatKRW(totalBudget)}</span>
        </div>
        <div class="sb-arrow">→</div>
        <div class="sb-item">
          <span class="sb-label">공제 후 생활비</span>
          <span class="sb-value accent">${formatKRW(livingBudget)}</span>
        </div>
        <div class="sb-arrow">→</div>
        <div class="sb-item">
          <span class="sb-label">잔여 생활비</span>
          <span class="sb-value ${remainingBudget < 0 ? "text-danger" : ""}">${formatKRW(Math.max(0, remainingBudget))}</span>
        </div>
      </div>
      <div class="scenario-progress-wrap">
        <div class="scenario-progress-bar">
          <div class="scenario-progress-fill" style="width:${usedPct}%"></div>
        </div>
        <div class="scenario-progress-labels">
          <span>사용 ${usedPct}%</span>
          <span>${formatKRW(travelKRW)} / ${formatKRW(livingBudget)}</span>
        </div>
      </div>
      <div class="scenario-stats">
        <div class="ss-item">
          <span class="ss-label">이 시나리오로 가능한 총 일수</span>
          <span class="ss-value">${possibleDays}일</span>
        </div>
        <div class="ss-item">
          <span class="ss-label">잔여 예산으로 가능한 일수</span>
          <span class="ss-value ${remainingDays < 10 ? "text-danger" : ""}">${remainingDays}일</span>
        </div>
      </div>
      ${projectionHtml}
      <p class="scenario-deduct-note">
        공제: 항공권 ${formatKRW(deductFlight)} + 이동 ${formatKRW(deductTransport)} + 비상금 ${formatKRW(deductEmergency)}
        ${homeKRW > 0 ? ` + Home 지출 ${formatKRW(homeKRW)}` : ""}
        = ${formatKRW(totalDeductions + homeKRW)}
      </p>
    </div>
  `;

  // 탭 클릭 이벤트
  el.querySelectorAll(".scenario-tab").forEach(btn => {
    btn.addEventListener("click", () => {
      _selectedScenarioId = parseInt(btn.dataset.sid);
      renderScenarioSection(ctx);
    });
  });
}

// 바 차트 렌더링 (CSS 기반)
// onClickFn이 있으면 각 바를 클릭 가능하게 만듦
// labelMetaFn(label) → 라벨 아래에 표시할 서브텍스트 (예: 도시 일수)
function renderBarChart(containerId, dataMap, limit, onClickFn, labelMetaFn) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const sorted = Object.entries(dataMap).sort((a, b) => b[1] - a[1]);
  const items  = limit ? sorted.slice(0, limit) : sorted;
  if (items.length === 0) {
    container.innerHTML = "<p class='empty-msg'>데이터가 없습니다.</p>";
    return;
  }

  const maxVal = items[0][1];
  const clickable = typeof onClickFn === "function";

  container.innerHTML = items.map(([label, val]) => {
    const pct  = maxVal > 0 ? Math.round((val / maxVal) * 100) : 0;
    const meta = typeof labelMetaFn === "function" ? labelMetaFn(label) : null;
    return `
      <div class="bar-row ${clickable ? "clickable-bar" : ""}" data-label="${label}">
        <div class="bar-label-wrap">
          <div class="bar-label">${label}</div>
          ${meta ? `<div class="bar-label-meta">${meta}</div>` : ""}
        </div>
        <div class="bar-track">
          <div class="bar-fill" style="width:${pct}%"></div>
        </div>
        <div class="bar-value">${formatKRW(val)}</div>
      </div>
    `;
  }).join("");

  if (clickable) {
    container.querySelectorAll(".clickable-bar").forEach(row => {
      row.addEventListener("click", () => {
        const wasActive = row.classList.contains("active");
        container.querySelectorAll(".clickable-bar").forEach(r => r.classList.remove("active"));
        if (!wasActive) {
          row.classList.add("active");
          onClickFn(row.dataset.label);
        } else {
          onClickFn(null); // 닫기
        }
      });
    });
  }
}

// ============================================================
// 도시별 상세 내역
// ============================================================

// 카테고리 표시 순서
const CATEGORY_ORDER = ["accommodation", "food", "transport", "attraction", "shopping", "etc"];

function renderCityDetail(city, entries, expanded) {
  const container = document.getElementById("city-detail-content");
  if (!container) return;

  if (!city) {
    container.innerHTML = "<p class='empty-msg detail-hint'>도시를 클릭하면 상세 내역이 표시됩니다.</p>";
    return;
  }

  // 해당 도시의 원본 항목 (days 분산 전)
  const cityEntries = entries.filter(e => e.city === city);
  // 해당 도시의 총 지출 (days 분산 적용)
  const cityTotal = expanded
    .filter(e => e.city === city)
    .reduce((sum, e) => sum + e.amountKRW, 0);

  // 숙박 일수 합산 → 예산 한도 계산
  const cityDays = cityEntries
    .filter(e => e.category === "accommodation")
    .reduce((sum, e) => sum + (parseInt(e.days) || 1), 0);
  const cityBudget = cityDays * DAILY_BUDGET;
  const budgetDiff = cityTotal - cityBudget;
  const isOver     = budgetDiff > 0;

  // 카테고리 순서대로 그룹화
  const grouped = {};
  CATEGORY_ORDER.forEach(cat => { grouped[cat] = []; });
  cityEntries.forEach(e => {
    const cat = CATEGORY_ORDER.includes(e.category) ? e.category : "etc";
    grouped[cat].push(e);
  });

  // 카테고리별 소계 (expanded 기준)
  const catTotals = {};
  expanded.filter(e => e.city === city).forEach(e => {
    const cat = CATEGORY_ORDER.includes(e.category) ? e.category : "etc";
    catTotals[cat] = (catTotals[cat] || 0) + e.amountKRW;
  });

  const sections = CATEGORY_ORDER
    .filter(cat => grouped[cat].length > 0)
    .map(cat => {
      const emoji = CATEGORY_EMOJI[cat] || "💳";
      const catTotal = catTotals[cat] || 0;
      const itemsHtml = grouped[cat].map(e => {
        const krw = toKRW(e.amount, e.currency);
        const origStr = e.currency !== "KRW"
          ? `<span class="orig-amount">${e.amount} ${e.currency}</span>` : "";
        const daysStr = e.days > 1
          ? `<span class="list-days">÷${e.days}일 (원 ${formatKRW(krw)})</span>` : "";
        const perDay = Math.round(krw / e.days);
        const displayAmt = e.days > 1 ? perDay * e.days : krw; // 실제 결제액
        return `
          <div class="detail-item">
            <div class="list-info" style="flex:1">
              <div class="list-item-name">${e.item}</div>
              <div class="list-meta">${e.date}${e.days > 1 ? ` ~ ${formatDate(addDays(parseDate(e.date), e.days - 1))}` : ""}</div>
              ${e.note ? `<div class="list-note">${e.note}</div>` : ""}
            </div>
            <div class="list-right">
              <div class="list-amount">${formatKRW(displayAmt)}</div>
              ${origStr}${daysStr}
            </div>
          </div>`;
      }).join("");
      return `
        <div class="group-cat-section">
          <div class="group-cat-header">
            <span>${emoji} ${cat}</span>
            <span class="group-cat-total">${formatKRW(catTotal)}</span>
          </div>
          ${itemsHtml}
        </div>`;
    }).join("");

  // 예산 대비 표시 (숙박일수가 있을 때만)
  const budgetLine = cityDays > 0 ? `
    <div class="city-budget-row">
      <span class="city-days-badge">${cityDays}일</span>
      <span class="city-budget-limit">예산 한도 ${formatKRW(cityBudget)}</span>
      <span class="city-budget-diff ${isOver ? "text-danger" : "text-success"}">
        ${isOver ? "+" : ""}${formatKRW(budgetDiff)}
      </span>
    </div>` : "";

  container.innerHTML = `
    <div class="group-detail-header">
      <span class="group-detail-title">🏙️ ${city}</span>
      <span class="group-detail-total">${formatKRW(cityTotal)}</span>
    </div>
    ${budgetLine}
    ${sections}
  `;
}

// ============================================================
// 카테고리별 상세 내역
// ============================================================

function renderCategoryDetail(category, entries, expanded) {
  const container = document.getElementById("category-detail-content");
  if (!container) return;

  if (!category) {
    container.innerHTML = "<p class='empty-msg detail-hint'>카테고리를 클릭하면 상세 내역이 표시됩니다.</p>";
    return;
  }

  const catEntries = entries
    .filter(e => {
      const cat = CATEGORY_ORDER.includes(e.category) ? e.category : "etc";
      return cat === category;
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  const catTotal = expanded
    .filter(e => {
      const cat = CATEGORY_ORDER.includes(e.category) ? e.category : "etc";
      return cat === category;
    })
    .reduce((sum, e) => sum + e.amountKRW, 0);

  const emoji = CATEGORY_EMOJI[category] || "💳";

  const itemsHtml = catEntries.map(e => {
    const krw = toKRW(e.amount, e.currency);
    const origStr = e.currency !== "KRW"
      ? `<span class="orig-amount">${e.amount} ${e.currency}</span>` : "";
    const daysStr = e.days > 1
      ? `<span class="list-days">÷${e.days}일 (원 ${formatKRW(krw)})</span>` : "";
    return `
      <div class="detail-item">
        <div class="list-info" style="flex:1">
          <div class="list-item-name">${e.item}</div>
          <div class="list-meta">${e.date} · ${e.city}</div>
          ${e.note ? `<div class="list-note">${e.note}</div>` : ""}
        </div>
        <div class="list-right">
          <div class="list-amount">${formatKRW(krw)}</div>
          ${origStr}${daysStr}
        </div>
      </div>`;
  }).join("");

  container.innerHTML = `
    <div class="group-detail-header">
      <span class="group-detail-title">${emoji} ${category}</span>
      <span class="group-detail-total">${formatKRW(catTotal)}</span>
    </div>
    ${itemsHtml}
  `;
}

// ============================================================
// 날짜별 상세 내역 기능
// ============================================================

// 날짜 선택 칩 목록 렌더링
// entries: 원본 지출 항목, expanded: days 분산된 항목
function renderDatePicker(dates, entries, expanded) {
  const container = document.getElementById("date-picker");
  if (!container) return;

  if (dates.length === 0) {
    container.innerHTML = "<p class='empty-msg'>날짜 데이터가 없습니다.</p>";
    return;
  }

  // Home 항목이 있으면 맨 앞에 Home 칩 추가
  const allEntries = entries.__all || entries; // renderDashboard에서 넘겨주는 allEntries 참조
  const homeEntries = allEntries.filter(isHome);
  const homeChip = homeEntries.length > 0
    ? `<button class="date-chip date-chip-home" data-date="__home">🏠 Home</button>`
    : "";

  container.innerHTML = homeChip + dates.map(date => {
    const shortDate = date.slice(5); // MM-DD
    return `<button class="date-chip" data-date="${date}">${shortDate}</button>`;
  }).join("");

  const EMPTY_MSG = "<p class='empty-msg'>날짜를 선택하면 상세 내역이 표시됩니다.</p>";

  // 클릭 핸들러 (칩 선택 + 상세 렌더링)
  const selectChip = (btn) => {
    container.querySelectorAll(".date-chip").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    if (btn.dataset.date === "__home") {
      renderHomeDetail(homeEntries);
    } else {
      renderDayDetail(btn.dataset.date, entries, expanded);
    }
  };

  container.querySelectorAll(".date-chip").forEach(btn => {
    btn.addEventListener("click", () => {
      const wasActive = btn.classList.contains("active");
      if (!wasActive) {
        selectChip(btn);
      } else {
        // 같은 칩 다시 누르면 닫기
        btn.classList.remove("active");
        document.getElementById("day-detail-content").innerHTML = EMPTY_MSG;
      }
    });
  });

  // ── 페이지 로드 시 기본 선택 ──────────────────────────────────
  // 오늘 날짜 기준으로 자동 프리셋
  const todayStr  = formatDate(new Date());
  const firstDate = dates[0];
  const lastDate  = dates[dates.length - 1];

  let presetBtn = null;

  if (todayStr < firstDate) {
    // 여행 시작 전 → Home 칩 선택
    presetBtn = container.querySelector('.date-chip-home');
  } else if (todayStr > lastDate) {
    // 여행 종료 후 → 마지막 날 선택
    presetBtn = container.querySelector(`[data-date="${lastDate}"]`);
  } else {
    // 여행 중 → 오늘 날짜 칩 (없으면 가장 가까운 이전 날짜)
    const closestDate = [...dates].reverse().find(d => d <= todayStr);
    if (closestDate) presetBtn = container.querySelector(`[data-date="${closestDate}"]`);
  }

  if (presetBtn) selectChip(presetBtn);
}

// Home 항목 상세 렌더링 (예산 비교 없음)
function renderHomeDetail(homeEntries) {
  const container = document.getElementById("day-detail-content");
  if (!container) return;

  if (homeEntries.length === 0) {
    container.innerHTML = "<p class='empty-msg'>Home 항목이 없습니다.</p>";
    return;
  }

  const totalKRW = homeEntries.reduce((sum, e) => sum + toKRW(e.amount, e.currency), 0);
  const sorted   = [...homeEntries].sort((a, b) => a.date.localeCompare(b.date));

  container.innerHTML = `
    <div class="day-detail-header">
      <span class="day-detail-date">🏠 Home</span>
      <span class="day-detail-total">${formatKRW(totalKRW)}</span>
    </div>
    <div class="day-detail-list">
      ${sorted.map(e => {
        const emoji   = CATEGORY_EMOJI[e.category] || "💳";
        const krw     = toKRW(e.amount, e.currency);
        const origStr = e.currency !== "KRW"
          ? `<span class="orig-amount">${e.amount} ${e.currency}</span>` : "";
        return `
          <div class="detail-item">
            <span class="list-emoji">${emoji}</span>
            <div class="list-info">
              <div class="list-item-name">${e.item}</div>
              <div class="list-meta">${e.date} · ${e.category}</div>
              ${e.note ? `<div class="list-note">${e.note}</div>` : ""}
            </div>
            <div class="list-right">
              <div class="list-amount">${formatKRW(krw)}</div>
              ${origStr}
              ${e.days > 1 ? `<div class="list-days">÷${e.days}일</div>` : ""}
            </div>
          </div>`;
      }).join("")}
    </div>
  `;
}

// 선택된 날짜의 상세 내역 렌더링
// - expanded 기준으로 해당 날짜에 포함되는 원본 항목을 보여줌
// - days > 1인 항목은 "일할 적용 중" 배지 표시
function renderDayDetail(date, entries, expanded) {
  const container = document.getElementById("day-detail-content");
  if (!container) return;

  // 해당 날짜에 expanded 항목이 있는 원본 item 이름 수집
  const itemsOnDay = expanded
    .filter(e => e.date === date)
    .map(e => e.item);

  // 원본 항목 중 해당 날짜와 관련된 것 추출
  // (days 분산 항목은 expanded에서 해당 날짜로 나뉘어 있음)
  const relatedEntries = entries.filter(e => itemsOnDay.includes(e.item));

  // expanded에서 해당 날짜 amountKRW 합산 (일할 적용된 금액)
  const dayExpandedMap = {};
  expanded.filter(e => e.date === date).forEach(e => {
    dayExpandedMap[e.item] = e.amountKRW;
  });

  if (relatedEntries.length === 0) {
    container.innerHTML = "<p class='empty-msg'>해당 날짜의 지출이 없습니다.</p>";
    return;
  }

  const dayTotal = expanded
    .filter(e => e.date === date)
    .reduce((sum, e) => sum + e.amountKRW, 0);

  const isOver = dayTotal > DAILY_BUDGET;

  const mm_dd = date.slice(5);

  container.innerHTML = `
    <div class="day-detail-header">
      <span class="day-detail-date">${mm_dd}</span>
      <span class="day-detail-total ${isOver ? "text-danger" : "text-success"}">${formatKRW(dayTotal)}</span>
      <span class="day-detail-badge ${isOver ? "badge-over" : "badge-ok"}">${isOver ? "예산 초과" : "예산 내"}</span>
    </div>
    <div class="day-detail-list">
      ${relatedEntries.map(e => {
        const emoji      = CATEGORY_EMOJI[e.category] || "💳";
        const dayAmount  = dayExpandedMap[e.item] || 0;
        const origKRW    = toKRW(e.amount, e.currency);
        const isDivided  = e.days > 1;
        const origStr    = e.currency !== "KRW"
          ? `<span class="orig-amount">${e.amount} ${e.currency}</span>` : "";
        return `
          <div class="detail-item">
            <span class="list-emoji">${emoji}</span>
            <div class="list-info">
              <div class="list-item-name">${e.item}</div>
              <div class="list-meta">${e.city} · ${e.category}</div>
              ${e.note ? `<div class="list-note">${e.note}</div>` : ""}
            </div>
            <div class="list-right">
              <div class="list-amount">${formatKRW(dayAmount)}</div>
              ${origStr}
              ${isDivided
                ? `<div class="list-days">÷${e.days}일 (원 ${formatKRW(origKRW)})</div>`
                : ""}
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

// ============================================================
// 캘린더 히트맵
// ============================================================

// 금액 → 캘린더 셀 축약 표시 (예: 177,889 → "18만", 9,800 → "1만")
function formatCalAmount(krw) {
  if (!krw || krw < 1000) return "";
  if (krw >= 10000) return Math.round(krw / 10000) + "만";
  return Math.round(krw / 1000) + "천";
}

// 금액 → 히트맵 CSS 클래스
function calHeatClass(krw) {
  if (!krw) return "";
  const r = krw / DAILY_BUDGET;
  if (r <= 0.5)  return "heat-low";    // ~5만 (초록 연)
  if (r <= 1.0)  return "heat-mid";    // ~10만 (초록 진)
  if (r <= 1.5)  return "heat-high";   // ~15만 (주황)
  return "heat-over";                  // 15만+ (빨강)
}

// 전역 캘린더 상태
let _calYear  = new Date().getFullYear();
let _calMonth = new Date().getMonth(); // 0-indexed

function renderCalendarHeatmap(dataMap, entries, expanded) {
  const container = document.getElementById("daily-chart");
  if (!container) return;

  container.innerHTML = `
    <div class="cal-wrap">
      <div class="cal-nav">
        <button class="cal-arrow" id="cal-prev">‹</button>
        <span class="cal-title" id="cal-title"></span>
        <button class="cal-arrow" id="cal-next">›</button>
      </div>
      <div class="cal-grid" id="cal-grid"></div>
    </div>
  `;

  const drawMonth = (year, month) => {
    _calYear  = year;
    _calMonth = month;

    document.getElementById("cal-title").textContent =
      `${year}년 ${month + 1}월`;

    const DOW_LABELS = ["일","월","화","수","목","금","토"];
    const firstDay   = new Date(year, month, 1).getDay(); // 0=일
    const lastDay    = new Date(year, month + 1, 0).getDate();
    const todayStr   = formatDate(new Date());

    let html = DOW_LABELS.map(d =>
      `<div class="cal-dow ${d === "일" ? "cal-dow-sun" : d === "토" ? "cal-dow-sat" : ""}">${d}</div>`
    ).join("");

    // 첫 주 빈 칸
    for (let i = 0; i < firstDay; i++) {
      html += `<div class="cal-day cal-day-empty"></div>`;
    }

    for (let day = 1; day <= lastDay; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
      const krw     = dataMap[dateStr] || 0;
      const heat    = calHeatClass(krw);
      const amt     = formatCalAmount(krw);
      const isToday = dateStr === todayStr ? "cal-today" : "";
      const dow     = new Date(year, month, day).getDay();
      const isSun   = dow === 0 ? "cal-sun" : "";
      const isSat   = dow === 6 ? "cal-sat" : "";
      const hasData = krw > 0 ? "cal-has-data" : "";

      html += `
        <div class="cal-day ${heat} ${isToday} ${isSun} ${isSat} ${hasData}" data-date="${dateStr}">
          <span class="cal-day-num">${day}</span>
          ${amt ? `<span class="cal-day-amt">${amt}</span>` : ""}
        </div>`;
    }

    document.getElementById("cal-grid").innerHTML = html;

    // 날짜 셀 클릭 → 상세 내역 + 날짜 칩 연동
    document.getElementById("cal-grid").querySelectorAll(".cal-has-data").forEach(cell => {
      cell.addEventListener("click", () => {
        const date = cell.dataset.date;

        // 캘린더 내 선택 표시
        document.querySelectorAll(".cal-day.cal-selected").forEach(c => c.classList.remove("cal-selected"));
        cell.classList.add("cal-selected");

        // 날짜 칩 동기화
        const picker = document.getElementById("date-picker");
        if (picker) {
          picker.querySelectorAll(".date-chip").forEach(b => {
            b.classList.toggle("active", b.dataset.date === date);
          });
        }
        // 상세 내역 렌더링 + 스크롤
        renderDayDetail(date, entries, expanded);
        document.getElementById("section-day-detail").scrollIntoView({ behavior: "smooth" });
      });
    });
  };

  // 초기 달: 데이터가 있는 가장 최근 달 (없으면 오늘)
  const dataDates = Object.keys(dataMap).sort();
  if (dataDates.length > 0) {
    const latest = dataDates[dataDates.length - 1]; // 가장 최근 날짜
    const d = parseDate(latest);
    if (d) { _calYear = d.getFullYear(); _calMonth = d.getMonth(); }
  }

  drawMonth(_calYear, _calMonth);

  document.getElementById("cal-prev").addEventListener("click", () => {
    const d = new Date(_calYear, _calMonth - 1, 1);
    drawMonth(d.getFullYear(), d.getMonth());
  });
  document.getElementById("cal-next").addEventListener("click", () => {
    const d = new Date(_calYear, _calMonth + 1, 1);
    drawMonth(d.getFullYear(), d.getMonth());
  });
}

// 카테고리 이모지 매핑
const CATEGORY_EMOJI = {
  accommodation: "🏨",
  food:          "🍽️",
  transport:     "🚌",
  attraction:    "🎡",
  shopping:      "🛍️",
  etc:           "💳",
};

// 최근 지출 내역 렌더링 (원본 entries 기준)
function renderRecentList(entries) {
  const container = document.getElementById("recent-list");
  if (!container) return;

  // 최근 15건, 날짜 내림차순
  const recent = [...entries]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 15);

  if (recent.length === 0) {
    container.innerHTML = "<p class='empty-msg'>데이터가 없습니다.</p>";
    return;
  }

  container.innerHTML = recent.map(e => {
    const krw   = toKRW(e.amount, e.currency);
    const emoji = CATEGORY_EMOJI[e.category] || "💳";
    const origStr = e.currency !== "KRW"
      ? `<span class="orig-amount">${e.amount} ${e.currency}</span>`
      : "";
    return `
      <div class="list-item">
        <div class="list-left">
          <span class="list-emoji">${emoji}</span>
          <div class="list-info">
            <div class="list-item-name">${e.item}</div>
            <div class="list-meta">${e.date} · ${e.city} · ${e.category}</div>
            ${e.note ? `<div class="list-note">${e.note}</div>` : ""}
          </div>
        </div>
        <div class="list-right">
          <div class="list-amount">${formatKRW(krw)}</div>
          ${origStr}
          ${e.days > 1 ? `<div class="list-days">${e.days}일 분할</div>` : ""}
        </div>
      </div>
    `;
  }).join("");
}

// 에러/안내 메시지 표시
function showError(msg) {
  document.getElementById("error-banner").textContent = msg;
  document.getElementById("error-banner").style.display = "block";
}

function hideError() {
  document.getElementById("error-banner").style.display = "none";
}

// 로딩 상태 표시
function setLoading(isLoading) {
  document.getElementById("loading").style.display = isLoading ? "block" : "none";
}

// ============================================================
// 메인 렌더링 파이프라인
// ============================================================
function renderDashboard(rawData, settingsMap) {
  // Budget·Home 행은 집계에서 제외 (차트/리스트 모두)
  const allEntries = rawData.map(normalizeRow).filter(e => e.amount > 0 && e.date);
  const entries    = allEntries.filter(e => !isMetaCity(e)); // 차트·리스트용
  const expanded   = expandByDays(entries);

  const byDate     = aggregateByDate(expanded);
  const byCity     = aggregateByCity(expanded);
  const byCategory = aggregateByCategory(expanded);
  const cityDays   = aggregateCityDays(entries); // 도시별 숙박 일수

  // 날짜 목록 (정렬)
  const dates = Object.keys(byDate).sort();

  renderSummary(expanded, allEntries, settingsMap);
  // allEntries를 entries에 __all로 태깅해서 Home 칩 렌더링에 활용
  entries.__all = allEntries;
  renderDatePicker(dates, entries, expanded);
  renderCalendarHeatmap(byDate, entries, expanded);
  renderBarChart(
    "city-chart", byCity, null,
    city => renderCityDetail(city, entries, expanded),
    city => {
      const d = cityDays[city];
      return d ? `<span class="bar-days-tag">${d}일 · 한도 ${formatKRW(d * DAILY_BUDGET)}</span>` : null;
    }
  );
  renderBarChart("category-chart", byCategory, null, category => renderCategoryDetail(category, entries, expanded));
  renderRecentList(entries);
}

// ============================================================
// Google Sheet URL → CSV URL 변환
// ============================================================

// 어떤 형태의 Google Sheet URL이든 gviz CSV URL로 변환
// gviz/tq 엔드포인트는 "링크 공유" 설정만으로 인증 없이 동작합니다
// (export?format=csv 는 Google 로그인 쿠키 없이 400을 반환하므로 사용하지 않음)
//
// 지원 형식:
//   .../d/SHEET_ID/edit?usp=sharing        ← 일반 공유 링크
//   .../d/SHEET_ID/edit#gid=123            ← 특정 탭
//   .../d/e/PUB_ID/pub?gid=0&output=csv   ← 웹에 게시 링크 (그대로 사용)
//   .../d/SHEET_ID/gviz/tq?tqx=out:csv    ← 이미 gviz URL
// URL에서 Sheet ID 추출
function extractSheetId(rawUrl) {
  const idMatch = rawUrl.match(/\/spreadsheets\/d\/(?!e\/)([a-zA-Z0-9_-]+)/);
  return idMatch ? idMatch[1] : null;
}

// 어떤 형태의 Google Sheet URL이든 gviz CSV URL로 변환
// sheetName 지정 시 탭 이름으로 직접 접근 (gid보다 안정적)
function toCSVUrl(rawUrl, sheetName) {
  const url = rawUrl.trim();
  if (!url) return null;

  // 이미 완성된 pub/gviz URL이면 그대로
  if (url.includes("output=csv") || url.includes("gviz/tq")) return url;

  const sheetId = extractSheetId(url);
  if (!sheetId) return null;

  if (sheetName) {
    // 탭 이름으로 접근 — gid 불필요, 이름 변경 없는 한 안정적
    return `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
  }

  // 기본: gid 추출 (없으면 0 = 첫 번째 탭)
  const gidMatch = url.match(/[?&#]gid=(\d+)/);
  const gid = gidMatch ? gidMatch[1] : "0";
  return `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&gid=${gid}`;
}

// ============================================================
// 데이터 로딩
// ============================================================
async function loadData() {
  setLoading(true);
  hideError();

  // ① 원본 시트 URL 확보 (상수 → txt 순)
  let rawSheetUrl = SHEET_CSV_URL || "";
  try {
    const txtRes = await fetch("google-sheet.txt");
    if (txtRes.ok) {
      const fromTxt = (await txtRes.text()).trim();
      if (fromTxt) rawSheetUrl = fromTxt;
    }
  } catch (_) {}

  if (!rawSheetUrl) {
    setLoading(false);
    showError("⚠️ google-sheet.txt에 Google Sheet 주소를 넣어주세요. 지금은 샘플 데이터를 표시합니다.");
    renderDashboard(SAMPLE_DATA, null);
    return;
  }

  // ② "지출내역" 탭 (첫 번째 탭) fetch
  const csvUrl      = toCSVUrl(rawSheetUrl, "지출내역");
  // ③ "예산 설정" 탭 fetch (실패해도 계속 진행)
  const settingsUrl = toCSVUrl(rawSheetUrl, "예산 설정");

  try {
    // 두 탭 병렬 fetch
    const [dataRes, settingsRes] = await Promise.all([
      fetch(csvUrl),
      settingsUrl ? fetch(settingsUrl).catch(() => null) : Promise.resolve(null),
    ]);

    if (!dataRes.ok) throw new Error(`HTTP ${dataRes.status}`);
    const dataText = await dataRes.text();
    const rows     = parseCSV(dataText);

    // "예산 설정" 탭 파싱 (실패 시 null → script.js 상수 사용)
    let settingsMap = null;
    if (settingsRes?.ok) {
      const settingsText = await settingsRes.text();
      settingsMap = parseSettingsCSV(settingsText);
    }

    if (rows.length === 0) {
      showError("⚠️ 지출내역 탭에 데이터가 없습니다. 샘플 데이터를 표시합니다.");
      renderDashboard(SAMPLE_DATA, settingsMap);
    } else {
      renderDashboard(rows, settingsMap);
    }
  } catch (err) {
    setLoading(false);
    showError(`❌ Google Sheet를 불러오지 못했습니다 (${err.message}). 시트가 "링크 있는 사용자 모두 보기"로 공유되어 있는지 확인해주세요.`);
    renderDashboard(SAMPLE_DATA, null);
    return;
  }

  setLoading(false);
}

// "예산 설정" 탭 CSV → key:value 맵으로 파싱
// 첫 컬럼이 key, 두 번째 컬럼이 value (숫자)
function parseSettingsCSV(text) {
  const map = {};
  const lines = text.replace(/\r/g, "").trim().split("\n");
  for (const line of lines) {
    const fields = splitCSVRow(line);
    const key    = (fields[0] || "").toLowerCase().trim();
    const val    = parseFloat((fields[1] || "").replace(/,/g, ""));
    if (key && !isNaN(val)) map[key] = val;
  }
  return map;
}

// 페이지 로드 시 실행
document.addEventListener("DOMContentLoaded", loadData);
