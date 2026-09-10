/**
 * Grid-Guard AI - Main Dashboard Controller & WebSocket Client.
 * Binds SCADA UI, real-time analytics, scenario controls, and Modbus tables.
 */

class DashboardApp {
    constructor() {
        this.ws = null;
        this.telemetry = null;
        this.historicalAlarms = [];
        this.modbusData = { mpr: {}, tvoc: {} };
        this.activeFilter = "ALL";
        this.searchQuery = "";
        this.processedAlertIds = new Set();

        this.initClock();
        this.initScenarioToolbar();
        this.initTabs();
        this.initModbusFilters();
        this.connectWebSocket();
        this.fetchInitialHistory();
    }

    initClock() {
        const el = document.getElementById("clockDisplay");
        setInterval(() => {
            const now = new Date();
            if (el) el.textContent = now.toLocaleTimeString('tr-TR');
        }, 1000);
    }

    initScenarioToolbar() {
        const buttons = document.querySelectorAll(".btn-scenario");
        buttons.forEach(btn => {
            btn.addEventListener("click", () => {
                const scenario = btn.getAttribute("data-scenario");
                this.switchScenario(scenario, btn);
            });
        });
    }

    async switchScenario(scenarioName, clickedBtn) {
        try {
            const res = await fetch(`/api/scenario/${scenarioName}`, { method: "POST" });
            const data = await res.json();
            if (data.status === "SUCCESS") {
                document.querySelectorAll(".btn-scenario").forEach(b => b.classList.remove("active"));
                if (clickedBtn) clickedBtn.classList.add("active");
            }
        } catch (e) {
            console.error("Failed to switch scenario:", e);
        }
    }

