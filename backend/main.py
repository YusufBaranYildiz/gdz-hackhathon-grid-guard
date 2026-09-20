"""
Grid-Guard AI - FastAPI On-Premise SCADA Gateway & Web Monitoring Server.
Strictly On-Premise compliant (Zero Public Cloud dependency).
Serves real-time telemetry, Modbus registers, scenario injection, and frontend dashboard.
"""

import os
import sys
import asyncio
import time
from typing import Dict, Any, List, Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware

# Ensure core modules can be imported
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from core.physics_thermal_model import PhysicsThermalModel
from core.dew_point_pd_fusion import DewPointPDFusion
from core.arc_protection import ArcProtectionEngine
from core.health_index import SwitchgearHealthIndex
from core.fleet_manager import FleetManager
from simulator.modbus_simulator import ModbusPanoSimulator
from services.notification_service import NotificationService, strip_emojis

# Initialize paths
DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "Hackathon Verileri"))
EXCEL_PATH = os.path.join(DATA_DIR, "İstenen Veriler.xlsx")
if not os.path.exists(EXCEL_PATH) and os.path.isdir(DATA_DIR):
    import unicodedata
    for f in os.listdir(DATA_DIR):
        if f.endswith(".xlsx") and "stenen" in unicodedata.normalize("NFC", f):
            EXCEL_PATH = os.path.join(DATA_DIR, f)
            break
FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))

# Core Engines
thermal_engine = PhysicsThermalModel()
dew_pd_engine = DewPointPDFusion()
arc_engine = ArcProtectionEngine()
health_engine = SwitchgearHealthIndex()
notification_service = NotificationService()
simulator = ModbusPanoSimulator(EXCEL_PATH)
fleet_manager = FleetManager(total_panels=100)

# Telemetry History Buffer (last 60 seconds)
telemetry_history: List[Dict[str, Any]] = []
latest_snapshot: Dict[str, Any] = {}

# Connected WebSocket clients
active_websockets: List[WebSocket] = []

async def _send_snapshot(websocket: WebSocket, snapshot: Dict[str, Any]):
    try:
        await asyncio.wait_for(websocket.send_json(snapshot), timeout=0.5)
        return None
    except Exception as exc:
        return exc


async def broadcast_snapshot(snapshot: Dict[str, Any]):
    clients = list(active_websockets)
    if not clients:
        return

    results = await asyncio.gather(
        *(_send_snapshot(websocket, snapshot) for websocket in clients),
        return_exceptions=True,
    )
    for websocket, result in zip(clients, results):
        if isinstance(result, Exception) and websocket in active_websockets:
            active_websockets.remove(websocket)


