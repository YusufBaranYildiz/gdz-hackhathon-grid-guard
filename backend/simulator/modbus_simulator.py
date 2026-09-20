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

        # Physical Thermal Inertia states (Copper 2x100x10mm busbar mass & feeders low-pass filter)
        self.smooth_main_busbar_temp: float = 36.2
        self.smooth_feeder_temps: Dict[int, float] = {}

    def _load_excel_currents(self):
        """
        Loads L1 synthetic current data from 'İstenen Veriler.xlsx'.
        Row formula: Primary Amps = Sekonder_mA * (600000/100) / 1000 = mA * 6
        """
        import unicodedata
        try:
            excel_target = self.excel_path
            if not os.path.exists(excel_target):
                parent = os.path.dirname(excel_target)
                if os.path.isdir(parent):
                    for f in os.listdir(parent):
                        if f.endswith(".xlsx") and "stenen" in unicodedata.normalize("NFC", f):
                            excel_target = os.path.join(parent, f)
                            break

            if os.path.exists(excel_target):
                wb = openpyxl.load_workbook(excel_target, data_only=True)
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
            if scenario_name == "NORMAL":
                # Immediately reset ABB TVOC-2 Modbus registers to clean supervisory state
                self.tvoc2_registers[149] = 0
                self.tvoc2_registers[1300] = 0
                self.tvoc2_registers[100] = 0
                self.tvoc2_registers[101] = 0
                self.tvoc2_registers[102] = 0
                self.tvoc2_registers[1000] = 1
                # Reset thermal smoothing baseline to avoid stale transient lag
                self.smooth_main_busbar_temp = self.ambient_temp_c + 0.35
                self.smooth_feeder_temps.clear()
        return self.active_scenario

    def step(self) -> Dict[str, Any]:
        """
        Advances the simulation by 1 time step, updates physics and Modbus registers.
        Strictly satisfies Kirchhoff's Current Law: Sum(I_feeders) == I_incomer (L1).
        """
        # 1. Fetch baseline L1 current from Excel cyclical stream (~320A - 380A in Aegean normal operation)
        base_l1_current = self.synthetic_currents[self.current_step_idx % len(self.synthetic_currents)]
        self.current_step_idx += 1

        # Synthesize 3-Phase currents with minor realistic unbalance & noise
        jitter = random.uniform(-2.0, 2.0)
        i_l1 = max(50.0, base_l1_current + jitter)
        i_l2 = max(50.0, i_l1 * random.uniform(0.97, 0.99))
        i_l3 = max(50.0, i_l1 * random.uniform(1.01, 1.03))
        i_neutral = round(abs((i_l1 + i_l2 + i_l3) / 3.0 - i_l2) * 0.4, 1)

        # 2. Environmental dynamics
        ambient_temp = self.ambient_temp_c + random.uniform(-0.1, 0.1)
        relative_humidity = self.relative_humidity_pct + random.uniform(-0.3, 0.3)

        # Techimp HFCT partial discharge baseline (low pps in normal operation)
        hfct_pps = random.uniform(3.0, 6.0)
        hfct_peak_pc = random.uniform(25.0, 35.0)

        # Optical Arc flag
        optical_flash = False
        triggered_sensor = None
        di_dt = 15.0

        # Normal busbar surface temperature baseline (Normalized TS EN 61439-1 Joule Heating):
        # 1600 kVA (2309.4 A) copper double busbar has Delta_T = 14.0 K at full continuous load.
        target_busbar_rise = 14.0 * ((i_l1 / 2309.4) ** 2)
        target_busbar_temp = ambient_temp + target_busbar_rise
        self.smooth_main_busbar_temp += 0.1 * (target_busbar_temp - self.smooth_main_busbar_temp)
        main_busbar_temp = round(self.smooth_main_busbar_temp + random.uniform(-0.02, 0.02), 1)

        # 3. Apply Scenario Mutations
        anomaly_flag = False
        scenario_description = "Normal çalışma döngüsü. Tüm sensörler nominal sınırlarda."

        if self.active_scenario == "LOOSE_BOLT":
            # DSYA-04 loose terminal bolt: Contact resistance spikes, creating realistic Delta-T (+18°C to +22°C)
            anomaly_flag = True
            scenario_description = "ANOMALİ: DSYA-04 klemensinde yüksek kontak direnci! Termal aşırı ısınma tespit edildi."

        elif self.active_scenario == "CONDENSATION_PD":
            # Nighttime condensation wave: Relative humidity surges to 93%, dew point collapses margin
            relative_humidity = 93.5 + random.uniform(-0.5, 0.5)
            ambient_temp = 17.5
            main_busbar_temp = 18.2  # Cold busbar near ambient
            hfct_pps = random.uniform(78.0, 115.0)
            hfct_peak_pc = random.uniform(260.0, 380.0)
            anomaly_flag = True
            scenario_description = "ANOMALİ: Yüksek bağıl nem/yoğuşma riski ve şiddetli HFCT kısmi deşarj (PD) tespiti!"

        elif self.active_scenario == "ARC_FLASH":
            optical_flash = True
            triggered_sensor = "X2:2"  # DSYA-04 compartment
            i_l1 = 3450.0  # Massive arc fault current
            di_dt = 1850.0  # di/dt spike
            anomaly_flag = True
            scenario_description = "KRİTİK: Hücre içi optik ark flaş patlaması! Milisaniye altı açtırma tetiklendi."

        # 4. Kirchhoff's Current Law Distribution: Sum(I_feeders) == I_incomer (i_l1)
        if self.active_scenario == "ARC_FLASH":
            # Direct short-circuit arc path on Feeder 3 (DSYA-04); other branches carry 0 A
            for idx, f in enumerate(self.feeders):
                if idx == 3:
                    f["current_amps"] = round(i_l1, 1)
                    f["contact_status"] = "ARC_FAULT"
                    f["surface_temp_c"] = 82.5
                else:
                    f["current_amps"] = 0.0
                    f["contact_status"] = "OK" if f["is_active"] else "SPARE"
                    f["surface_temp_c"] = round(ambient_temp + 0.3, 1)
        else:
            active_feeders = [f for f in self.feeders if f["is_active"]]
            active_weights = [0.105, 0.098, 0.102, 0.095, 0.108, 0.097, 0.101, 0.096, 0.103, 0.095]
            w_sum = sum(active_weights)
            norm_weights = [w / w_sum for w in active_weights]
            
            allocated_amps = 0.0
            for i, f in enumerate(active_feeders):
                idx = int(f["id"].split("-")[-1]) - 1
                if i == len(active_feeders) - 1:
                    f_amps = round(i_l1 - allocated_amps, 1)
                else:
                    f_amps = round(i_l1 * norm_weights[i], 1)
                    allocated_amps += f_amps
                f["current_amps"] = f_amps

                # Physical feeder contact temperature calculation
                expected_feeder_rise = 18.0 * ((f["current_amps"] / 250.0) ** 2)
                target_feeder_temp = ambient_temp + expected_feeder_rise

                if self.active_scenario == "LOOSE_BOLT" and idx == 3:
                    # DSYA-04 has 150 µΩ loose connection producing +20°C Delta-T (Warning band: 15-30°C)
                    fault_target_temp = target_feeder_temp + 20.2
                    prev_temp = self.smooth_feeder_temps.get(idx, fault_target_temp)
                    curr_temp = prev_temp + 0.2 * (fault_target_temp - prev_temp)
                    self.smooth_feeder_temps[idx] = curr_temp
                    f["surface_temp_c"] = round(curr_temp + random.uniform(-0.03, 0.03), 1)
                    f["contact_status"] = "OVERHEATING"
                else:
                    prev_temp = self.smooth_feeder_temps.get(idx, target_feeder_temp)
                    curr_temp = prev_temp + 0.1 * (target_feeder_temp - prev_temp)
                    self.smooth_feeder_temps[idx] = curr_temp
                    f["surface_temp_c"] = round(curr_temp + random.uniform(-0.02, 0.02), 1)
                    f["contact_status"] = "OK"

            # Inactive spare feeders
            for f in self.feeders:
                if not f["is_active"]:
                    f["current_amps"] = 0.0
                    f["surface_temp_c"] = round(ambient_temp + 0.3, 1)
                    f["contact_status"] = "SPARE"

        # 5. Update ENTES MPR-53CS Modbus RTU Registers (Function 03)
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

        # 6. Update ABB TVOC-2 Registers
        self.tvoc2_registers[149] = 1 if self.active_scenario == "ARC_FLASH" else 0  # Number of trips
        self.tvoc2_registers[1300] = 2 if self.active_scenario == "ARC_FLASH" else 0  # 2: Tripped, 0: Normal
        self.tvoc2_registers[100] = 0x0800 if self.active_scenario == "ARC_FLASH" else 0x0000  # Bit 11 = X2:2 (DSYA-04)
        self.tvoc2_registers[101] = 0x0000
        self.tvoc2_registers[102] = 0x0007 if self.active_scenario == "ARC_FLASH" else 0x0000  # Relays K4, K5, K6
        self.tvoc2_registers[500] = 0x000E  # Installed modules (Internal HMI + X2 + X3)
        self.tvoc2_registers[1000] = 0

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
