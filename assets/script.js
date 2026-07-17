const $ = (id) => document.getElementById(id);
const MEALS = ["breakfast", "lunch", "dinner"];
const MEAL_LABELS = { breakfast: "เช้า", lunch: "กลางวัน", dinner: "เย็น" };
let activeMeal = "breakfast";

// ---------- Gauges ----------
const GAUGE_DEFS = [
  { id: "bmr", label: "BMR" },
  { id: "tdee", label: "TDEE" },
  { id: "target", label: "เป้าหมาย/วัน" },
  { id: "gainday", label: "น้ำหนักเพิ่ม/วัน" },
];
const gaugesEl = $("gauges");
GAUGE_DEFS.forEach((g) => {
  const div = document.createElement("div");
  div.className = "gauge";
  div.innerHTML = `<div class="gauge__label">${g.label}</div><div class="gauge__value" id="g_${g.id}">–</div>`;
  gaugesEl.appendChild(div);
});

// ---------- Meal tabs ----------
document.querySelectorAll(".meal-tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    activeMeal = btn.dataset.meal;
    document.querySelectorAll(".meal-tab").forEach((b) => b.classList.toggle("is-active", b === btn));
    document.querySelectorAll(".meal-panel").forEach((p) => {
      p.hidden = p.dataset.mealPanel !== activeMeal;
    });
    const label = $("activeMealLabel");
    if (label) label.textContent = MEAL_LABELS[activeMeal];
  });
});

// ---------- Food rows (per meal) ----------
const MAX_ROWS_PER_MEAL = 8;
const rowCounts = { breakfast: 0, lunch: 0, dinner: 0 };

function addFoodRow(meal) {
  if (rowCounts[meal] >= MAX_ROWS_PER_MEAL) return;
  rowCounts[meal]++;
  const tbody = document.querySelector(`.foodBody[data-meal="${meal}"]`);
  const tr = document.createElement("tr");
  tr.dataset.saved = "false";
  tr.classList.add("row--unsaved");

  const sel = document.createElement("select");
  sel.className = "foodSelect";
  FOODS.forEach((f, idx) => {
    const opt = document.createElement("option");
    opt.value = idx;
    opt.textContent = f.name;
    sel.appendChild(opt);
  });
  const tdSel = document.createElement("td");
  tdSel.appendChild(sel);

  const tdGrams = document.createElement("td");
  tdGrams.innerHTML = `<input type="number" class="foodGrams" value="0" min="0">`;
  const gramsInput = tdGrams.querySelector("input");

  const tdP = document.createElement("td");
  tdP.className = "num foodP";
  const tdF = document.createElement("td");
  tdF.className = "num foodF";
  const tdC = document.createElement("td");
  tdC.className = "num foodC";

  const tdAction = document.createElement("td");
  tdAction.className = "row-action";
  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.className = "btn btn--small row-save";
  saveBtn.textContent = "✓ บันทึก";
  tdAction.appendChild(saveBtn);

  tr.append(tdSel, tdGrams, tdP, tdF, tdC, tdAction);
  tbody.appendChild(tr);

  sel.addEventListener("input", calc);
  gramsInput.addEventListener("input", calc);

  saveBtn.addEventListener("click", () => {
    const isSaved = tr.dataset.saved === "true";
    tr.dataset.saved = isSaved ? "false" : "true";
    tr.classList.toggle("row--saved", !isSaved);
    tr.classList.toggle("row--unsaved", isSaved);
    sel.disabled = !isSaved;
    gramsInput.disabled = !isSaved;
    saveBtn.textContent = isSaved ? "✓ บันทึก" : "แก้ไข";
    calc();
  });

  return tr;
}

MEALS.forEach((meal) => {
  for (let i = 0; i < 3; i++) addFoodRow(meal);
});

document.querySelectorAll(".addRow").forEach((btn) => {
  btn.addEventListener("click", () => addFoodRow(btn.dataset.meal));
});

document.querySelectorAll(".carbSource, .carbGrams").forEach((el) => {
  el.addEventListener("input", calc);
});