def compute_telemetry_tick(tick_started: Optional[float] = None) -> Dict[str, Any]:
    global latest_snapshot
    if tick_started is None:
        tick_started = time.monotonic()

    # 1. Step simulator
    raw = simulator.step()

    # 2. Physics Thermal Model Evaluation - Scan all 12 DSYA Feeders + Main Busbar
    thermal_eval = thermal_engine.evaluate_contact(
        measured_temp_c=raw["thermal"]["main_busbar_temp_c"],
        current_amps=raw["electrical"]["current_l1"],
        ambient_temp_c=raw["thermal"]["ambient_temp_c"],
        dt_seconds=1.0,
        channel_id="main_busbar_2x100x10"
    )

    # Evaluate all 12 feeders individually
    worst_feeder_eval = thermal_eval
    feeder_evaluations = []
    for idx, feeder in enumerate(raw["thermal"]["dsya_feeders"]):
        f_eval = thermal_engine.evaluate_contact(
            measured_temp_c=feeder["surface_temp_c"],
            current_amps=feeder["current_amps"],
            ambient_temp_c=raw["thermal"]["ambient_temp_c"],
            dt_seconds=1.0,
            channel_id=feeder["id"]
        )
        feeder_evaluations.append(f_eval)
        if f_eval["residual_delta_t"] > worst_feeder_eval["residual_delta_t"]:
            worst_feeder_eval = f_eval

    dsya4_eval = feeder_evaluations[3] if len(feeder_evaluations) > 3 else thermal_eval

    # Calculate True 3-Phase Current Unbalance Ratio (%)
    i1 = raw["electrical"]["current_l1"]
    i2 = raw["electrical"]["current_l2"]
    i3 = raw["electrical"]["current_l3"]
    i_avg = max(1.0, (i1 + i2 + i3) / 3.0)
    phase_unbalance = round(((max(i1, i2, i3) - min(i1, i2, i3)) / i_avg) * 100.0, 1)

    # 3. Dew Point & HFCT PD Fusion
    dew_pd_eval = dew_pd_engine.evaluate(
        ambient_temp_c=raw["thermal"]["ambient_temp_c"],
        relative_humidity_pct=raw["environmental_pd"]["relative_humidity_pct"],
        surface_temp_c=raw["thermal"]["main_busbar_temp_c"],
        hfct_pd_pulse_rate_pps=raw["environmental_pd"]["hfct_pd_pps"],
        hfct_peak_amplitude_pc=raw["environmental_pd"]["hfct_peak_pc"]
    )

    # 4. Optical Arc Protection Evaluation
    if simulator.active_scenario != "ARC_FLASH" and (arc_engine.system_state == 2 or arc_engine.latched):
        arc_engine.reset_trip()
        simulator.tvoc2_registers[1300] = 0
        simulator.tvoc2_registers[100] = 0
        simulator.tvoc2_registers[101] = 0
        simulator.tvoc2_registers[102] = 0
        simulator.tvoc2_registers[149] = 0
        simulator.tvoc2_registers[1000] = 1

    arc_eval = arc_engine.evaluate_arc(
        optical_flash_detected=raw["optical_arc"]["optical_flash"],
        triggered_sensor=raw["optical_arc"]["triggered_sensor"],
        instantaneous_current_amps=raw["electrical"]["current_l1"],
        nominal_current_amps=400.0,
        di_dt_amps_per_ms=raw["electrical"]["di_dt"]
    )

    if simulator.active_scenario == "NORMAL":
        arc_eval["trip_executed"] = False
        arc_eval["latched"] = False
        arc_eval["system_state"] = 0
        arc_eval["arc_detected"] = False

    # 5. Multi-Modal Unified Health Index
    health = health_engine.compute(
        thermal_eval=worst_feeder_eval if worst_feeder_eval["anomaly_detected"] else thermal_eval,
        dew_pd_eval=dew_pd_eval,
        arc_eval=arc_eval,
        thd_current_pct=raw["electrical"]["thd_current"],
        phase_unbalance_pct=phase_unbalance
    )

    tvoc_engine_regs = arc_engine.get_modbus_register_snapshot()
    simulator.tvoc2_registers.update(tvoc_engine_regs)

    # 6. Automatic Notification Check
    active_alert = None
    if simulator.active_scenario == "NORMAL":
        active_alert = None
        active_alarm_count = 0
    elif simulator.active_scenario == "ARC_FLASH" and arc_eval.get("trip_executed"):
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
    elif simulator.active_scenario == "LOOSE_BOLT" and dsya4_eval.get("status") in ["WARNING", "CRITICAL"] and dsya4_eval.get("residual_delta_t", 0.0) >= 15.0:
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
    elif simulator.active_scenario == "CONDENSATION_PD" and dew_pd_eval.get("status") == "CRITICAL_FLASHOVER_RISK":
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

    if simulator.active_scenario == "NORMAL":
        active_alert = None
        active_alarm_count = 0
    else:
        active_alarm_count = 1 if active_alert else 0

    fleet_manager.update_primary_panel(
        scenario=simulator.active_scenario,
        health_index=health["health_index"],
        active_alarms=active_alarm_count,
        main_busbar_temp=raw["thermal"]["main_busbar_temp_c"],
        residual_delta_t=thermal_eval["residual_delta_t"]
    )

    # Grid-Guard AI Virtual Edge Registers (Holding Registers 40001 - 40010 as per SCADA_MODBUS_MAPPING.md)
    is_fault_focus = simulator.active_scenario in ("LOOSE_BOLT", "ARC_FLASH")
    t_meas_live = dsya4_eval.get("measured_temp_c", raw["thermal"]["main_busbar_temp_c"]) if is_fault_focus else raw["thermal"]["main_busbar_temp_c"]
    t_pred_live = dsya4_eval.get("predicted_temp_c", thermal_eval["predicted_temp_c"]) if is_fault_focus else thermal_eval["predicted_temp_c"]
    dt_res_live = dsya4_eval.get("residual_delta_t", thermal_eval["residual_delta_t"]) if is_fault_focus else thermal_eval["residual_delta_t"]

    alarm_word = 0
    if dt_res_live >= 15.0:
        alarm_word |= 0x0001  # Bit 0: Thermal contact loosening
    if dew_pd_eval.get("hfct_pd_pps", 0.0) >= 30.0 or dew_pd_eval.get("status") == "CRITICAL_FLASHOVER_RISK":
        alarm_word |= 0x0002  # Bit 1: Partial discharge / insulation
    if dew_pd_eval.get("dew_margin_c", 99.0) <= 3.0:
        alarm_word |= 0x0004  # Bit 2: High condensation risk
    if arc_eval.get("trip_executed") or arc_eval.get("latched") or arc_eval.get("system_state") == 2:
        alarm_word |= 0x0008  # Bit 3: Optical Arc trip

    ai_registers = {
        40001: int(round(health["health_index"] * 10)),
        40002: int(round(t_meas_live * 10)),
        40003: int(round(t_pred_live * 10)),
        40004: int(round(dt_res_live * 10)),
        40005: int(round(worst_feeder_eval.get("contact_degradation_index", 0.0) * 10)),
        40006: int(round(dew_pd_eval.get("dew_point_c", 0.0) * 10)),
        40007: int(round(dew_pd_eval.get("dew_margin_c", 0.0) * 10)),
        40008: int(round(dew_pd_eval.get("hfct_pd_pps", 0.0) * 10)),
        40009: int(round(dew_pd_eval.get("hfct_peak_pc", 0.0))),
        40010: alarm_word
    }

    snapshot = {
        "timestamp": time.strftime("%H:%M:%S"),
        "step_index": raw["step_index"],
        "data_source": "SIMULATION",
        "simulation": True,
        "modbus_transport": "SIMULATED",
        "notification_transport": "SIMULATED",
        "tick_duration_ms": round((time.monotonic() - tick_started) * 1000.0, 3),
        "scenario": raw["scenario"],
        "scenario_description": raw["scenario_description"],
        "active_alarm_count": active_alarm_count,
        "fleet_summary": fleet_manager.get_fleet_summary(),
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
        "mpr53cs_registers": simulator.mpr53cs_registers,
        "tvoc2_registers": simulator.tvoc2_registers,
        "ai_registers": ai_registers
    }

    act_scen = snapshot["scenario"]
    if act_scen in ("LOOSE_BOLT", "ARC_FLASH"):
        t_meas = dsya4_eval.get("measured_temp_c", raw["thermal"]["main_busbar_temp_c"])
        t_pred = dsya4_eval.get("predicted_temp_c", thermal_eval["predicted_temp_c"])
    else:
        t_meas = raw["thermal"]["main_busbar_temp_c"]
        t_pred = thermal_eval["predicted_temp_c"]

    telemetry_history.append({
        "time": snapshot["timestamp"],
        "scenario": act_scen,
        "i_l1": snapshot["electrical"]["current_l1"],
        "temp_busbar": snapshot["thermal"]["main_busbar_temp_c"],
        "temp_model": snapshot["thermal"]["main_busbar_predicted_c"],
        "temp_dsya4": snapshot["thermal"]["dsya4_eval"]["measured_temp_c"],
        "temp_measured": t_meas,
        "temp_predicted": t_pred,
        "dew_margin": snapshot["environmental_pd"]["dew_margin_c"],
        "hfct_pd": snapshot["environmental_pd"]["hfct_pd_pps"],
        "health_index": snapshot["health_index"]["health_index"]
    })
    if len(telemetry_history) > 60:
        telemetry_history.pop(0)

    latest_snapshot = snapshot
    return snapshot


