/**
 * Grid-Guard AI - Main Dashboard Controller & WebSocket Client.
 * Binds SCADA UI, real-time analytics, scenario controls, and Modbus tables.
 */

class DashboardApp {
    constructor() {
        this.ws = null;
        this.telemetry = null;
        this.historicalAlarms = [];
        this.modbusData = { mpr: {}, tvoc: {}, ai: {} };
        this.activeFilter = "ALL";
        this.searchQuery = "";
        this.activeTabId = document.querySelector(".tab-btn.active")?.getAttribute("data-tab") || "tabCharts";
        this.processedAlertIds = new Set();
        this.pendingTelemetry = null;
        this.pendingAlerts = [];
        this.telemetryFrame = null;
        this.reconnectTimer = null;
        this.reconnectDelayMs = 1000;
        this.isClosing = false;

        this.initClock();
        this.initThemeSelector();
        this.initScenarioToolbar();
        this.initWorkspaceSplitter();
        this.initTabs();
        this.initWorkspaceWindows();
        this.initModbusFilters();
        this.initActionButtons();
        this.initFleetSelector();
        this.connectWebSocket();
        this.fetchInitialTelemetry();
        this.fetchInitialHistory();
        this.fetchInitialAlerts();
        this.handleUrlParams();
    }

    handleUrlParams() {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get("openPhone") === "1" || urlParams.get("openPhone") === "true") {
            setTimeout(() => {
                const btnPhone = document.getElementById("btnOpenPhone");
                if (btnPhone) btnPhone.click();
            }, 400);
        }
        const qPanel = urlParams.get("panel");
        if (qPanel) {
            setTimeout(async () => {
                const select = document.getElementById("fleetSelect");
                if (select) {
                    const clean = qPanel.replace(/\D/g, "");
                    const opt = Array.from(select.options).find(o => o.value == qPanel || o.value == clean);
                    if (opt) {
                        select.value = opt.value;
                        select.dispatchEvent(new Event("change"));
                    }
                }
            }, 600);
        }
    }

    async fetchInitialTelemetry() {
        const isStaticHost = window.location.hostname.includes("netlify.app") ||
                             window.location.hostname.includes("github.io") ||
                             window.location.hostname.includes("vercel.app") ||
                             window.location.protocol === "file:";

        if (isStaticHost && window.clientSimulatorEngine) {
            const snap = window.clientSimulatorEngine.step();
            this.handleTelemetry(snap);
            return;
        }

        try {
            const res = await fetch("/api/telemetry");
            const data = await res.json();
            if (data && data.scenario) {
                this.handleTelemetry(data);
                document.querySelectorAll(".btn-scenario").forEach(b => {
                    if (b.getAttribute("data-scenario") === data.scenario) {
                        b.classList.add("active");
                    } else {
                        b.classList.remove("active");
                    }
                });
            }
        } catch (e) {
            console.warn("Could not load initial telemetry from server, using client engine:", e);
            if (window.clientSimulatorEngine) {
                const snap = window.clientSimulatorEngine.step();
                this.handleTelemetry(snap);
            }
        }
    }

    initClock() {
        const el = document.getElementById("clockDisplay");
        setInterval(() => {
            const now = new Date();
            if (el) el.textContent = now.toLocaleTimeString('tr-TR');
        }, 1000);
    }

    populateFleetOptions(panels) {
        const select = document.getElementById("fleetSelect");
        if (!select || !Array.isArray(panels)) return;
        select.innerHTML = "";
        panels.forEach(p => {
            const opt = document.createElement("option");
            const pId = p.id || 1;
            opt.value = pId;
            let tag = "";
            if (p.status === "CRITICAL") tag = " [KRİTİK ALARM]";
            else if (p.status === "WARNING") tag = " [UYARI]";

            const subName = (p.substation || p.name || "")
                .replace("Izmir ", "")
                .replace("Manisa ", "")
                .replace("Denizli ", "")
                .replace("Aydin ", "")
                .replace("Mugla ", "");

            if (pId === 1) {
                opt.textContent = "Buca TM · Pano #1 (Canlı)";
                opt.selected = true;
            } else {
                opt.textContent = `${subName} · Pano #${pId}${tag ? tag : ` (%${Math.round(p.health_index)})`}`;
            }
            select.appendChild(opt);
        });
    }

    async initFleetSelector() {
        const select = document.getElementById("fleetSelect");
        if (!select) return;

        const isStaticHost = window.location.hostname.includes("netlify.app") ||
                             window.location.hostname.includes("github.io") ||
                             window.location.hostname.includes("vercel.app") ||
                             window.location.protocol === "file:";

        if (isStaticHost && window.clientSimulatorEngine) {
            this.populateFleetOptions(window.clientSimulatorEngine.fleetPanels);
            return;
        }

        try {
            const res = await fetch("/api/fleet");
            const data = await res.json();
            if (data && data.panels) {
                this.populateFleetOptions(data.panels);
            } else if (window.clientSimulatorEngine) {
                this.populateFleetOptions(window.clientSimulatorEngine.fleetPanels);
            }
        } catch (e) {
            console.warn("Could not load fleet data from server, using client engine:", e);
            if (window.clientSimulatorEngine) {
                this.populateFleetOptions(window.clientSimulatorEngine.fleetPanels);
            }
        }

        const fleetPill = document.getElementById("fleetSummaryPill");
        if (fleetPill) {
            fleetPill.addEventListener("click", () => {
                select.focus();
                if (typeof select.showPicker === "function") {
                    try { select.showPicker(); } catch (err) {}
                }
            });
        }

        select.addEventListener("change", async (e) => {
            const rawVal = e.target.value;
            const cleanId = String(rawVal).replace(/\D/g, "");
            if (rawVal === "1" || cleanId === "1" || cleanId === "001") {
                this.selectedFleetPanel = null;
                const descEl = document.getElementById("scenarioDescription");
                if (descEl) descEl.textContent = "GDZ Buca TM Pano #1 aktif dijital ikiz canlı telemetrisi izleniyor.";
                if (this.latestTelemetry) {
                    this.handleTelemetry(this.latestTelemetry);
                }
            } else if (cleanId) {
                try {
                    const res = await fetch(`/api/fleet/${cleanId}`);
                    const p = await res.json();
                    if (p && p.name) {
                        this.selectedFleetPanel = p;
                        this.renderFleetPanel(p);
                    }
                } catch (err) {
                    console.error("Error loading panel:", err);
                }
            }
        });
    }

    renderFleetPanel(p) {
        const descEl = document.getElementById("scenarioDescription");
        const bTemp = p.temp_c !== undefined ? p.temp_c : (p.main_busbar_temp_c || 35.0);
        const rDt = p.residual_dt_c !== undefined ? p.residual_dt_c : (p.residual_delta_t || 0.0);
        if (descEl) {
            descEl.textContent = `[FİLO İZLEME: ${p.name}] Sağlık: %${p.health_index} (${p.status}) | Bara: ${bTemp}°C (ΔT: ${rDt > 0 ? '+' : ''}${rDt}°C) | Canlı telemetriye dönmek için Pano #1'i seçiniz.`;
        }

        // Update Health Index KPI
        const elVal = document.getElementById("healthIndexValue");
        const elChip = document.getElementById("healthStatusChip");
        const elGauge = document.getElementById("gaugeProgress");
        if (elVal) elVal.textContent = Math.round(p.health_index);
        
        const isSanzo = document.body.classList.contains("theme-sanzo-wada");
        const isLight = document.body.classList.contains("theme-light");
        const okColor = isSanzo ? "#4eba7e" : (isLight ? "#0284c7" : "#00e5ff");
        const color = okColor;

        let statusTr = "OPTİMAL";
        if (p.status === "CRITICAL") {
            statusTr = "KRİTİK";
        } else if (p.status === "WARNING") {
            statusTr = "UYARI";
        }

        if (elChip) {
            elChip.textContent = statusTr;
            elChip.style.color = color;
            elChip.style.borderColor = color;
            elChip.style.background = `${color}1a`;
            const isDanger = p.status === "CRITICAL" || p.status === "WARNING";
            elChip.classList.toggle("danger-pulse", isDanger);
        }
        if (elGauge) {
            const circumference = 314;
            const offset = circumference - (p.health_index / 100) * circumference;
            elGauge.style.strokeDashoffset = offset;
            elGauge.style.stroke = color;
        }

        // Sub-bars
        const subs = p.sub_scores || {};
        const updateBar = (barId, valId, val) => {
            const bar = document.getElementById(barId);
            const text = document.getElementById(valId);
            const safeVal = val !== undefined && val !== null ? val : 100;
            if (bar) {
                bar.style.width = `${safeVal}%`;
                bar.style.backgroundColor = okColor;
            }
            if (text) text.textContent = `${Math.round(safeVal)}%`;
        };
        updateBar("barThermal", "valThermal", subs.thermal_contact ?? (p.status === "CRITICAL" ? 40 : (p.status === "WARNING" ? 65 : 98)));
        updateBar("barInsulation", "valInsulation", subs.insulation_pd ?? (p.status === "CRITICAL" ? 50 : (p.status === "WARNING" ? 75 : 96)));
        updateBar("barEnv", "valEnv", subs.environmental_dew ?? 95);
        updateBar("barElec", "valElec", subs.electrical_quality ?? 99);

        // Update Thermal Card
        const elMeas = document.getElementById("measuredBusbarTemp");
        const elPred = document.getElementById("predictedBusbarTemp");
        const elResVal = document.getElementById("residualValue");
        const elResStat = document.getElementById("residualStatus");
        const elMeasLabel = document.getElementById("thermalCardMeasLabel");

        if (elMeasLabel) elMeasLabel.textContent = `Ölçülen Sıcaklık (${p.name.split(' ')[0]}):`;
        if (elMeas) elMeas.textContent = `${bTemp.toFixed(1)} °C`;
        const predTemp = (bTemp - rDt).toFixed(1);
        if (elPred) elPred.textContent = `${predTemp} °C`;
        if (elResVal) elResVal.textContent = `${rDt >= 0 ? '+' : ''}${rDt.toFixed(1)} °C`;
        if (elResStat) {
            elResStat.textContent = p.status === "CRITICAL" ? "KRİTİK TERMİK RİSK" : (p.status === "WARNING" ? "ERKEN KONTAK BOZULMASI" : "NOMİNAL DİRENÇ");
            elResStat.style.color = color;
            elResStat.style.borderColor = color;
            elResStat.style.background = `${color}1a`;
            const isThermalDanger = p.status === "CRITICAL" || rDt >= 15;
            elResStat.classList.toggle("danger-pulse", isThermalDanger);
        }

        // Update Dew Point & PD
        const elDm = document.getElementById("dewMarginValue");
        const elPdPps = document.getElementById("pdPps");
        const elRh = document.getElementById("rhValue");
        const elDp = document.getElementById("dewPointValue");
        const elAmb = document.getElementById("ambientTemp");
        const elCur = document.getElementById("loadCurrent");

        const dewMargin = p.dew_margin_c !== undefined ? p.dew_margin_c : 18.0;
        // Exact physical identity: Surface Temp - Dew Margin = Dew Point!
        const dewPoint = Math.max(0.0, Number((bTemp - dewMargin).toFixed(1)));
        const ambientT = Math.max(15.0, Number((bTemp - 11.5).toFixed(1)));
        const loadA = p.load_pct ? ((p.load_pct / 100.0) * 470.0).toFixed(1) : "318.0";

        if (elDm) elDm.textContent = `${dewMargin.toFixed(1)} °C`;
        if (elDp) elDp.textContent = `${dewPoint.toFixed(1)} °C`;
        if (elRh) elRh.textContent = `${(p.relative_humidity_pct || 48.2).toFixed(1)} %`;
        if (elPdPps) elPdPps.textContent = `${(p.hfct_pd_pps || 4.5).toFixed(1)} pps`;
        if (elAmb) elAmb.textContent = `${ambientT.toFixed(1)} °C`;
        if (elCur) elCur.textContent = `${loadA} A`;

        // Update Prescriptive Card
        const prescCard = document.getElementById("prescriptiveActionCard");
        const prescText = document.getElementById("prescriptiveActionText");
        if (prescCard && prescText) {
            if (p.status === "CRITICAL") {
                prescCard.className = "prescriptive-action-card critical";
                prescText.textContent = `Aksiyon: ${p.substation} ${p.name} acil saha incelemesi talep edildi: ${p.anomaly_detail}.`;
            } else if (p.status === "WARNING") {
                prescCard.className = "prescriptive-action-card warning";
                prescText.textContent = `Aksiyon: ${p.substation} ${p.name} planlı torklama ve termal kontrol: ${p.anomaly_detail}.`;
            } else {
                prescCard.className = "prescriptive-action-card";
                prescText.textContent = `Aksiyon: ${p.substation} ${p.name} nominal çalışıyor. Periyodik kestirimci bakım takvimi geçerlidir.`;
            }
        }
    }

    async switchScenario(scenarioName, clickedBtn) {
        // 1. Reset fleet panel selection so live telemetry stream updates the UI immediately!
        this.selectedFleetPanel = null;
        const fleetSelect = document.getElementById("fleetSelect");
        if (fleetSelect) {
            fleetSelect.value = "1";
        }

        if (window.clientSimulatorEngine) {
            window.clientSimulatorEngine.setScenario(scenarioName);
        }

        document.querySelectorAll(".btn-scenario").forEach(b => b.classList.remove("active"));
        if (clickedBtn) clickedBtn.classList.add("active");

        const isStaticHost = window.location.hostname.includes("netlify.app") ||
                             window.location.hostname.includes("github.io") ||
                             window.location.hostname.includes("vercel.app") ||
                             window.location.protocol === "file:";

        if (isStaticHost && window.clientSimulatorEngine) {
            const snap = window.clientSimulatorEngine.step();
            this.handleTelemetry(snap);
        } else {
            try {
                const res = await fetch(`/api/scenario/${scenarioName}`, { method: "POST" });
                const data = await res.json();
                if (data.status === "SUCCESS") {
                    try {
                        const tRes = await fetch("/api/telemetry");
                        const tData = await tRes.json();
                        if (tData) {
                            this.handleTelemetry(tData);
                        }
                    } catch (e) {}
                }
            } catch (e) {
                // Netlify / Standalone client simulation fallback
                if (window.clientSimulatorEngine) {
                    const snap = window.clientSimulatorEngine.step();
                    this.handleTelemetry(snap);
                }
            }
        }

        if (scenarioName.toUpperCase() === "NORMAL") {
            if (window.whatsappModal) {
                window.whatsappModal.resetCount();
            }
            const descEl = document.getElementById("scenarioDescription");
            if (descEl) descEl.textContent = "Normal çalışma döngüsü. Tüm sensörler nominal sınırlarda.";

            const elArcLight = document.getElementById("arcStatusLight");
            if (elArcLight) elArcLight.className = "status-light";

            const elArcState = document.getElementById("arcSystemState");
            if (elArcState) {
                elArcState.textContent = "SİSTEM NORMAL";
                elArcState.style.color = "#ffffff";
            }
            document.getElementById("btnTvocReset")?.classList.remove("tripped");
        }
    }

    initThemeSelector() {
        const trigger = document.getElementById("btnThemeTrigger");
        const dropdown = document.getElementById("themeMenuDropdown");
        const activeLabel = document.getElementById("themeActiveLabel");
        const themeItems = document.querySelectorAll(".theme-item");

        if (!trigger || !dropdown) return;

        const themes = {
            "default": "Koyu tema",
            "light": "Beyaz tema",
            "oled": "Siyah tema",
            "sanzo-wada": "Sanzo Wada"
        };

        const applyTheme = (themeKey) => {
            const validKey = themes[themeKey] ? themeKey : "default";

            document.body.classList.remove("theme-default", "theme-light", "theme-oled", "theme-sanzo-wada");
            document.body.classList.add(`theme-${validKey}`);

            themeItems.forEach(item => {
                const itemTheme = item.getAttribute("data-theme");
                if (itemTheme === validKey) {
                    item.classList.add("active");
                    item.setAttribute("aria-selected", "true");
                } else {
                    item.classList.remove("active");
                    item.setAttribute("aria-selected", "false");
                }
            });

            if (activeLabel) {
                activeLabel.textContent = "Tema";
            }

            try {
                localStorage.setItem("grid_guard_theme", validKey);
            } catch (err) {
                console.warn("Could not save theme to localStorage", err);
            }

            if (window.chartThermal) {
                window.chartThermal.initCanvasResolution();
                window.chartThermal.render();
            }
            if (window.chartDewPD) {
                window.chartDewPD.initCanvasResolution();
                window.chartDewPD.render();
            }
            if (window.panoDigitalTwin) {
                window.panoDigitalTwin.renderBaseSvg();
                if (this.telemetry) {
                    window.panoDigitalTwin.updateTelemetry(this.telemetry);
                }
            }
            if (this.selectedFleetPanel) {
                this.renderFleetPanel(this.selectedFleetPanel);
            } else if (this.telemetry) {
                this.handleTelemetry(this.telemetry);
            }
            if (this.modbusData) {
                this.renderModbusTable();
            }
        };

        window.setTheme = applyTheme;
        window.toggleThemeMenu = () => {
            const isOpen = dropdown.classList.toggle("show");
            trigger.setAttribute("aria-expanded", isOpen ? "true" : "false");
        };

        const urlParams = new URLSearchParams(window.location.search);
        const queryTheme = urlParams.get("theme");
        const openThemeMenu = urlParams.get("openTheme");

        const savedTheme = queryTheme || localStorage.getItem("grid_guard_theme") || "default";
        applyTheme(savedTheme);

        if (openThemeMenu === "1" || openThemeMenu === "true") {
            dropdown.classList.add("show");
            trigger.setAttribute("aria-expanded", "true");
        }

        trigger.addEventListener("click", (e) => {
            e.stopPropagation();
            const isOpen = dropdown.classList.toggle("show");
            trigger.setAttribute("aria-expanded", isOpen ? "true" : "false");
        });

        themeItems.forEach(item => {
            item.addEventListener("click", (e) => {
                e.stopPropagation();
                const themeKey = item.getAttribute("data-theme");
                applyTheme(themeKey);
                dropdown.classList.remove("show");
                trigger.setAttribute("aria-expanded", "false");
            });
        });

        document.addEventListener("click", (e) => {
            if (!dropdown.contains(e.target) && !trigger.contains(e.target)) {
                dropdown.classList.remove("show");
                trigger.setAttribute("aria-expanded", "false");
            }
        });

        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && dropdown.classList.contains("show")) {
                dropdown.classList.remove("show");
                trigger.setAttribute("aria-expanded", "false");
                trigger.focus();
            }
        });
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

    initWorkspaceSplitter() {
        const splitter = document.getElementById("workspaceSplitter");
        const workspace = document.getElementById("mainWorkspace");
        if (!splitter || !workspace) return;

        let isDragging = false;

        splitter.addEventListener("mousedown", (e) => {
            isDragging = true;
            splitter.classList.add("dragging");
            document.body.style.cursor = "col-resize";
            document.body.style.userSelect = "none";
            e.preventDefault();
        });

        window.addEventListener("mousemove", (e) => {
            if (!isDragging) return;
            const rect = workspace.getBoundingClientRect();
            const minLeft = 320;
            const maxLeft = rect.width - 320;
            let leftWidth = e.clientX - rect.left;
            leftWidth = Math.max(minLeft, Math.min(maxLeft, leftWidth));

            workspace.style.gridTemplateColumns = `${leftWidth}px 10px 1fr`;

            const pct = Math.round((leftWidth / rect.width) * 100);
            const widthSlider = document.getElementById("dimWidthSlider");
            const widthVal = document.getElementById("dimWidthVal");
            if (widthSlider) widthSlider.value = pct;
            if (widthVal) widthVal.textContent = `%${pct}`;

            window.chartThermal?.initCanvasResolution();
            window.chartThermal?.render();
            window.chartDewPD?.initCanvasResolution();
            window.chartDewPD?.render();
        });

        window.addEventListener("mouseup", () => {
            if (isDragging) {
                isDragging = false;
                splitter.classList.remove("dragging");
                document.body.style.cursor = "";
                document.body.style.userSelect = "";

                window.chartThermal?.initCanvasResolution();
                window.chartThermal?.render();
                window.chartDewPD?.initCanvasResolution();
                window.chartDewPD?.render();
            }
        });
    }

    initActionButtons() {
        const btnReset = document.getElementById("btnTvocReset");
        if (btnReset) {
            btnReset.addEventListener("click", async () => {
                try {
                    const res = await fetch("/api/arc/reset", { method: "POST" });
                    const data = await res.json();
                    if (data.status === "SUCCESS") {
                        document.querySelectorAll(".btn-scenario").forEach(b => {
                            if (b.getAttribute("data-scenario") === "NORMAL") b.classList.add("active");
                            else b.classList.remove("active");
                        });
                        const descEl = document.getElementById("scenarioDescription");
                        if (descEl) descEl.textContent = "TVOC-2 açtırma kilidi başarıyla sıfırlandı. Sistem normal denetime döndü.";
                        
                        btnReset.innerHTML = '<svg class="ui-icon" style="width:14px;height:14px;" aria-hidden="true"><use href="#icon-status-ok"></use></svg><span>Sıfırlandı!</span>';
                        setTimeout(() => {
                            btnReset.innerHTML = '<svg class="ui-icon" style="width:14px;height:14px;" aria-hidden="true"><use href="#icon-restore"></use></svg><span>TVOC-2 Sıfırla (PDU 1000)</span>';
                        }, 2000);
                    }
                } catch (e) {
                    console.error("Failed to reset TVOC-2:", e);
                }
            });
        }

        const btnExport = document.getElementById("btnExportReport");
        if (btnExport) {
            btnExport.addEventListener("click", async () => {
                try {
                    btnExport.innerHTML = '<svg class="ui-icon" style="width:14px;height:14px;" aria-hidden="true"><use href="#icon-check"></use></svg><span>İndiriliyor...</span>';
                    const res = await fetch("/api/reports/latest");
                    const data = await res.json();
                    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `GridGuard_Olay_Raporu_${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    btnExport.innerHTML = '<svg class="ui-icon" style="width:14px;height:14px;" aria-hidden="true"><use href="#icon-check"></use></svg><span>Rapor İndirildi!</span>';
                    setTimeout(() => {
                        btnExport.innerHTML = '<svg class="ui-icon" style="width:14px;height:14px;" aria-hidden="true"><use href="#icon-register"></use></svg><span>Olay Raporunu İndir (JSON)</span>';
                    }, 2500);
                } catch (e) {
                    console.error("Failed to export incident report:", e);
                    btnExport.innerHTML = '<svg class="ui-icon" style="width:14px;height:14px;" aria-hidden="true"><use href="#icon-register"></use></svg><span>Olay Raporunu İndir (JSON)</span>';
                }
            });
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
                this.activeTabId = targetId || "tabCharts";
                const targetContent = document.getElementById(targetId);
                if (targetContent) targetContent.classList.add("active");

                // Reconcile only the panel that just became visible.
                if (this.activeTabId === "tabCharts") {
                    if (window.chartThermal) window.chartThermal.initCanvasResolution();
                    if (window.chartDewPD) window.chartDewPD.initCanvasResolution();
                } else if (this.activeTabId === "tabModbus") {
                    this.renderModbusTable();
                }
            });
        });

        const urlTab = new URLSearchParams(window.location.search).get("tab");
        if (urlTab) {
            const targetBtn = document.querySelector(`.tab-btn[data-tab="${urlTab}"]`);
            if (targetBtn) targetBtn.click();
        }
    }

    initWorkspaceWindows() {
        this.activeWindow = null;
        this.windowResizeObserver = null;
        this.windowOverlay = document.createElement("div");
        this.windowOverlay.className = "workspace-window-overlay";
        this.windowOverlay.innerHTML = '<div class="workspace-window-backdrop" aria-hidden="true"></div>';
        document.body.appendChild(this.windowOverlay);

        const panels = [
            document.querySelector(".digital-twin-section"),
            document.querySelector(".analytics-section")
        ].filter(Boolean);

        panels.forEach((panel, index) => {
            const header = panel.querySelector(".card-header, .panel-header, .analytics-tabs");
            if (!header || header.querySelector(".panel-expand-control")) return;

            const title = panel.querySelector("h2, h3")?.textContent?.trim() || `Panel ${index + 1}`;
            panel.dataset.windowTitle = title;
            panel.classList.add("workspace-window-target");

            const control = document.createElement("button");
            control.type = "button";
            control.className = "panel-expand-control";
            control.setAttribute("aria-expanded", "false");
            control.setAttribute("aria-label", `${title} panelini büyüt`);
            control.title = "Paneli büyüt / eski boyuta getir";
            control.innerHTML = '<svg class="ui-icon" aria-hidden="true"><use href="#icon-expand"></use></svg>';
            control.addEventListener("click", () => {
                if (this.activeWindow === panel) this.closeWorkspaceWindow();
                else this.openWorkspaceWindow(panel, control);
            });
            header.appendChild(control);
        });

        this.windowOverlay.querySelector(".workspace-window-backdrop").addEventListener("click", () => {
            this.closeWorkspaceWindow();
        });
        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape" && this.activeWindow) {
                event.preventDefault();
                this.closeWorkspaceWindow();
            }
        });
        window.addEventListener("resize", () => this.refreshWorkspaceWindow());
    }

    openWorkspaceWindow(panel, trigger) {
        if (this.activeWindow) this.closeWorkspaceWindow();
        this.activeWindow = panel;
        this.activeWindowTrigger = trigger;
        panel.classList.add("workspace-window-expanded");
        this.windowOverlay.classList.add("active");
        document.body.classList.add("workspace-window-open");
        trigger.setAttribute("aria-expanded", "true");
        trigger.setAttribute("aria-label", `${panel.dataset.windowTitle} panelini eski boyuta getir`);
        trigger.innerHTML = '<svg class="ui-icon" aria-hidden="true"><use href="#icon-restore"></use></svg>';

        this.windowResizeObserver?.disconnect();
        this.windowResizeObserver = new ResizeObserver(() => this.refreshWorkspaceWindow());
        this.windowResizeObserver.observe(panel);
        this.refreshWorkspaceWindow();
        requestAnimationFrame(() => trigger.focus());
    }

    closeWorkspaceWindow() {
        const panel = this.activeWindow;
        if (!panel) return;
        const trigger = this.activeWindowTrigger;
        panel.classList.remove("workspace-window-expanded");
        this.windowOverlay.classList.remove("active");
        document.body.classList.remove("workspace-window-open");
        if (trigger) {
            trigger.setAttribute("aria-expanded", "false");
            trigger.setAttribute("aria-label", `${panel.dataset.windowTitle} panelini büyüt`);
            trigger.innerHTML = '<svg class="ui-icon" aria-hidden="true"><use href="#icon-expand"></use></svg>';
        }
        this.windowResizeObserver?.disconnect();
        this.windowResizeObserver = null;
        this.activeWindow = null;
        this.activeWindowTrigger = null;
        if (window.chartThermal) window.chartThermal.initCanvasResolution();
        if (window.chartDewPD) window.chartDewPD.initCanvasResolution();
        requestAnimationFrame(() => trigger?.focus());
    }

    refreshWorkspaceWindow() {
        if (!this.activeWindow) return;
        const bounds = this.activeWindow.getBoundingClientRect();
        if (bounds.width <= 0 || bounds.height <= 0) return;
        if (this.activeWindow.querySelector("#chartThermal, #chartDewPD")) {
            window.chartThermal?.initCanvasResolution();
            window.chartThermal?.render();
            window.chartDewPD?.initCanvasResolution();
            window.chartDewPD?.render();
        }
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
        const isStaticHost = window.location.hostname.includes("netlify.app") ||
                             window.location.hostname.includes("github.io") ||
                             window.location.hostname.includes("vercel.app") ||
                             window.location.protocol === "file:";

        if (isStaticHost && window.clientSimulatorEngine) {
            this.generateInitialClientHistory();
            return;
        }

        try {
            const res = await fetch("/api/history");
            const history = await res.json();
            if (Array.isArray(history) && history.length > 0) {
                if (window.chartThermal) window.chartThermal.setHistory(history);
                if (window.chartDewPD) window.chartDewPD.setHistory(history);
            }
        } catch (e) {
            console.warn("Could not load initial history, using client simulation:", e);
            if (window.clientSimulatorEngine) {
                this.generateInitialClientHistory();
            }
        }
    }

    generateInitialClientHistory() {
        if (!window.clientSimulatorEngine) return;
        const pts = [];
        const now = Date.now();
        // Generate 35 points of historical wave data so charts start fully populated with rich dynamics
        for (let i = 35; i >= 0; i--) {
            const timeStr = new Date(now - i * 1000).toLocaleTimeString('tr-TR');
            const s = window.clientSimulatorEngine.step();
            const actMeas = s.scenario === "LOOSE_BOLT"
                ? (s.thermal.dsya4_eval ? s.thermal.dsya4_eval.measured_temp_c : 48.1)
                : s.thermal.main_busbar_temp_c;
            const actPred = s.scenario === "LOOSE_BOLT"
                ? (s.thermal.dsya4_eval ? s.thermal.dsya4_eval.predicted_temp_c : 27.9)
                : s.thermal.main_busbar_predicted_c;

            pts.push({
                time: timeStr,
                scenario: s.scenario,
                i_l1: s.electrical.current_l1,
                temp_busbar: s.thermal.main_busbar_temp_c,
                temp_model: s.thermal.main_busbar_predicted_c,
                temp_dsya4: s.thermal.dsya4_eval ? s.thermal.dsya4_eval.measured_temp_c : null,
                temp_measured: actMeas,
                temp_predicted: actPred,
                dew_margin: s.environmental_pd.dew_margin_c,
                hfct_pd: s.environmental_pd.hfct_pd_pps,
                health_index: s.health_index.health_index
            });
        }
        if (window.chartThermal) window.chartThermal.setHistory(pts);
        if (window.chartDewPD) window.chartDewPD.setHistory(pts);
    }

    async fetchInitialAlerts() {
        try {
            const res = await fetch("/api/alerts");
            const alerts = await res.json();
            if (Array.isArray(alerts)) {
                alerts.slice().reverse().forEach(alert => {
                    if (!alert || !alert.id || this.processedAlertIds.has(alert.id)) return;
                    this.processedAlertIds.add(alert.id);
                    this.historicalAlarms.push(alert);
                    if (window.whatsappModal) {
                        window.whatsappModal.pushAlert(alert);
                    }
                });
                this.historicalAlarms = this.historicalAlarms.slice(-30).reverse();
                this.renderAlarmFeed();
            }
        } catch (e) {
            console.warn("Could not load initial alerts:", e);
        }
    }

    connectWebSocket() {
        if (this.isClosing) return;

        const badge = document.getElementById("scadaCommBadge");

        const startClientFallback = () => {
            if (this.clientSimInterval) return;
            if (!window.clientSimulatorEngine) return;

            if (badge) {
                const commText = document.getElementById("commBadgeText");
                if (commText) commText.textContent = "Netlify · Canlı Simülasyon";
                const dot = badge.querySelector(".pulse-dot");
                if (dot) {
                    dot.style.background = "var(--cyan-primary)";
                    dot.style.boxShadow = "0 0 8px var(--cyan-primary)";
                }
                badge.style.color = "var(--cyan-primary)";
            }

            // Immediately tick once so the dashboard populates at millisecond 0
            const initialSnap = window.clientSimulatorEngine.step();
            this.handleTelemetry(initialSnap);

            // Run continuous 1-second (1000ms) telemetry tick
            this.clientSimInterval = setInterval(() => {
                if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
                    const snap = window.clientSimulatorEngine.step();
                    this.handleTelemetry(snap);
                }
            }, 1000);
        };

        const isStaticHost = window.location.hostname.includes("netlify.app") ||
                             window.location.hostname.includes("github.io") ||
                             window.location.hostname.includes("vercel.app") ||
                             window.location.protocol === "file:";

        if (isStaticHost) {
            startClientFallback();
            return;
        }

        if (this.ws && this.ws.readyState === WebSocket.OPEN) return;

        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsUrl = `${protocol}//${window.location.host}/ws/live`;

        let connectTimeout = setTimeout(() => {
            if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
                startClientFallback();
            }
        }, 1500);

        try {
            this.ws = new WebSocket(wsUrl);

            this.ws.onopen = () => {
                if (connectTimeout) {
                    clearTimeout(connectTimeout);
                    connectTimeout = null;
                }
                if (this.clientSimInterval) {
                    clearInterval(this.clientSimInterval);
                    this.clientSimInterval = null;
                }
                this.reconnectDelayMs = 1000;
                if (this.reconnectTimer) {
                    clearTimeout(this.reconnectTimer);
                    this.reconnectTimer = null;
                }
                if (badge) {
                    const commText = document.getElementById("commBadgeText");
                    if (commText) commText.textContent = "Yerel Ağ · Modbus Canlı";
                    const dot = badge.querySelector(".pulse-dot");
                    if (dot) {
                        dot.style.background = "var(--cyan-primary)";
                        dot.style.boxShadow = "0 0 8px var(--cyan-primary)";
                    }
                    badge.style.color = "var(--cyan-primary)";
                }
            };

            this.ws.onmessage = (evt) => {
                try {
                    const data = JSON.parse(evt.data);
                    this.pendingTelemetry = data;
                    if (data.active_alert) this.pendingAlerts.push(data.active_alert);
                    this.scheduleTelemetryFlush();
                } catch (err) {
                    console.error("Error parsing telemetry message:", err);
                }
            };

            this.ws.onclose = () => {
                startClientFallback();
                if (badge && !this.clientSimInterval) {
                    const commText = document.getElementById("commBadgeText");
                    if (commText) commText.textContent = "Yerel Ağ: Yeniden Bağlanıyor";
                    const dot = badge.querySelector(".pulse-dot");
                    if (dot) {
                        dot.style.background = "#ee6670";
                        dot.style.boxShadow = "none";
                    }
                    badge.style.color = "#ee6670";
                }
                if (!this.isClosing && !this.reconnectTimer) {
                    const delay = this.reconnectDelayMs;
                    this.reconnectDelayMs = Math.min(this.reconnectDelayMs * 2, 30000);
                    this.reconnectTimer = setTimeout(() => {
                        this.reconnectTimer = null;
                        this.connectWebSocket();
                    }, delay);
                }
            };

            this.ws.onerror = (err) => {
                startClientFallback();
            };
        } catch (e) {
            startClientFallback();
        }
    }

    scheduleTelemetryFlush() {
        if (this.telemetryFrame !== null) return;
        const requestFrame = window.requestAnimationFrame || ((callback) => setTimeout(callback, 0));
        this.telemetryFrame = requestFrame(() => {
            this.telemetryFrame = null;
            const latest = this.pendingTelemetry;
            const alerts = this.pendingAlerts;
            this.pendingTelemetry = null;
            this.pendingAlerts = [];
            if (!latest) return;

            this.handleTelemetry(latest, { skipAlert: true });
            alerts.forEach(alert => this.processNewAlert(alert));
        });
    }

    formatNumber(value, digits = 1, fallback = "N/A") {
        return Number.isFinite(value) ? value.toFixed(digits) : fallback;
    }

    handleTelemetry(data, options = {}) {
        this.telemetry = data;
        window.latestTelemetry = data;

        // If a specific secondary fleet panel is currently selected from the dropdown,
        // do not overwrite its inspection view with Pano #1's live stream.
        if (this.selectedFleetPanel) {
            return;
        }

        // 0. Update Fleet Summary Pill & Reset Alarms in Normal Scenario
        if (data.fleet_summary) {
            const fs = data.fleet_summary;
            const pillText = document.getElementById("fleetSummaryText");
            if (pillText) {
                pillText.textContent = `Filo: ${fs.total_panels} Pano (${fs.normal} Normal | ${fs.alarms} Alarm)`;
            }

            const fleetTotal = document.getElementById("fleetTotalCount");
            if (fleetTotal) fleetTotal.textContent = `${fs.total_panels} Pano`;

            const alarmChip = document.getElementById("fleetAlarmChip");
            if (alarmChip) {
                if (fs.alarms > 0) {
                    alarmChip.textContent = `${fs.alarms} Alarm`;
                    alarmChip.className = "fleet-alarm-chip has-alarm";
                } else {
                    alarmChip.textContent = "0 Alarm";
                    alarmChip.className = "fleet-alarm-chip is-ok";
                }
            }

            const popNormal = document.getElementById("fleetPopNormal");
            if (popNormal) popNormal.textContent = `${fs.normal} Pano`;

            const popAlarms = document.getElementById("fleetPopAlarms");
            if (popAlarms) popAlarms.textContent = `${fs.alarms} Pano`;

            const dot = document.querySelector(".fleet-status-dot");
            if (dot) {
                dot.style.background = "";
                if (fs.alarms > 0) {
                    dot.classList.add("has-alarm");
                } else {
                    dot.classList.remove("has-alarm");
                }
            }
        }

        // When in NORMAL scenario or 0 active alarms, ensure unread badge is 0
        if (data.scenario === "NORMAL" || data.active_alarm_count === 0) {
            if (window.whatsappModal) {
                window.whatsappModal.resetCount();
            }
        }

        // 1. Update Scenario Label & Active Button
        const scDesc = document.getElementById("scenarioDescription");
        if (scDesc && data.scenario_description) {
            scDesc.textContent = data.scenario_description;
        }
        if (data.scenario) {
            document.querySelectorAll(".btn-scenario").forEach(b => {
                if (b.getAttribute("data-scenario") === data.scenario) {
                    b.classList.add("active");
                } else {
                    b.classList.remove("active");
                }
            });
        }

        const isSanzo = document.body.classList.contains("theme-sanzo-wada");
        const isLight = document.body.classList.contains("theme-light");
        const okColor = isSanzo ? "#4eba7e" : (isLight ? "#0284c7" : "#00e5ff");
        const critColor = okColor;
        const warnColor = okColor;

        const isArcTripped = data.scenario === "ARC_FLASH" || Boolean(data.optical_arc && (data.optical_arc.trip_executed || data.optical_arc.latched || data.optical_arc.system_state === 2));

        // 2. Update KPI 1: Health Index
        const hi = data.health_index;
        if (hi) {
            const elVal = document.getElementById("healthIndexValue");
            const elChip = document.getElementById("healthStatusChip");
            const elGauge = document.getElementById("gaugeProgress");

            const displayScore = isArcTripped ? 0 : Math.round(hi.health_index);
            if (elVal) elVal.textContent = displayScore;

            let themeColor = okColor;

            if (elChip) {
                let statusTr = hi.status_label;
                if (isArcTripped) statusTr = "AÇTIRILDI (TRIPPED)";
                else if (statusTr === "HEALTHY" || statusTr === "OPTIMAL") statusTr = "OPTİMAL";
                else if (statusTr === "ATTENTION") statusTr = "DİKKAT";
                else if (statusTr === "WARNING") statusTr = "UYARI";
                else if (statusTr === "CRITICAL") statusTr = "KRİTİK";
                elChip.textContent = statusTr;
                elChip.style.color = okColor;
                elChip.style.borderColor = okColor;
                elChip.style.background = `${okColor}1a`;

                const isTrippedOrDanger = isArcTripped || hi.status_label === "CRITICAL" || hi.status_label === "WARNING";
                elChip.classList.toggle("danger-pulse", isTrippedOrDanger);
            }
            if (elGauge) {
                const circumference = 314;
                const offset = circumference - (displayScore / 100) * circumference;
                elGauge.style.strokeDashoffset = offset;
                elGauge.style.stroke = okColor;
            }

            // Sub-bars with Nullish Coalescing (??) so 0% does NOT fallback to 95%!
            const subs = hi.sub_scores || {};
            const updateBar = (barId, valId, val) => {
                const bar = document.getElementById(barId);
                const text = document.getElementById(valId);
                const safeVal = val !== undefined && val !== null ? val : 100;
                if (bar) {
                    bar.style.width = `${safeVal}%`;
                    bar.style.backgroundColor = okColor;
                }
                if (text) text.textContent = `${Math.round(safeVal)}%`;
            };
            updateBar("barThermal", "valThermal", subs.thermal_contact);
            updateBar("barInsulation", "valInsulation", subs.insulation_pd);
            updateBar("barEnv", "valEnv", subs.environmental_dew);
            updateBar("barElec", "valElec", isArcTripped ? 0 : subs.electrical_quality);
        }

        // 3. Update KPI 2: Thermal Residual
        let activeMeasuredTemp = null;
        let activePredictedTemp = null;
        const th = data.thermal;
        if (th) {
            const elMeas = document.getElementById("measuredBusbarTemp");
            const elPred = document.getElementById("predictedBusbarTemp");
            const elResVal = document.getElementById("residualValue");
            const elResStat = document.getElementById("residualStatus");
            const elAmb = document.getElementById("ambientTemp");
            const elCur = document.getElementById("loadCurrent");
            const elMeasLabel = document.getElementById("thermalCardMeasLabel");
            const elPredLabel = document.getElementById("thermalCardPredLabel");

            const dsya4 = th.dsya4_eval || {};
            let displayMeasured, displayPredicted, displayResidual, statusText, statusColor, measLabel;

            if (data.scenario === "ARC_FLASH") {
                measLabel = "Ölçülen Sıcaklık (Ark Noktası DSYA-04):";
                displayMeasured = dsya4.measured_temp_c !== undefined ? dsya4.measured_temp_c : 82.5;
                displayPredicted = dsya4.predicted_temp_c !== undefined ? dsya4.predicted_temp_c : 28.1;
                displayResidual = Number((displayMeasured - displayPredicted).toFixed(1));
                statusText = "ARK PATLAMASI / TERMİK ŞOK";
                statusColor = okColor;
            } else if (data.scenario === "LOOSE_BOLT") {
                measLabel = "Ölçülen Sıcaklık (Kritik Nokta DSYA-04):";
                displayMeasured = dsya4.measured_temp_c !== undefined ? dsya4.measured_temp_c : 48.1;
                displayPredicted = dsya4.predicted_temp_c !== undefined ? dsya4.predicted_temp_c : 27.9;
                displayResidual = Number((displayMeasured - displayPredicted).toFixed(1));
                statusText = "ERKEN KONTAK BOZULMASI";
                statusColor = okColor;
            } else {
                measLabel = "Ölçülen Bara Sıcaklığı:";
                displayMeasured = th.main_busbar_temp_c;
                displayPredicted = th.main_busbar_predicted_c;
                displayResidual = Number((displayMeasured - displayPredicted).toFixed(1));
                if (displayResidual >= 30 || displayMeasured >= 75) {
                    statusText = "KRİTİK GEVŞEK BAĞLANTI";
                    statusColor = okColor;
                } else if (displayResidual >= 15) {
                    statusText = "ERKEN KONTAK BOZULMASI";
                    statusColor = okColor;
                } else if (displayResidual >= 5) {
                    statusText = "İZLEME / BİLGİLENDİRME";
                    statusColor = okColor;
                } else {
                    statusText = "NOMİNAL DİRENÇ";
                    statusColor = okColor;
                }
            }

            if (elMeasLabel) elMeasLabel.textContent = measLabel;
            if (elPredLabel) elPredLabel.textContent = "Joule Model Beklenen:";
            if (elMeas) elMeas.textContent = `${this.formatNumber(displayMeasured)} °C`;
            if (elPred) elPred.textContent = `${this.formatNumber(displayPredicted)} °C`;
            if (elResVal) elResVal.textContent = `${displayResidual >= 0 ? '+' : ''}${this.formatNumber(displayResidual)} °C`;
            
            if (elResStat) {
                elResStat.textContent = statusText;
                elResStat.style.color = statusColor;
                elResStat.style.borderColor = statusColor;
                elResStat.style.background = `${statusColor}1a`;
                const isThermalDanger = data.scenario === "ARC_FLASH" || displayResidual >= 15;
                elResStat.classList.toggle("danger-pulse", isThermalDanger);
            }

            if (elAmb) elAmb.textContent = `${this.formatNumber(th.ambient_temp_c)} °C`;
            if (elCur) elCur.textContent = `${this.formatNumber(data.electrical && data.electrical.current_l1)} A`;
            activeMeasuredTemp = displayMeasured;
            activePredictedTemp = displayPredicted;
        }

        // 4. Update KPI 3: Dew Point & HFCT PD
        const env = data.environmental_pd;
        if (env) {
            const elRh = document.getElementById("rhValue");
            const elDp = document.getElementById("dewPointValue");
            const elDm = document.getElementById("dewMarginValue");
            const elPdPps = document.getElementById("pdPps");
            const elPdPeak = document.getElementById("pdPeak");
            const elPdState = document.getElementById("pdStateChip");

            if (elRh) elRh.textContent = `${this.formatNumber(env.relative_humidity_pct)} %`;
            if (elDp) elDp.textContent = `${this.formatNumber(env.dew_point_c)} °C`;
            if (elDm) elDm.textContent = `${this.formatNumber(env.dew_margin_c)} °C`;
            if (elPdPps) elPdPps.textContent = `${this.formatNumber(env.hfct_pd_pps)} pps`;
            if (elPdPeak) elPdPeak.textContent = `${this.formatNumber(env.hfct_peak_pc)} pC`;

            if (elPdState) {
                let pdTr = env.status_label;
                if (pdTr === "CRITICAL") pdTr = "KRİTİK YOĞUŞMA & PD";
                else if (pdTr === "WARNING") pdTr = "UYARI (YÜKSEK NEM)";
                else pdTr = "NOMİNAL";
                elPdState.textContent = pdTr;
                elPdState.style.color = okColor;
                elPdState.style.borderColor = okColor;
                elPdState.style.background = `${okColor}1a`;

                const isDewDanger = data.scenario === "CONDENSATION_PD" || env.dew_margin_c <= 3.0 || env.hfct_pd_pps >= 30;
                elPdState.classList.toggle("danger-pulse", isDewDanger);
            }
        }

        // 5. Update KPI 4: ABB TVOC-2 Optical Arc Protection
        const arc = data.optical_arc;
        if (arc) {
            const elArcLight = document.getElementById("arcStatusLight");
            const elArcState = document.getElementById("arcSystemState");
            const elTripCount = document.getElementById("tripCount") || document.getElementById("arcTripCount");
            const arcIndicator = document.getElementById("arcIndicator");

            if (elArcLight) {
                elArcLight.className = isArcTripped ? "status-light tripped" : "status-light";
                elArcLight.style.background = isArcTripped ? okColor : "";
            }

            if (arcIndicator) {
                arcIndicator.classList.toggle("tripped", isArcTripped);
            }

            if (elArcState) {
                elArcState.textContent = isArcTripped ? "AÇTIRMA (ARK KİLİTLİ)" : "SİSTEM NORMAL";
                elArcState.style.color = isArcTripped ? okColor : (isLight ? "#0f172a" : "#ffffff");
            }
            document.getElementById("btnTvocReset")?.classList.toggle("tripped", isArcTripped);

            if (elTripCount && data.tvoc2_registers) {
                const tripCount = data.tvoc2_registers[149];
                elTripCount.textContent = tripCount !== undefined && tripCount !== null ? tripCount : (isArcTripped ? 1 : 0);
            }
        }

        // 6. Update Prescriptive AI Action Card
        const prescCard = document.getElementById("prescriptiveActionCard");
        const prescText = document.getElementById("prescriptiveActionText");
        const prescLabel = document.getElementById("prescriptiveLabel");
        const iconUse = document.querySelector("#prescriptiveIconFrame use");

        if (prescCard && prescText) {
            if (data.scenario === "ARC_FLASH" || isArcTripped) {
                prescCard.className = "prescriptive-action-card critical";
                if (prescLabel) prescLabel.textContent = "REÇETELİ SAHA BAKIM AKSİYONU (PRESCRIPTIVE AI):";
                if (iconUse) iconUse.setAttribute("href", "#icon-alert-triangle");
                prescText.textContent = "Aksiyon: TVOC-2 optik ark açtırması gerçekleşti. Hücreyi enerjilendirmeden önce topraklama yapınız, optik sensör ve DTC arıza kodunu inceleyiniz.";
            } else if (data.scenario === "LOOSE_BOLT") {
                prescCard.className = "prescriptive-action-card warning";
                if (prescLabel) prescLabel.textContent = "REÇETELİ SAHA BAKIM AKSİYONU (PRESCRIPTIVE AI):";
                if (iconUse) iconUse.setAttribute("href", "#icon-alert-triangle");
                prescText.textContent = "Aksiyon: DSYA-04 klemensinde termal kontak direnci artışı tespit edildi. 45 Nm tork anahtarı ile klemens torklama ve kontak temizliği önerilir.";
            } else if (data.scenario === "CONDENSATION_PD") {
                prescCard.className = "prescriptive-action-card critical";
                if (prescLabel) prescLabel.textContent = "REÇETELİ SAHA BAKIM AKSİYONU (PRESCRIPTIVE AI):";
                if (iconUse) iconUse.setAttribute("href", "#icon-alert-triangle");
                prescText.textContent = "Aksiyon: Bağıl nem %90 üzerine çıktı ve HFCT kısmi deşarj atlaması riski mevcut. Pano içi anti-kondenzasyon ısıtıcısını derhal devreye alınız.";
            } else {
                prescCard.className = "prescriptive-action-card";
                if (prescLabel) prescLabel.textContent = "REÇETELİ SAHA BAKIM AKSİYONU (PRESCRIPTIVE AI):";
                if (iconUse) iconUse.setAttribute("href", "#icon-check");
                prescText.textContent = "Aksiyon: Buca TM Pano #1 tüm parametreleri nominal sınırlar içinde çalışıyor. Bir sonraki kestirimci bakım döngüsüne kadar izleme devam etmektedir.";
            }
        }

        // 7. Update Digital Twin
        if (window.panoDigitalTwin) {
            window.panoDigitalTwin.updateTelemetry(data);
        }

        // 8. Update Charts
        const chartPt = {
            scenario: data.scenario,
            i_l1: data.electrical.current_l1,
            temp_busbar: data.thermal.main_busbar_temp_c,
            temp_model: data.thermal.main_busbar_predicted_c,
            temp_dsya4: data.thermal.dsya4_eval ? data.thermal.dsya4_eval.measured_temp_c : null,
            temp_measured: activeMeasuredTemp !== null ? activeMeasuredTemp : data.thermal.main_busbar_temp_c,
            temp_predicted: activePredictedTemp !== null ? activePredictedTemp : data.thermal.main_busbar_predicted_c,
            dew_margin: data.environmental_pd.dew_margin_c,
            hfct_pd: data.environmental_pd.hfct_pd_pps
        };
        if (window.chartThermal) window.chartThermal.pushData(chartPt);
        if (window.chartDewPD) window.chartDewPD.pushData(chartPt);

        // 9. Handle Alerts (Deduplicated)
        if (!options.skipAlert) this.processNewAlert(data.active_alert);

        // 10. Store Modbus registers and re-render only when visible
        this.modbusData = {
            mpr: data.mpr53cs_registers || {},
            tvoc: data.tvoc2_registers || {},
            ai: data.ai_registers || {}
        };
        if (this.activeTabId === "tabModbus") this.renderModbusTable();
    }

    processNewAlert(alert) {
        if (!alert || !alert.id || this.processedAlertIds.has(alert.id)) return;
        this.processedAlertIds.add(alert.id);
        if (this.processedAlertIds.size > 500) {
            const oldestId = this.processedAlertIds.values().next().value;
            this.processedAlertIds.delete(oldestId);
        }
        this.handleNewAlert(alert);
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

    escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    renderAlarmFeed() {
        const container = document.getElementById("alarmFeed");
        if (!container) return;

        if (this.historicalAlarms.length === 0) {
            container.textContent = "Aktif alarm veya arıza kaydı bulunmamaktadır. Sistem sağlıklı.";
            return;
        }

        let html = "";
        this.historicalAlarms.forEach(alr => {
            const isCrit = alr.severity === "CRITICAL";
            const metrics = alr.metrics || (alr.whatsapp_payload && alr.whatsapp_payload.metrics) || {};
            const action = alr.recommended_action || (alr.whatsapp_payload && alr.whatsapp_payload.action) || "Saha ekibi yönlendirildi.";
            html += `
                <div class="alarm-card ${isCrit ? "critical" : "warning"}">
                    <div class="alarm-top">
                        <span class="time">${this.escapeHtml(alr.timestamp)}</span>
                        <span class="sev-tag ${isCrit ? "CRITICAL" : "WARNING"}">${this.escapeHtml(alr.severity)}</span>
                    </div>
                    <div class="alarm-title">${this.escapeHtml(alr.anomaly_type)}</div>
                    <div class="alarm-desc">
                        <span class="alarm-location-label">Konum</span>
                        <span class="alarm-location-text">${this.escapeHtml(alr.location)}</span>
                        ${metrics.highlight_summary ? ` — <span class="alarm-metrics-summary">${this.escapeHtml(metrics.highlight_summary)}</span>` : ""}
                    </div>
                    <div class="alarm-footer-meta">
                        <div class="alarm-action"><span class="action-label">Öneri:</span> ${this.escapeHtml(action)}</div>
                        <div class="alarm-mode-badge">${this.escapeHtml(alr.transport_mode || "SIMULATED")}</div>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    renderModbusTable() {
        const tbody = document.getElementById("modbusTableBody");
        if (!tbody) return;

        const mprList = [
            { dev: "ENTES MPR-53CS", dec: 0, hex: "0x0000", name: "L1 Faz-Nötr Gerilimi", unit: "V", fmt: "uint16", scale: 0.1, decPlaces: 1 },
            { dev: "ENTES MPR-53CS", dec: 2, hex: "0x0002", name: "L2 Faz-Nötr Gerilimi", unit: "V", fmt: "uint16", scale: 0.1, decPlaces: 1 },
            { dev: "ENTES MPR-53CS", dec: 4, hex: "0x0004", name: "L3 Faz-Nötr Gerilimi", unit: "V", fmt: "uint16", scale: 0.1, decPlaces: 1 },
            { dev: "ENTES MPR-53CS", dec: 6, hex: "0x0006", name: "L1 Faz Akımı", unit: "A", fmt: "uint16", scale: 1.0, decPlaces: 1 },
            { dev: "ENTES MPR-53CS", dec: 8, hex: "0x0008", name: "L2 Faz Akımı", unit: "A", fmt: "uint16", scale: 1.0, decPlaces: 1 },
            { dev: "ENTES MPR-53CS", dec: 10, hex: "0x000A", name: "L3 Faz Akımı", unit: "A", fmt: "uint16", scale: 1.0, decPlaces: 1 },
            { dev: "ENTES MPR-53CS", dec: 12, hex: "0x000C", name: "Nötr Hattı Akımı", unit: "A", fmt: "uint16", scale: 1.0, decPlaces: 1 },
            { dev: "ENTES MPR-53CS", dec: 14, hex: "0x000E", name: "L1-L2 Faz-Faz Gerilimi", unit: "V", fmt: "uint16", scale: 0.1, decPlaces: 1 },
            { dev: "ENTES MPR-53CS", dec: 38, hex: "0x0026", name: "L1 Güç Faktörü (Cos φ)", unit: "", fmt: "int16", scale: 0.001, decPlaces: 3 },
            { dev: "ENTES MPR-53CS", dec: 58, hex: "0x003A", name: "Şebeke Frekansı", unit: "Hz", fmt: "uint16", scale: 0.01, decPlaces: 2 },
            { dev: "ENTES MPR-53CS", dec: 72, hex: "0x0048", name: "L1 Gerilim THD", unit: "%", fmt: "uint16", scale: 0.1, decPlaces: 1 },
            { dev: "ENTES MPR-53CS", dec: 78, hex: "0x004E", name: "L1 Akım THD", unit: "%", fmt: "uint16", scale: 0.1, decPlaces: 1 },
            { dev: "ENTES MPR-53CS", dec: 32768, hex: "0x8000", name: "VT Gerilim Trafosu Oranı", unit: "", fmt: "uint16", scale: 1.0, decPlaces: 0 },
            { dev: "ENTES MPR-53CS", dec: 32769, hex: "0x8001", name: "CT Akım Trafosu Oranı (2500/5)", unit: "", fmt: "uint16", scale: 1.0, decPlaces: 0 }
        ];

        const tvocList = [
            { dev: "ABB TVOC-2", dec: 100, hex: "0x0064", name: "Trip 1 Dedektör Düşük (X1:1 - X2:5)", unit: "", fmt: "HEX Word", scale: 1.0, isHex: true },
            { dev: "ABB TVOC-2", dec: 101, hex: "0x0065", name: "Trip 1 Dedektör Yüksek (X2:6 - X3:10)", unit: "", fmt: "HEX Word", scale: 1.0, isHex: true },
            { dev: "ABB TVOC-2", dec: 102, hex: "0x0066", name: "Trip 1 Açtıran Röleler (K4, K5, K6)", unit: "", fmt: "HEX Word", scale: 1.0, isHex: true },
            { dev: "ABB TVOC-2", dec: 149, hex: "0x0095", name: "Kaydedilen Ark Açtırma Sayısı", unit: "Adet", fmt: "uint16", scale: 1.0, decPlaces: 0 },
            { dev: "ABB TVOC-2", dec: 500, hex: "0x01F4", name: "Kurulu Modüller (0x000E: X2+X3+HMI)", unit: "", fmt: "HEX Word", scale: 1.0, isHex: true },
            { dev: "ABB TVOC-2", dec: 1000, hex: "0x03E8", name: "Trip Sıfırlama Komutu (PDU 1000 = 1)", unit: "", fmt: "Komut (W)", scale: 1.0, decPlaces: 0 },
            { dev: "ABB TVOC-2", dec: 1300, hex: "0x0514", name: "Sistem Durumu (0: Normal, 2: Tripped)", unit: "", fmt: "uint16", scale: 1.0, decPlaces: 0 }
        ];

        const aiList = [
            { dev: "Grid-Guard AI", dec: 40001, hex: "0x9C41", name: "AI_ASSET_HEALTH_INDEX (Sağlık İndeksi)", unit: "%", fmt: "uint16", scale: 0.1, decPlaces: 1 },
            { dev: "Grid-Guard AI", dec: 40002, hex: "0x9C42", name: "AI_BUSBAR_MEASURED_TEMP (Ölçülen Sıcaklık)", unit: "°C", fmt: "uint16", scale: 0.1, decPlaces: 1 },
            { dev: "Grid-Guard AI", dec: 40003, hex: "0x9C43", name: "AI_JOULE_PREDICTED_TEMP (Joule Model)", unit: "°C", fmt: "uint16", scale: 0.1, decPlaces: 1 },
            { dev: "Grid-Guard AI", dec: 40004, hex: "0x9C44", name: "AI_THERMAL_RESIDUAL_DT (Artık Fark ΔT)", unit: "°C", fmt: "int16", scale: 0.1, decPlaces: 1, showSign: true },
            { dev: "Grid-Guard AI", dec: 40005, hex: "0x9C45", name: "AI_CONTACT_DEG_INDEX (Kontak Bozulma CDI)", unit: "%", fmt: "uint16", scale: 0.1, decPlaces: 1 },
            { dev: "Grid-Guard AI", dec: 40006, hex: "0x9C46", name: "AI_DEW_POINT_TEMP (Magnus Çiğ Noktası Tdp)", unit: "°C", fmt: "uint16", scale: 0.1, decPlaces: 1 },
            { dev: "Grid-Guard AI", dec: 40007, hex: "0x9C47", name: "AI_DEW_MARGIN (Yoğuşma Güvenlik Marjı)", unit: "°C", fmt: "uint16", scale: 0.1, decPlaces: 1 },
            { dev: "Grid-Guard AI", dec: 40008, hex: "0x9C48", name: "AI_HFCT_PD_PPS (Kısmi Deşarj Darbe Sıklığı)", unit: "pps", fmt: "uint16", scale: 0.1, decPlaces: 1 },
            { dev: "Grid-Guard AI", dec: 40009, hex: "0x9C49", name: "AI_HFCT_PEAK_PC (Kısmi Deşarj Tepe Genlik)", unit: "pC", fmt: "uint16", scale: 1.0, decPlaces: 0 },
            { dev: "Grid-Guard AI", dec: 40010, hex: "0x9C4A", name: "AI_ANOMALY_ALARM_WORD (Alarm Durum Maskesi)", unit: "", fmt: "HEX Word", scale: 1.0, isHex: true }
        ];

        let combined = [];
        if (this.activeFilter === "ALL" || this.activeFilter === "MPR") combined.push(...mprList);
        if (this.activeFilter === "ALL" || this.activeFilter === "TVOC") combined.push(...tvocList);
        if (this.activeFilter === "ALL" || this.activeFilter === "AI") combined.push(...aiList);

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
                rawVal = (this.modbusData?.mpr && this.modbusData.mpr[item.dec] !== undefined) ? this.modbusData.mpr[item.dec] : "-";
            } else if (item.dev.includes("TVOC")) {
                rawVal = (this.modbusData?.tvoc && this.modbusData.tvoc[item.dec] !== undefined) ? this.modbusData.tvoc[item.dec] : "-";
            } else {
                rawVal = (this.modbusData?.ai && this.modbusData.ai[item.dec] !== undefined) ? this.modbusData.ai[item.dec] : "-";
            }

            if (rawVal !== "-") {
                if (item.isHex) {
                    engVal = `0x${Number(rawVal).toString(16).toUpperCase().padStart(4, '0')}`;
                } else {
                    const scaled = rawVal * item.scale;
                    const decP = item.decPlaces !== undefined ? item.decPlaces : (item.scale < 1.0 ? 1 : 0);
                    const formatted = scaled.toFixed(decP);
                    engVal = (item.showSign && scaled > 0 ? "+" : "") + formatted;
                }
            }

            const isSanzo = document.body.classList.contains("theme-sanzo-wada");
            const isLight = document.body.classList.contains("theme-light");
            const mprColor = isSanzo ? "#4eba7e" : (isLight ? "#0284c7" : "#26c6da");
            const tvocColor = isSanzo ? "#e6823b" : (isLight ? "#0369a1" : "#06b6d4");
            const aiColor = isSanzo ? "#d97706" : (isLight ? "#7c3aed" : "#a855f7");
            const engColor = isSanzo ? "#4eba7e" : (isLight ? "#0284c7" : "#26c6da");
            const hexColor = isSanzo ? "#a4b89d" : (isLight ? "#64748b" : "#a7b8c8");
            const nameColor = isSanzo ? "#f7f4eb" : (isLight ? "#0f172a" : "#f8fafc");

            const devColor = item.dev.includes('MPR') ? mprColor : (item.dev.includes('TVOC') ? tvocColor : aiColor);
            const unitSuffix = item.unit ? ` ${item.unit}` : "";

            html += `
                <tr>
                    <td style="color:${devColor}; font-weight:600;">${item.dev}</td>
                    <td>${item.dec}</td>
                    <td style="color:${hexColor};">${item.hex}</td>
                    <td style="color:${nameColor};">${item.name}</td>
                    <td class="highlight-val">${rawVal}</td>
                    <td style="color:${engColor}; font-weight:600;">${engVal}${unitSuffix}</td>
                    <td style="color:${hexColor};">${item.fmt}</td>
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
