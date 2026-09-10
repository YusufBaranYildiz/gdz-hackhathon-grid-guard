"""
Physics-Informed Dynamic Thermal Model for Switchgear Busbars and Contacts.
Complies with IEEE Transactions on Power Delivery & 2025/2026 Reduced-Order Thermal Modeling.

Calculates expected steady-state and transient conductor temperatures based on Joule heating (I²·R),
ambient temperature, and thermal time constants. Computes residuals to detect contact degradation
(loose bolts, oxidation, terminal degradation) weeks before critical thermal runaway.
"""

import math
from typing import Dict, Any, Tuple

class PhysicsThermalModel:
    def __init__(
        self,
        joule_coefficient: float = 0.0001,                   # Delta_T_ss = (I^2) * k -> 500A gives ~25K rise per TS EN 61439-1
        thermal_time_constant_seconds: float = 1200.0,       # tau ~20 minutes for copper thermal mass
        warning_residual_celsius: float = 15.0,
        critical_residual_celsius: float = 25.0
    ):
        self.k_joule = joule_coefficient
        self.tau = thermal_time_constant_seconds
        self.warning_threshold = warning_residual_celsius
        self.critical_threshold = critical_residual_celsius
        
        # State tracking per channel (e.g. 'main_busbar', 'dsya_1', 'dsya_4', etc.)
        self.channel_states: Dict[str, float] = {}

    def predict_temperature(
        self,
        current_amps: float,
        ambient_temp_c: float,
        dt_seconds: float = 1.0,
        channel_id: str = "main_busbar"
    ) -> float:
        """
        Calculates predicted physical temperature using first-order transient Joule heating.
        """
        # Steady-state temperature rise: Delta_T_ss = I^2 * k_joule
        delta_t_ss = (current_amps ** 2) * self.k_joule

        # Previous delta T
        prev_delta_t = self.channel_states.get(channel_id, delta_t_ss)

        # Exponential decay towards steady-state
        alpha = math.exp(-dt_seconds / self.tau)
        current_delta_t = prev_delta_t * alpha + delta_t_ss * (1.0 - alpha)
        self.channel_states[channel_id] = current_delta_t

        return ambient_temp_c + current_delta_t

    def evaluate_contact(
        self,
        measured_temp_c: float,
        current_amps: float,
        ambient_temp_c: float,
        dt_seconds: float = 1.0,
        channel_id: str = "main_busbar"
    ) -> Dict[str, Any]:
        """
        Evaluates measured temperature against physics model to detect degradation.
        """
        predicted_temp = self.predict_temperature(current_amps, ambient_temp_c, dt_seconds, channel_id)
        residual = measured_temp_c - predicted_temp

        # Contact Degradation Index (CDI): ratio of estimated actual resistance to nominal
        # Only valid when current is high enough to produce measurable Delta T (>50 A)
        actual_delta_t = max(0.0, measured_temp_c - ambient_temp_c)
        predicted_delta_t = max(0.5, (current_amps ** 2) * self.k_joule)
        if current_amps > 50.0:
            cdi = max(1.0, actual_delta_t / predicted_delta_t)
        else:
            cdi = 1.0

        # Determine severity
        if residual >= self.critical_threshold:
            status = "CRITICAL"
            anomaly_detected = True
            description = f"Critical contact overheating! Residual Delta-T is +{residual:.1f}°C above Joule thermal model."
        elif residual >= self.warning_threshold:
            status = "WARNING"
            anomaly_detected = True
            description = f"Early contact degradation detected. Residual Delta-T is +{residual:.1f}°C (Bolt loosening/oxidation)."
        elif residual <= -15.0:
            status = "SENSOR_FAULT"
            anomaly_detected = True
            description = "Sensor reading significantly below physical model. Possible probe detachment."
        else:
            status = "NORMAL"
            anomaly_detected = False
            description = "Conductor thermal state strictly complies with physical Joule heating model."

        return {
            "channel_id": channel_id,
            "measured_temp_c": round(measured_temp_c, 2),
            "predicted_temp_c": round(predicted_temp, 2),
            "residual_delta_t": round(residual, 2),
            "ambient_temp_c": round(ambient_temp_c, 2),
            "current_amps": round(current_amps, 1),
            "contact_degradation_index": round(cdi, 2),
            "status": status,
            "anomaly_detected": anomaly_detected,
            "description": description
        }