# Initialize baseline snapshot on startup
latest_snapshot = compute_telemetry_tick()


async def simulation_loop():
    """Background loop that ticks the synthetic gateway at a stable 1 Hz cadence."""
    next_tick = time.monotonic()
    while True:
        tick_started = time.monotonic()
        try:
            snapshot = compute_telemetry_tick(tick_started)
            await broadcast_snapshot(snapshot)
        except Exception as e:
            print(f"Error in simulation loop: {e}")

        next_tick += 1.0
        await asyncio.sleep(max(0.0, next_tick - time.monotonic()))

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    sim_task = asyncio.create_task(simulation_loop())
    try:
        yield
    finally:
        # Shutdown
        sim_task.cancel()
        try:
            await sim_task
        except asyncio.CancelledError:
            pass

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

@app.middleware("http")
async def add_no_cache_headers(request: Request, call_next):
    # WebSocket upgrade requests must NOT be processed by HTTP middleware
    if request.headers.get("upgrade", "").lower() == "websocket":
        return await call_next(request)
    response = await call_next(request)
    path = request.url.path.lower()
    if path == "/" or path.endswith((".html", ".css", ".js", ".json")):
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response

# REST Endpoints
@app.get("/api/status")
def get_system_status():
    return {
        "system": "Grid-Guard AI Edge Gateway",
        "system_status": "HEALTHY",
        "substation": "GDZ Buca TM-1600kVA Pano #1",
        "standard_compliance": ["IEEE P3835", "IEEE C37.21-2026", "TEDAŞ-MLZ/2003-06.B"],
        "mode": "On-Premise (Zero Public Cloud)",
        "cloud_dependency": "NONE (100% On-Premise / Edge-Native)",
        "data_source": "SIMULATION",
        "active_scenario": simulator.active_scenario,
        "scada_modbus_rtu": "SIMULATED (RS-485 mapping available)",
        "notification_transport": "SIMULATED",
        "active_clients": len(active_websockets)
    }

