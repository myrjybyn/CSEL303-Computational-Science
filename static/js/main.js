/**
 * main.js — COVID-19 SEIR Simulator Frontend
 * Handles UI events, API calls, and Chart.js rendering.
 */

// ── Chart instances ──────────────────────────────────────────────────────────
let seirChartInst = null;
let infectedChartInst = null;
let sensChartInst = null;

// ── Shared chart defaults ─────────────────────────────────────────────────────
const CHART_DEFAULTS = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: "index", intersect: false },
  plugins: {
    legend: {
      labels: { color: "#94a3b8", font: { family: "Space Mono", size: 11 }, boxWidth: 12 }
    },
    tooltip: {
      backgroundColor: "#111520",
      borderColor: "#1f2840",
      borderWidth: 1,
      titleColor: "#e2e8f0",
      bodyColor: "#94a3b8",
      titleFont: { family: "Space Mono", size: 11 },
      callbacks: {
        label: ctx => ` ${ctx.dataset.label}: ${Math.round(ctx.raw).toLocaleString()}`
      }
    }
  },
  scales: {
    x: {
      ticks: { color: "#64748b", font: { family: "Space Mono", size: 10 }, maxTicksLimit: 10 },
      grid: { color: "#1f2840" },
      title: { display: true, text: "Days", color: "#64748b", font: { family: "Space Mono", size: 10 } }
    },
    y: {
      ticks: {
        color: "#64748b", font: { family: "Space Mono", size: 10 },
        callback: v => v >= 1e6 ? (v/1e6).toFixed(1)+"M" : v >= 1e3 ? (v/1e3).toFixed(0)+"K" : v
      },
      grid: { color: "#1f2840" },
      title: { display: true, text: "People", color: "#64748b", font: { family: "Space Mono", size: 10 } }
    }
  }
};

// ── Utility ───────────────────────────────────────────────────────────────────
function fmt(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return String(Math.round(n));
}

function setStatus(msg, loading = false) {
  document.getElementById("statusText").textContent = msg;
  document.getElementById("spinner").classList.toggle("hidden", !loading);
}

function setMetrics(metrics, isMC = false) {
  document.getElementById("m-R0").textContent = metrics.R0 ?? metrics.R0_mean ?? "—";
  document.getElementById("m-herd").textContent =
    metrics.herd_immunity_threshold != null ? metrics.herd_immunity_threshold + "%" : "—";

  if (isMC) {
    document.getElementById("m-peak").textContent =
      fmt(metrics.peak_infected_mean) +
      ` (±${fmt((metrics.peak_infected_upper - metrics.peak_infected_lower) / 2)})`;
    document.getElementById("m-peakday").textContent = "Day " + metrics.peak_day_mean;
    document.getElementById("m-total").textContent = fmt(metrics.total_infected_mean);
  } else {
    document.getElementById("m-peak").textContent = fmt(metrics.peak_infected);
    document.getElementById("m-peakday").textContent = "Day " + metrics.peak_day;
    document.getElementById("m-total").textContent = fmt(metrics.total_infected);
  }
}

function getParams() {
  return {
    population:       parseInt(document.getElementById("population").value),
    beta:             parseFloat(document.getElementById("beta").value),
    sigma:            parseFloat(document.getElementById("sigma").value),
    gamma:            parseFloat(document.getElementById("gamma").value),
    initial_infected: parseInt(document.getElementById("initial_infected").value),
    days:             parseInt(document.getElementById("days").value),
  };
}

// ── Sliders ───────────────────────────────────────────────────────────────────
const sliderIds = ["population", "beta", "sigma", "gamma", "initial_infected", "days", "replications", "noise_level"];

sliderIds.forEach(id => {
  const el = document.getElementById(id);
  if (!el) return;
  const badge = document.getElementById("val-" + id);
  el.addEventListener("input", () => {
    let v = el.value;
    if (id === "population")        badge.textContent = parseInt(v).toLocaleString();
    else if (id === "noise_level")  badge.textContent = v + "%";
    else                            badge.textContent = v;
  });
});

// ── Monte Carlo toggle ─────────────────────────────────────────────────────────
document.getElementById("mcToggle").addEventListener("change", e => {
  document.getElementById("mcOptions").classList.toggle("hidden", !e.target.checked);
});

// ── Tabs ──────────────────────────────────────────────────────────────────────
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("tab-" + btn.dataset.tab).classList.add("active");
  });
});

// ── Scenarios ─────────────────────────────────────────────────────────────────
let scenarioPresets = {};

async function loadScenarios() {
  try {
    const res = await fetch("/api/scenarios");
    const json = await res.json();
    scenarioPresets = json.data;
  } catch (e) {
    console.warn("Could not load scenarios", e);
  }
}

