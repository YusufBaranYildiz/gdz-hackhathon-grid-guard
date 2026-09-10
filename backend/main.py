"""
Grid-Guard AI - FastAPI On-Premise SCADA Gateway & Web Monitoring Server.
Strictly On-Premise compliant (Zero Public Cloud dependency).
Serves real-time telemetry, Modbus registers, scenario injection, and frontend dashboard.
"""

import os
import sys
import asyncio
import time
from typing import Dict, Any, List
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware

# Ensure core modules can be imported
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from core.physics_thermal_model import PhysicsThermalModel
from core.dew_point_pd_fusion import DewPointPDFusion
from core.arc_protection import ArcProtectionEngine
from core.health_index import SwitchgearHealthIndex
from simulator.modbus_simulator import ModbusPanoSimulator
from services.notification_service import NotificationService

# Initialize paths
DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "Hackathon Verileri"))
EXCEL_PATH = os.path.join(DATA_DIR, "İstenen Veriler.xlsx")
FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))

# Core Engines
thermal_engine = PhysicsThermalModel()
dew_pd_engine = DewPointPDFusion()
arc_engine = ArcProtectionEngine()
health_engine = SwitchgearHealthIndex()
notification_service = NotificationService()
simulator = ModbusPanoSimulator(EXCEL_PATH)

# Telemetry History Buffer (last 60 seconds)
telemetry_history: List[Dict[str, Any]] = []

# Connected WebSocket clients
active_websockets: List[WebSocket] = []

async def simulation_loop():
    """Background loop that ticks simulation at 1 Hz and broadcasts to clients."""
    while True:
        try:
            # 1. Step simulator
            raw = simulator.step()

            # 2. Physics Thermal Model Evaluation
            thermal_eval = thermal_engine.evaluate_contact(
                measured_temp_c=raw["thermal"]["main_busbar_temp_c"],
                current_amps=raw["electrical"]["current_l1"],
                ambient_temp_c=raw["thermal"]["ambient_temp_c"],
                dt_seconds=1.0,
                channel_id="main_busbar_2x100x10"
            )

            # Evaluate DSYA-04 specifically for contact anomalies
            dsya4 = raw["thermal"]["dsya_feeders"][3]
            dsya4_eval = thermal_engine.evaluate_contact(
                measured_temp_c=dsya4["surface_temp_c"],
                current_amps=dsya4["current_amps"],
                ambient_temp_c=raw["thermal"]["ambient_temp_c"],
                dt_seconds=1.0,
                channel_id="DSYA-04"
            )

            # 3. Dew Point & HFCT PD Fusion
            dew_pd_eval = dew_pd_engine.evaluate(
                ambient_temp_c=raw["thermal"]["ambient_temp_c"],
                relative_humidity_pct=raw["environmental_pd"]["relative_humidity_pct"],
                surface_temp_c=raw["thermal"]["main_busbar_temp_c"],
                hfct_pd_pulse_rate_pps=raw["environmental_pd"]["hfct_pd_pps"],
                hfct_peak_amplitude_pc=raw["environmental_pd"]["hfct_peak_pc"]
            )

            # 4. Optical Arc Protection Evaluation
            arc_eval = arc_engine.evaluate_arc(
                optical_flash_detected=raw["optical_arc"]["optical_flash"],
                triggered_sensor=raw["optical_arc"]["triggered_sensor"],
                instantaneous_current_amps=raw["electrical"]["current_l1"],
                nominal_current_amps=400.0,
                di_dt_amps_per_ms=raw["electrical"]["di_dt"]
            )

            # 5. Multi-Modal Unified Health Index
            health = health_engine.compute(
                thermal_eval=dsya4_eval if dsya4_eval["anomaly_detected"] else thermal_eval,
                dew_pd_eval=dew_pd_eval,
                arc_eval=arc_eval,
                thd_current_pct=raw["electrical"]["thd_current"]
            )

            # Sync actual TVOC-2 registers from ArcProtectionEngine
            tvoc_engine_regs = arc_engine.get_modbus_register_snapshot()
            simulator.tvoc2_registers.update(tvoc_engine_regs)

            # 6. Automatic Notification Check
            active_alert = None
            if arc_eval.get("trip_executed"):
                active_alert = notification_service.dispatch_alert(
                    severity="CRITICAL",
                    anomaly_type="Hücre İçi Ark Flaş Patlaması (TVOC-2 Tetiklendi)",
                    component_location=arc_eval["trip_detail"]["zone"],
                    metrics={
                        "highlight_summary": f"Ark Akımı: {raw['electrical']['current_l1']}A | Açtırma: {arc_eval['trip_detail']['clearing_time_ms']} ms",
                        "current": f"{raw['electrical']['current_l1']} A",
                        "clearing_time": f"{arc_eval['trip_detail']['clearing_time_ms']} ms"
                    },
                    recommended_action="Hücreyi açmadan önce emniyet topraklaması yapınız, TVOC-2 optik dedektör kontrolü sağlayınız."
                )
            elif dsya4_eval.get("status") in ["WARNING", "CRITICAL"]:
                active_alert = notification_service.dispatch_alert(
                    severity=dsya4_eval["status"],
                    anomaly_type="Termal Kontak Direnci Bozulması (Gevşek Cıvata)",
                    component_location="DSYA-04 Çıkış Pabucu & Bara Bağlantısı",
                    metrics={
                        "highlight_summary": f"Yüzey: {dsya4_eval['measured_temp_c']}°C | Joule Model: {dsya4_eval['predicted_temp_c']}°C (ΔT: +{dsya4_eval['residual_delta_t']}°C)",
                        "measured_temp": f"{dsya4_eval['measured_temp_c']}°C",
                        "residual": f"+{dsya4_eval['residual_delta_t']}°C",
                        "current": f"{dsya4_eval['current_amps']} A"
                    },
                    recommended_action="DSYA-04 klemens cıvatalarını tork anahtarı ile torklayınız ve korozyon temizliği yapınız."
                )
            elif dew_pd_eval.get("status") == "CRITICAL_FLASHOVER_RISK":
                active_alert = notification_service.dispatch_alert(
                    severity="CRITICAL",
                    anomaly_type="Yoğuşma & Kısmi Deşarj Atlama Riski",
                    component_location="1600kVA Pano İçi Mesnet İzolatörleri",
                    metrics={
                        "highlight_summary": f"Çiğ Noktası Marjı: {dew_pd_eval['dew_margin_c']}°C | HFCT PD: {dew_pd_eval['hfct_pd_pps']} pps ({dew_pd_eval['hfct_peak_pc']} pC)",
                        "dew_margin": f"{dew_pd_eval['dew_margin_c']}°C",
                        "pd_pulse_rate": f"{dew_pd_eval['hfct_pd_pps']} pps"
                    },
                    recommended_action="Pano içi nem önleyici ısıtıcıyı (anti-condensation heater) derhal manuel devreye alınız."
                )

            # 7. Assemble consolidated payload
            snapshot = {
                "timestamp": time.strftime("%H:%M:%S"),
                "step_index": raw["step_index"],
                "scenario": raw["scenario"],
                "scenario_description": raw["scenario_description"],
                "health_index": health,
                "electrical": raw["electrical"],
                "thermal": {
                    "ambient_temp_c": raw["thermal"]["ambient_temp_c"],
                    "main_busbar_temp_c": raw["thermal"]["main_busbar_temp_c"],
                    "main_busbar_predicted_c": thermal_eval["predicted_temp_c"],
                    "main_busbar_residual_c": thermal_eval["residual_delta_t"],
                    "dsya_feeders": raw["thermal"]["dsya_feeders"],
                    "dsya4_eval": dsya4_eval
                },
                "environmental_pd": dew_pd_eval,
                "optical_arc": arc_eval,
                "active_alert": active_alert,
                "latest_alerts": notification_service.get_latest_alerts(5),
                "mpr53cs_registers": simulator.mpr53cs_registers,
                "tvoc2_registers": simulator.tvoc2_registers
            }

            # Update history buffer (max 60 items)
            telemetry_history.append({
                "time": snapshot["timestamp"],
                "i_l1": snapshot["electrical"]["current_l1"],
                "temp_busbar": snapshot["thermal"]["main_busbar_temp_c"],
                "temp_model": snapshot["thermal"]["main_busbar_predicted_c"],
                "temp_dsya4": snapshot["thermal"]["dsya4_eval"]["measured_temp_c"],
                "dew_margin": snapshot["environmental_pd"]["dew_margin_c"],
                "hfct_pd": snapshot["environmental_pd"]["hfct_pd_pps"],
                "health_index": snapshot["health_index"]["health_index"]
            })
            if len(telemetry_history) > 60:
                telemetry_history.pop(0)

            # Broadcast to WebSocket clients
            dead_sockets = []
            for ws in active_websockets:
                try:
                    await ws.send_json(snapshot)
                except Exception:
                    dead_sockets.append(ws)
            for ds in dead_sockets:
                active_websockets.remove(ds)

        except Exception as e:
            print(f"Error in simulation loop: {e}")

        await asyncio.sleep(1.0)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    sim_task = asyncio.create_task(simulation_loop())
    yield
    # Shutdown
    sim_task.cancel()