@app.get("/api/telemetry")
def get_latest_telemetry():
    return latest_snapshot

@app.get("/api/history")
def get_telemetry_history():
    return telemetry_history

@app.get("/api/fleet")
def get_fleet_overview():
    return {
        "summary": fleet_manager.get_fleet_summary(),
        "panels": fleet_manager.get_all_panels()
    }

@app.get("/api/fleet/{panel_id}")
def get_fleet_panel(panel_id: str):
    panel = fleet_manager.get_panel(panel_id)
    if not panel:
        return JSONResponse(status_code=404, content={"status": "ERROR", "message": f"Panel '{panel_id}' not found"})
    return panel

@app.post("/api/scenario/{scenario_name}")
def switch_scenario(scenario_name: str):
    valid_scenarios = ["NORMAL", "LOOSE_BOLT", "CONDENSATION_PD", "ARC_FLASH"]
    upper_name = scenario_name.upper()
    if upper_name not in valid_scenarios:
        return JSONResponse(
            status_code=400,
            content={"status": "ERROR", "message": f"Invalid scenario '{scenario_name}'. Valid options: {valid_scenarios}"}
        )

    res = simulator.set_scenario(upper_name)
    if upper_name != "ARC_FLASH":
        arc_engine.reset_trip()
        simulator.tvoc2_registers[1300] = 0
        simulator.tvoc2_registers[100] = 0
        simulator.tvoc2_registers[101] = 0
        simulator.tvoc2_registers[102] = 0
        simulator.tvoc2_registers[149] = 0
        simulator.tvoc2_registers[1000] = 1
        thermal_engine.reset_states()
        notification_service.reset_state()
    return {"status": "SUCCESS", "active_scenario": res}