// ---------- Online food search (USDA FoodData Central) ----------
const usdaKeyInput = $("usdaKey");
const foodSearchInput = $("foodSearch");
const searchResultsEl = $("searchResults");

usdaKeyInput.value = localStorage.getItem("usdaApiKey") || "";
usdaKeyInput.addEventListener("input", () => {
  localStorage.setItem("usdaApiKey", usdaKeyInput.value.trim());
});

function translateFoodQuery(q) {
  for (const [th, en] of Object.entries(THAI_FOOD_TERMS)) {
    if (q.includes(th)) return en;
  }
  return q;
}

function getUsdaNutrient(food, nutrientNames) {
  const found = food.foodNutrients?.find((n) => nutrientNames.includes(n.nutrientName));
  return found ? found.value : 0;
}

let searchDebounceId;
foodSearchInput.addEventListener("input", () => {
  clearTimeout(searchDebounceId);
  const q = foodSearchInput.value.trim();
  if (q.length < 2) {
    searchResultsEl.innerHTML = "";
    return;
  }
  searchDebounceId = setTimeout(() => runUsdaSearch(q), 450);
});

async function runUsdaSearch(q) {
  const key = usdaKeyInput.value.trim();
  if (!key) {
    searchResultsEl.innerHTML = `<p class="hint">ใส่ USDA API Key ด้านบนก่อน (ขอฟรีได้ตามลิงก์)</p>`;
    return;
  }
  searchResultsEl.innerHTML = `<p class="hint">กำลังค้นหา…</p>`;
  const query = translateFoodQuery(q);
  try {
    const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(
      key
    )}&query=${encodeURIComponent(query)}&dataType=Foundation,SR%20Legacy&pageSize=8`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    renderUsdaResults(data.foods || []);
  } catch (err) {
    searchResultsEl.innerHTML = `<p class="hint">ค้นหาไม่สำเร็จ (${err.message}) — เช็ค API key หรือลองพิมพ์เป็นภาษาอังกฤษดู</p>`;
  }
}

function renderUsdaResults(foods) {
  if (!foods.length) {
    searchResultsEl.innerHTML = `<p class="hint">ไม่พบผลลัพธ์ ลองพิมพ์เป็นภาษาอังกฤษ เช่น "pork ground raw"</p>`;
    return;
  }
  searchResultsEl.innerHTML = "";
  foods.forEach((food) => {
    const p = getUsdaNutrient(food, ["Protein"]);
    const f = getUsdaNutrient(food, ["Total lipid (fat)"]);
    const c = getUsdaNutrient(food, ["Carbohydrate, by difference"]);
    const row = document.createElement("div");
    row.className = "search-result";
    row.innerHTML = `
      <div class="search-result__info">
        <div class="search-result__name">${food.description}</div>
        <div class="search-result__macro">โปรตีน ${p.toFixed(1)} / ไขมัน ${f.toFixed(1)} / คาร์บ ${c.toFixed(1)} ก. ต่อ 100 ก.</div>
      </div>
      <button type="button" class="btn btn--small">+ เพิ่ม</button>
    `;
    row.querySelector("button").addEventListener("click", () => addCustomFood(food.description, p, f, c));
    searchResultsEl.appendChild(row);
  });
}

function addCustomFood(name, p, f, c) {
  const idx = FOODS.length;
  FOODS.push({ name, p, f, c });
  document.querySelectorAll(".foodSelect").forEach((sel) => {
    const opt = document.createElement("option");
    opt.value = idx;
    opt.textContent = name;
    sel.appendChild(opt);
  });
  const tr = addFoodRow(activeMeal);
  if (tr) tr.querySelector(".foodSelect").value = idx;
  foodSearchInput.value = "";
  searchResultsEl.innerHTML = "";
  calc();
}

// ---------- Per-meal sums ----------
function sumMealFoods(meal) {
  let p = 0, f = 0, c = 0;
  const tbody = document.querySelector(`.foodBody[data-meal="${meal}"]`);
  tbody.querySelectorAll("tr").forEach((row) => {
    const sel = row.querySelector(".foodSelect");
    const grams = row.querySelector(".foodGrams");
    const food = FOODS[parseInt(sel.value)];
    const g = parseFloat(grams.value) || 0;
    const factor = g / 100;
    const fp = food.p * factor, ff = food.f * factor, fc = food.c * factor;
    row.querySelector(".foodP").textContent = fp.toFixed(1) + " ก.";
    row.querySelector(".foodF").textContent = ff.toFixed(1) + " ก.";
    row.querySelector(".foodC").textContent = fc.toFixed(1) + " ก.";
    // only rows confirmed with "✓ บันทึก" count toward the meal/day totals —
    // this is what keeps half-typed or unconfirmed entries out of the log
    if (row.dataset.saved === "true") {
      p += fp; f += ff; c += fc;
    }
  });
  return { p, f, c };
}

function sumMealCarb(meal) {
  const sel = document.querySelector(`.carbSource[data-meal="${meal}"]`);
  const gramsInput = document.querySelector(`.carbGrams[data-meal="${meal}"]`);
  const outEl = document.querySelector(`.carbCalOut[data-meal="${meal}"]`);
  const carb = CARBS[parseInt(sel.value)];
  const g = parseFloat(gramsInput.value) || 0;
  const factor = g / 100;
  const p = carb.p * factor, f = carb.f * factor, c = carb.c * factor;
  const kcal = Math.round(p * 4 + f * 9 + c * 4);
  outEl.textContent = kcal.toLocaleString() + " kcal";
  return { p, f, c };
}

// ---------- Daily log (localStorage, shared with history.html) ----------
function saveDailyLog(payload) {
  const key = "bulkConsoleDailyLogs";
  let logs = {};
  try {
    logs = JSON.parse(localStorage.getItem(key)) || {};
  } catch (e) {
    logs = {};
  }
  const dateKey = new Date().toLocaleDateString("en-CA");
  logs[dateKey] = { date: dateKey, savedAt: new Date().toISOString(), ...payload };
  localStorage.setItem(key, JSON.stringify(logs));
}

// ---------- Calculation ----------
function calc() {
  const gender = $("gender").value;
  const age = parseFloat($("age").value) || 0;
  const weight = parseFloat($("weight").value) || 0;
  const height = parseFloat($("height").value) || 0;
  const activity = parseFloat($("activity").value);
  const rate = parseFloat($("rate").value);
  const proteinFactor = parseFloat($("proteinFactor").value) || 2;
  $("rateOut").textContent = rate.toFixed(1);

  const bmr = Math.round(
    gender === "male"
      ? 10 * weight + 6.25 * height - 5 * age + 5
      : 10 * weight + 6.25 * height - 5 * age - 161
  );
  const tdee = Math.round(bmr * activity);
  const weeklyGainKg = weight * (rate / 100);
  const dailySurplus = Math.round((weeklyGainKg * 7700) / 7);
  const target = tdee + dailySurplus;
  const gainPerDay = weeklyGainKg / 7;
  const targetProtein = Math.round(weight * proteinFactor);

  $("g_bmr").innerHTML = `${bmr.toLocaleString()} <small>kcal</small>`;
  $("g_tdee").innerHTML = `${tdee.toLocaleString()} <small>kcal</small>`;
  $("g_target").innerHTML = `${target.toLocaleString()} <small>kcal</small>`;
  $("g_gainday").innerHTML = `${gainPerDay.toFixed(3)} <small>กก.</small>`;

  // food + carbs, summed per meal
  let sumP = 0, sumF = 0, sumC = 0;
  const mealTotals = {};
  MEALS.forEach((meal) => {
    const foodSum = sumMealFoods(meal);
    const carbSum = sumMealCarb(meal);
    const mp = foodSum.p + carbSum.p;
    const mf = foodSum.f + carbSum.f;
    const mc = foodSum.c + carbSum.c;
    const mkcal = Math.round(mp * 4 + mf * 9 + mc * 4);
    mealTotals[meal] = { p: Math.round(mp), f: Math.round(mf), c: Math.round(mc), kcal: mkcal };
    sumP += mp; sumF += mf; sumC += mc;

    const subtotalEl = document.querySelector(`.meal-subtotal[data-meal-subtotal="${meal}"]`);
    if (subtotalEl) {
      subtotalEl.innerHTML = `รวมมื้อนี้: <b>${mkcal.toLocaleString()} kcal</b> · P ${mp.toFixed(1)} / F ${mf.toFixed(1)} / C ${mc.toFixed(1)} ก.`;
    }
    const mbEl = $(`mb_${meal}`);
    if (mbEl) mbEl.textContent = mkcal.toLocaleString() + " kcal";
  });

  // protein powder (whole day, not tied to a meal)
  const scoops = parseFloat($("scoops").value) || 0;
  const scoopProtein = parseFloat($("scoopProtein").value) || 0;
  const scoopCal = parseFloat($("scoopCal").value) || 0;
  sumP += scoops * scoopProtein;
  const scoopCalTotal = scoops * scoopCal;

  // calories = macros from real food (incl. scoop protein grams) minus the
  // calorie-equivalent of scoop protein (to avoid double counting), plus the
  // scoop's own labeled calories (which already include its fat/carb/fillers)
  const finalCal = Math.round(
    sumP * 4 + sumF * 9 + sumC * 4 - scoops * scoopProtein * 4 + scoopCalTotal
  );

  // donut
  const C = 2 * Math.PI * 50;
  const totalMacroCal = Math.max(finalCal, 1);
  const pPct = (sumP * 4) / totalMacroCal;
  const fPct = (sumF * 9) / totalMacroCal;
  const cPct = (sumC * 4) / totalMacroCal;
  const pLen = C * pPct, fLen = C * fPct, cLen = C * cPct;

  const dp = $("donutProtein"), df = $("donutFat"), dc = $("donutCarb");
  dp.style.stroke = "var(--amber)";
  df.style.stroke = "var(--rust)";
  dc.style.stroke = "var(--teal)";
  dp.setAttribute("stroke-dasharray", `${pLen} ${C - pLen}`);
  dp.setAttribute("stroke-dashoffset", "0");
  df.setAttribute("stroke-dasharray", `${fLen} ${C - fLen}`);
  df.setAttribute("stroke-dashoffset", `${-pLen}`);
  dc.setAttribute("stroke-dasharray", `${cLen} ${C - cLen}`);
  dc.setAttribute("stroke-dashoffset", `${-(pLen + fLen)}`);

  $("donutKcal").textContent = Math.round(finalCal).toLocaleString();
  $("legProtein").textContent = Math.round(sumP) + " ก.";
  $("legFat").textContent = Math.round(sumF) + " ก.";
  $("legCarb").textContent = Math.round(sumC) + " ก.";
  $("legTargetProtein").textContent = targetProtein + " ก.";
  $("legTargetCal").textContent = target.toLocaleString() + " kcal";
  const remain = target - Math.round(finalCal);
  $("legRemain").textContent = remain.toLocaleString() + " kcal";

  const pill = $("statusPill");
  if (Math.abs(remain) <= 100) {
    pill.textContent = "อยู่ในเป้าหมาย";
    pill.style.color = "var(--teal)";
    pill.style.borderColor = "var(--teal)";
  } else if (remain > 100) {
    pill.textContent = `ยังขาดอีก ${remain.toLocaleString()} kcal`;
    pill.style.color = "var(--amber)";
    pill.style.borderColor = "var(--amber)";
  } else {
    pill.textContent = `เกินเป้า ${Math.abs(remain).toLocaleString()} kcal`;
    pill.style.color = "var(--rust)";
    pill.style.borderColor = "var(--rust)";
  }

  saveDailyLog({
    target: { kcal: target, protein: targetProtein },
    totals: { kcal: Math.round(finalCal), protein: Math.round(sumP), fat: Math.round(sumF), carb: Math.round(sumC) },
    meals: mealTotals,
    remain,
  });
}

document
  .querySelectorAll(
    "#gender,#age,#weight,#height,#activity,#rate,#proteinFactor,#scoops,#scoopProtein,#scoopCal"
  )
  .forEach((el) => el.addEventListener("input", calc));

calc();
