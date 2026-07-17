const $ = (id) => document.getElementById(id);
const MEALS_ORDER = ["breakfast", "lunch", "dinner"];
const MEAL_LABELS = { breakfast: "เช้า", lunch: "กลางวัน", dinner: "เย็น" };
const dateFmt = new Intl.DateTimeFormat("th-TH-u-ca-gregory", {
  weekday: "long",
  day: "numeric",
  month: "short",
  year: "numeric",
});

let currentRange = 30;

function loadLogs() {
  try {
    return JSON.parse(localStorage.getItem("bulkConsoleDailyLogs")) || {};
  } catch (e) {
    return {};
  }
}

function statusColor(remain) {
  if (Math.abs(remain) <= 100) return "var(--teal)";
  if (remain > 100) return "var(--amber)";
  return "var(--rust)";
}

function niceMax(value) {
  const padded = Math.max(value, 1) * 1.15;
  const magnitude = Math.pow(10, Math.floor(Math.log10(padded)));
  const residual = padded / magnitude;
  let niceResidual;
  if (residual <= 1) niceResidual = 1;
  else if (residual <= 2) niceResidual = 2;
  else if (residual <= 2.5) niceResidual = 2.5;
  else if (residual <= 5) niceResidual = 5;
  else niceResidual = 10;
  return niceResidual * magnitude;
}

function filterDates(dates, range) {
  if (range === "all" || dates.length <= range) return dates;
  return dates.slice(dates.length - range);
}

