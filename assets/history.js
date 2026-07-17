const MEAL_LABELS = { breakfast: "เช้า", lunch: "กลางวัน", dinner: "เย็น" };
const dateFmt = new Intl.DateTimeFormat("th-TH-u-ca-gregory", {
  weekday: "long",
  day: "numeric",
  month: "short",
  year: "numeric",
});

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

function renderHistory() {
  const logs = loadLogs();
  const dates = Object.keys(logs).sort((a, b) => (a < b ? 1 : -1));
  const listEl = document.getElementById("historyList");

  if (!dates.length) {
    listEl.innerHTML = `
      <section class="panel">
        <p class="hint">ยังไม่มีข้อมูลบันทึกไว้ — กลับไปหน้าแดชบอร์ดแล้วกรอกข้อมูลก่อน ระบบจะบันทึกของวันนี้ให้อัตโนมัติ</p>
      </section>
    `;
    return;
  }

  listEl.innerHTML = dates
    .map((dateKey) => {
      const log = logs[dateKey];
      const d = new Date(dateKey + "T00:00:00");
      const label = dateFmt.format(d);
      const color = statusColor(log.remain);
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

      return `
        <section class="panel day-card">
          <div class="day-card__header">
            <div>
              <h2 class="day-card__date">${label}</h2>
              <p class="day-card__totals">
                รวม <b style="color:${color}">${log.totals.kcal.toLocaleString()} kcal</b>
                (เป้า ${log.target.kcal.toLocaleString()} kcal ·
                ${log.remain >= 0 ? "เหลือ" : "เกิน"} ${Math.abs(log.remain).toLocaleString()} kcal) ·
                โปรตีน ${log.totals.protein} / ${log.target.protein} ก.
              </p>
            </div>
            <button type="button" class="btn btn--small" data-delete="${dateKey}">ลบ</button>
          </div>
          <div class="history-meals">${mealCells}</div>
        </section>
      `;
    })
    .join("");

  listEl.querySelectorAll("[data-delete]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const logs = loadLogs();
      delete logs[btn.dataset.delete];
      localStorage.setItem("bulkConsoleDailyLogs", JSON.stringify(logs));
      renderHistory();
    });
  });
}

const MEALS_ORDER = ["breakfast", "lunch", "dinner"];

document.getElementById("clearAllBtn").addEventListener("click", () => {
  if (!confirm("ลบประวัติทั้งหมดถาวร ไม่สามารถกู้คืนได้ ยืนยันหรือไม่?")) return;
  localStorage.removeItem("bulkConsoleDailyLogs");
  renderHistory();
});

renderHistory();
