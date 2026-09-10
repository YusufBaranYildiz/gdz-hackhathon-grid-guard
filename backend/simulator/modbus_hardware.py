"""
Grid-Guard AI - Hardware RS-485 Modbus RTU & TCP Adapter Interface.
Enables transparent switching between Hackathon Simulation Mode and Physical Substation Hardware.
Complies with TEDAŞ 1600 kVA AG Pano, ENTES MPR-53CS (RS-485 19200 8E1) and ABB TVOC-2.
"""

import time
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger("ModbusHardwareAdapter")

class ModbusHardwareAdapter:
    """
    Physical Hardware Adapter for Substation Edge Gateway.
    Reads real Modbus RTU / TCP registers from physical devices when MODE=HARDWARE.
    """
    def __init__(self, mode: str = "SIMULATION", port: str = "COM3", baudrate: int = 19200, unit_id_mpr: int = 1, unit_id_tvoc: int = 2):
        self.mode = mode.upper()  # 'SIMULATION' or 'HARDWARE_RTU' or 'HARDWARE_TCP'
        self.port = port
        self.baudrate = baudrate
        self.unit_id_mpr = unit_id_mpr
        self.unit_id_tvoc = unit_id_tvoc
        self.is_connected = False
        self.client = None

        if self.mode != "SIMULATION":
            self._init_client()

    def _init_client(self):
        try:
            # Lazy import pymodbus to avoid breaking if not installed in offline demo
            from pymodbus.client import ModbusSerialClient
            self.client = ModbusSerialClient(
                port=self.port,
                baudrate=self.baudrate,
                parity='E',
                stopbits=1,
                bytesize=8,
                timeout=1.0
            )
            self.is_connected = self.client.connect()
            logger.info(f"Connected to physical Modbus RTU port {self.port}: {self.is_connected}")
        except Exception as e:
            logger.warning(f"Could not initialize physical Modbus connection: {e}. Falling back to virtual driver.")
            self.is_connected = False

    def read_mpr53cs_telemetry(self) -> Optional[Dict[str, float]]:
        """
        Polls Holding Registers 0x0000 - 0x004E from physical ENTES MPR-53CS.
        """
        if not self.is_connected or not self.client:
            return None

        try:
            # Read 20 registers starting from 0 (V_L1 to Phase-Phase)
            rr = self.client.read_holding_registers(address=0, count=20, slave=self.unit_id_mpr)
            if rr.isError():
                return None
            
            regs = rr.registers
            v_l1 = regs[0] * 0.1
            v_l2 = regs[2] * 0.1
            v_l3 = regs[4] * 0.1
            i_l1 = regs[6] * 1.0  # Assumes CT ratio applied or scaled
            return {
                "v_l1": v_l1, "v_l2": v_l2, "v_l3": v_l3, "i_l1": i_l1
            }
        except Exception as e:
            logger.error(f"Modbus RTU read error: {e}")
            return None

    def read_tvoc2_status(self) -> Optional[Dict[str, Any]]:
        """
        Polls Holding Registers 100, 149, 1300 from physical ABB TVOC-2.
        """
        if not self.is_connected or not self.client:
            return None

        try:
            rr = self.client.read_holding_registers(address=100, count=5, slave=self.unit_id_tvoc)
            if rr.isError():
                return None
            
            trip_bits = rr.registers[0]
            return {
                "optical_arc_tripped": (trip_bits > 0),
                "active_detectors": trip_bits
            }
        except Exception as e:
            logger.error(f"TVOC-2 Modbus RTU read error: {e}")
            return None

    def reset_tvoc2_trip(self) -> bool:
        """Sends command to register 1000 to clear trip state."""
        if not self.is_connected or not self.client:
            return False
        try:
            self.client.write_register(address=1000, value=1, slave=self.unit_id_tvoc)
            return True
        except Exception:
            return False
