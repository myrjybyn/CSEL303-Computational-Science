"""
SEIR Model for COVID-19 Epidemic Simulation
Uses scipy's solve_ivp for numerical ODE integration (RK45 method)
"""

import numpy as np
from scipy.integrate import solve_ivp


def seir_odes(t, y, beta, sigma, gamma, N):
    """
    SEIR differential equations.

    Parameters:
        t     : time (required by solve_ivp, unused directly)
        y     : state vector [S, E, I, R]
        beta  : transmission rate (contacts/day * prob of transmission)
        sigma : incubation rate (1 / incubation period)
        gamma : recovery rate (1 / infectious period)
        N     : total population
    """
    S, E, I, R = y

    dS_dt = -beta * S * I / N
    dE_dt =  beta * S * I / N - sigma * E
    dI_dt =  sigma * E - gamma * I
    dR_dt =  gamma * I

    return [dS_dt, dE_dt, dI_dt, dR_dt]


def run_seir(population, beta, sigma, gamma, initial_infected, days):
    """
    Run a single deterministic SEIR simulation.

    Returns a dict with time array and S, E, I, R arrays.
    """
    N = population
    I0 = initial_infected
    E0 = I0 * 2          # assume double exposed at start
    R0_count = 0
    S0 = N - E0 - I0 - R0_count

    y0 = [S0, E0, I0, R0_count]
    t_span = (0, days)
    t_eval = np.linspace(0, days, days + 1)

    sol = solve_ivp(
        seir_odes,
        t_span,
        y0,
        args=(beta, sigma, gamma, N),
        method='RK45',
        t_eval=t_eval,
        dense_output=False
    )

    S, E, I, R = sol.y

    # Compute key metrics
    peak_infected = float(np.max(I))
    peak_day = int(np.argmax(I))
    total_infected = float(R[-1])
    basic_reproduction_number = round(beta / gamma, 4)
    herd_immunity_threshold = round((1 - 1 / (beta / gamma)) * 100, 2) if beta / gamma > 1 else 0.0

    return {
        "t": sol.t.tolist(),
        "S": S.tolist(),
        "E": E.tolist(),
        "I": I.tolist(),
        "R": R.tolist(),
        "metrics": {
            "peak_infected": round(peak_infected),
            "peak_day": peak_day,
            "total_infected": round(total_infected),
            "R0": basic_reproduction_number,
            "herd_immunity_threshold": herd_immunity_threshold,
        }
    }


def get_scenario_presets():
    """Return named scenario presets with COVID-19 realistic parameters."""
    return {
        "no_intervention": {
            "label": "No Intervention",
            "beta": 0.35,
            "sigma": 0.2,
            "gamma": 0.1,
            "description": "Uncontrolled spread. R₀ ≈ 3.5"
        },
        "social_distancing": {
            "label": "Social Distancing",
            "beta": 0.20,
            "sigma": 0.2,
            "gamma": 0.1,
            "description": "Reduced contact rate. R₀ ≈ 2.0"
        },
        "lockdown": {
            "label": "Strict Lockdown",
            "beta": 0.10,
            "sigma": 0.2,
            "gamma": 0.1,
            "description": "Severe movement restrictions. R₀ ≈ 1.0"
        },
        "vaccination": {
            "label": "Vaccination Campaign",
            "beta": 0.25,
            "sigma": 0.2,
            "gamma": 0.15,
            "description": "Faster recovery, partial immunity. R₀ ≈ 1.67"
        }
    }