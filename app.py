"""
Flask API server for COVID-19 SEIR Simulation
Exposes endpoints consumed by the frontend UI.
"""

from flask import Flask, request, jsonify, render_template
from simulation.seir import run_seir, get_scenario_presets
from simulation.montecarlo import run_monte_carlo
from simulation.sensitivity import run_sensitivity

app = Flask(__name__)


# ── Pages ──────────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html")


# ── API Endpoints ──────────────────────────────────────────────────────────────

@app.route("/api/simulate", methods=["POST"])
def simulate():
    """Run a single deterministic SEIR simulation."""
    data = request.get_json()
    try:
        result = run_seir(
            population=int(data["population"]),
            beta=float(data["beta"]),
            sigma=float(data["sigma"]),
            gamma=float(data["gamma"]),
            initial_infected=int(data["initial_infected"]),
            days=int(data["days"]),
        )
        return jsonify({"status": "ok", "data": result})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400


@app.route("/api/montecarlo", methods=["POST"])
def montecarlo():
    """Run Monte Carlo replications."""
    data = request.get_json()
    try:
        result = run_monte_carlo(
            population=int(data["population"]),
            beta=float(data["beta"]),
            sigma=float(data["sigma"]),
            gamma=float(data["gamma"]),
            initial_infected=int(data["initial_infected"]),
            days=int(data["days"]),
            replications=int(data.get("replications", 100)),
            noise_level=float(data.get("noise_level", 0.10)),
        )
        return jsonify({"status": "ok", "data": result})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400


@app.route("/api/sensitivity", methods=["POST"])
def sensitivity():
    """Run sensitivity analysis on a single parameter."""
    data = request.get_json()
    try:
        result = run_sensitivity(
            population=int(data["population"]),
            beta=float(data["beta"]),
            sigma=float(data["sigma"]),
            gamma=float(data["gamma"]),
            initial_infected=int(data["initial_infected"]),
            days=int(data["days"]),
            target_param=data["target_param"],
            steps=int(data.get("steps", 30)),
        )
        return jsonify({"status": "ok", "data": result})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400


@app.route("/api/scenarios", methods=["GET"])
def scenarios():
    """Return available scenario presets."""
    return jsonify({"status": "ok", "data": get_scenario_presets()})


# ── Entry Point ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    app.run(debug=True, port=5000)