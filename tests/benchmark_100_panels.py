"""
CPU Benchmark: Measuring the synthetic analysis core across 100 virtual distribution panels.
This benchmark covers in-process calculations only; it does not represent physical sensors,
Modbus/network traffic, WebSocket clients, persistence, or breaker response time.
"""

import time
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from backend.core.physics_thermal_model import PhysicsThermalModel
from backend.core.dew_point_pd_fusion import DewPointPDFusion
from backend.core.arc_protection import ArcProtectionEngine
from backend.core.health_index import SwitchgearHealthIndex

def run_100_panel_benchmark():
    NUM_PANELS = 100
    print(f"============================================================")
    print(f"GRID-GUARD AI: 100 SWITCHGEAR PANEL CONCURRENCY BENCHMARK")
    print(f"Target Architecture: On-Premise Industrial Edge Gateway (e.g. Advantech / Raspberry Pi 4)")
    print(f"============================================================")

    # Initialize 100 isolated panel state engines
    panels = []
    for i in range(NUM_PANELS):
        panels.append({
            "id": f"TM-BUCA-PANO-{i+1:03d}",
            "thermal": PhysicsThermalModel(),
            "dew_pd": DewPointPDFusion(),
            "arc": ArcProtectionEngine(),
            "health": SwitchgearHealthIndex()
        })

    print(f"[OK] Instantiated {NUM_PANELS} independent switchgear state engines.")

    # Run 10 consecutive full telemetry cycles across all 100 panels (1000 evaluations total)
    cycles = 10
    total_start = time.perf_counter()

    for c in range(cycles):
        cycle_start = time.perf_counter()
        for p in panels:
            # 1. Thermal evaluation
            th_eval = p["thermal"].evaluate_contact(
                measured_temp_c=45.2,
                current_amps=320.0,
                ambient_temp_c=28.0,
                dt_seconds=1.0,
                channel_id=f"{p['id']}-busbar"
            )
            # 2. Dew Point & PD evaluation
            dp_eval = p["dew_pd"].evaluate(
                ambient_temp_c=28.0,
                relative_humidity_pct=55.0,
                surface_temp_c=45.2,
                hfct_pd_pulse_rate_pps=6.2
            )
            # 3. Arc protection check
            arc_eval = p["arc"].evaluate_arc(
                optical_flash_detected=False,
                instantaneous_current_amps=320.0
            )
            # 4. Multi-modal Health Index
            hi = p["health"].compute(
                thermal_eval=th_eval,
                dew_pd_eval=dp_eval,
                arc_eval=arc_eval,
                thd_current_pct=2.4
            )

        cycle_elapsed_ms = (time.perf_counter() - cycle_start) * 1000.0
        # Print progress
        if (c + 1) % 5 == 0 or c == 0:
            print(f"Cycle {c+1:02d}/{cycles}: Evaluated 100 panels in {cycle_elapsed_ms:.2f} ms ({cycle_elapsed_ms/NUM_PANELS:.3f} ms per panel)")

    total_elapsed_ms = (time.perf_counter() - total_start) * 1000.0
    avg_cycle_ms = total_elapsed_ms / cycles
    avg_panel_ms = avg_cycle_ms / NUM_PANELS

    print(f"------------------------------------------------------------")
    print(f"BENCHMARK RESULTS:")
    print(f"Total Evaluations       : {NUM_PANELS * cycles} full panel cycles")
    print(f"Total Processing Time   : {total_elapsed_ms:.2f} ms")
    print(f"Average Cycle (100 Panos): {avg_cycle_ms:.2f} ms (Cycle requirement: <= 1000 ms)")
    print(f"Processing Time / Panel : {avg_panel_ms:.4f} ms")
    print(f"Maximum Edge Capacity   : ~{int(1000.0 / avg_panel_ms)} switchgears / second on single core")
    print(f"INFO: Synthetic CPU calculation benchmark completed; this is not an end-to-end field SLA.")
    print(f"============================================================")

if __name__ == '__main__':
    run_100_panel_benchmark()