document.getElementById("scenarioGrid").addEventListener("click", e => {
  const btn = e.target.closest(".scenario-btn");
  if (!btn) return;
  const key = btn.dataset.scenario;
  const preset = scenarioPresets[key];
  if (!preset) return;

  document.querySelectorAll(".scenario-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");

  document.getElementById("beta").value  = preset.beta;
  document.getElementById("sigma").value = preset.sigma;
  document.getElementById("gamma").value = preset.gamma;
  document.getElementById("val-beta").textContent  = preset.beta;
  document.getElementById("val-sigma").textContent = preset.sigma;
  document.getElementById("val-gamma").textContent = preset.gamma;
  document.getElementById("scenarioDesc").textContent = preset.description;
});

// ── SEIR Chart ────────────────────────────────────────────────────────────────
function renderSEIRChart(data, isMC = false) {
  const ctx = document.getElementById("seirChart").getContext("2d");
  if (seirChartInst) seirChartInst.destroy();

  const labels = data.t.map(v => Math.round(v));
  const datasets = [];

  if (isMC) {
    // Band fill for I (confidence interval)
    datasets.push({
      label: "I (95% CI upper)",
      data: data.I.upper,
      borderColor: "transparent",
      backgroundColor: "rgba(239,68,68,0.12)",
      fill: "+1",
      pointRadius: 0,
      tension: 0.3,
    });
    datasets.push({
      label: "I (95% CI lower)",
      data: data.I.lower,
      borderColor: "transparent",
      backgroundColor: "rgba(239,68,68,0.12)",
      fill: false,
      pointRadius: 0,
      tension: 0.3,
    });
    datasets.push({ label: "S (mean)", data: data.S.mean, borderColor: "#3b82f6", backgroundColor: "transparent", pointRadius: 0, tension: 0.3, borderWidth: 2 });
    datasets.push({ label: "E (mean)", data: data.E.mean, borderColor: "#f59e0b", backgroundColor: "transparent", pointRadius: 0, tension: 0.3, borderWidth: 2 });
    datasets.push({ label: "I (mean)", data: data.I.mean, borderColor: "#ef4444", backgroundColor: "transparent", pointRadius: 0, tension: 0.3, borderWidth: 2.5 });
    datasets.push({ label: "R (mean)", data: data.R.mean, borderColor: "#22c55e", backgroundColor: "transparent", pointRadius: 0, tension: 0.3, borderWidth: 2 });
  } else {
    datasets.push({ label: "S — Susceptible", data: data.S, borderColor: "#3b82f6", backgroundColor: "rgba(59,130,246,0.06)", fill: true, pointRadius: 0, tension: 0.3, borderWidth: 2 });
    datasets.push({ label: "E — Exposed",     data: data.E, borderColor: "#f59e0b", backgroundColor: "transparent",           fill: false, pointRadius: 0, tension: 0.3, borderWidth: 2 });
    datasets.push({ label: "I — Infectious",  data: data.I, borderColor: "#ef4444", backgroundColor: "rgba(239,68,68,0.06)", fill: true, pointRadius: 0, tension: 0.3, borderWidth: 2.5 });
    datasets.push({ label: "R — Recovered",   data: data.R, borderColor: "#22c55e", backgroundColor: "rgba(34,197,94,0.04)",  fill: true, pointRadius: 0, tension: 0.3, borderWidth: 2 });
  }

  seirChartInst = new Chart(ctx, {
    type: "line",
    data: { labels, datasets },
    options: { ...CHART_DEFAULTS }
  });
}

// ── Infected-Only Chart ────────────────────────────────────────────────────────
function renderInfectedChart(data, isMC = false) {
  const ctx = document.getElementById("infectedChart").getContext("2d");
  if (infectedChartInst) infectedChartInst.destroy();

  const labels = data.t.map(v => Math.round(v));
  const datasets = [];

  if (isMC) {
    datasets.push({ label: "I upper 95%", data: data.I.upper, borderColor: "transparent", backgroundColor: "rgba(239,68,68,0.15)", fill: "+1", pointRadius: 0, tension: 0.3 });
    datasets.push({ label: "I lower 5%",  data: data.I.lower, borderColor: "transparent", backgroundColor: "rgba(239,68,68,0.15)", fill: false, pointRadius: 0, tension: 0.3 });
    datasets.push({ label: "I — Infectious (mean)", data: data.I.mean, borderColor: "#ef4444", backgroundColor: "transparent", pointRadius: 0, tension: 0.3, borderWidth: 2.5 });
  } else {
    datasets.push({ label: "I — Infectious", data: data.I, borderColor: "#ef4444", backgroundColor: "rgba(239,68,68,0.12)", fill: true, pointRadius: 0, tension: 0.3, borderWidth: 2.5 });
  }

  infectedChartInst = new Chart(ctx, {
    type: "line",
    data: { labels, datasets },
    options: { ...CHART_DEFAULTS }
  });
}

