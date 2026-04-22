"""
Sensitivity Analysis for SEIR COVID-19 Model
Sweeps a target parameter across a range and records peak infection metrics.
"""

import numpy as np
from scipy.integrate import solve_ivp
from simulation.seir import seir_odes


SWEEPABLE_PARAMS = ["beta", "sigma", "gamma"]


def run_sensitivity(population, beta, sigma, gamma, initial_infected, days, target_param, steps=30):
    """
    Sweep `target_param` over a range while holding others fixed.
    Records peak_infected, peak_day, total_infected, and R0 for each value.

    Parameters:
        target_param : one of "beta", "sigma", "gamma"
        steps        : number of evenly-spaced values to sweep

    Returns a dict with param_values list and corresponding metric lists.
    """
    if target_param not in SWEEPABLE_PARAMS:
        raise ValueError(f"target_param must be one of {SWEEPABLE_PARAMS}")

    base = {"beta": beta, "sigma": sigma, "gamma": gamma}

    # Define sweep range: 20% to 200% of the base value
    base_val = base[target_param]
    param_values = np.linspace(base_val * 0.2, base_val * 2.0, steps)

    peak_infecteds = []
    peak_days = []
    total_infecteds = []
    R0_values = []

    N = population
    I0 = initial_infected
    E0 = I0 * 2
    S0 = N - E0 - I0
    y0 = [S0, E0, I0, 0]
    t_eval = np.linspace(0, days, days + 1)

    for val in param_values:
        params = dict(base)
        params[target_param] = val

        sol = solve_ivp(
            seir_odes,
            (0, days),
            y0,
            args=(params["beta"], params["sigma"], params["gamma"], N),
            method='RK45',
            t_eval=t_eval,
            dense_output=False
        )

        I_run = sol.y[2]
        R_run = sol.y[3]

        peak_infecteds.append(round(float(np.max(I_run))))
        peak_days.append(int(np.argmax(I_run)))
        total_infecteds.append(round(float(R_run[-1])))
        R0_values.append(round(params["beta"] / params["gamma"], 4))

    return {
        "target_param": target_param,
        "param_values": param_values.tolist(),
        "peak_infected": peak_infecteds,
        "peak_day": peak_days,
        "total_infected": total_infecteds,
        "R0": R0_values,
    }