"""
Comprehensive tests for FleetManager and FastAPI REST Endpoints.
Verifies full data flow, calculation contracts, and API responses.
"""

import unittest
import os
import sys

# Add project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from fastapi.testclient import TestClient
from backend.main import app
from backend.core.fleet_manager import FleetManager


class TestFleetManager(unittest.TestCase):
    def setUp(self):
        self.fm = FleetManager(total_panels=100)

    def test_fleet_initialization(self):
        """Fleet manager must initialize exactly 100 panels with valid attributes."""
        panels = self.fm.get_all_panels()
        self.assertEqual(len(panels), 100)
        
        # Panel #1 must be the active digital twin
        p1 = panels[0]
        self.assertEqual(p1["id"], 1)
        self.assertTrue(p1["is_active_twin"])
        self.assertEqual(p1["transformer_kva"], 1600)
        self.assertIn(p1["region"], ["GDZ", "ADM"])

        # All panels must have valid health indices and temperature ratings
        for p in panels:
            self.assertGreaterEqual(p["health_index"], 0.0)
            self.assertLessEqual(p["health_index"], 100.0)
            self.assertEqual(p["transformer_kva"], 1600)
            self.assertEqual(p["feeder_count"], 12)
            self.assertIn(p["region"], ["GDZ", "ADM"])
            self.assertIn(p["status"], ["OPTIMAL", "ATTENTION", "WARNING", "CRITICAL"])

    def test_get_panel_lookup_formats(self):
        """Panels should be retrievable by integer, formatted string, or raw ID."""
        p_int = self.fm.get_panel(17)
        self.assertIsNotNone(p_int)
        self.assertEqual(p_int["id"], 17)

        p_str = self.fm.get_panel("PANO-017")
        self.assertIsNotNone(p_str)
        self.assertEqual(p_str["id"], 17)

        p_hash = self.fm.get_panel("#17")
        self.assertIsNotNone(p_hash)
        self.assertEqual(p_hash["id"], 17)

        p_invalid = self.fm.get_panel(999)
        self.assertIsNone(p_invalid)

    def test_update_primary_panel(self):
        """Primary panel state must update seamlessly based on active scenario."""
        self.fm.update_primary_panel(
            active_scenario="LOOSE_BOLT",
            health_index=62.5,
            active_alarms=1,
            temp_c=58.2,
            residual_c=22.4
        )
        p1 = self.fm.get_panel(1)
        self.assertEqual(p1["health_index"], 62.5)
        self.assertEqual(p1["temp_c"], 58.2)
        self.assertEqual(p1["residual_dt_c"], 22.4)
        self.assertEqual(p1["status"], "CRITICAL")
        self.assertIn("Gevsekligi", p1["anomaly_detail"])

        # Return to NORMAL
        self.fm.update_primary_panel(
            active_scenario="NORMAL",
            health_index=98.0,
            active_alarms=0,
            temp_c=36.0,
            residual_c=1.0
        )
        p1 = self.fm.get_panel(1)
        self.assertEqual(p1["status"], "OPTIMAL")
        self.assertEqual(p1["active_alarms"], 0)


class TestFastAPIEndpoints(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_api_status(self):
        """System status endpoint must return HEALTHY and ON_PREMISE configuration."""
        res = self.client.get("/api/status")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["system_status"], "HEALTHY")
        self.assertEqual(data["cloud_dependency"], "NONE (100% On-Premise / Edge-Native)")

    def test_api_telemetry(self):
        """Telemetry endpoint must return complete physical and sensor telemetry."""
        res = self.client.get("/api/telemetry")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("electrical", data)
        self.assertIn("thermal", data)
        self.assertIn("environmental_pd", data)
        self.assertIn("optical_arc", data)
        self.assertIn("health_index", data)
        self.assertIn("mpr53cs_registers", data)
        self.assertIn("tvoc2_registers", data)
        self.assertIn("fleet_summary", data)

        # Check CT ratio and frequency in Modbus snapshot
        mb = data["mpr53cs_registers"]
        self.assertEqual(mb.get("32769", mb.get(32769)), 500)
        self.assertAlmostEqual(data["electrical"]["frequency"], 50.0, delta=0.5)

    def test_api_history(self):
        """Telemetry history endpoint must return a list of historical records."""
        res = self.client.get("/api/history")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIsInstance(data, list)

    def test_api_fleet_and_detail(self):
        """Fleet overview and single panel endpoints."""
        res = self.client.get("/api/fleet")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["summary"]["total_panels"], 100)
        self.assertIn("summary", data)
        self.assertEqual(len(data["panels"]), 100)

        # Detail of panel 1
        res_p1 = self.client.get("/api/fleet/1")
        self.assertEqual(res_p1.status_code, 200)
        self.assertEqual(res_p1.json()["id"], 1)

        # Detail of panel 42
        res_p42 = self.client.get("/api/fleet/42")
        self.assertEqual(res_p42.status_code, 200)
        self.assertEqual(res_p42.json()["id"], 42)

    def test_scenario_switching_and_arc_reset(self):
        """Scenario switching cycle must execute without error."""
        scenarios = ["NORMAL", "LOOSE_BOLT", "CONDENSATION_PD", "ARC_FLASH", "NORMAL"]
        for s in scenarios:
            res = self.client.post(f"/api/scenario/{s}")
            self.assertEqual(res.status_code, 200)
            self.assertEqual(res.json()["status"], "SUCCESS")
            self.assertEqual(res.json()["active_scenario"], s)

        # Test Arc Trip Reset
        res_reset = self.client.post("/api/arc/reset")
        self.assertEqual(res_reset.status_code, 200)
        self.assertEqual(res_reset.json()["status"], "SUCCESS")

    def test_api_reports_and_alerts(self):
        """Reports and alert logs endpoints."""
        res_rep = self.client.get("/api/reports/latest")
        self.assertEqual(res_rep.status_code, 200)
        self.assertIn("report_id", res_rep.json())

        res_test_alr = self.client.post("/api/alerts/test")
        self.assertEqual(res_test_alr.status_code, 200)
        self.assertEqual(res_test_alr.json()["status"], "ALERT_SENT")

        res_alrs = self.client.get("/api/alerts")
        self.assertEqual(res_alrs.status_code, 200)
        self.assertIsInstance(res_alrs.json(), list)


if __name__ == "__main__":
    unittest.main()
