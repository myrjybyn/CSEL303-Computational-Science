# COVID-19 SEIR Epidemic Simulator
### CSEL 303 — Computational Science Final Project

A web-based simulation of COVID-19 epidemic spread using the SEIR compartmental model.
Python (Flask + SciPy) handles all computation; HTML/CSS/JS renders the interactive UI.

---

## Setup & Installation

### 1. Install Python dependencies
```bash
pip install -r requirements.txt
```

### 2. Run the server
```bash
python app.py
```

### 3. Open in browser
```
http://127.0.0.1:5000
```

---

## Project Structure

```
covid-simulation/
├── app.py                      # Flask server & API routes
├── requirements.txt
├── simulation/
│   ├── seir.py                 # SEIR ODEs + RK45 solver (scipy)
│   ├── montecarlo.py           # Monte Carlo replications (numpy)
│   └── sensitivity.py          # Sensitivity analysis (parameter sweep)
├── templates/
│   └── index.html              # UI layout (Jinja2)
└── static/
    ├── css/style.css
    └── js/main.js              # Chart.js rendering + API calls
```

---

## Features

| Feature | Description |
|---|---|
| **SEIR Solver** | RK45 numerical integration via `scipy.integrate.solve_ivp` |
| **Scenario Presets** | No Intervention, Social Distancing, Lockdown, Vaccination |
| **Monte Carlo** | N stochastic replications with Gaussian parameter noise (numpy) |
| **Sensitivity Analysis** | Sweep β, σ, or γ and observe impact on metrics |
| **Key Metrics** | R₀, peak infected, day of peak, total infected, herd immunity % |

---

## SEIR Model

```
dS/dt = -β·S·I / N
dE/dt =  β·S·I / N - σ·E
dI/dt =  σ·E - γ·I
dR/dt =  γ·I
```

| Parameter | Meaning | COVID-19 estimate |
|---|---|---|
| β | Transmission rate | 0.25 – 0.35 |
| σ | Incubation rate (1/days) | ~0.20 (≈ 5-day incubation) |
| γ | Recovery rate (1/days) | ~0.10 (≈ 10-day infectious period) |
| R₀ | Basic reproduction number | β / γ |
