"""
Consolidated Modbus RTU Simulator for ENTES MPR-53CS & ABB TVOC-2.
Replays real synthetic current telemetry from 'İstenen Veriler.xlsx' and simulates
exact Modbus register tables, sensor states, and realistic fault injection scenarios.
"""

import os
import openpyxl
import math
import random
from typing import Dict, Any, List

class ModbusPanoSimulator:
    def __init__(self, excel_path: str):
        self.excel_path = excel_path
        self.synthetic_currents: List[float] = []
        self._load_excel_currents()
        
        self.current_step_idx: int = 0
        self.active_scenario: str = "NORMAL"  # NORMAL, LOOSE_BOLT, CONDENSATION_PD, ARC_FLASH
        
        # Environmental base conditions (typical Aegean coast - Izmir/Aydin)
        self.ambient_temp_c: float = 27.5
        self.relative_humidity_pct: float = 48.0
        
        # 12 DSYA Feeder states (currents, measured surface temps, switch status)
        self.feeders: List[Dict[str, Any]] = []
        for i in range(1, 13):
            self.feeders.append({
                "id": f"DSYA-{i:02d}",
                "name": f"Çıkış Kolu {i} ({'250A Boy-1' if i <= 6 else '400A Boy-2'})",
                "is_active": True if i <= 10 else False,  # 11 and 12 are Spares (Yedek)
                "fuse_size": "250A" if i <= 6 else "400A",
                "current_amps": 0.0,
                "surface_temp_c": 30.0,
                "contact_status": "OK"
            })
            
        # Register maps
        self.mpr53cs_registers: Dict[int, int] = {}
        self.tvoc2_registers: Dict[int, int] = {}

    def _load_excel_currents(self):
        """
        Loads L1 synthetic current data from 'İstenen Veriler.xlsx'.
        Row formula: Primary Amps = Sekonder_mA * (600000/100) / 1000 = mA * 6
        """
        try:
            if os.path.exists(self.excel_path):
                wb = openpyxl.load_workbook(self.excel_path, data_only=True)
                ws = wb["Akım Sensörü"]
                for r in range(7, ws.max_row + 1):
                    val = ws.cell(r, 2).value
                    if val is not None and isinstance(val, (int, float)):
                        primary_a = float(val) * 6.0
                        self.synthetic_currents.append(primary_a)
        except Exception as e:
            print(f"Warning: Could not load Excel data: {e}")
            
        # Fallback if file missing or empty
        if not self.synthetic_currents:
            self.synthetic_currents = [180.0, 240.0, 310.0, 420.0, 490.0, 380.0, 260.0, 210.0]

    def set_scenario(self, scenario_name: str) -> str:
        valid_scenarios = ["NORMAL", "LOOSE_BOLT", "CONDENSATION_PD", "ARC_FLASH"]
        if scenario_name in valid_scenarios:
            self.active_scenario = scenario_name
        return self.active_scenario

    def step(self) -> Dict[str, Any]:
        """
        Advances the simulation by 1 time step, updates physics and Modbus registers.
        """
        # 1. Fetch baseline L1 current from Excel cyclical stream
        base_l1_current = self.synthetic_currents[self.current_step_idx % len(self.synthetic_currents)]
        self.current_step_idx += 1

        # Synthesize 3-Phase currents with minor realistic unbalance & noise
        jitter = random.uniform(-2.5, 2.5)
        i_l1 = max(10.0, base_l1_current + jitter)
        i_l2 = max(10.0, i_l1 * random.uniform(0.95, 0.99))
        i_l3 = max(10.0, i_l1 * random.uniform(1.01, 1.04))
        i_neutral = round(abs((i_l1 + i_l2 + i_l3) / 3.0 - i_l2) * 0.4, 1)

        # 2. Environmental dynamics
        ambient_temp = self.ambient_temp_c + random.uniform(-0.3, 0.3)
        relative_humidity = self.relative_humidity_pct + random.uniform(-0.5, 0.5)

        # Techimp HFCT partial discharge baseline (low pps in normal operation)
        hfct_pps = random.uniform(3.0, 7.0)
        hfct_peak_pc = random.uniform(25.0, 40.0)

        # Optical Arc flag
        optical_flash = False
        triggered_sensor = None
        di_dt = 15.0

        # Normal busbar surface temperature baseline (Joule heat)
        # 2x(100x10mm) busbar at ~400A warms approx 15-22°C above ambient
        busbar_normal_rise = ((i_l1 / 500.0) ** 2) * 22.0
        main_busbar_temp = ambient_temp + busbar_normal_rise + random.uniform(-0.5, 0.5)

        # Distribute currents to active DSYA feeders
        active_feeders = [f for f in self.feeders if f["is_active"]]
        load_per_feeder = i_l1 / len(active_feeders)
        for f in self.feeders:
            if f["is_active"]:
                f["current_amps"] = round(load_per_feeder * random.uniform(0.85, 1.15), 1)
                feeder_rise = ((f["current_amps"] / 250.0) ** 2) * 25.0
                f["surface_temp_c"] = round(ambient_temp + feeder_rise + random.uniform(-0.4, 0.4), 1)
                f["contact_status"] = "OK"
            else:
                f["current_amps"] = 0.0
                f["surface_temp_c"] = round(ambient_temp + random.uniform(0.0, 1.5), 1)
                f["contact_status"] = "SPARE"

        # 3. Apply Scenario Mutations
        anomaly_flag = False
        scenario_description = "Normal operating cycle. All parameters healthy."

        if self.active_scenario == "LOOSE_BOLT":
            # DSYA-04 loose terminal bolt: Contact resistance spikes, creating severe local Delta-T
            target_feeder = self.feeders[3]  # DSYA-04
            target_feeder["surface_temp_c"] = round(ambient_temp + 58.5 + random.uniform(-1.0, 1.0), 1)  # ~86°C!
            target_feeder["contact_status"] = "OVERHEATING"
            main_busbar_temp += 12.0
            anomaly_flag = True
            scenario_description = "ANOMALY: High contact resistance at DSYA-04 terminal! Thermal runaway detected."

        elif self.active_scenario == "CONDENSATION_PD":
            # Nighttime condensation wave: Relative humidity surges to 93%, dew point collapses margin
            relative_humidity = 93.5 + random.uniform(-0.5, 0.5)
            ambient_temp = 17.5
            main_busbar_temp = 18.2  # Cold busbar near ambient
            # HFCT Partial discharge pulses avalanche due to microscopic moisture film on insulators
            hfct_pps = random.uniform(78.0, 115.0)
            hfct_peak_pc = random.uniform(260.0, 380.0)
            anomaly_flag = True
            scenario_description = "ANOMALY: High condensation and severe HFCT Partial Discharge (PD) avalanche!"

        elif self.active_scenario == "ARC_FLASH":
            # Catastrophic optical arc in DSYA-04 compartment
            optical_flash = True
            triggered_sensor = "X2:2"  # DSYA-04 compartment
            i_l1 = 3450.0  # Massive arc fault current
            di_dt = 1850.0  # di/dt spike
            anomaly_flag = True
            scenario_description = "CRITICAL: Internal Arc Flash ignition detected! Sub-millisecond clearing initiated."

        # 4. Update ENTES MPR-53CS Modbus RTU Registers (Function 03)
        # Voltages
        v_l1 = 230.2 + random.uniform(-0.8, 0.8)
        v_l2 = 229.7 + random.uniform(-0.8, 0.8)
        v_l3 = 231.1 + random.uniform(-0.8, 0.8)
        
        self.mpr53cs_registers[0] = int(v_l1 * 10)     # L1 Phase Voltage (0.1V)
        self.mpr53cs_registers[2] = int(v_l2 * 10)     # L2 Phase Voltage
        self.mpr53cs_registers[4] = int(v_l3 * 10)     # L3 Phase Voltage
        self.mpr53cs_registers[6] = int(i_l1)          # L1 Current (0.001A x CT)
        self.mpr53cs_registers[8] = int(i_l2)          # L2 Current
        self.mpr53cs_registers[10] = int(i_l3)         # L3 Current
        self.mpr53cs_registers[12] = int(i_neutral)    # Neutral Current
        self.mpr53cs_registers[14] = int(399.1 * 10)   # L1-L2 Phase-Phase Voltage
        self.mpr53cs_registers[16] = int(400.4 * 10)   # L2-L3 Phase-Phase Voltage
        self.mpr53cs_registers[18] = int(398.8 * 10)   # L3-L1 Phase-Phase Voltage
        self.mpr53cs_registers[38] = 965               # Cos Phi L1 (0.965)
        self.mpr53cs_registers[40] = 971               # Cos Phi L2
        self.mpr53cs_registers[42] = 958               # Cos Phi L3
        self.mpr53cs_registers[58] = 5002              # Frequency (50.02 Hz)
        self.mpr53cs_registers[72] = 14                # THD-V1 (1.4%)
        self.mpr53cs_registers[78] = 26                # THD-I1 (2.6%)
        self.mpr53cs_registers[32768] = 1              # VT Ratio
        self.mpr53cs_registers[32769] = 500            # CT Ratio (2500/5 = 500)

        # 5. Update ABB TVOC-2 Registers
        self.tvoc2_registers[149] = 1 if self.active_scenario == "ARC_FLASH" else 0  # Number of trips
        self.tvoc2_registers[1300] = 2 if self.active_scenario == "ARC_FLASH" else 0  # 2: Tripped, 0: Normal
        self.tvoc2_registers[100] = 0x0004 if self.active_scenario == "ARC_FLASH" else 0x0000  # X2:2 bit
        self.tvoc2_registers[500] = 0x000E  # Installed modules (Internal HMI + X2 + X3)

        return {
            "step_index": self.current_step_idx,
            "scenario": self.active_scenario,
            "scenario_description": scenario_description,
            "anomaly_flag": anomaly_flag,
            "electrical": {
                "current_l1": round(i_l1, 1),
                "current_l2": round(i_l2, 1),
                "current_l3": round(i_l3, 1),
                "current_neutral": round(i_neutral, 1),
                "voltage_l1": round(v_l1, 1),
                "voltage_l2": round(v_l2, 1),
                "voltage_l3": round(v_l3, 1),
                "frequency": 50.02,
                "power_factor": 0.965,
                "thd_current": 2.6,
                "thd_voltage": 1.4,
                "di_dt": di_dt
            },
            "thermal": {
                "ambient_temp_c": round(ambient_temp, 1),
                "main_busbar_temp_c": round(main_busbar_temp, 1),
                "dsya_feeders": self.feeders
            },
            "environmental_pd": {
                "relative_humidity_pct": round(relative_humidity, 1),
                "hfct_pd_pps": round(hfct_pps, 1),
                "hfct_peak_pc": round(hfct_peak_pc, 1)
            },
            "optical_arc": {
                "optical_flash": optical_flash,
                "triggered_sensor": triggered_sensor
            }
        }
