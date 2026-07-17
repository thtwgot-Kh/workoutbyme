const $ = (id) => document.getElementById(id);

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

// ---------- Food rows ----------
const foodBody = $("foodBody");
const MAX_ROWS = 15;
let rowCount = 0;

function addFoodRow() {
  if (rowCount >= MAX_ROWS) return;
  rowCount++;
  const tr = document.createElement("tr");
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

  const tdP = document.createElement("td");
  tdP.className = "num foodP";
  const tdF = document.createElement("td");
  tdF.className = "num foodF";
  const tdC = document.createElement("td");
  tdC.className = "num foodC";

  tr.append(tdSel, tdGrams, tdP, tdF, tdC);
  foodBody.appendChild(tr);

  sel.addEventListener("input", calc);
  tdGrams.querySelector("input").addEventListener("input", calc);
}
for (let i = 0; i < 5; i++) addFoodRow();
$("addRow").addEventListener("click", addFoodRow);

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
  addFoodRow();
  const selects = document.querySelectorAll(".foodSelect");
  selects[selects.length - 1].value = idx;
  foodSearchInput.value = "";
  searchResultsEl.innerHTML = "";
  calc();
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

  // food rows
  let sumP = 0, sumF = 0, sumC = 0;
  document.querySelectorAll(".foodSelect").forEach((sel, i) => {
    const grams = document.querySelectorAll(".foodGrams")[i];
    const f = FOODS[parseInt(sel.value)];
    const g = parseFloat(grams.value) || 0;
    const factor = g / 100;
    const p = f.p * factor, fat = f.f * factor, c = f.c * factor;
    sumP += p; sumF += fat; sumC += c;
    const row = sel.closest("tr");
    row.querySelector(".foodP").textContent = p.toFixed(1) + " ก.";
    row.querySelector(".foodF").textContent = fat.toFixed(1) + " ก.";
    row.querySelector(".foodC").textContent = c.toFixed(1) + " ก.";
  });

  // protein powder
  const scoops = parseFloat($("scoops").value) || 0;
  const scoopProtein = parseFloat($("scoopProtein").value) || 0;
  const scoopCal = parseFloat($("scoopCal").value) || 0;
  sumP += scoops * scoopProtein;
  const scoopCalTotal = scoops * scoopCal;

  // carbs
  const carbSel = CARBS[parseInt($("carbSource").value)];
  const carbGrams = parseFloat($("carbGrams").value) || 0;
  const cf = carbGrams / 100;
  const carbP = carbSel.p * cf, carbF = carbSel.f * cf, carbC = carbSel.c * cf;
  sumP += carbP; sumF += carbF; sumC += carbC;
  const carbCal = Math.round(carbP * 4 + carbF * 9 + carbC * 4);
  $("carbCalOut").textContent = carbCal.toLocaleString() + " kcal";

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
}

document
  .querySelectorAll(
    "#gender,#age,#weight,#height,#activity,#rate,#proteinFactor,#scoops,#scoopProtein,#scoopCal,#carbSource,#carbGrams"
  )
  .forEach((el) => el.addEventListener("input", calc));

calc();