@app.post("/api/arc/reset")
def reset_arc_trip():
    """
    Simulates writing '1' to ABB TVOC-2 Modbus Register 1000 (Reset Trip).
    Clears latch, resets system_state to 0, clears detector bitfields.
    """
    arc_engine.reset_trip()
    simulator.tvoc2_registers[1000] = 1
    simulator.tvoc2_registers[1300] = 0
    simulator.tvoc2_registers[100] = 0
    simulator.tvoc2_registers[101] = 0
    simulator.tvoc2_registers[102] = 0
    simulator.tvoc2_registers[149] = 0
    if simulator.active_scenario == "ARC_FLASH":
        simulator.set_scenario("NORMAL")
    notification_service.reset_state()
    thermal_engine.reset_states()
    return {
        "status": "SUCCESS",
        "message": "ABB TVOC-2 Açtırma Kilidi Sıfırlandı (Modbus PDU 1000 = 1 Yazıldı)",
        "system_state": 0,
        "active_scenario": simulator.active_scenario
    }

@app.get("/api/reports/latest")
def get_latest_incident_report():
    """Generates structured incident and forensic report for export."""
    latest_telemetry = telemetry_history[-1] if telemetry_history else {}
    alerts = notification_service.get_latest_alerts(10)
    report = {
        "report_id": f"REP-GDZ-{int(time.time())}",
        "generated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "substation": "GDZ İzmir Buca TM - 1600 kVA AG Dağıtım Panosu #1",
        "standard_compliance": [
            "TEDAŞ-MLZ/2003-06.B",
            "TS EN 61439-1 (Sıcaklık Sınırları)",
            "IEEE P3835 (Varlık Sağlık İndeksi)",
            "IEC 60947-3 / IEEE Std 1584 (Ark Koruması)"
        ],
        "active_scenario": simulator.active_scenario,
        "tvoc2_supervision": {
            "system_state": arc_engine.system_state,
            "number_of_trips": arc_engine.number_of_trips,
            "trip_log": arc_engine.trip_log,
            "clearing_rating": "< 1 ms (IGBT solid-state)"
        },
        "latest_telemetry": latest_telemetry,
        "fleet_summary": fleet_manager.get_fleet_summary(),
        "prescriptive_action": (
            "TVOC-2 optik ark açtırması gerçekleşti. Hücreyi enerjilendirmeden önce topraklama yapınız, optik sensör ve DTC arıza kodunu inceleyiniz."
            if simulator.active_scenario == "ARC_FLASH"
            else (
                "DSYA-04 klemensinde termal kontak direnci artışı tespit edildi. 45 Nm tork anahtarı ile klemens torklama ve kontak temizliği önerilir."
                if simulator.active_scenario == "LOOSE_BOLT"
                else (
                    "Bağıl nem %90 üzerine çıktı ve HFCT kısmi deşarj atlaması riski mevcut. Pano içi anti-kondenzasyon ısıtıcısını derhal devreye alınız."
                    if simulator.active_scenario == "CONDENSATION_PD"
                    else "Sistem nominal sınırlarda çalışıyor. Periyodik kestirimci bakım takvimi geçerlidir."
                )
            )
        ),
        "recent_alerts": alerts
    }
    return strip_emojis(report)

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
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_websockets.append(websocket)
    try:
        while True:
            # Keep-alive receive
            _ = await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        if websocket in active_websockets:
            active_websockets.remove(websocket)

# Mount static frontend
if os.path.exists(FRONTEND_DIR):
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
