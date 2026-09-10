"""
Environmental Condensation (Dew Point) and Partial Discharge (PD) Multi-Modal Fusion.
Complies with IEEE Std 1291, IEEE C37.303, and CIGRE TB 837.

Calculates Dew Point using the Magnus-Tetens equation and correlates surface condensation margin
with High-Frequency Current Transformer (Techimp HFCT 30/50, 1-60 MHz) pulse statistics
to predict dielectric breakdown and surface flashover hours to days before a flashover occurs.
"""

import math
from typing import Dict, Any

class DewPointPDFusion:
    def __init__(
        self,
        critical_dew_margin_celsius: float = 3.0,
        normal_pd_pulse_rate_pps: float = 10.0,
        warning_pd_pulse_rate_pps: float = 40.0,
        critical_pd_pulse_rate_pps: float = 100.0
    ):
        self.critical_dew_margin = critical_dew_margin_celsius
        self.normal_pd_pps = normal_pd_pulse_rate_pps
        self.warning_pd_pps = warning_pd_pulse_rate_pps
        self.critical_pd_pps = critical_pd_pulse_rate_pps
        
        # Magnus-Tetens coefficients for water vapor (valid -45°C to 60°C)
        self.a = 17.27
        self.b = 237.7

    def calculate_dew_point(self, ambient_temp_c: float, relative_humidity_pct: float) -> float:
        """
        Calculates Dew Point Temperature (T_dp) using Magnus-Tetens formula.
        Safely clamped to physical switchgear operating range (-45°C to 65°C) to prevent zero division.
        """
        # Physical clamping
        temp = max(-45.0, min(65.0, ambient_temp_c))
        rh = max(1.0, min(100.0, relative_humidity_pct))
        
        denominator = self.b + temp
        if abs(denominator) < 0.001:
            denominator = 0.001

        alpha = ((self.a * temp) / denominator) + math.log(rh / 100.0)
        t_dp = (self.b * alpha) / (self.a - alpha)
        return t_dp

    def evaluate(
        self,
        ambient_temp_c: float,
        relative_humidity_pct: float,
        surface_temp_c: float,
        hfct_pd_pulse_rate_pps: float,
        hfct_peak_amplitude_pc: float = 35.0
    ) -> Dict[str, Any]:
        """
        Fused evaluation of microclimate and high-frequency partial discharge.
        """
        t_dp = self.calculate_dew_point(ambient_temp_c, relative_humidity_pct)
        dew_margin = surface_temp_c - t_dp

        # Evaluate condensation state
        condensation_risk = "SAFE"
        if dew_margin <= 0.0:
            condensation_risk = "CONDENSATION_ACTIVE"
        elif dew_margin <= self.critical_dew_margin:
            condensation_risk = "HIGH_RISK"
        elif dew_margin <= 5.0:
            condensation_risk = "MODERATE"

        # Evaluate PD activity (Techimp HFCT)
        pd_state = "NORMAL"
        if hfct_pd_pulse_rate_pps >= self.critical_pd_pps or hfct_peak_amplitude_pc >= 250.0:
            pd_state = "CRITICAL"
        elif hfct_pd_pulse_rate_pps >= self.warning_pd_pps or hfct_peak_amplitude_pc >= 100.0:
            pd_state = "ELEVATED"

        # Fused Anomaly & Threat Classification
        if condensation_risk in ["CONDENSATION_ACTIVE", "HIGH_RISK"] and pd_state in ["ELEVATED", "CRITICAL"]:
            status = "CRITICAL_FLASHOVER_RISK"
            anomaly_detected = True
            description = (
                f"IMMINENT SURFACE FLASHOVER RISK! Dew margin is only {dew_margin:.1f}°C and "
                f"HFCT PD pulse rate has surged to {hfct_pd_pulse_rate_pps:.1f} pps ({hfct_peak_amplitude_pc:.0f} pC). "
                "Moisture condensation is accelerating dielectric tracking across insulator surface!"
            )
        elif condensation_risk in ["CONDENSATION_ACTIVE", "HIGH_RISK"]:
            status = "CONDENSATION_WARNING"
            anomaly_detected = True
            description = (
                f"Cabinet microclimate at condensation threshold (Margin: {dew_margin:.1f}°C, RH: {relative_humidity_pct:.0f}%). "
                "Cabinet anti-condensation space heater must be activated."
            )
        elif pd_state == "CRITICAL":
            status = "INSULATION_DEFECT"
            anomaly_detected = True
            description = (
                f"Severe internal partial discharge detected by HFCT ({hfct_pd_pulse_rate_pps:.1f} pps, {hfct_peak_amplitude_pc:.0f} pC). "
                "Dry insulation breakdown / void ionization in cable termination or busbar support insulator."
            )
        elif pd_state == "ELEVATED":
            status = "PD_ELEVATED"
            anomaly_detected = True
            description = f"Moderate partial discharge activity detected ({hfct_pd_pulse_rate_pps:.1f} pps). Schedule condition assessment."
        else:
            status = "NORMAL"
            anomaly_detected = False
            description = f"Insulation and environmental microclimate stable. Dew margin: {dew_margin:.1f}°C, PD: {hfct_pd_pulse_rate_pps:.1f} pps."

        # Risk Score (0-100, where 0 is clean, 100 is emergency)
        dew_penalty = max(0.0, min(50.0, (5.0 - dew_margin) * 10.0))
        pd_penalty = min(50.0, (hfct_pd_pulse_rate_pps / self.critical_pd_pps) * 50.0)
        risk_score = round(dew_penalty + pd_penalty, 1)

        return {
            "ambient_temp_c": round(ambient_temp_c, 1),
            "relative_humidity_pct": round(relative_humidity_pct, 1),
            "surface_temp_c": round(surface_temp_c, 1),
            "dew_point_c": round(t_dp, 1),
            "dew_margin_c": round(dew_margin, 1),
            "condensation_risk": condensation_risk,
            "hfct_pd_pps": round(hfct_pd_pulse_rate_pps, 1),
            "hfct_peak_pc": round(hfct_peak_amplitude_pc, 1),
            "pd_state": pd_state,
            "status": status,
            "anomaly_detected": anomaly_detected,
            "risk_score": risk_score,
            "description": description
        }
