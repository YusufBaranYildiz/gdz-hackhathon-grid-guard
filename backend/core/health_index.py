"""Multi-modal switchgear asset health index."""

from __future__ import annotations

import math
from typing import Any, Dict


class SwitchgearHealthIndex:
    def __init__(
        self,
        weight_thermal: float = 0.35,
        weight_insulation: float = 0.25,
        weight_env: float = 0.20,
        weight_electrical: float = 0.20,
    ):
        weights = [weight_thermal, weight_insulation, weight_env, weight_electrical]
        if any(not math.isfinite(weight) or weight < 0 for weight in weights):
            raise ValueError("Health index weights must be finite and non-negative")
        if not math.isclose(sum(weights), 1.0, rel_tol=1e-6, abs_tol=1e-6):
            raise ValueError("Health index weights must sum to 1.0")
        self.w_th, self.w_ins, self.w_env, self.w_elec = weights

    @staticmethod
    def _number(value: Any, default: float) -> tuple[float, bool]:
        if isinstance(value, (int, float)) and math.isfinite(value):
            return float(value), True
        return default, False

    def compute(
        self,
        thermal_eval: Dict[str, Any],
        dew_pd_eval: Dict[str, Any],
        arc_eval: Dict[str, Any],
        thd_current_pct: float = 2.5,
        phase_unbalance_pct: float = 1.8,
    ) -> Dict[str, Any]:
        penalty_reasons = []
        data_quality = []

        thermal_status = thermal_eval.get("status", "NORMAL")
        residual, residual_valid = self._number(thermal_eval.get("residual_delta_t"), 0.0)
        if not residual_valid:
            data_quality.append("THERMAL_RESIDUAL_MISSING")
        if thermal_status == "SENSOR_FAULT" or thermal_eval.get("sensor_fault"):
            s_thermal = 20.0
            penalty_reasons.append("THERMAL_SENSOR_FAULT")
        else:
            s_thermal = max(0.0, min(100.0, 100.0 - max(0.0, residual) * 4.0))
            cdi, cdi_valid = self._number(thermal_eval.get("contact_degradation_index"), 1.0)
            if not cdi_valid:
                data_quality.append("THERMAL_CDI_MISSING")
            elif residual >= 30.0 or (residual >= 15.0 and cdi >= 2.5):
                s_thermal = min(s_thermal, 15.0)
                penalty_reasons.append("CRITICAL_CONTACT_DEGRADATION")
            elif residual >= 15.0 or (residual >= 5.0 and cdi >= 1.8):
                s_thermal = min(s_thermal, 55.0)
                penalty_reasons.append("EARLY_CONTACT_DEGRADATION")

        pd_pps, pps_valid = self._number(dew_pd_eval.get("hfct_pd_pps"), 0.0)
        pd_peak, peak_valid = self._number(dew_pd_eval.get("hfct_peak_pc"), 0.0)
        if not pps_valid:
            data_quality.append("PD_RATE_MISSING")
        if not peak_valid:
            data_quality.append("PD_PEAK_MISSING")
        rate_score = 100.0 - max(0.0, pd_pps) * 1.0
        peak_score = 100.0 - max(0.0, pd_peak - 35.0) * 0.35
        s_insulation = max(0.0, min(100.0, min(rate_score, peak_score)))
        if dew_pd_eval.get("pd_state") == "CRITICAL":
            s_insulation = min(s_insulation, 20.0)
            penalty_reasons.append("CRITICAL_PARTIAL_DISCHARGE")
        elif dew_pd_eval.get("pd_state") == "ELEVATED":
            penalty_reasons.append("ELEVATED_PARTIAL_DISCHARGE")

        dew_margin, dew_valid = self._number(dew_pd_eval.get("dew_margin_c"), 0.0)
        if not dew_valid:
            data_quality.append("DEW_MARGIN_MISSING")
        s_env = max(0.0, min(100.0, max(0.0, dew_margin) * 12.5))
        if dew_pd_eval.get("condensation_risk") in {"CONDENSATION_ACTIVE", "HIGH_RISK"}:
            penalty_reasons.append("CONDENSATION_RISK")

        arc_latched = bool(
            arc_eval.get("latched")
            or arc_eval.get("trip_executed")
            or arc_eval.get("system_state") == 2
            or arc_eval.get("active_fault")
        )
        s_elec = 0.0 if arc_latched else 100.0
        if arc_latched:
            penalty_reasons.append("ARC_LOCKOUT_ACTIVE")
        thd, thd_valid = self._number(thd_current_pct, 0.0)
        unbalance, unbalance_valid = self._number(phase_unbalance_pct, 0.0)
        if not thd_valid:
            data_quality.append("THD_MISSING")
        if not unbalance_valid:
            data_quality.append("PHASE_UNBALANCE_MISSING")
        if not arc_latched:
            if thd > 5.0:
                s_elec -= min(30.0, (thd - 5.0) * 6.0)
                penalty_reasons.append("HIGH_CURRENT_THD")
            if unbalance > 5.0:
                s_elec -= min(20.0, (unbalance - 5.0) * 4.0)
                penalty_reasons.append("PHASE_UNBALANCE")
        s_elec = max(0.0, min(100.0, s_elec))

        if arc_latched:
            total_hi = 0.0
            status_label, color_code = "CRITICAL", "#ee6670"
            action = "Ark patlaması nedeniyle TVOC-2 ana şalteri açtırmıştır. Pano enerjisiz ve servis dışıdır (AÇTIRILDI / KİLİTLİ)."
        else:
            total_hi = round(
                max(0.0, min(100.0, self.w_th * s_thermal + self.w_ins * s_insulation + self.w_env * s_env + self.w_elec * s_elec)),
                1,
            )
            if total_hi >= 85.0:
                status_label, color_code = "HEALTHY", "#00e5ff"
                action = "Normal operation. All available sensor domains are within expected tolerances."
            elif total_hi >= 70.0:
                status_label, color_code = "ATTENTION", "#f59e0b"
                action = "Early drift detected. Continue monitoring and schedule a condition assessment."
            elif total_hi >= 45.0:
                status_label, color_code = "WARNING", "#f97316"
                action = "Degradation threshold reached. Dispatch a field crew for inspection."
            else:
                status_label, color_code = "CRITICAL", "#ef4444"
                action = "Critical threat. Immediate operational intervention is required."

        return {
            "health_index": total_hi,
            "status_label": status_label,
            "color_code": color_code,
            "action_recommendation": action,
            "sub_scores": {
                "thermal_contact": round(s_thermal, 1),
                "insulation_pd": round(s_insulation, 1),
                "environmental_dew": round(s_env, 1),
                "electrical_quality": round(s_elec, 1),
            },
            "penalty_reasons": penalty_reasons,
            "data_quality": data_quality,
        }
