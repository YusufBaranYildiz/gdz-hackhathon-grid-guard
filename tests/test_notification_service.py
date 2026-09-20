import json
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.core.arc_protection import ArcProtectionEngine
from backend.core.dew_point_pd_fusion import DewPointPDFusion
from backend.core.health_index import SwitchgearHealthIndex
from backend.services.notification_service import NotificationService


class TestNotificationAndHealthContracts(unittest.TestCase):
    def test_simulated_notification_schema_and_restart_history(self):
        with tempfile.TemporaryDirectory() as directory:
            path = os.path.join(directory, "alerts.jsonl")
            clock = iter([100.0, 110.0, 200.0])
            service = NotificationService(history_path=path, clock=lambda: next(clock))
            record = service.dispatch_alert(
                severity="WARNING",
                anomaly_type="Test alarm",
                component_location="DSYA-04",
                metrics={"highlight_summary": "0°C test residual"},
                recommended_action="İncele",
            )
            self.assertIsNotNone(record)
            self.assertEqual(record["transport_mode"], "SIMULATED")
            self.assertEqual(record["delivery_status"], "SIMULATED_DELIVERY")
            self.assertFalse(record["delivered"])
            self.assertEqual(record["metrics"]["highlight_summary"], "0°C test residual")
            self.assertIsNone(service.dispatch_alert("WARNING", "Test alarm", "DSYA-04", {}, "İncele"))

            restored = NotificationService(history_path=path)
            self.assertEqual(restored.get_latest_alerts(1)[0]["id"], record["id"])
            with open(path, encoding="utf-8") as history_file:
                self.assertEqual(len([line for line in history_file if line.strip()]), 1)

    def test_latched_arc_is_critical_in_health_index(self):
        arc = ArcProtectionEngine()
        arc.evaluate_arc(True, instantaneous_current_amps=2000.0, nominal_current_amps=400.0)
        latched = arc.evaluate_arc(False, instantaneous_current_amps=0.0, nominal_current_amps=400.0)
        health = SwitchgearHealthIndex().compute(
            {"status": "NORMAL", "residual_delta_t": 0.0},
            DewPointPDFusion().evaluate(25.0, 50.0, 35.0, 5.0),
            latched,
        )
        self.assertEqual(health["sub_scores"]["electrical_quality"], 0.0)
        self.assertIn("ARC_LOCKOUT_ACTIVE", health["penalty_reasons"])
        self.assertEqual(health["status_label"], "CRITICAL")

    def test_invalid_health_weights_are_rejected(self):
        with self.assertRaises(ValueError):
            SwitchgearHealthIndex(weight_thermal=0.5, weight_insulation=0.5, weight_env=0.5, weight_electrical=0.5)


if __name__ == "__main__":
    unittest.main()
