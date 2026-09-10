"""
Multi-Modal Switchgear Asset Health Index (HI: 0 - 100%) Engine.
Synthesizes 2025/2026 IEEE P3835 & C37.21-2026 condition monitoring guidelines.

Combines four distinct physical domains into an operational health metric:
1. Thermal Contact Integrity (35% weight)
2. Dielectric / Partial Discharge State (25% weight)
3. Microclimate & Condensation Margin (20% weight)
4. Power Quality & Arc Readiness (20% weight)
"""

from typing import Dict, Any

class SwitchgearHealthIndex:
    def __init__(
        self,
        weight_thermal: float = 0.35,
        weight_insulation: float = 0.25,
        weight_env: float = 0.20,
        weight_electrical: float = 0.20
    ):
        self.w_th = weight_thermal
        self.w_ins = weight_insulation
        self.w_env = weight_env
        self.w_elec = weight_electrical

    def compute(
        self,
        thermal_eval: Dict[str, Any],
        dew_pd_eval: Dict[str, Any],
        arc_eval: Dict[str, Any],
        thd_current_pct: float = 2.5,
        phase_unbalance_pct: float = 1.8
    ) -> Dict[str, Any]:
        """
        Calculates unified health score and categorical operational status.
        """
        # 1. Thermal score (0 to 100)
        residual = max(0.0, thermal_eval.get("residual_delta_t", 0.0))
        # Normal residual < 5C -> 100 score; 25C residual -> 0 score
        s_thermal = max(0.0, min(100.0, 100.0 - (residual * 4.0)))

        # 2. Insulation / PD score (0 to 100)
        pd_pps = dew_pd_eval.get("hfct_pd_pps", 5.0)
        # Normal < 10 pps -> 100; 100 pps -> 0
        s_insulation = max(0.0, min(100.0, 100.0 - (pd_pps * 1.0)))

        # 3. Environmental / Dew Point score (0 to 100)
        dew_margin = dew_pd_eval.get("dew_margin_c", 10.0)
        # Margin >= 8C -> 100; Margin <= 0C -> 0
        s_env = max(0.0, min(100.0, dew_margin * 12.5))

        # 4. Power Quality & Arc readiness (0 to 100)
        s_elec = 100.0
        if arc_eval.get("arc_detected", False):
            s_elec = 0.0
        else:
            if thd_current_pct > 5.0:
                s_elec -= min(30.0, (thd_current_pct - 5.0) * 6.0)
            if phase_unbalance_pct > 5.0:
                s_elec -= min(20.0, (phase_unbalance_pct - 5.0) * 4.0)

        # Unified Weighted Health Index
        total_hi = (
            (self.w_th * s_thermal) +
            (self.w_ins * s_insulation) +
            (self.w_env * s_env) +
            (self.w_elec * s_elec)
        )
        total_hi = max(0.0, min(100.0, round(total_hi, 1)))

        # Status categorization
        if total_hi >= 85.0:
            status_label = "HEALTHY"
            color_code = "#10b981"  # Emerald Green
            action_recommendation = "Normal operation. All sensor domains within IEEE standard tolerances."
        elif total_hi >= 70.0:
            status_label = "ATTENTION"
            color_code = "#f59e0b"  # Amber
            action_recommendation = "Early drift detected in microclimate or contact resistance. Monitor trend."
        elif total_hi >= 45.0:
            status_label = "WARNING"
            color_code = "#f97316"  # Orange
            action_recommendation = "Degradation threshold reached. Dispatch field crew for thermal inspection & torking."
        else:
            status_label = "CRITICAL"
            color_code = "#ef4444"  # Red
            action_recommendation = "CRITICAL THREAT. High risk of arc fault / thermal runaway. Immediate intervention required."

        return {
            "health_index": total_hi,
            "status_label": status_label,
            "color_code": color_code,
            "action_recommendation": action_recommendation,
            "sub_scores": {
                "thermal_contact": round(s_thermal, 1),
                "insulation_pd": round(s_insulation, 1),
                "environmental_dew": round(s_env, 1),
                "electrical_quality": round(s_elec, 1)
            }
        }
