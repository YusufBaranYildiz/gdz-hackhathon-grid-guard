"""
ABB TVOC-2 Optical Arc Protection & Dual-Criteria Fast Tripping Engine.
Complies with 1SFC170017M0201 (TVOC-2 Modbus Manual) and IEC 60947-3 / IEEE Std 1584.

Features sub-millisecond (< 1 ms) optical arc detection combined with current rate-of-rise (di/dt)
dual-verification from ENTES MPR-53CS to prevent false tripping (e.g. camera flash, door opening).
Maintains exact TVOC-2 Modbus register states and diagnostic trouble codes (DTC).
"""

from typing import Dict, Any, List, Optional
import time

class ArcProtectionEngine:
    def __init__(self, current_threshold_multiplier: float = 1.8):
        self.current_threshold_multiplier = current_threshold_multiplier
        
        # Internal states matching TVOC-2 Modbus registers
        self.system_state: int = 0  # 0: Normal, 1: Error, 2: Tripped
        self.latched: bool = False
        self.number_of_trips: int = 0
        self.trip_log: List[Dict[str, Any]] = []
        self.active_dtcs: List[str] = []
        
        # Detector maps for 1600kVA AG Pano:
        # X1: 10 optical sensors along Main Copper Busbars and Incoming connection
        # X2: 10 optical sensors across DSYA Feeders 1 to 10
        # X3: 10 optical sensors for Street Lighting, Metering cubicle & Spares
        self.detector_zones = {
            "X1:1": "Main Incomer Bushing R-Phase",
            "X1:2": "Main Incomer Bushing S-Phase",
            "X1:3": "Main Incomer Bushing T-Phase",
            "X1:4": "Main Copper Busbar 2x(100x10) Section A",
            "X1:5": "Main Copper Busbar 2x(100x10) Section B",
            "X1:6": "Neutral Busbar Connection",
            "X2:1": "DSYA Feeder 1-2 Compartment",
            "X2:2": "DSYA Feeder 3-4 Compartment",
            "X2:3": "DSYA Feeder 5-6 Compartment",
            "X2:4": "DSYA Feeder 7-8 Compartment",
            "X2:5": "DSYA Feeder 9-10 Compartment",
            "X3:1": "Metering & Instrument Transformer Compartment (MPR-53CS)",
            "X3:2": "Street Lighting & Internal Services Section"
        }

    def evaluate_arc(
        self,
        optical_flash_detected: bool,
        triggered_sensor: Optional[str] = None,
        instantaneous_current_amps: float = 400.0,
        nominal_current_amps: float = 400.0,
        di_dt_amps_per_ms: float = 0.0
    ) -> Dict[str, Any]:
        """
        Evaluates optical flash and electrical current condition.
        Dual Criteria: Flash == True AND (I > 1.8 * I_nom OR di/dt > 500 A/ms).
        """
        current_ratio = instantaneous_current_amps / max(1.0, nominal_current_amps)
        current_condition_met = (current_ratio >= self.current_threshold_multiplier) or (di_dt_amps_per_ms > 500.0)

        arc_trip_executed = False
        trip_detail = None

        if optical_flash_detected and current_condition_met:
            sensor_id = triggered_sensor or "X1:4"
            zone_desc = self.detector_zones.get(sensor_id, "General Switchgear Cubicle")

            # Check if this incident is already latched
            if self.system_state == 2 and self.trip_log:
                trip_detail = self.trip_log[-1]
                return {
                    "arc_detected": True,
                    "trip_executed": True,
                    "latched": True,
                    "dual_criteria_satisfied": True,
                    "system_state": 2,
                    "hardware_clearing_time_ms": trip_detail.get("clearing_time_ms", 0.85),
                    "trip_detail": trip_detail,
                    "description": f"LATCHED: TVOC-2 optical arc trip in {zone_desc}. Breaker locked out (Manual Reset required)."
                }

            # First occurrence of Genuine High-Energy Arc Flash -> Execute Trip & Latch
            self.system_state = 2  # Tripped / Lockout
            self.latched = True
            self.number_of_trips += 1
            
            trip_detail = {
                "trip_id": self.number_of_trips,
                "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
                "sensor_id": sensor_id,
                "zone": zone_desc,
                "current_amps": round(instantaneous_current_amps, 1),
                "di_dt": round(di_dt_amps_per_ms, 1),
                "clearing_time_ms": 0.85,  # TVOC-2 solid-state optical IGBT hardware clearing rating
                "relays_tripped": ["K4_MAIN_BREAKER", "K5_SCADA_ALARM"],
                "status": "CIRCUIT_BREAKER_LOCKED_OUT"
            }
            self.trip_log.append(trip_detail)
            self.active_dtcs = ["DTC-16-01-04 (Arc Flash Cleared)"]

            return {
                "arc_detected": True,
                "trip_executed": True,
                "latched": True,
                "dual_criteria_satisfied": True,
                "system_state": 2,
                "hardware_clearing_time_ms": 0.85,
                "trip_detail": trip_detail,
                "description": f"CRITICAL: TVOC-2 optical arc trip executed (<1 ms hardware clearing rating) at {zone_desc}!"
            }

        elif self.system_state == 2:
            # Latched in tripped state even if current/flash subsided, until explicit reset command
            last_trip = self.trip_log[-1] if self.trip_log else {}
            return {
                "arc_detected": True,
                "trip_executed": True,
                "latched": True,
                "dual_criteria_satisfied": True,
                "system_state": 2,
                "hardware_clearing_time_ms": 0.85,
                "trip_detail": last_trip,
                "description": "LATCHED / LOCKOUT: Pano şalteri açık ve kilitli. TVOC-2 resetlenene kadar sistem güvenli konumda tutuluyor."
            }

        elif optical_flash_detected and not current_condition_met:
            # Optical flash only (e.g. ambient light interference, torch, flash) -> False alarm suppressed!
            return {
                "arc_detected": False,
                "trip_executed": False,
                "latched": False,
                "dual_criteria_satisfied": False,
                "system_state": self.system_state,
                "ambient_light_warning": True,
                "description": "Optical light pulse detected without corresponding current surge. Trip suppressed to prevent false outage."
            }

        else:
            return {
                "arc_detected": False,
                "trip_executed": False,
                "latched": False,
                "dual_criteria_satisfied": False,
                "system_state": self.system_state,
                "description": "Optical arc monitors active. All 30 fiber channels healthy."
            }

    def reset_trip(self) -> None:
        """
        Modbus write to PDU 1000 (Reset trip).
        Clears latch, resets registers and returns TVOC-2 to normal supervisory state.
        """
        self.system_state = 0
        self.latched = False
        self.active_dtcs.clear()
        self.trip_log.clear()

    def get_modbus_register_snapshot(self) -> Dict[int, int]:
        """
        Returns raw TVOC-2 Modbus register values for SCADA polling.
        Conforms strictly to ABB TVOC-2 Modbus Manual (1SFC170017M0201) Tables 4.4.1.1 & 4.4.1.2.
        """
        regs = {}
        # PDU 149: Number of trips
        regs[149] = self.number_of_trips
        # PDU 1300: System state (0: Normal, 2: Tripped)
        regs[1300] = self.system_state
        # PDU 500: Installed modules (0x000E = Internal HMI + X2 + X3)
        regs[500] = 0x000E
        # PDU 1000: Reset register (0: idle)
        regs[1000] = 0
        
        # PDU 100 & 101 & 102: Active detector and relay bitfields
        if self.system_state == 2 and self.trip_log:
            last_trip = self.trip_log[-1]
            sensor = last_trip.get("sensor_id", "X2:2")

            # Table 4.4.1.1: Trip 1 detector, low (PDU 100) -> Bit 0-9: X1:1-X1:10, Bit 10-14: X2:1-X2:5
            pdu100_map = {f"X1:{i}": i - 1 for i in range(1, 11)}
            for i in range(1, 6):
                pdu100_map[f"X2:{i}"] = 9 + i

            # Table 4.4.1.2: Trip 1 detector, high (PDU 101) -> Bit 0-4: X2:6-X2:10, Bit 5-14: X3:1-X3:10
            pdu101_map = {f"X2:{i}": i - 6 for i in range(6, 11)}
            for i in range(1, 11):
                pdu101_map[f"X3:{i}"] = 4 + i

            regs[100] = (1 << pdu100_map[sensor]) if sensor in pdu100_map else 0x0800
            regs[101] = (1 << pdu101_map[sensor]) if sensor in pdu101_map else 0x0000
            regs[102] = 0x0007  # Relays K4, K5, K6
        else:
            regs[100] = 0
            regs[101] = 0
            regs[102] = 0
        return regs