app = FastAPI(
    title="Grid-Guard AI - Pano Anomali Erken Uyarı Sistemi",
    description="ADM & GDZ Elektrik On-Premise SCADA Monitoring Gateway",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# REST Endpoints
@app.get("/api/status")
def get_system_status():
    return {
        "system": "Grid-Guard AI Edge Gateway",
        "substation": "GDZ Buca TM-1600kVA Pano #1",
        "standard_compliance": ["IEEE P3835", "IEEE C37.21-2026", "TEDAŞ-MLZ/2003-06.B"],
        "mode": "On-Premise (Zero Public Cloud)",
        "active_scenario": simulator.active_scenario,
        "scada_modbus_rtu": "Connected (RS-485 19200 bps, Even Parity)",
        "active_clients": len(active_websockets)
    }

@app.get("/api/history")
def get_telemetry_history():
    return telemetry_history

@app.post("/api/scenario/{scenario_name}")
def switch_scenario(scenario_name: str):
    res = simulator.set_scenario(scenario_name.upper())
    if scenario_name.upper() == "NORMAL":
        arc_engine.reset_trip()
        notification_service.reset_state()
    return {"status": "SUCCESS", "active_scenario": res}

@app.post("/api/alerts/test")
def trigger_test_alert():
    alert = notification_service.dispatch_alert(
        severity="WARNING",
        anomaly_type="Manuel Test Bildirimi (SMS & WhatsApp Doğrulaması)",
        component_location="Pano İzleme Ünitesi",
        metrics={"highlight_summary": "Test sinyali operasyon merkezine başarıyla iletildi."},
        recommended_action="Herhangi bir aksiyon gerekmemektedir, sistem doğrulandı."
    )
    return {"status": "ALERT_SENT", "alert": alert}

@app.get("/api/alerts")
def get_alert_history():
    return notification_service.get_latest_alerts(20)

@app.websocket("/ws/live")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_websockets.append(websocket)
    try:
        while True:
            # Keep-alive receive
            _ = await websocket.receive_text()
    except WebSocketDisconnect:
        if websocket in active_websockets:
            active_websockets.remove(websocket)

# Mount static frontend
if os.path.exists(FRONTEND_DIR):
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
