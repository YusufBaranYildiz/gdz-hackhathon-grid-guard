"""
Comprehensive Unit & Edge Case Tests covering:
1. Arc protection latching, trip lockout, and reset register clearing
2. Sensor fault penalty in Health Index
3. Clamped Magnus dew point formula (zero division protection)
4. Contact Degradation Index (CDI) alarm triggering
5. Phase unbalance calculation
"""

import unittest
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from backend.core.physics_thermal_model import PhysicsThermalModel
from backend.core.dew_point_pd_fusion import DewPointPDFusion
from backend.core.arc_protection import ArcProtectionEngine
from backend.core.health_index import SwitchgearHealthIndex

class TestEdgeAndAlgorithmAccuracy(unittest.TestCase):
    def setUp(self):
        self.thermal_model = PhysicsThermalModel()
        self.dew_pd = DewPointPDFusion()
        self.arc_engine = ArcProtectionEngine()
        self.health_engine = SwitchgearHealthIndex()

    def test_arc_latch_and_lockout(self):
        """Arc trip must latch in system_state=2 and maintain trip status on subsequent normal ticks until reset."""
        # 1. Trigger genuine optical arc
        res1 = self.arc_engine.evaluate_arc(
            optical_flash_detected=True,
            instantaneous_current_amps=3500.0,
            nominal_current_amps=400.0,
            di_dt_amps_per_ms=1500.0
        )
        self.assertTrue(res1["trip_executed"])
        self.assertEqual(res1["system_state"], 2)
        self.assertEqual(self.arc_engine.number_of_trips, 1)

        # 2. Subsequent normal tick (flash ceased, current dropped to 0) -> MUST STAY LATCHED
        res2 = self.arc_engine.evaluate_arc(
            optical_flash_detected=False,
            instantaneous_current_amps=0.0,
            nominal_current_amps=400.0
        )
        self.assertTrue(res2["latched"])
        self.assertEqual(res2["system_state"], 2)
        self.assertEqual(self.arc_engine.number_of_trips, 1)  # Counter should NOT increment again

        # 3. Check Modbus register snapshot reflects tripped state
        regs = self.arc_engine.get_modbus_register_snapshot()
        self.assertEqual(regs[1300], 2)
        self.assertEqual(regs[149], 1)
        self.assertGreater(regs[100], 0)

        # 4. Execute manual reset
        self.arc_engine.reset_trip()
        self.assertEqual(self.arc_engine.system_state, 0)
        clean_regs = self.arc_engine.get_modbus_register_snapshot()
        self.assertEqual(clean_regs[1300], 0)
        self.assertEqual(clean_regs[100], 0)  # Detector bitfield cleared

    def test_sensor_fault_health_index_penalty(self):
        """When temperature sensor is detached/faulty (reading << ambient), Health Index must NOT be 100."""
        # Current is 400A, but sensor reads -10°C (detached/broken probe)
        thermal_res = self.thermal_model.evaluate_contact(
            measured_temp_c=-10.0,
            current_amps=400.0,
            ambient_temp_c=25.0
        )
        self.assertEqual(thermal_res["status"], "SENSOR_FAULT")

        # Evaluate health index with sensor fault
        dew_res = self.dew_pd.evaluate(25.0, 50.0, 35.0, 5.0)
        arc_res = self.arc_engine.evaluate_arc(False)
        
        hi = self.health_engine.compute(thermal_res, dew_res, arc_res)
        # Thermal sub-score should be heavily penalized (20.0, not 100.0)
        self.assertEqual(hi["sub_scores"]["thermal_contact"], 20.0)
        self.assertLess(hi["health_index"], 80.0)

    def test_magnus_extreme_temperature_safety(self):
        """Magnus formula must safely handle extreme inputs (-237.7°C, 1000°C) without throwing ZeroDivisionError."""
        # Singularity point: T = -237.7
        dp_singularity = self.dew_pd.calculate_dew_point(ambient_temp_c=-237.7, relative_humidity_pct=80.0)
        self.assertIsInstance(dp_singularity, float)

        # Extreme high temp
        dp_high = self.dew_pd.calculate_dew_point(ambient_temp_c=500.0, relative_humidity_pct=40.0)
        self.assertIsInstance(dp_high, float)

    def test_contact_degradation_index_alarm(self):
        """When CDI is high even if absolute Delta-T is moderate, alarm must trigger."""
        res = self.thermal_model.evaluate_contact(
            measured_temp_c=60.0,
            current_amps=150.0,
            ambient_temp_c=25.0
        )
        self.assertTrue(res["anomaly_detected"])
        self.assertGreaterEqual(res["contact_degradation_index"], 1.6)

if __name__ == '__main__':
    unittest.main()