// ── Run Simulation ─────────────────────────────────────────────────────────────
document.getElementById("runBtn").addEventListener("click", async () => {
  const params = getParams();
  const isMC   = document.getElementById("mcToggle").checked;
  const btn    = document.getElementById("runBtn");

  btn.disabled = true;
  setStatus("Running simulation…", true);

  try {
    let result;

    if (isMC) {
      const mcParams = {
        ...params,
        replications: parseInt(document.getElementById("replications").value),
        noise_level:  parseInt(document.getElementById("noise_level").value) / 100,
      };
      const res = await fetch("/api/montecarlo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mcParams)
      });
      const json = await res.json();
      if (json.status !== "ok") throw new Error(json.message);
      result = json.data;
      renderSEIRChart(result, true);
      renderInfectedChart(result, true);
      setMetrics(result.metrics, true);
      setStatus(`Monte Carlo complete — ${result.replications} replications (RK45 + numpy).`);
    } else {
      const res = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params)
      });
      const json = await res.json();
      if (json.status !== "ok") throw new Error(json.message);
      result = json.data;
      renderSEIRChart(result, false);
      renderInfectedChart(result, false);
      setMetrics(result.metrics, false);
      setStatus(`Simulation complete — RK45 solver, ${params.days} days.`);
    }

  } catch (err) {
    setStatus("Error: " + err.message);
    console.error(err);
  } finally {
    btn.disabled = false;
  }
});

// ── Sensitivity Analysis ───────────────────────────────────────────────────────
document.getElementById("sensRunBtn").addEventListener("click", async () => {
  const params = getParams();
  const targetParam = document.getElementById("sensParam").value;
  const metric      = document.getElementById("sensMetric").value;
  const btn         = document.getElementById("sensRunBtn");

  btn.disabled = true;
  setStatus("Running sensitivity analysis…", true);

  try {
    const res = await fetch("/api/sensitivity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...params, target_param: targetParam, steps: 30 })
    });
    const json = await res.json();
    if (json.status !== "ok") throw new Error(json.message);
    const data = json.data;

    const ctx = document.getElementById("sensChart").getContext("2d");
    if (sensChartInst) sensChartInst.destroy();

    const paramLabels = { beta: "β", sigma: "σ", gamma: "γ" };
    const metricLabels = {
      peak_infected: "Peak Infected",
      total_infected: "Total Infected",
      peak_day: "Day of Peak",
      R0: "Basic R₀"
    };

    sensChartInst = new Chart(ctx, {
      type: "line",
      data: {
        labels: data.param_values.map(v => v.toFixed(3)),
        datasets: [{
          label: metricLabels[metric],
          data: data[metric],
          borderColor: "#7c5cfc",
          backgroundColor: "rgba(124,92,252,0.1)",
          fill: true,
          pointRadius: 3,
          tension: 0.3,
          borderWidth: 2,
        }]
      },
      options: {
        ...CHART_DEFAULTS,
        scales: {
          ...CHART_DEFAULTS.scales,
          x: {
            ...CHART_DEFAULTS.scales.x,
            title: { display: true, text: paramLabels[targetParam], color: "#64748b", font: { family: "Space Mono", size: 10 } }
          },
          y: {
            ...CHART_DEFAULTS.scales.y,
            title: { display: true, text: metricLabels[metric], color: "#64748b", font: { family: "Space Mono", size: 10 } }
          }
        }
      }
    });

    setStatus(`Sensitivity analysis complete — swept ${paramLabels[targetParam]} over 30 steps.`);
  } catch (err) {
    setStatus("Error: " + err.message);
    console.error(err);
  } finally {
    btn.disabled = false;
  }
});

// ── Init ──────────────────────────────────────────────────────────────────────
(async () => {
  await loadScenarios();
  // Auto-run on load with defaults
  document.getElementById("runBtn").click();
})();

// ── Download Summary Results (NEW)─────────────────────────────────────────────────────
document.getElementById("downloadBtn").addEventListener("click", async () => {
  const params = getParams();

  try {
    const res = await fetch("/api/export_csv", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(params)
    });

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "seir_results.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();

    window.URL.revokeObjectURL(url);
  } catch (err) {
    console.error("Download failed:", err);
  }
});