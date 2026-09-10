/**
 * TEDAŞ 1600 kVA AG Pano Digital Twin (SVG Renderer & Interactive SCADA).
 * Replicates TEDAŞ-MLZ/2003-06.B EK-II/14 layout (1600 x 1500 x 450 mm).
 */

class PanoDigitalTwin {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.selectedFeederId = "DSYA-04";
        this.drawer = document.getElementById("componentDrawer");
        this.drawerTitle = document.getElementById("drawerTitle");
        this.drawerBody = document.getElementById("drawerBody");
        this.btnCloseDrawer = document.getElementById("btnCloseDrawer");

        this.initEventListeners();
        this.renderBaseSvg();
    }

    initEventListeners() {
        if (this.btnCloseDrawer) {
            this.btnCloseDrawer.addEventListener("click", () => {
                this.drawer.classList.remove("active");
            });
        }
    }

    renderBaseSvg() {
        // SVG dimensions: viewBox 0 0 1000 600
        const svgHtml = `
        <svg id="panoSvg" viewBox="0 0 1000 620" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <!-- Copper Busbar Gradient -->
                <linearGradient id="copperGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="#b45309" />
                    <stop offset="50%" stop-color="#f59e0b" />
                    <stop offset="100%" stop-color="#b45309" />
                </linearGradient>

                <!-- Hot / Overheating Busbar Gradient -->
                <linearGradient id="hotCopperGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="#b91c1c" />
                    <stop offset="50%" stop-color="#f87171" />
                    <stop offset="100%" stop-color="#b91c1c" />
                </linearGradient>

                <!-- DSYA Enclosure Shadow -->
                <filter id="boxGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#06b6d4" flood-opacity="0.2"/>
                </filter>
            </defs>

            <!-- Outer Cabinet Frame (TEDAŞ 1600x1500 mm profile) -->
            <rect x="20" y="20" width="960" height="580" rx="8" fill="#0c1322" stroke="#334155" stroke-width="4"/>
            <rect x="26" y="26" width="948" height="568" rx="6" fill="none" stroke="#1e293b" stroke-width="2"/>

            <!-- Top Header Compartment: Street Lighting, Service & Protection -->
            <rect x="35" y="35" width="750" height="85" rx="4" fill="#111c2e" stroke="#1e293b" stroke-width="1.5"/>
            <text x="50" y="55" fill="#64748b" font-size="11" font-family="'Outfit', sans-serif" font-weight="700">ÜST SERVİS VE KORUMA KOMPARTIMANI</text>
            
            <!-- ABB TVOC-2 Arc Guard Unit inside top compartment -->
            <g id="tvocUnitGroup" transform="translate(50, 65)">
                <rect width="180" height="45" rx="4" fill="#182234" stroke="#06b6d4" stroke-width="1.5"/>
                <text x="12" y="20" fill="#06b6d4" font-size="11" font-family="'Outfit', sans-serif" font-weight="800">ABB TVOC-2 ARC GUARD</text>
                <circle id="tvocLed" cx="160" cy="18" r="5" fill="#10b981"/>
                <text x="12" y="36" fill="#94a3b8" font-size="9" font-family="'JetBrains Mono', monospace">30 Optik Fiber Kanalı</text>
            </g>

            <!-- Internal Service & Lighting Fuses -->
            <g transform="translate(250, 65)">
                <rect width="220" height="45" rx="4" fill="#182234" stroke="#334155" stroke-width="1"/>
                <text x="12" y="18" fill="#94a3b8" font-size="10" font-family="'Outfit', sans-serif" font-weight="700">SOKAK AYDINLATMA (160A) &amp; İÇ İHTİYAÇ</text>
                <text x="12" y="35" fill="#64748b" font-size="9" font-family="'JetBrains Mono', monospace">Kontaktör AC-5a | Sigorta gG 20A</text>
            </g>

            <!-- SCADA Gateway Edge Node -->
            <g transform="translate(490, 65)">
                <rect width="280" height="45" rx="4" fill="#182234" stroke="#10b981" stroke-width="1.5"/>
                <text x="12" y="18" fill="#10b981" font-size="11" font-family="'Outfit', sans-serif" font-weight="800">GRID-GUARD ON-PREMISE GATEWAY</text>
                <text x="12" y="35" fill="#94a3b8" font-size="9" font-family="'JetBrains Mono', monospace">RS-485 Modbus RTU / Edge AI / Zero Cloud</text>
            </g>

            <!-- Right Compartment: Metering / Analyser (ENTERS MPR-53CS) -->
            <rect x="795" y="35" width="170" height="550" rx="4" fill="#111c2e" stroke="#334155" stroke-width="1.5"/>
            <text x="810" y="55" fill="#64748b" font-size="11" font-family="'Outfit', sans-serif" font-weight="700">ÖLÇÜ ODASI (EÖ)</text>

            <!-- ENTES MPR-53CS Panel Unit -->
            <g transform="translate(805, 75)">
                <rect width="150" height="150" rx="6" fill="#090f1a" stroke="#06b6d4" stroke-width="2"/>
                <rect x="12" y="12" width="126" height="60" rx="3" fill="#03141e" stroke="#0891b2" stroke-width="1"/>
                <!-- LCD Display Text -->
                <text x="20" y="32" fill="#38bdf8" font-size="12" font-family="'JetBrains Mono', monospace" font-weight="700" id="mprLcdV">V: 230.2 V</text>
                <text x="20" y="48" fill="#38bdf8" font-size="12" font-family="'JetBrains Mono', monospace" font-weight="700" id="mprLcdI">I: 324.5 A</text>
                <text x="20" y="63" fill="#38bdf8" font-size="10" font-family="'JetBrains Mono', monospace" id="mprLcdF">50.02 Hz | THD: 2.6%</text>
                
                <text x="25" y="95" fill="#f8fafc" font-size="11" font-family="'Outfit', sans-serif" font-weight="800">ENTES MPR-53CS</text>
                <text x="25" y="110" fill="#64748b" font-size="9" font-family="'JetBrains Mono', monospace">3-Faz Güç Analizörü</text>
                <!-- Keypad Buttons Mock -->
                <circle cx="35" cy="130" r="6" fill="#1e293b" stroke="#475569" stroke-width="1"/>
                <circle cx="55" cy="130" r="6" fill="#1e293b" stroke="#475569" stroke-width="1"/>
                <circle cx="75" cy="130" r="6" fill="#1e293b" stroke="#475569" stroke-width="1"/>
                <circle cx="95" cy="130" r="6" fill="#1e293b" stroke="#475569" stroke-width="1"/>
            </g>

            <!-- Instrument CT Details below analyser -->
            <g transform="translate(805, 240)">
                <rect width="150" height="80" rx="4" fill="#182234" stroke="#1e293b" stroke-width="1"/>
                <text x="12" y="20" fill="#94a3b8" font-size="10" font-family="'Outfit', sans-serif" font-weight="700">AKIM TRAFOSU GİRİŞİ</text>
                <text x="12" y="38" fill="#38bdf8" font-size="11" font-family="'JetBrains Mono', monospace" font-weight="700">2500 / 5 A (CT)</text>
                <text x="12" y="55" fill="#64748b" font-size="9" font-family="'Inter', sans-serif">TEDAŞ Şartname Sınıfı 0.5</text>
            </g>

            <!-- Techimp HFCT PD Sensor Earth Collector Box -->
            <g transform="translate(805, 335)">
                <rect width="150" height="110" rx="4" fill="#182234" stroke="#06b6d4" stroke-width="1.5"/>
                <text x="12" y="20" fill="#06b6d4" font-size="10" font-family="'Outfit', sans-serif" font-weight="700">TECHIMP HFCT PD ÜNİTESİ</text>
                <text x="12" y="38" fill="#94a3b8" font-size="9" font-family="'JetBrains Mono', monospace">1 - 60 MHz Yüksek Frekans</text>
                <text x="12" y="54" fill="#38bdf8" font-size="11" font-family="'JetBrains Mono', monospace" id="twinPdPps">PD: 4.8 pps</text>
                <text x="12" y="70" fill="#94a3b8" font-size="10" font-family="'JetBrains Mono', monospace" id="twinPdPeak">32 pC Peak</text>
                <text x="12" y="94" fill="#10b981" font-size="9" font-family="'Inter', sans-serif" font-weight="700">Topraklama Örgüsünde Klipsli</text>
            </g>

            <!-- Main Busbar Section (Behind DSYA, 2x 100x10 mm Cu) -->
            <g id="mainBusbarGroup">
                <!-- R, S, T 3-Phase Busbar horizontal strips -->
                <rect id="barR" x="35" y="135" width="750" height="14" rx="2" fill="url(#copperGrad)"/>
                <rect id="barS" x="35" y="155" width="750" height="14" rx="2" fill="url(#copperGrad)"/>
                <rect id="barT" x="35" y="175" width="750" height="14" rx="2" fill="url(#copperGrad)"/>
                <!-- Neutral Bar -->
                <rect id="barN" x="35" y="515" width="750" height="10" rx="2" fill="#64748b"/>
                <text x="45" y="146" fill="#111" font-size="9" font-family="'JetBrains Mono', monospace" font-weight="800">L1 BARA 2x(100x10 mm²)</text>
                <text x="45" y="166" fill="#111" font-size="9" font-family="'JetBrains Mono', monospace" font-weight="800">L2 BARA</text>
                <text x="45" y="186" fill="#111" font-size="9" font-family="'JetBrains Mono', monospace" font-weight="800">L3 BARA</text>
                <text x="45" y="523" fill="#fff" font-size="8" font-family="'JetBrains Mono', monospace" font-weight="800">NÖTR BARASI (N)</text>
            </g>

            <!-- 12 DSYA Vertical Feeders Container (Middle Body) -->
            <g id="dsyaFeedersContainer">
                <!-- Generated dynamically via renderFeeders() -->
            </g>

            <!-- Bottom Cable Entry & Non-Invasive HFCT Sensor Area (>400 mm clearance per TEDAŞ) -->
            <rect x="35" y="535" width="750" height="50" rx="4" fill="#090e18" stroke="#1e293b" stroke-width="1"/>
            <text x="50" y="552" fill="#475569" font-size="10" font-family="'JetBrains Mono', monospace">KABLO BAĞLANTI KOMPARTIMANI (TEDAŞ ŞARTNAMESİ: EN AZ 400 mm NET MONTAJ AÇIKLIĞI)</text>
            <text x="50" y="570" fill="#06b6d4" font-size="9" font-family="'Inter', sans-serif">✓ Non-İnvaziv Techimp HFCT 30/50 Sensörleri topraklama örgüsüne klipsli takılmıştır (Bara delme/kesme yok)</text>
        </svg>
        `;

        this.container.innerHTML = svgHtml;
        this.renderFeeders();
    }

    renderFeeders(feedersData = null) {
        const container = document.getElementById("dsyaFeedersContainer");
        if (!container) return;

        const startX = 42;
        const feederWidth = 56;
        const gap = 6;
        const startY = 198;
        const feederHeight = 310;

        let html = "";
        for (let i = 0; i < 12; i++) {
            const id = `DSYA-${String(i + 1).padStart(2, '0')}`;
            const x = startX + i * (feederWidth + gap);
            const data = feedersData ? feedersData[i] : null;

            const isSpare = i >= 10;
            const current = data ? data.current_amps : (isSpare ? 0 : 35.0);
            const temp = data ? data.surface_temp_c : 32.0;
            const isOverheating = data && data.contact_status === "OVERHEATING";

            // Temperature color coding
            let borderColor = "#334155";
            let fillColor = "#141e30";
            let glowFilter = "";

            if (isOverheating) {
                borderColor = "#ef4444";
                fillColor = "rgba(239, 68, 68, 0.2)";
                glowFilter = 'filter="url(#boxGlow)"';
            } else if (temp > 65) {
                borderColor = "#f59e0b";
                fillColor = "rgba(245, 158, 11, 0.15)";
            } else if (!isSpare) {
                borderColor = "#06b6d4";
                fillColor = "#111c2e";
            }

            const fuseBoy = i < 5 ? "Boy-1 (250A)" : (i < 10 ? "Boy-2 (400A)" : "Yedek");

            html += `
            <g class="dsya-unit" id="feederNode_${id}" transform="translate(${x}, ${startY})" style="cursor: pointer;" onclick="window.panoDigitalTwin.selectFeeder('${id}')" ${glowFilter}>
                <!-- Outer DSYA vertical casing -->
                <rect width="${feederWidth}" height="${feederHeight}" rx="4" fill="${fillColor}" stroke="${borderColor}" stroke-width="${isOverheating ? 2.5 : 1.5}"/>
                
                <!-- DSYA Disconnector Handle / Fuse Carrier -->
                <rect x="6" y="8" width="${feederWidth - 12}" height="32" rx="3" fill="#1e293b" stroke="#475569" stroke-width="1"/>
                <text x="${feederWidth / 2}" y="28" fill="#f8fafc" font-size="10" font-family="'Outfit', sans-serif" font-weight="700" text-anchor="middle">${id}</text>

                <!-- Fuse Body 3-Phase Windows -->
                <rect x="10" y="48" width="${feederWidth - 20}" height="45" rx="2" fill="#090f1a" stroke="#334155"/>
                <text x="${feederWidth / 2}" y="74" fill="#64748b" font-size="9" font-family="'JetBrains Mono', monospace" text-anchor="middle">L1 FUSE</text>

                <rect x="10" y="100" width="${feederWidth - 20}" height="45" rx="2" fill="#090f1a" stroke="#334155"/>
                <text x="${feederWidth / 2}" y="126" fill="#64748b" font-size="9" font-family="'JetBrains Mono', monospace" text-anchor="middle">L2 FUSE</text>

                <rect x="10" y="152" width="${feederWidth - 20}" height="45" rx="2" fill="#090f1a" stroke="#334155"/>
                <text x="${feederWidth / 2}" y="178" fill="#64748b" font-size="9" font-family="'JetBrains Mono', monospace" text-anchor="middle">L3 FUSE</text>

                <!-- Live Metrics Badge on Feeder -->
                <rect x="4" y="206" width="${feederWidth - 8}" height="45" rx="3" fill="#0a1220" stroke="${borderColor}" stroke-width="1"/>
                <text x="${feederWidth / 2}" y="222" fill="${isOverheating ? '#f87171' : '#38bdf8'}" font-size="11" font-family="'JetBrains Mono', monospace" font-weight="700" text-anchor="middle">${current.toFixed(0)} A</text>
                <text x="${feederWidth / 2}" y="242" fill="${temp > 75 ? '#ef4444' : (temp > 50 ? '#f59e0b' : '#10b981')}" font-size="11" font-family="'JetBrains Mono', monospace" font-weight="800" text-anchor="middle">${temp.toFixed(1)}°C</text>

                <!-- Status LED -->
                <circle cx="${feederWidth / 2}" cy="265" r="5" fill="${isOverheating ? '#ef4444' : (isSpare ? '#64748b' : '#10b981')}"/>

                <!-- Subtitle / Fuse spec -->
                <text x="${feederWidth / 2}" y="285" fill="#64748b" font-size="8" font-family="'Inter', sans-serif" text-anchor="middle">${i < 5 ? '250A' : (i < 10 ? '400A' : 'YDK')}</text>
                <text x="${feederWidth / 2}" y="298" fill="#475569" font-size="7" font-family="'Inter', sans-serif" text-anchor="middle">${isSpare ? 'Boş' : 'Çıkış'}</text>
            </g>
            `;
        }

        container.innerHTML = html;
    }

    updateTelemetry(telemetry) {
        if (!telemetry) return;

        // 1. Update LCD on ENTES MPR-53CS
        const elV = document.getElementById("mprLcdV");
        const elI = document.getElementById("mprLcdI");
        const elF = document.getElementById("mprLcdF");
        if (elV) elV.textContent = `V: ${telemetry.electrical.voltage_l1} V`;
        if (elI) elI.textContent = `I: ${telemetry.electrical.current_l1} A`;
        if (elF) elF.textContent = `50.02 Hz | THD: ${telemetry.electrical.thd_current}%`;

        // 2. Update TVOC-2 LED
        const tvocLed = document.getElementById("tvocLed");
        if (tvocLed) {
            tvocLed.setAttribute("fill", telemetry.optical_arc.arc_detected ? "#ef4444" : "#10b981");
        }

        // 3. Update HFCT box
        const pdPps = document.getElementById("twinPdPps");
        const pdPeak = document.getElementById("twinPdPeak");
        if (pdPps) pdPps.textContent = `PD: ${telemetry.environmental_pd.hfct_pd_pps} pps`;
        if (pdPeak) pdPeak.textContent = `${telemetry.environmental_pd.hfct_peak_pc} pC Peak`;

        // 4. Update Busbar Gradients
        const barR = document.getElementById("barR");
        if (barR) {
            barR.setAttribute("fill", telemetry.thermal.main_busbar_temp_c > 65 ? "url(#hotCopperGrad)" : "url(#copperGrad)");
        }

        // 5. Update Feeders
        this.renderFeeders(telemetry.thermal.dsya_feeders);

        // 6. Update Drawer if open
        if (this.drawer && this.drawer.classList.contains("active")) {
            this.updateDrawerContent(telemetry);
        }
    }

    selectFeeder(feederId) {
        this.selectedFeederId = feederId;
        if (this.drawer) {
            this.drawer.classList.add("active");
            if (this.drawerTitle) this.drawerTitle.textContent = `${feederId} Çıkış Kolu & Klemens İnceleme`;
            if (window.latestTelemetry) {
                this.updateDrawerContent(window.latestTelemetry);
            }
        }
    }

    updateDrawerContent(telemetry) {
        const feederIdx = parseInt(this.selectedFeederId.replace("DSYA-", "")) - 1;
        const feeder = telemetry.thermal.dsya_feeders[feederIdx];
        if (!feeder) return;

        const isTargetAnomalous = feeder.id === "DSYA-04" && telemetry.scenario === "LOOSE_BOLT";
        const cdi = isTargetAnomalous ? 3.8 : 1.05;
        const residual = isTargetAnomalous ? (feeder.surface_temp_c - (telemetry.thermal.ambient_temp_c + 22.0)).toFixed(1) : "+1.2";

        this.drawerBody.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:8px; font-size:11px;">
                <div style="display:flex; justify-content:space-between; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:4px;">
                    <span style="color:#94a3b8;">Hücre Tipi:</span>
                    <strong style="color:#fff;">${feeder.name}</strong>
                </div>
                <div style="display:flex; justify-content:space-between;">
                    <span style="color:#94a3b8;">Yük Akımı:</span>
                    <strong style="color:#38bdf8; font-family:'JetBrains Mono';">${feeder.current_amps} A</strong>
                </div>
                <div style="display:flex; justify-content:space-between;">
                    <span style="color:#94a3b8;">Klemens Sıcaklığı:</span>
                    <strong style="color:${feeder.surface_temp_c > 75 ? '#ef4444' : '#10b981'}; font-family:'JetBrains Mono'; font-size:13px;">${feeder.surface_temp_c} °C</strong>
                </div>
                <div style="display:flex; justify-content:space-between;">
                    <span style="color:#94a3b8;">ΔT Residual:</span>
                    <strong style="color:${isTargetAnomalous ? '#ef4444' : '#10b981'}; font-family:'JetBrains Mono';">${residual} °C</strong>
                </div>
                <div style="display:flex; justify-content:space-between;">
                    <span style="color:#94a3b8;">Kontak Bozulma İndeksi (CDI):</span>
                    <strong style="color:${cdi > 1.5 ? '#f59e0b' : '#10b981'}; font-family:'JetBrains Mono';">${cdi}x</strong>
                </div>
                <div style="display:flex; justify-content:space-between;">
                    <span style="color:#94a3b8;">Bara Terminalleri Mesafesi:</span>
                    <span style="color:#cbd5e1; font-family:'JetBrains Mono';">185 mm (TEDAŞ)</span>
                </div>
                <div style="background:rgba(255,255,255,0.04); padding:6px; border-radius:4px; margin-top:4px;">
                    <span style="display:block; color:#94a3b8; font-size:10px;">DURUM ÖZETİ:</span>
                    <p style="color:${isTargetAnomalous ? '#f87171' : '#34d399'}; font-size:10px; margin-top:2px;">
                        ${isTargetAnomalous 
                            ? 'DİKKAT: Cıvata gevşemesi kaynaklı kontak direnci 3.8 kat yükselmiş! Yangın öncesi erken safha.' 
                            : 'Normal termal soğuma ve akım dağılımı. Kontak direnci stabil.'}
                    </p>
                </div>
            </div>
        `;
    }
}

// Instantiate on load
document.addEventListener("DOMContentLoaded", () => {
    window.panoDigitalTwin = new PanoDigitalTwin("panoContainer");
});