    initTabs() {
        const tabBtns = document.querySelectorAll(".tab-btn");
        tabBtns.forEach(btn => {
            btn.addEventListener("click", () => {
                tabBtns.forEach(b => b.classList.remove("active"));
                document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));

                btn.classList.add("active");
                const targetId = btn.getAttribute("data-tab");
                const targetContent = document.getElementById(targetId);
                if (targetContent) targetContent.classList.add("active");

                // Trigger chart re-render on tab switch
                if (targetId === "tabCharts") {
                    if (window.chartThermal) window.chartThermal.initCanvasResolution();
                    if (window.chartDewPD) window.chartDewPD.initCanvasResolution();
                }
            });
        });
    }

    initModbusFilters() {
        const searchInput = document.getElementById("modbusSearch");
        if (searchInput) {
            searchInput.addEventListener("input", (e) => {
                this.searchQuery = e.target.value.toLowerCase();
                this.renderModbusTable();
            });
        }

        const filterRadios = document.querySelectorAll("input[name='devFilter']");
        filterRadios.forEach(radio => {
            radio.addEventListener("change", (e) => {
                this.activeFilter = e.target.value;
                this.renderModbusTable();
            });
        });
    }

    async fetchInitialHistory() {
        try {
            const res = await fetch("/api/history");
            const history = await res.json();
            if (Array.isArray(history) && history.length > 0) {
                history.forEach(pt => {
                    if (window.chartThermal) window.chartThermal.pushData(pt);
                    if (window.chartDewPD) window.chartDewPD.pushData(pt);
                });
            }
        } catch (e) {
            console.warn("Could not load initial history:", e);
        }
    }

    connectWebSocket() {
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsUrl = `${protocol}//${window.location.host}/ws/live`;

        const badge = document.getElementById("scadaCommBadge");

        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
            if (badge) {
                badge.innerHTML = `<span class="pulse-dot"></span><span>MODBUS RTU: ONLINE (19200 8E1)</span>`;
                badge.style.color = "var(--cyan-primary)";
            }
        };

        this.ws.onmessage = (evt) => {
            try {
                const data = JSON.parse(evt.data);
                this.handleTelemetry(data);
            } catch (err) {
                console.error("Error parsing telemetry message:", err);
            }
        };

        this.ws.onclose = () => {
            if (badge) {
                badge.innerHTML = `<span class="pulse-dot" style="background:#ef4444; box-shadow:none;"></span><span>MODBUS RTU: YENİDEN BAĞLANIYOR...</span>`;
                badge.style.color = "#ef4444";
            }
            setTimeout(() => this.connectWebSocket(), 2000);
        };

        this.ws.onerror = (err) => {
            console.warn("WebSocket error:", err);
            this.ws.close();
        };
    }

    handleTelemetry(data) {
        this.telemetry = data;
        window.latestTelemetry = data;

        // 1. Update Scenario Label
        const scDesc = document.getElementById("scenarioDescription");
        if (scDesc && data.scenario_description) {
            scDesc.textContent = data.scenario_description;
        }

        // 2. Update KPI 1: Health Index
        const hi = data.health_index;
        if (hi) {
            const elVal = document.getElementById("healthIndexValue");
            const elChip = document.getElementById("healthStatusChip");
            const elGauge = document.getElementById("gaugeProgress");

            if (elVal) elVal.textContent = Math.round(hi.health_index);
            if (elChip) {
                elChip.textContent = hi.status_label;
                elChip.style.color = hi.color_code;
                elChip.style.borderColor = hi.color_code;
                elChip.style.background = `${hi.color_code}22`;
            }
            if (elGauge) {
                const circumference = 314;
                const offset = circumference - (hi.health_index / 100) * circumference;
                elGauge.style.strokeDashoffset = offset;
                elGauge.style.stroke = hi.color_code;
            }

            // Sub-bars with Nullish Coalescing (??) so 0% does NOT fallback to 95%!
            const subs = hi.sub_scores || {};
            const updateBar = (barId, valId, val) => {
                const bar = document.getElementById(barId);
                const text = document.getElementById(valId);
                const safeVal = val !== undefined && val !== null ? val : 100;
                if (bar) bar.style.width = `${safeVal}%`;
                if (text) text.textContent = `${Math.round(safeVal)}%`;
            };
            updateBar("barThermal", "valThermal", subs.thermal_contact);
            updateBar("barInsulation", "valInsulation", subs.insulation_pd);
            updateBar("barEnv", "valEnv", subs.environmental_dew);
            updateBar("barElec", "valElec", subs.electrical_quality);
        }

        // 3. Update KPI 2: Thermal Residual
        const th = data.thermal;
        if (th) {
            const elMeas = document.getElementById("measuredBusbarTemp");
            const elPred = document.getElementById("predictedBusbarTemp");
            const elResVal = document.getElementById("residualValue");
            const elResStat = document.getElementById("residualStatus");
            const elAmb = document.getElementById("ambientTemp");
            const elCur = document.getElementById("loadCurrent");

            const dsya4 = th.dsya4_eval || {};
            const displayMeasured = dsya4.measured_temp_c > 65 ? dsya4.measured_temp_c : th.main_busbar_temp_c;
            const displayResidual = dsya4.residual_delta_t > 15 ? dsya4.residual_delta_t : th.main_busbar_residual_c;

            if (elMeas) elMeas.textContent = `${displayMeasured.toFixed(1)} °C`;
            if (elPred) elPred.textContent = `${th.main_busbar_predicted_c.toFixed(1)} °C`;
            if (elResVal) elResVal.textContent = `${displayResidual >= 0 ? '+' : ''}${displayResidual.toFixed(1)} °C`;
            
            if (elResStat) {
                if (displayResidual >= 25) {
                    elResStat.textContent = "KRİTİK GEVŞEK BAĞLANTI";
                    elResStat.style.color = "#ef4444";
                    elResStat.style.background = "rgba(239, 68, 68, 0.2)";
                } else if (displayResidual >= 15) {
                    elResStat.textContent = "ERKEN KONTAK BOZULMASI";
                    elResStat.style.color = "#f59e0b";
                    elResStat.style.background = "rgba(245, 158, 11, 0.2)";
                } else {
                    elResStat.textContent = "NOMİNAL DİRENÇ";
                    elResStat.style.color = "#10b981";
                    elResStat.style.background = "rgba(16, 185, 129, 0.15)";
                }
            }

            if (elAmb) elAmb.textContent = `${th.ambient_temp_c.toFixed(1)} °C`;
            if (elCur) elCur.textContent = `${data.electrical.current_l1.toFixed(1)} A`;
        }

        // 4. Update KPI 3: Dew Point & HFCT PD
        const env = data.environmental_pd;
        if (env) {
            const elRh = document.getElementById("rhValue");
            const elDp = document.getElementById("dewPointValue");
            const elDm = document.getElementById("dewMarginValue");
            const elPdPps = document.getElementById("pdPps");
            const elPdPeak = document.getElementById("pdPeak");
            const elPdChip = document.getElementById("pdStateChip");

            if (elRh) elRh.textContent = `${env.relative_humidity_pct.toFixed(1)} %`;
            if (elDp) elDp.textContent = `${env.dew_point_c.toFixed(1)} °C`;
            if (elDm) {
                elDm.textContent = `${env.dew_margin_c.toFixed(1)} °C`;
                elDm.style.color = env.dew_margin_c <= 3.0 ? "#ef4444" : (env.dew_margin_c <= 6.0 ? "#f59e0b" : "#10b981");
            }

            if (elPdPps) elPdPps.textContent = `${env.hfct_pd_pps.toFixed(1)} pps`;
            if (elPdPeak) elPdPeak.textContent = `${env.hfct_peak_pc.toFixed(0)} pC`;

            if (elPdChip) {
                elPdChip.textContent = env.pd_state;
                elPdChip.style.color = env.pd_state === "CRITICAL" ? "#ef4444" : (env.pd_state === "ELEVATED" ? "#f59e0b" : "#10b981");
            }
        }

        // 5. Update KPI 4: Arc Protection TVOC-2 (Check trip_executed OR latched system_state == 2)
        const arc = data.optical_arc;
        if (arc) {
            const elArcLight = document.getElementById("arcStatusLight");
            const elArcState = document.getElementById("arcSystemState");
            const elTripCount = document.getElementById("tripCount");

            const isTrippedOrLatched = arc.trip_executed || arc.system_state === 2 || arc.latched;

            if (elArcLight) {
                elArcLight.className = isTrippedOrLatched ? "status-light tripped" : "status-light";
            }

            if (elArcState) {
                elArcState.textContent = isTrippedOrLatched ? "TRIPPED (ARK AÇTIRMA - KİLİTLİ)" : "SYSTEM NORMAL";
                elArcState.style.color = isTrippedOrLatched ? "#ef4444" : "#ffffff";
            }

            if (elTripCount && data.tvoc2_registers) {
                elTripCount.textContent = data.tvoc2_registers[149] || 0;
            }
        }

        // 6. Update Digital Twin
        if (window.panoDigitalTwin) {
            window.panoDigitalTwin.updateTelemetry(data);
        }

        // 7. Update Charts
        const chartPt = {
            i_l1: data.electrical.current_l1,
            temp_busbar: data.thermal.main_busbar_temp_c,
            temp_model: data.thermal.main_busbar_predicted_c,
            temp_dsya4: data.thermal.dsya4_eval.measured_temp_c,
            dew_margin: data.environmental_pd.dew_margin_c,
            hfct_pd: data.environmental_pd.hfct_pd_pps
        };
        if (window.chartThermal) window.chartThermal.pushData(chartPt);
        if (window.chartDewPD) window.chartDewPD.pushData(chartPt);

        // 8. Handle Alerts (Deduplicated)
        if (data.active_alert && !this.processedAlertIds.has(data.active_alert.id)) {
            this.processedAlertIds.add(data.active_alert.id);
            this.handleNewAlert(data.active_alert);
        }

        // 9. Store Modbus registers and re-render table if visible
        this.modbusData = {
            mpr: data.mpr53cs_registers || {},
            tvoc: data.tvoc2_registers || {}
        };
        this.renderModbusTable();
    }

    handleNewAlert(alert) {
        // Dispatch to WhatsApp virtual phone
        if (window.whatsappModal) {
            window.whatsappModal.pushAlert(alert);
        }

        // Add to SOE Alarm Feed
        this.historicalAlarms.unshift(alert);
        if (this.historicalAlarms.length > 30) this.historicalAlarms.pop();
        this.renderAlarmFeed();
    }

    renderAlarmFeed() {
        const container = document.getElementById("alarmFeed");
        if (!container) return;

        if (this.historicalAlarms.length === 0) {
            container.innerHTML = `
                <div style="text-align:center; padding:30px; color:#64748b; font-size:12px;">
                    <span>Aktif alarm veya arıza kaydı bulunmamaktadır. Sistem sağlıklı.</span>
                </div>
            `;
            return;
        }

        let html = "";
        this.historicalAlarms.forEach(alr => {
            const isCrit = alr.severity === "CRITICAL";
            html += `
                <div class="alarm-card ${isCrit ? 'critical' : 'warning'}">
                    <div class="alarm-top">
                        <span class="time">${alr.timestamp}</span>
                        <span class="sev-tag ${alr.severity}">${alr.severity}</span>
                    </div>
                    <div class="alarm-title">${alr.anomaly_type}</div>
                    <div class="alarm-desc">📍 ${alr.location} — ${alr.metrics.highlight_summary || ''}</div>
                    <div class="alarm-action">🔧 Öneri: ${alr.whatsapp_payload ? alr.whatsapp_payload.action : 'Saha ekibi yönlendirildi.'}</div>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    renderModbusTable() {
        const tbody = document.getElementById("modbusTableBody");
        if (!tbody) return;

        const mprList = [
            { dev: "ENTES MPR-53CS", dec: 0, hex: "0x0000", name: "L1 Phase Voltage", unit: "0.1 V", fmt: "unsigned int", scale: 0.1 },
            { dev: "ENTES MPR-53CS", dec: 2, hex: "0x0002", name: "L2 Phase Voltage", unit: "0.1 V", fmt: "unsigned int", scale: 0.1 },
            { dev: "ENTES MPR-53CS", dec: 4, hex: "0x0004", name: "L3 Phase Voltage", unit: "0.1 V", fmt: "unsigned int", scale: 0.1 },
            { dev: "ENTES MPR-53CS", dec: 6, hex: "0x0006", name: "L1 Phase Current", unit: "0.001 A x CT", fmt: "unsigned int", scale: 1.0 },
            { dev: "ENTES MPR-53CS", dec: 8, hex: "0x0008", name: "L2 Phase Current", unit: "0.001 A x CT", fmt: "unsigned int", scale: 1.0 },
            { dev: "ENTES MPR-53CS", dec: 10, hex: "0x000A", name: "L3 Phase Current", unit: "0.001 A x CT", fmt: "unsigned int", scale: 1.0 },
            { dev: "ENTES MPR-53CS", dec: 12, hex: "0x000C", name: "Neutral Current", unit: "0.001 A x CT", fmt: "unsigned int", scale: 1.0 },
            { dev: "ENTES MPR-53CS", dec: 14, hex: "0x000E", name: "L1-L2 Phase Voltage", unit: "0.1 V", fmt: "unsigned int", scale: 0.1 },
            { dev: "ENTES MPR-53CS", dec: 38, hex: "0x0026", name: "L1 Phase Cos Phi", unit: "0.001", fmt: "int", scale: 0.001 },
            { dev: "ENTES MPR-53CS", dec: 58, hex: "0x003A", name: "Network Frequency", unit: "0.01 Hz", fmt: "unsigned int", scale: 0.01 },
            { dev: "ENTES MPR-53CS", dec: 72, hex: "0x0048", name: "L1 Voltage THD", unit: "0.1 %", fmt: "unsigned int", scale: 0.1 },
            { dev: "ENTES MPR-53CS", dec: 78, hex: "0x004E", name: "L1 Current THD", unit: "0.1 %", fmt: "unsigned int", scale: 0.1 },
            { dev: "ENTES MPR-53CS", dec: 32768, hex: "0x8000", name: "VT Ratio Setting", unit: "0.1", fmt: "short-int", scale: 1.0 },
            { dev: "ENTES MPR-53CS", dec: 32769, hex: "0x8001", name: "CT Ratio Setting (2500/5)", unit: "1", fmt: "short-int", scale: 1.0 }
        ];

        const tvocList = [
            { dev: "ABB TVOC-2", dec: 100, hex: "0x0064", name: "Trip 1 Detector Low (X1:1-X2:5)", unit: "Bitfield", fmt: "HEX", scale: 1.0 },
            { dev: "ABB TVOC-2", dec: 102, hex: "0x0066", name: "Trip 1 Relays (K4, K5, K6)", unit: "Bitfield", fmt: "HEX", scale: 1.0 },
            { dev: "ABB TVOC-2", dec: 149, hex: "0x0095", name: "Number of Trips Logged", unit: "Integer", fmt: "unsigned int", scale: 1.0 },
            { dev: "ABB TVOC-2", dec: 500, hex: "0x01F4", name: "Installed Modules Bitfield", unit: "Bitfield", fmt: "HEX", scale: 1.0 },
            { dev: "ABB TVOC-2", dec: 1000, hex: "0x03E8", name: "Reset Trip Command (Write 1)", unit: "Command", fmt: "W", scale: 1.0 },
            { dev: "ABB TVOC-2", dec: 1300, hex: "0x0514", name: "System State (0:Norm, 2:Trip)", unit: "State Code", fmt: "unsigned int", scale: 1.0 }
        ];

        let combined = [];
        if (this.activeFilter === "ALL" || this.activeFilter === "MPR") combined.push(...mprList);
        if (this.activeFilter === "ALL" || this.activeFilter === "TVOC") combined.push(...tvocList);

        if (this.searchQuery) {
            combined = combined.filter(r => 
                r.name.toLowerCase().includes(this.searchQuery) ||
                r.dec.toString().includes(this.searchQuery) ||
                r.hex.toLowerCase().includes(this.searchQuery) ||
                r.dev.toLowerCase().includes(this.searchQuery)
            );
        }

        let html = "";
        combined.forEach(item => {
            let rawVal = "-";
            let engVal = "-";

            if (item.dev.includes("MPR")) {
                rawVal = this.modbusData.mpr[item.dec] !== undefined ? this.modbusData.mpr[item.dec] : "-";
                if (rawVal !== "-") {
                    engVal = (rawVal * item.scale).toFixed(item.scale < 1.0 ? 2 : 0);
                }
            } else {
                rawVal = this.modbusData.tvoc[item.dec] !== undefined ? this.modbusData.tvoc[item.dec] : "-";
                if (rawVal !== "-") {
                    engVal = item.fmt === "HEX" ? `0x${rawVal.toString(16).toUpperCase().padStart(4, '0')}` : rawVal.toString();
                }
            }

            html += `
                <tr>
                    <td style="color:${item.dev.includes('MPR') ? '#38bdf8' : '#06b6d4'}; font-weight:600;">${item.dev}</td>
                    <td>${item.dec}</td>
                    <td style="color:#a855f7;">${item.hex}</td>
                    <td style="color:#f8fafc;">${item.name}</td>
                    <td class="highlight-val">${rawVal}</td>
                    <td style="color:#10b981; font-weight:600;">${engVal} ${item.unit}</td>
                    <td style="color:#64748b;">${item.fmt}</td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
    }
}

// Instantiate on load
document.addEventListener("DOMContentLoaded", () => {
    window.dashboardApp = new DashboardApp();
});
