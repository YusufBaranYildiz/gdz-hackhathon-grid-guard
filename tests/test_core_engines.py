"""
Unit tests for Physics Thermal Model, Dew Point & PD Fusion, and Modbus Simulator.
"""

import unittest
import os
import sys

# Add project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from backend.core.physics_thermal_model import PhysicsThermalModel
from backend.core.dew_point_pd_fusion import DewPointPDFusion
from backend.core.arc_protection import ArcProtectionEngine
from backend.core.health_index import SwitchgearHealthIndex
from backend.simulator.modbus_simulator import ModbusPanoSimulator

class TestCoreEngines(unittest.TestCase):
    def setUp(self):
        self.thermal_model = PhysicsThermalModel()
        self.dew_pd = DewPointPDFusion()
        self.arc_engine = ArcProtectionEngine()
        self.health_engine = SwitchgearHealthIndex()
        
        excel_path = os.path.abspath(os.path.join(
            os.path.dirname(__file__), '..', 'data', 'Hackathon Verileri', 'İstenen Veriler.xlsx'
        ))
        self.simulator = ModbusPanoSimulator(excel_path)

    def test_thermal_model_normal(self):
        """Under nominal current and ambient, residual Delta-T should be close to 0."""
        # 300A at 25C ambient on a 2309A double busbar produces ~0.3K rise
        res = self.thermal_model.evaluate_contact(
            measured_temp_c=26.0,
            current_amps=300.0,
            ambient_temp_c=25.0,
            dt_seconds=1200.0,
            channel_id="test_busbar"
        )
        self.assertFalse(res["anomaly_detected"])
        self.assertEqual(res["status"], "NORMAL")
        self.assertLess(abs(res["residual_delta_t"]), 5.0)

    def test_thermal_model_loose_bolt(self):
        """When measured temp spikes without current change, residual must trigger CRITICAL/WARNING."""
        # Current is only 200A, but measured temp is 85C at 25C ambient
        res = self.thermal_model.evaluate_contact(
            measured_temp_c=85.0,
            current_amps=200.0,
            ambient_temp_c=25.0,
            dt_seconds=1200.0,
            channel_id="test_loose_terminal"
        )
        self.assertTrue(res["anomaly_detected"])
        self.assertIn(res["status"], ["WARNING", "CRITICAL"])
        self.assertGreater(res["residual_delta_t"], 15.0)
        self.assertGreater(res["contact_degradation_index"], 1.5)

    def test_dew_point_calculation(self):
        """Magnus formula calculation check."""
        # At 20°C and 50% RH, dew point is ~9.3°C
        dp = self.dew_pd.calculate_dew_point(ambient_temp_c=20.0, relative_humidity_pct=50.0)
        self.assertAlmostEqual(dp, 9.3, delta=0.5)

    def test_condensation_pd_fusion(self):
        """When surface temperature nears dew point and PD pulses spike, danger must be detected."""
        res = self.dew_pd.evaluate(
            ambient_temp_c=18.0,
            relative_humidity_pct=92.0,
            surface_temp_c=17.5,
            hfct_pd_pulse_rate_pps=85.0,
            hfct_peak_amplitude_pc=300.0
        )
        self.assertTrue(res["anomaly_detected"])
        self.assertIn(res["status"], ["CRITICAL_FLASHOVER_RISK", "CONDENSATION_WARNING"])
        self.assertLessEqual(res["dew_margin_c"], 3.0)

    def test_arc_protection_dual_criteria(self):
        """Arc protection requires both optical flash AND current surge."""
        # Optical flash ONLY (false alarm suppression)
        res1 = self.arc_engine.evaluate_arc(
            optical_flash_detected=True,
            instantaneous_current_amps=250.0,
            nominal_current_amps=300.0
        )
        self.assertFalse(res1["trip_executed"])
        self.assertTrue(res1.get("ambient_light_warning", False))

        # Optical flash + Massive current surge (>1.8x)
        res2 = self.arc_engine.evaluate_arc(
            optical_flash_detected=True,
            instantaneous_current_amps=3200.0,
            nominal_current_amps=400.0,
            di_dt_amps_per_ms=1200.0
        )
        self.assertTrue(res2["trip_executed"])
        self.assertEqual(res2["system_state"], 2)  # Tripped state in TVOC-2

    def test_simulator_and_modbus_registers(self):
        """Modbus simulator step and register generation."""
        telemetry = self.simulator.step()
        self.assertIn("electrical", telemetry)
        self.assertIn("thermal", telemetry)
        self.assertIn("environmental_pd", telemetry)
        
        # Check MPR-53CS registers
        regs = self.simulator.mpr53cs_registers
        self.assertIn(0, regs)  # V_L1
        self.assertIn(6, regs)  # I_L1
        self.assertIn(58, regs) # Frequency
        self.assertEqual(regs[32769], 500) # CT Ratio 500

        # Check TVOC-2 registers
        tvoc_regs = self.simulator.tvoc2_registers
        self.assertIn(149, tvoc_regs) # Trips count
        self.assertIn(1300, tvoc_regs) # System state

if __name__ == '__main__':
    unittest.main()