function shortDateLabel(dateKey) {
  const d = new Date(dateKey + "T00:00:00");
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

// ---------- Tooltip ----------
const tooltipEl = $("chartTooltip");
function showTooltip(clientX, clientY, html) {
  tooltipEl.innerHTML = html;
  tooltipEl.hidden = false;
  const rect = tooltipEl.getBoundingClientRect();
  let left = clientX + 14;
  let top = clientY + 14;
  if (left + rect.width > window.innerWidth) left = clientX - rect.width - 14;
  if (top + rect.height > window.innerHeight) top = clientY - rect.height - 14;
  tooltipEl.style.left = left + "px";
  tooltipEl.style.top = top + "px";
}
function hideTooltip() {
  tooltipEl.hidden = true;
}

function buildTrendTooltip(dateKey, actual, target) {
  const label = dateFmt.format(new Date(dateKey + "T00:00:00"));
  const delta = actual - target;
  const deltaColor = Math.abs(delta) <= 100 ? "var(--teal)" : delta > 0 ? "var(--rust)" : "var(--amber)";
  const deltaText =
    delta > 0 ? `เกิน ${delta.toLocaleString()}` : delta < 0 ? `ขาด ${Math.abs(delta).toLocaleString()}` : "ตรงเป้า";
  return `
    <div class="tooltip__title">${label}</div>
    <div class="tooltip__row"><span>แคลอรี่จริง</span><b>${actual.toLocaleString()} kcal</b></div>
    <div class="tooltip__row"><span>เป้าหมาย</span><b>${target.toLocaleString()} kcal</b></div>
    <div class="tooltip__row"><span>ผลต่าง</span><b style="color:${deltaColor}">${deltaText} kcal</b></div>
  `;
}

function buildMacroTooltip(dateKey, p, f, c) {
  const label = dateFmt.format(new Date(dateKey + "T00:00:00"));
  return `
    <div class="tooltip__title">${label}</div>
    <div class="tooltip__row"><span><span class="dot dot--protein"></span>โปรตีน</span><b>${p} ก.</b></div>
    <div class="tooltip__row"><span><span class="dot dot--fat"></span>ไขมัน</span><b>${f} ก.</b></div>
    <div class="tooltip__row"><span><span class="dot dot--carb"></span>คาร์บ</span><b>${c} ก.</b></div>
  `;
}

// ---------- KPI row ----------
function computeKPIs(logs, dates) {
  if (!dates.length) return null;
  const n = dates.length;
  let sumKcal = 0, sumTargetKcal = 0, sumProtein = 0, sumTargetProtein = 0, onTargetDays = 0;
  dates.forEach((d) => {
    const log = logs[d];
    sumKcal += log.totals.kcal;
    sumTargetKcal += log.target.kcal;
    sumProtein += log.totals.protein;
    sumTargetProtein += log.target.protein;
    if (Math.abs(log.remain) <= 100) onTargetDays++;
  });
  return {
    days: n,
    avgKcal: Math.round(sumKcal / n),
    avgTargetKcal: Math.round(sumTargetKcal / n),
    avgProtein: Math.round(sumProtein / n),
    avgTargetProtein: Math.round(sumTargetProtein / n),
    pctOnTarget: Math.round((onTargetDays / n) * 100),
  };
}

function renderKPIs(kpis) {
  const el = $("kpiRow");
  if (!kpis) {
    el.innerHTML = `<p class="hint">ยังไม่มีข้อมูลบันทึกไว้ในช่วงนี้</p>`;
    return;
  }
  el.innerHTML = `
    <div class="kpi-tile">
      <span class="kpi-tile__label">จำนวนวันที่บันทึก</span>
      <span class="kpi-tile__value">${kpis.days}<small> วัน</small></span>
    </div>
    <div class="kpi-tile">
      <span class="kpi-tile__label">แคลอรี่เฉลี่ย/วัน</span>
      <span class="kpi-tile__value">${kpis.avgKcal.toLocaleString()}<small> kcal</small></span>
      <span class="kpi-tile__sub">เป้า ${kpis.avgTargetKcal.toLocaleString()} kcal</span>
    </div>
    <div class="kpi-tile">
      <span class="kpi-tile__label">โปรตีนเฉลี่ย/วัน</span>
      <span class="kpi-tile__value">${kpis.avgProtein}<small> ก.</small></span>
      <span class="kpi-tile__sub">เป้า ${kpis.avgTargetProtein} ก.</span>
    </div>
    <div class="kpi-tile">
      <span class="kpi-tile__label">วันที่ถึงเป้าแคลอรี่</span>
      <span class="kpi-tile__value">${kpis.pctOnTarget}<small>%</small></span>
    </div>
  `;
}

// ---------- Trend chart (kcal actual vs target) ----------
function renderTrendChart(logs, dates) {
  const container = $("trendChart");
  $("trendLegend").innerHTML = `
    <span class="legend-key"><span class="line-key line-key--actual"></span>แคลอรี่จริง</span>
    <span class="legend-key"><span class="line-key line-key--target"></span>เป้าหมาย</span>
  `;

  if (!dates.length) {
    container.innerHTML = `<p class="hint">ยังไม่มีข้อมูลในช่วงนี้</p>`;
    return;
  }

  const actual = dates.map((d) => logs[d].totals.kcal);
  const target = dates.map((d) => logs[d].target.kcal);
  const maxVal = niceMax(Math.max(...actual, ...target, 1));

  const stepW = 48;
  const width = Math.max(dates.length * stepW, 320);
  const height = 220;
  const padL = 46, padR = 16, padT = 16, padB = 30;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const xFor = (i) => (dates.length === 1 ? padL + plotW / 2 : padL + (plotW * i) / (dates.length - 1));
  const yFor = (v) => padT + plotH - (v / maxVal) * plotH;

  let gridSvg = "";
  const steps = 4;
  for (let s = 0; s <= steps; s++) {
    const v = (maxVal / steps) * s;
    const y = yFor(v);
    gridSvg += `<line x1="${padL}" y1="${y}" x2="${width - padR}" y2="${y}" class="chart-grid" />`;
    gridSvg += `<text x="${padL - 8}" y="${y + 4}" class="chart-tick" text-anchor="end">${Math.round(v).toLocaleString()}</text>`;
  }

  const targetPath = target.map((v, i) => `${i === 0 ? "M" : "L"}${xFor(i)},${yFor(v)}`).join(" ");
  const actualPath = actual.map((v, i) => `${i === 0 ? "M" : "L"}${xFor(i)},${yFor(v)}`).join(" ");
  const areaPath = `${actualPath} L${xFor(actual.length - 1)},${padT + plotH} L${xFor(0)},${padT + plotH} Z`;

  const labelIdxs = new Set([0, dates.length - 1, Math.floor((dates.length - 1) / 2)]);
  let xLabelsSvg = "";
  labelIdxs.forEach((i) => {
    xLabelsSvg += `<text x="${xFor(i)}" y="${height - 8}" class="chart-tick" text-anchor="middle">${shortDateLabel(dates[i])}</text>`;
  });

  const lastX = xFor(actual.length - 1), lastY = yFor(actual[actual.length - 1]);
  const lastTargetY = yFor(target[target.length - 1]);
  // place the end-label on whichever side moves it away from the target
  // reference line, so the two never sit on top of each other when actual ≈ target
  const labelBelow = lastY >= lastTargetY;
  let labelY = labelBelow ? lastY + 16 : lastY - 10;
  labelY = Math.max(padT + 10, Math.min(height - padB - 4, labelY));

  container.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" class="chart-svg" role="img" aria-label="กราฟแคลอรี่รายวันเทียบเป้าหมาย">
      ${gridSvg}
      <path d="${areaPath}" class="chart-area" />
      <path d="${targetPath}" class="chart-line chart-line--target" fill="none" />
      <path d="${actualPath}" class="chart-line chart-line--actual" fill="none" />
      <circle cx="${lastX}" cy="${lastY}" r="4.5" class="chart-dot" />
      <text x="${lastX}" y="${labelY}" class="chart-endlabel" text-anchor="end">${actual[actual.length - 1].toLocaleString()} kcal</text>
      ${xLabelsSvg}
      <line class="chart-crosshair" x1="0" y1="${padT}" x2="0" y2="${padT + plotH}" hidden />
    </svg>
  `;

  const svg = container.querySelector("svg");
  const crosshair = svg.querySelector(".chart-crosshair");

  svg.addEventListener("mousemove", (evt) => {
    const rect = svg.getBoundingClientRect();
    const px = ((evt.clientX - rect.left) / rect.width) * width;
    let idx = Math.round(((px - padL) / plotW) * (dates.length - 1));
    idx = Math.max(0, Math.min(dates.length - 1, idx));
    const x = xFor(idx);
    crosshair.setAttribute("x1", x);
    crosshair.setAttribute("x2", x);
    crosshair.removeAttribute("hidden");
    showTooltip(evt.clientX, evt.clientY, buildTrendTooltip(dates[idx], actual[idx], target[idx]));
  });
  svg.addEventListener("mouseleave", () => {
    crosshair.setAttribute("hidden", "");
    hideTooltip();
  });
}

// ---------- Macro stacked bar chart (P/F/C grams per day) ----------
function renderMacroChart(logs, dates) {
  const container = $("macroChart");
  if (!dates.length) {
    container.innerHTML = `<p class="hint">ยังไม่มีข้อมูลในช่วงนี้</p>`;
    return;
  }

  const pArr = dates.map((d) => logs[d].totals.protein);
  const fArr = dates.map((d) => logs[d].totals.fat);
  const cArr = dates.map((d) => logs[d].totals.carb);
  const totalArr = dates.map((_, i) => pArr[i] + fArr[i] + cArr[i]);
  const maxVal = niceMax(Math.max(...totalArr, 1));

  const barW = 20, gap = 16;
  const slotW = barW + gap;
  const width = Math.max(dates.length * slotW + gap, 320);
  const height = 220;
  const padL = 46, padR = 16, padT = 16, padB = 30;
  const plotH = height - padT - padB;

  const yFor = (v) => padT + plotH - (v / maxVal) * plotH;
  const xFor = (i) => padL + gap + i * slotW;

  let gridSvg = "";
  const steps = 4;
  for (let s = 0; s <= steps; s++) {
    const v = (maxVal / steps) * s;
    const y = yFor(v);
    gridSvg += `<line x1="${padL}" y1="${y}" x2="${width - padR}" y2="${y}" class="chart-grid" />`;
    gridSvg += `<text x="${padL - 8}" y="${y + 4}" class="chart-tick" text-anchor="end">${Math.round(v)}</text>`;
  }

  const segGap = 2;
  const baseline = padT + plotH;
  const labelEvery = Math.max(1, Math.ceil(dates.length / 8));
  let barsSvg = "";
  let xLabelsSvg = "";

  dates.forEach((d, i) => {
    const x = xFor(i);
    const p = pArr[i], f = fArr[i], c = cArr[i];
    const pTop = yFor(p);
    const fTop = yFor(p + f);
    const cTop = yFor(p + f + c);

    if (p > 0) {
      barsSvg += `<rect x="${x}" y="${pTop}" width="${barW}" height="${Math.max(baseline - pTop - segGap, 0)}" rx="2" class="bar bar--protein" data-i="${i}"/>`;
    }
    if (f > 0) {
      barsSvg += `<rect x="${x}" y="${fTop}" width="${barW}" height="${Math.max(pTop - fTop - segGap, 0)}" rx="2" class="bar bar--fat" data-i="${i}"/>`;
    }
    if (c > 0) {
      barsSvg += `<rect x="${x}" y="${cTop}" width="${barW}" height="${Math.max(fTop - cTop - segGap, 0)}" rx="2" class="bar bar--carb" data-i="${i}"/>`;
    }
    barsSvg += `<rect x="${x}" y="${padT}" width="${barW}" height="${plotH}" class="bar-hit" data-i="${i}" fill="transparent"/>`;

    if (i % labelEvery === 0 || i === dates.length - 1) {
      xLabelsSvg += `<text x="${x + barW / 2}" y="${height - 8}" class="chart-tick" text-anchor="middle">${shortDateLabel(d)}</text>`;
    }
  });

  container.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" class="chart-svg" role="img" aria-label="กราฟสัดส่วนสารอาหารรายวัน">
      ${gridSvg}
      ${barsSvg}
      ${xLabelsSvg}
    </svg>
  `;

  const svg = container.querySelector("svg");
  svg.querySelectorAll(".bar-hit").forEach((hit) => {
    const i = parseInt(hit.dataset.i);
    hit.addEventListener("mousemove", (evt) => {
      showTooltip(evt.clientX, evt.clientY, buildMacroTooltip(dates[i], pArr[i], fArr[i], cArr[i]));
      svg.querySelectorAll(`[data-i="${i}"].bar`).forEach((b) => b.classList.add("is-hover"));
    });
    hit.addEventListener("mouseleave", () => {
      hideTooltip();
      svg.querySelectorAll(".bar").forEach((b) => b.classList.remove("is-hover"));
    });
  });
}

// ---------- Day list ----------
function renderDayList(logs, dates) {
  const el = $("dayList");
  if (!dates.length) {
    el.innerHTML = `<p class="hint">ยังไม่มีข้อมูลบันทึกไว้ — กลับไปหน้าแดชบอร์ดแล้วกรอกข้อมูลก่อน ระบบจะบันทึกของวันนี้ให้อัตโนมัติ</p>`;
    return;
  }
  const descending = [...dates].reverse();
  el.innerHTML = descending
    .map((dateKey) => {
      const log = logs[dateKey];
      const label = dateFmt.format(new Date(dateKey + "T00:00:00"));
      const color = statusColor(log.remain);
      return `
        <button type="button" class="day-row" data-date="${dateKey}">
          <span class="day-row__date">${label}</span>
          <span class="day-row__kcal" style="color:${color}">${log.totals.kcal.toLocaleString()} kcal</span>
          <span class="day-row__protein">P ${log.totals.protein} ก.</span>
          <span class="day-row__arrow">›</span>
        </button>
      `;
    })
    .join("");

  el.querySelectorAll(".day-row").forEach((btn) => {
    btn.addEventListener("click", () => openDayModal(btn.dataset.date, logs[btn.dataset.date]));
  });
}

// ---------- Nutritionist-style insights ----------
function buildInsights(log) {
  const insights = [];
  const { protein, fat, carb, kcal } = log.totals;
  const targetProtein = log.target.protein;
  const remain = log.remain;

  const proteinPct = targetProtein > 0 ? (protein / targetProtein) * 100 : 0;
  if (proteinPct >= 95) {
    insights.push({ color: "var(--teal)", text: `โปรตีนเพียงพอ (${Math.round(proteinPct)}% ของเป้า) ดีต่อการซ่อมแซมและสร้างกล้ามเนื้อ` });
  } else if (proteinPct >= 70) {
    insights.push({
      color: "var(--amber)",
      text: `โปรตีนได้ ${Math.round(proteinPct)}% ของเป้า ยังขาดอีก ${Math.max(targetProtein - protein, 0)} ก. ลองเพิ่มแหล่งโปรตีนมื้อถัดไป`,
    });
  } else {
    insights.push({
      color: "var(--rust)",
      text: `โปรตีนต่ำกว่าเป้ามาก (${Math.round(proteinPct)}%) เสี่ยงกล้ามเนื้อฟื้นตัวช้า ควรเพิ่มเนื้อสัตว์/ไข่/เวย์ในมื้อถัดไป`,
    });
  }

  if (Math.abs(remain) <= 100) {
    insights.push({ color: "var(--teal)", text: "แคลอรี่รวมอยู่ในเป้าหมาย เหมาะกับการ bulk แบบควบคุมไขมันส่วนเกิน" });
  } else if (remain > 100) {
    insights.push({ color: "var(--amber)", text: `แคลอรี่ยังขาดอีก ${remain.toLocaleString()} kcal อาจได้น้ำหนักเพิ่มช้ากว่าเป้า` });
  } else {
    insights.push({ color: "var(--rust)", text: `แคลอรี่เกินเป้า ${Math.abs(remain).toLocaleString()} kcal ถ้าเกินต่อเนื่องจะได้ไขมันเพิ่มเร็วกว่าที่ตั้งใจ` });
  }

  const fatPct = kcal > 0 ? ((fat * 9) / kcal) * 100 : 0;
  if (fatPct > 35) {
    insights.push({
      color: "var(--amber)",
      text: `สัดส่วนไขมันค่อนข้างสูง (${Math.round(fatPct)}% ของแคลอรี่) ลองสลับเป็นเนื้อสัตว์ส่วนที่ไม่ติดมันมากขึ้น`,
    });
  } else {
    insights.push({ color: "var(--teal)", text: `สัดส่วนไขมันอยู่ในเกณฑ์ดี (${Math.round(fatPct)}% ของแคลอรี่)` });
  }

  return insights;
}

// ---------- Day detail popup ----------
function openDayModal(dateKey, log) {
  const modal = $("dayModal");
  const body = $("dayModalBody");
  const label = dateFmt.format(new Date(dateKey + "T00:00:00"));

  const { protein, fat, carb, kcal } = log.totals;
  const totalMacroCal = Math.max(kcal, 1);
  const pPct = (protein * 4) / totalMacroCal;
  const fPct = (fat * 9) / totalMacroCal;
  const cPct = (carb * 4) / totalMacroCal;
  const C = 2 * Math.PI * 50;
  const pLen = C * pPct, fLen = C * fPct, cLen = C * cPct;

  const remain = log.remain;
  const color = statusColor(remain);
  const statusText =
    Math.abs(remain) <= 100
      ? "อยู่ในเป้าหมาย"
      : remain > 0
      ? `ขาดอีก ${remain.toLocaleString()} kcal`
      : `เกินเป้า ${Math.abs(remain).toLocaleString()} kcal`;

  const mealCells = MEALS_ORDER.map((meal) => {
    const m = log.meals?.[meal] || { kcal: 0, p: 0, f: 0, c: 0 };
    return `
      <div class="history-meal">
        <span class="history-meal__label">${MEAL_LABELS[meal]}</span>
        <b>${m.kcal.toLocaleString()} kcal</b>
        <small>P ${m.p} / F ${m.f} / C ${m.c} ก.</small>
      </div>
    `;
  }).join("");

  const insights = buildInsights(log);

  body.innerHTML = `
    <div class="day-modal__header">
      <h2>${label}</h2>
      <button type="button" class="modal-close" id="modalCloseBtn" aria-label="ปิด">×</button>
    </div>
    <div class="day-modal__summary">
      <div class="donut-wrap donut-wrap--sm">
        <svg viewBox="0 0 120 120" role="img" aria-label="สัดส่วนสารอาหาร">
          <circle cx="60" cy="60" r="50" fill="none" stroke="var(--border)" stroke-width="14"/>
          <circle cx="60" cy="60" r="50" fill="none" stroke="var(--amber)" stroke-width="14" stroke-linecap="butt" transform="rotate(-90 60 60)"
            stroke-dasharray="${pLen} ${C - pLen}" stroke-dashoffset="0"/>
          <circle cx="60" cy="60" r="50" fill="none" stroke="var(--rust)" stroke-width="14" stroke-linecap="butt" transform="rotate(-90 60 60)"
            stroke-dasharray="${fLen} ${C - fLen}" stroke-dashoffset="${-pLen}"/>
          <circle cx="60" cy="60" r="50" fill="none" stroke="var(--teal)" stroke-width="14" stroke-linecap="butt" transform="rotate(-90 60 60)"
            stroke-dasharray="${cLen} ${C - cLen}" stroke-dashoffset="${-(pLen + fLen)}"/>
        </svg>
        <div class="donut-center">
          <span>${kcal.toLocaleString()}</span>
          <small>kcal</small>
        </div>
      </div>
      <div class="legend">
        <div class="legend__row"><span class="dot dot--protein"></span>โปรตีน <b>${protein} ก.</b></div>
        <div class="legend__row"><span class="dot dot--fat"></span>ไขมัน <b>${fat} ก.</b></div>
        <div class="legend__row"><span class="dot dot--carb"></span>คาร์บ <b>${carb} ก.</b></div>
        <div class="legend__row legend__row--divider"></div>
        <div class="legend__row"><span>เป้าโปรตีน</span><b>${log.target.protein} ก.</b></div>
        <div class="legend__row"><span>เป้าแคลอรี่/วัน</span><b>${log.target.kcal.toLocaleString()} kcal</b></div>
        <div class="legend__row legend__row--highlight"><span>สถานะ</span><b style="color:${color}">${statusText}</b></div>
      </div>
    </div>
    <h3 class="meal-breakdown-title">แยกตามมื้อ</h3>
    <div class="history-meals">${mealCells}</div>
    <h3 class="meal-breakdown-title">คำแนะนำจากระบบ</h3>
    <ul class="insights-list">${insights.map((i) => `<li style="color:${i.color}">${i.text}</li>`).join("")}</ul>
  `;

  $("modalCloseBtn").addEventListener("click", closeDayModal);
  if (typeof modal.showModal === "function") modal.showModal();
  else modal.setAttribute("open", "");
}

function closeDayModal() {
  const modal = $("dayModal");
  if (typeof modal.close === "function") modal.close();
  else modal.removeAttribute("open");
}

$("dayModal").addEventListener("click", (evt) => {
  const rect = $("dayModal").getBoundingClientRect();
  const inDialog =
    rect.top <= evt.clientY && evt.clientY <= rect.bottom && rect.left <= evt.clientX && evt.clientX <= rect.right;
  if (!inDialog) closeDayModal();
});

// ---------- Filters ----------
document.querySelectorAll(".filter-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".filter-btn").forEach((b) => b.classList.toggle("is-active", b === btn));
    currentRange = btn.dataset.range === "all" ? "all" : parseInt(btn.dataset.range);
    renderAll();
  });
});

$("clearAllBtn").addEventListener("click", () => {
  if (!confirm("ลบประวัติทั้งหมดถาวร ไม่สามารถกู้คืนได้ ยืนยันหรือไม่?")) return;
  localStorage.removeItem("bulkConsoleDailyLogs");
  renderAll();
});

// ---------- Boot ----------
function renderAll() {
  const logs = loadLogs();
  const allDates = Object.keys(logs).sort();
  const dates = filterDates(allDates, currentRange);
  renderKPIs(computeKPIs(logs, dates));
  renderTrendChart(logs, dates);
  renderMacroChart(logs, dates);
  renderDayList(logs, dates);
}

renderAll();
