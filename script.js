// ============================================================
// 설정값 - 이 부분만 수정하면 됩니다
// ============================================================

// Google Sheet 주소를 아래에 붙여넣으세요 (edit 공유 링크 그대로 붙여넣어도 됩니다).
// google-sheet.txt 파일에 넣어도 같은 효과입니다 (txt가 우선 적용됨).
const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/1uToczZlxBdxCOf--8M3BEpyUp-6s-1JIjYg5zsvyirU/edit?usp=sharing";

// 환율 설정 (EUR -> KRW 환산)
// 여행 전에 현재 환율로 업데이트하세요
const EUR_TO_KRW = 1500;

// 여행 목표 일예산 (KRW)
const DAILY_BUDGET = 100000;

// 여행 시작일 (데이터가 없을 경우 오늘 기준으로 계산됩니다)
// 형식: "YYYY-MM-DD"
const TRIP_START_DATE = "";

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
function renderSummary(expanded, entries) {
  if (expanded.length === 0) {
    document.getElementById("summary").innerHTML = "<p class='empty-msg'>데이터가 없습니다.</p>";
    return;
  }

  // 전체 총 지출 (원본 entries 기준 - days 분산 전)
  const totalKRW = entries.reduce((sum, e) => sum + toKRW(e.amount, e.currency), 0);

  // 여행 기간 계산
  const dates = expanded.map(e => e.date).sort();
  const firstDateStr = TRIP_START_DATE || dates[0];
  const lastDateStr  = dates[dates.length - 1];
  const firstDate    = parseDate(firstDateStr);
  const lastDate     = parseDate(lastDateStr);
  const today        = new Date();
  today.setHours(0, 0, 0, 0);

  const totalTripDays = daysBetween(firstDate, addDays(lastDate, 1));
  const daysElapsed   = Math.max(1, daysBetween(firstDate, today > lastDate ? addDays(lastDate, 1) : today));

  const avgAll     = totalTripDays > 0 ? totalKRW / totalTripDays : 0;
  const avgToday   = daysElapsed   > 0 ? totalKRW / daysElapsed   : 0;
  const diffPerDay = avgToday - DAILY_BUDGET;
  const isOver     = diffPerDay > 0;

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
      <div class="summary-item">
        <span class="label">오늘까지 일평균</span>
        <span class="value">${formatKRW(avgToday)}</span>
        <span class="sub">${daysElapsed}일 경과</span>
      </div>
      <div class="summary-item full-width ${isOver ? "over-budget" : "under-budget"}">
        <span class="label">목표 ${formatKRW(DAILY_BUDGET)}/일 대비</span>
        <span class="value">${isOver ? "+" : ""}${formatKRW(diffPerDay)}</span>
        <span class="sub">${isOver ? "⚠️ 초과 중" : "✅ 절약 중"}</span>
      </div>
    </div>
  `;
}

// 바 차트 렌더링 (CSS 기반)
// onClickFn이 있으면 각 바를 클릭 가능하게 만듦
function renderBarChart(containerId, dataMap, limit, onClickFn) {
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
    const pct = maxVal > 0 ? Math.round((val / maxVal) * 100) : 0;
    return `
      <div class="bar-row ${clickable ? "clickable-bar" : ""}" data-label="${label}">
        <div class="bar-label">${label}</div>
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
  // 해당 도시의 일별 총합 (days 분산 적용)
  const cityTotal = expanded
    .filter(e => e.city === city)
    .reduce((sum, e) => sum + e.amountKRW, 0);

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

  container.innerHTML = `
    <div class="group-detail-header">
      <span class="group-detail-title">🏙️ ${city}</span>
      <span class="group-detail-total">${formatKRW(cityTotal)}</span>
    </div>
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

  container.innerHTML = dates.map(date => {
    const shortDate = date.slice(5); // MM-DD
    return `<button class="date-chip" data-date="${date}">${shortDate}</button>`;
  }).join("");

  // 칩 클릭 이벤트
  container.querySelectorAll(".date-chip").forEach(btn => {
    btn.addEventListener("click", () => {
      // 선택 상태 토글
      const wasActive = btn.classList.contains("active");
      container.querySelectorAll(".date-chip").forEach(b => b.classList.remove("active"));
      if (!wasActive) {
        btn.classList.add("active");
        renderDayDetail(btn.dataset.date, entries, expanded);
      } else {
        // 같은 날짜 다시 누르면 닫기
        document.getElementById("day-detail-content").innerHTML =
          "<p class='empty-msg'>날짜를 선택하면 상세 내역이 표시됩니다.</p>";
      }
    });
  });
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

// 일별 차트 렌더링 (날짜 순, 클릭으로 상세 연동)
function renderDailyChart(dataMap, entries, expanded) {
  const container = document.getElementById("daily-chart");
  if (!container) return;

  const sorted = Object.entries(dataMap).sort((a, b) => a[0].localeCompare(b[0]));
  if (sorted.length === 0) {
    container.innerHTML = "<p class='empty-msg'>데이터가 없습니다.</p>";
    return;
  }

  const maxVal = Math.max(...sorted.map(([, v]) => v));

  container.innerHTML = sorted.map(([date, val]) => {
    const pct       = maxVal > 0 ? Math.round((val / maxVal) * 100) : 0;
    const isOver    = val > DAILY_BUDGET;
    const shortDate = date.slice(5); // MM-DD
    return `
      <div class="bar-row clickable-bar" data-date="${date}" title="${date} 상세보기">
        <div class="bar-label">${shortDate}</div>
        <div class="bar-track">
          <div class="bar-fill ${isOver ? "bar-over" : ""}" style="width:${pct}%"></div>
        </div>
        <div class="bar-value">${formatKRW(val)}</div>
      </div>
    `;
  }).join("");

  // 차트 바 클릭 → 상단 날짜 선택 칩과 연동
  container.querySelectorAll(".clickable-bar").forEach(row => {
    row.addEventListener("click", () => {
      const date = row.dataset.date;
      // 날짜 칩 선택 상태 업데이트
      const picker = document.getElementById("date-picker");
      if (picker) {
        picker.querySelectorAll(".date-chip").forEach(b => {
          b.classList.toggle("active", b.dataset.date === date);
        });
      }
      // 상세 내역 렌더링 후 섹션으로 스크롤
      renderDayDetail(date, entries, expanded);
      document.getElementById("section-day-detail").scrollIntoView({ behavior: "smooth" });
    });
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
function renderDashboard(rawData) {
  const entries  = rawData.map(normalizeRow).filter(e => e.amount > 0 && e.date);
  const expanded = expandByDays(entries);

  const byDate     = aggregateByDate(expanded);
  const byCity     = aggregateByCity(expanded);
  const byCategory = aggregateByCategory(expanded);

  // 날짜 목록 (정렬)
  const dates = Object.keys(byDate).sort();

  renderSummary(expanded, entries);
  renderDatePicker(dates, entries, expanded);
  renderDailyChart(byDate, entries, expanded);
  renderBarChart("city-chart",     byCity,     null, city     => renderCityDetail(city, entries, expanded));
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
function toCSVUrl(rawUrl) {
  const url = rawUrl.trim();
  if (!url) return null;

  // 이미 완성된 pub CSV URL
  if (url.includes("output=csv")) return url;

  // 이미 gviz URL
  if (url.includes("gviz/tq")) return url;

  // Sheet ID 추출 (/d/ 다음 세그먼트, /e/ 형태 제외)
  const idMatch = url.match(/\/spreadsheets\/d\/(?!e\/)([a-zA-Z0-9_-]+)/);
  if (!idMatch) return null;
  const sheetId = idMatch[1];

  // gid 추출 (없으면 0 = 첫 번째 시트)
  const gidMatch = url.match(/[?&#]gid=(\d+)/);
  const gid = gidMatch ? gidMatch[1] : "0";

  // gviz/tq 엔드포인트 사용 — 공개 시트에서 CORS 없이 동작
  return `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&gid=${gid}`;
}

// ============================================================
// 데이터 로딩
// ============================================================
async function loadData() {
  setLoading(true);
  hideError();

  // ① SHEET_CSV_URL 상수 확인 (edit/공유 링크도 자동 변환)
  let csvUrl = SHEET_CSV_URL ? toCSVUrl(SHEET_CSV_URL) : null;

  // ② google-sheet.txt fetch 시도 (txt가 우선 — 상수를 덮어씀)
  try {
    const txtRes = await fetch("google-sheet.txt");
    if (txtRes.ok) {
      const raw = (await txtRes.text()).trim();
      const fromTxt = toCSVUrl(raw);
      if (fromTxt) csvUrl = fromTxt; // txt가 있으면 상수보다 우선 적용
    }
  } catch (_) {
    // txt 파일을 읽지 못해도 계속 진행 (상수값 사용)
  }

  // ② URL이 없으면 샘플 데이터
  if (!csvUrl) {
    setLoading(false);
    showError("⚠️ google-sheet.txt에 Google Sheet 주소를 넣어주세요. 지금은 샘플 데이터를 표시합니다.");
    renderDashboard(SAMPLE_DATA);
    return;
  }

  // ③ CSV fetch
  try {
    const res = await fetch(csvUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const rows = parseCSV(text);

    if (rows.length === 0) {
      showError("⚠️ 시트에 데이터가 없습니다. 샘플 데이터를 표시합니다.");
      renderDashboard(SAMPLE_DATA);
    } else {
      renderDashboard(rows);
    }
  } catch (err) {
    setLoading(false);
    showError(`❌ Google Sheet를 불러오지 못했습니다 (${err.message}). 시트가 "링크 있는 사용자 모두 보기"로 공유되어 있는지 확인해주세요.`);
    renderDashboard(SAMPLE_DATA);
    return;
  }

  setLoading(false);
}

// 페이지 로드 시 실행
document.addEventListener("DOMContentLoaded", loadData);
