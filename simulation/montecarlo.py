"""
Monte Carlo Simulation for SEIR COVID-19 Model
Runs N replications with randomized parameters to model stochastic uncertainty.
"""

import numpy as np
from scipy.integrate import solve_ivp
from simulation.seir import seir_odes


def run_monte_carlo(population, beta, sigma, gamma, initial_infected, days, replications=100, noise_level=0.1):
    """
    Run Monte Carlo replications of the SEIR model.
    Each replication perturbs beta, sigma, gamma with Gaussian noise.

    Parameters:
        population      : total population N
        beta            : base transmission rate
        sigma           : base incubation rate
        gamma           : base recovery rate
        initial_infected: initial infectious count
        days            : simulation duration
        replications    : number of Monte Carlo runs
        noise_level     : std dev as a fraction of base parameter (e.g. 0.1 = 10% noise)

    Returns a dict with per-day mean, lower bound (5th pct), and upper bound (95th pct)
    for each compartment, plus aggregate metrics.
    """
    N = population
    t_eval = np.linspace(0, days, days + 1)

    all_S = []
    all_E = []
    all_I = []
    all_R = []
    peak_infecteds = []
    peak_days = []
    total_infecteds = []
    R0_values = []

    rng = np.random.default_rng(seed=42)  # reproducible seed for verification

    for _ in range(replications):
        # Perturb parameters using Gaussian noise (clamp to positive values)
        b = max(0.01, rng.normal(beta,  beta  * noise_level))
        s = max(0.01, rng.normal(sigma, sigma * noise_level))
        g = max(0.01, rng.normal(gamma, gamma * noise_level))

        I0 = max(1, int(rng.normal(initial_infected, initial_infected * noise_level)))
        E0 = I0 * 2
        S0 = N - E0 - I0
        y0 = [S0, E0, I0, 0]

        sol = solve_ivp(
            seir_odes,
            (0, days),
            y0,
            args=(b, s, g, N),
            method='RK45',
            t_eval=t_eval,
            dense_output=False
        )

        S_run, E_run, I_run, R_run = sol.y

        all_S.append(S_run)
        all_E.append(E_run)
        all_I.append(I_run)
        all_R.append(R_run)

        peak_infecteds.append(float(np.max(I_run)))
        peak_days.append(int(np.argmax(I_run)))
        total_infecteds.append(float(R_run[-1]))
        R0_values.append(round(b / g, 4))

    # Stack into arrays: shape (replications, days+1)
    all_I_arr = np.array(all_I)
    all_S_arr = np.array(all_S)
    all_E_arr = np.array(all_E)
    all_R_arr = np.array(all_R)

    def summarize(arr):
        return {
            "mean":  np.mean(arr, axis=0).tolist(),
            "lower": np.percentile(arr, 5,  axis=0).tolist(),
            "upper": np.percentile(arr, 95, axis=0).tolist(),
        }

    return {
        "t": t_eval.tolist(),
        "S": summarize(all_S_arr),
        "E": summarize(all_E_arr),
        "I": summarize(all_I_arr),
        "R": summarize(all_R_arr),
        "replications": replications,
        "metrics": {
            "peak_infected_mean":  round(float(np.mean(peak_infecteds))),
            "peak_infected_lower": round(float(np.percentile(peak_infecteds, 5))),
            "peak_infected_upper": round(float(np.percentile(peak_infecteds, 95))),
            "peak_day_mean":       round(float(np.mean(peak_days))),
            "total_infected_mean": round(float(np.mean(total_infecteds))),
            "R0_mean":             round(float(np.mean(R0_values)), 4),
        }
    }