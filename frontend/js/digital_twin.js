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
        this.feederNodes = new Map();
        this.lastFeedersData = null;

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

    getThemeColors() {
        const isLight = document.body.classList.contains("theme-light");
        const isSanzo = document.body.classList.contains("theme-sanzo-wada");
        const isOled = document.body.classList.contains("theme-oled");

        if (isLight) {
            return {
                cabinetOuterBg: "#e2e8f0",
                cabinetOuterStroke: "#94a3b8",
                cabinetInnerStroke: "#cbd5e1",
                compBg: "#ffffff",
                compStroke: "#cbd5e1",
                compTitle: "#0f172a",
                unitBg: "#f1f5f9",
                unitStroke: "#0284c7",
                unitStrokeSubtle: "#cbd5e1",
                unitAccent: "#0284c7",
                unitText: "#0f172a",
                unitDesc: "#475569",
                mprBg: "#ffffff",
                mprLcdBg: "#e0f2fe",
                mprLcdStroke: "#0284c7",
                mprLcdText: "#0369a1",
                mprBtn: "#e2e8f0",
                mprBtnStroke: "#94a3b8",
                feederActiveBg: "#ffffff",
                feederSpareBg: "#f8fafc",
                feederActiveStroke: "#0284c7",
                feederSpareStroke: "#cbd5e1",
                fuseHandleBg: "#f1f5f9",
                fuseHandleStroke: "#94a3b8",
                fuseHandleText: "#0f172a",
                fuseSlotBg: "#f8fafc",
                fuseSlotStroke: "#cbd5e1",
                fuseInnerBg: "#ffffff",
                fuseInnerStroke: "#94a3b8",
                fusePhaseText: "#0f172a",
                fuseSigortaText: "#0284c7",
                metricsBg: "#f8fafc",
                metricsStroke: "#cbd5e1",
                currentText: "#0284c7",
                tempText: "#0f172a",
                ratingText: "#475569",
                cableBg: "#ffffff",
                cableStroke: "#cbd5e1",
                cableTitle: "#334155",
                cableNote: "#0284c7",
                neutralText: "#ffffff",
                busbarText: "#030712"
            };
        } else if (isSanzo) {
            return {
                cabinetOuterBg: "#17231a",
                cabinetOuterStroke: "#2e4232",
                cabinetInnerStroke: "#243427",
                compBg: "#1d2a20",
                compStroke: "#2e4232",
                compTitle: "#f7f4eb",
                unitBg: "#243327",
                unitStroke: "#4eba7e",
                unitStrokeSubtle: "#2e4232",
                unitAccent: "#4eba7e",
                unitText: "#f7f4eb",
                unitDesc: "#a4b89d",
                mprBg: "#172219",
                mprLcdBg: "#0f1a11",
                mprLcdStroke: "#4eba7e",
                mprLcdText: "#5ec98d",
                mprBtn: "#2b3d2f",
                mprBtnStroke: "#405745",
                feederActiveBg: "#1e2b20",
                feederSpareBg: "#172219",
                feederActiveStroke: "#4eba7e",
                feederSpareStroke: "#2e4232",
                fuseHandleBg: "#283a2c",
                fuseHandleStroke: "#405745",
                fuseHandleText: "#f7f4eb",
                fuseSlotBg: "#131b14",
                fuseSlotStroke: "#243427",
                fuseInnerBg: "#182219",
                fuseInnerStroke: "#334837",
                fusePhaseText: "#f7f4eb",
                fuseSigortaText: "#4eba7e",
                metricsBg: "#131b14",
                metricsStroke: "#243427",
                currentText: "#4eba7e",
                tempText: "#f7f4eb",
                ratingText: "#a4b89d",
                cableBg: "#162018",
                cableStroke: "#243427",
                cableTitle: "#a4b89d",
                cableNote: "#4eba7e",
                neutralText: "#ffffff",
                busbarText: "#030712"
            };
        } else if (isOled) {
            return {
                cabinetOuterBg: "#080808",
                cabinetOuterStroke: "#222225",
                cabinetInnerStroke: "#1a1a1a",
                compBg: "#0c0c0e",
                compStroke: "#1f1f23",
                compTitle: "#ffffff",
                unitBg: "#121215",
                unitStroke: "#00f0ff",
                unitStrokeSubtle: "#1f1f23",
                unitAccent: "#00f0ff",
                unitText: "#ffffff",
                unitDesc: "#a1a1aa",
                mprBg: "#08080a",
                mprLcdBg: "#040810",
                mprLcdStroke: "#00f0ff",
                mprLcdText: "#00f0ff",
                mprBtn: "#18181b",
                mprBtnStroke: "#27272a",
                feederActiveBg: "#0d0d0f",
                feederSpareBg: "#0a0a0c",
                feederActiveStroke: "#00f0ff",
                feederSpareStroke: "#27272a",
                fuseHandleBg: "#18181b",
                fuseHandleStroke: "#3f3f46",
                fuseHandleText: "#ffffff",
                fuseSlotBg: "#050507",
                fuseSlotStroke: "#1f1f23",
                fuseInnerBg: "#09090b",
                fuseInnerStroke: "#27272a",
                fusePhaseText: "#ffffff",
                fuseSigortaText: "#00f0ff",
                metricsBg: "#050507",
                metricsStroke: "#1f1f23",
                currentText: "#00f0ff",
                tempText: "#ffffff",
                ratingText: "#71717a",
                cableBg: "#080808",
                cableStroke: "#1f1f23",
                cableTitle: "#a1a1aa",
                cableNote: "#00f0ff",
                neutralText: "#ffffff",
                busbarText: "#030712"
            };
        } else {
            return {
                cabinetOuterBg: "#0c1322",
                cabinetOuterStroke: "#334155",
                cabinetInnerStroke: "#1e293b",
                compBg: "#111c2e",
                compStroke: "#1e293b",
                compTitle: "#94a3b8",
                unitBg: "#182234",
                unitStroke: "#26c6da",
                unitStrokeSubtle: "#334155",
                unitAccent: "#26c6da",
                unitText: "#e2e8f0",
                unitDesc: "#94a3b8",
                mprBg: "#090f1a",
                mprLcdBg: "#03141e",
                mprLcdStroke: "#0891b2",
                mprLcdText: "#26c6da",
                mprBtn: "#1e293b",
                mprBtnStroke: "#475569",
                feederActiveBg: "#111c2e",
                feederSpareBg: "#141e30",
                feederActiveStroke: "#26c6da",
                feederSpareStroke: "#334155",
                fuseHandleBg: "#1e293b",
                fuseHandleStroke: "#475569",
                fuseHandleText: "#f8fafc",
                fuseSlotBg: "#080e18",
                fuseSlotStroke: "#1e293b",
                fuseInnerBg: "#0f172a",
                fuseInnerStroke: "#334155",
                fusePhaseText: "#f8fafc",
                fuseSigortaText: "#00e5ff",
                metricsBg: "#080e18",
                metricsStroke: "#1e293b",
                currentText: "#26c6da",
                tempText: "#26c6da",
                ratingText: "#cbd5e1",
                cableBg: "#090e18",
                cableStroke: "#1e293b",
                cableTitle: "#94a3b8",
                cableNote: "#26c6da",
                neutralText: "#ffffff",
                busbarText: "#030712"
            };
        }
    }

    renderBaseSvg() {
        this.feederNodes.clear();
        const c = this.getThemeColors();

        // SVG dimensions: viewBox 0 0 1000 600
        const svgHtml = `
        <svg id="panoSvg" viewBox="0 0 1000 620" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <!-- Copper Busbar Gradient -->
                <linearGradient id="copperGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="#b45309" />
                    <stop offset="50%" stop-color="#e8aa52" />
                    <stop offset="100%" stop-color="#b45309" />
                </linearGradient>

                <!-- Hot / Overheating Busbar Gradient -->
                <linearGradient id="hotCopperGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="#b91c1c" />
                    <stop offset="50%" stop-color="#ee6670" />
                    <stop offset="100%" stop-color="#b91c1c" />
                </linearGradient>

                <!-- DSYA Enclosure Shadow -->
                <filter id="boxGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="${c.unitAccent}" flood-opacity="0.2"/>
                </filter>
            </defs>

            <!-- Outer Cabinet Frame (TEDAŞ 1600x1500 mm profile) -->
            <rect x="20" y="20" width="960" height="580" rx="8" fill="${c.cabinetOuterBg}" stroke="${c.cabinetOuterStroke}" stroke-width="4"/>
            <rect x="26" y="26" width="948" height="568" rx="6" fill="none" stroke="${c.cabinetInnerStroke}" stroke-width="2"/>

            <!-- Top Header Compartment: Street Lighting, Service & Protection -->
            <rect x="35" y="35" width="750" height="85" rx="4" fill="${c.compBg}" stroke="${c.compStroke}" stroke-width="1.5"/>
            <text x="50" y="55" fill="${c.compTitle}" font-size="11" font-family="'Outfit', sans-serif" font-weight="700">ÜST SERVİS VE KORUMA KOMPARTIMANI</text>
            
            <!-- ABB TVOC-2 Arc Guard Unit inside top compartment -->
            <g id="tvocUnitGroup" transform="translate(50, 65)">
                <rect width="185" height="45" rx="4" fill="${c.unitBg}" stroke="${c.unitStroke}" stroke-width="1.5"/>
                <text x="10" y="20" fill="${c.unitAccent}" font-size="10.2" font-family="'Outfit', sans-serif" font-weight="800">ABB TVOC-2 ARC GUARD</text>
                <circle id="tvocLed" cx="170" cy="18" r="6" fill="${c.unitAccent}"/>
                <text id="tvocWarnMark" x="170" y="21.5" fill="#ffffff" font-size="9.5" font-family="'Outfit', sans-serif" font-weight="900" text-anchor="middle" style="display:none; pointer-events:none;">!</text>
                <text x="10" y="36" fill="${c.unitDesc}" font-size="9" font-family="'JetBrains Mono', monospace">30 Optik Fiber Kanalı</text>
            </g>

            <!-- Internal Service & Lighting Fuses -->
            <g transform="translate(250, 65)">
                <rect width="220" height="45" rx="4" fill="${c.unitBg}" stroke="${c.unitStrokeSubtle}" stroke-width="1"/>
                <text x="12" y="18" fill="${c.unitText}" font-size="10.5" font-family="'Outfit', sans-serif" font-weight="700">SOKAK AYDINLATMA (160A) &amp; İÇ İHTİYAÇ</text>
                <text x="12" y="35" fill="${c.unitDesc}" font-size="9" font-family="'JetBrains Mono', monospace">Kontaktör AC-5a | Sigorta gG 20A</text>
            </g>

            <!-- SCADA Gateway Edge Node -->
            <g transform="translate(490, 65)">
                <rect width="280" height="45" rx="4" fill="${c.unitBg}" stroke="${c.unitStroke}" stroke-width="1.5"/>
                <text x="12" y="18" fill="${c.unitAccent}" font-size="11" font-family="'Outfit', sans-serif" font-weight="800">GRID-GUARD YEREL AĞ GEÇİDİ</text>
                <text x="12" y="35" fill="${c.unitDesc}" font-size="9" font-family="'JetBrains Mono', monospace">RS-485 Modbus RTU / Uç Yapay Zeka (Edge AI)</text>
            </g>

            <!-- Right Compartment: Metering / Analyser (ENTERS MPR-53CS) -->
            <rect x="795" y="35" width="170" height="550" rx="4" fill="${c.compBg}" stroke="${c.compStroke}" stroke-width="1.5"/>
            <text x="810" y="55" fill="${c.compTitle}" font-size="11" font-family="'Outfit', sans-serif" font-weight="700">ÖLÇÜ ODASI (EÖ)</text>

            <!-- ENTES MPR-53CS Panel Unit -->
            <g transform="translate(805, 75)">
                <rect width="150" height="150" rx="6" fill="${c.mprBg}" stroke="${c.unitStroke}" stroke-width="2"/>
                <rect x="12" y="12" width="126" height="60" rx="3" fill="${c.mprLcdBg}" stroke="${c.mprLcdStroke}" stroke-width="1"/>
                <!-- LCD Display Text -->
                <text x="20" y="32" fill="${c.mprLcdText}" font-size="12" font-family="'JetBrains Mono', monospace" font-weight="700" id="mprLcdV">V: 230.2 V</text>
                <text x="20" y="48" fill="${c.mprLcdText}" font-size="12" font-family="'JetBrains Mono', monospace" font-weight="700" id="mprLcdI">I: 324.5 A</text>
                <text x="20" y="63" fill="${c.mprLcdText}" font-size="10" font-family="'JetBrains Mono', monospace" id="mprLcdF">50.02 Hz | THD: 2.6%</text>
                
                <text x="25" y="95" fill="${c.unitText}" font-size="11" font-family="'Outfit', sans-serif" font-weight="800">ENTES MPR-53CS</text>
                <text x="25" y="110" fill="${c.unitDesc}" font-size="9.5" font-family="'JetBrains Mono', monospace">3-Faz Güç Analizörü</text>
                <!-- Keypad Buttons Mock -->
                <circle cx="35" cy="130" r="6" fill="${c.mprBtn}" stroke="${c.mprBtnStroke}" stroke-width="1"/>
                <circle cx="55" cy="130" r="6" fill="${c.mprBtn}" stroke="${c.mprBtnStroke}" stroke-width="1"/>
                <circle cx="75" cy="130" r="6" fill="${c.mprBtn}" stroke="${c.mprBtnStroke}" stroke-width="1"/>
                <circle cx="95" cy="130" r="6" fill="${c.mprBtn}" stroke="${c.mprBtnStroke}" stroke-width="1"/>
            </g>

            <!-- Instrument CT Details below analyser -->
            <g transform="translate(803, 240)">
                <rect width="154" height="80" rx="4" fill="${c.unitBg}" stroke="${c.unitStrokeSubtle}" stroke-width="1"/>
                <text x="9" y="20" fill="${c.unitText}" font-size="10" font-family="'Outfit', sans-serif" font-weight="700" textLength="136" lengthAdjust="spacingAndGlyphs">AKIM TRAFOSU GİRİŞİ</text>
                <text x="9" y="38" fill="${c.unitAccent}" font-size="11" font-family="'JetBrains Mono', monospace" font-weight="700">2500 / 5 A (CT)</text>
                <text x="9" y="55" fill="${c.unitDesc}" font-size="9" font-family="'Inter', sans-serif" textLength="136" lengthAdjust="spacingAndGlyphs">TEDAŞ Şartname Sınıfı 0.5</text>
            </g>

            <!-- Techimp HFCT PD Sensor Earth Collector Box -->
            <g transform="translate(803, 335)">
                <rect width="154" height="110" rx="4" fill="${c.unitBg}" stroke="${c.unitStroke}" stroke-width="1.5"/>
                <text x="9" y="20" fill="${c.unitAccent}" font-size="8.8" font-family="'Outfit', sans-serif" font-weight="800" textLength="136" lengthAdjust="spacingAndGlyphs">TECHIMP HFCT PD ÜNİTESİ</text>
                <text x="9" y="38" fill="${c.unitDesc}" font-size="8.5" font-family="'JetBrains Mono', monospace" textLength="136" lengthAdjust="spacingAndGlyphs">1 - 60 MHz Yüksek Frekans</text>
                <text x="9" y="54" fill="${c.unitAccent}" font-size="11" font-family="'JetBrains Mono', monospace" id="twinPdPps">PD: 4.8 pps</text>
                <text x="9" y="70" fill="${c.unitDesc}" font-size="10" font-family="'JetBrains Mono', monospace" id="twinPdPeak">32 pC Tepe</text>
                <text x="9" y="94" fill="${c.unitAccent}" font-size="8.4" font-family="'Inter', sans-serif" font-weight="700" textLength="136" lengthAdjust="spacingAndGlyphs">Topraklama Örgüsünde Klipsli</text>
            </g>

            <!-- Main Busbar Section (Behind DSYA, 2x 100x10 mm Cu) -->
            <g id="mainBusbarGroup">
                <!-- R, S, T 3-Phase Busbar horizontal strips -->
                <rect id="barR" x="35" y="135" width="750" height="14" rx="2" fill="url(#copperGrad)"/>
                <rect id="barS" x="35" y="155" width="750" height="14" rx="2" fill="url(#copperGrad)"/>
                <rect id="barT" x="35" y="175" width="750" height="14" rx="2" fill="url(#copperGrad)"/>
                <!-- Neutral Bar -->
                <rect id="barN" x="35" y="515" width="750" height="10" rx="2" fill="#64748b"/>
                <text x="45" y="146" fill="${c.busbarText}" font-size="9.5" font-family="'JetBrains Mono', monospace" font-weight="900" letter-spacing="0.3">L1 BARA 2x(100x10 mm²)</text>
                <text x="45" y="166" fill="${c.busbarText}" font-size="9.5" font-family="'JetBrains Mono', monospace" font-weight="900" letter-spacing="0.3">L2 BARA 2x(100x10 mm²)</text>
                <text x="45" y="186" fill="${c.busbarText}" font-size="9.5" font-family="'JetBrains Mono', monospace" font-weight="900" letter-spacing="0.3">L3 BARA 2x(100x10 mm²)</text>
                <text x="45" y="523" fill="${c.neutralText}" font-size="8.5" font-family="'JetBrains Mono', monospace" font-weight="800">NÖTR BARASI (N)</text>
            </g>

            <!-- 12 DSYA Vertical Feeders Container (Middle Body) -->
            <g id="dsyaFeedersContainer">
                <!-- Generated dynamically via renderFeeders() -->
            </g>

            <!-- Bottom Cable Entry & Non-Invasive HFCT Sensor Area (>400 mm clearance per TEDAŞ) -->
            <rect x="35" y="535" width="750" height="50" rx="4" fill="${c.cableBg}" stroke="${c.cableStroke}" stroke-width="1"/>
            <text x="50" y="552" fill="${c.cableTitle}" font-size="10" font-family="'JetBrains Mono', monospace" font-weight="700">KABLO BAĞLANTI KOMPARTIMANI (TEDAŞ ŞARTNAMESİ: EN AZ 400 mm NET MONTAJ AÇIKLIĞI)</text>
            <text x="50" y="570" fill="${c.cableNote}" font-size="9.5" font-family="'Inter', sans-serif" font-weight="600">✓ Non-İnvaziv Techimp HFCT 30/50 Sensörleri topraklama örgüsüne klipsli takılmıştır (Bara delme/kesme yok)</text>
        </svg>
        `;

        this.container.innerHTML = svgHtml;
        this.renderFeeders(this.lastFeedersData);
    }

    cacheFeederNodes(container) {
        this.feederNodes.clear();
        container.querySelectorAll(".dsya-unit").forEach(root => {
            this.feederNodes.set(root.id.replace("feederNode_", ""), {
                root,
                shell: root.querySelector('[data-role="shell"]'),
                metrics: root.querySelector('[data-role="metrics"]'),
                current: root.querySelector('[data-role="current"]'),
                temp: root.querySelector('[data-role="temp"]'),
                led: root.querySelector('[data-role="led"]')
            });
        });
    }

    renderFeeders(feedersData = null) {
        if (feedersData) {
            this.lastFeedersData = feedersData;
        }
        const c = this.getThemeColors();
        const container = document.getElementById("dsyaFeedersContainer");
        if (!container) return;

        const startX = 42;
        const feederWidth = 56;
        const gap = 6;
        const startY = 198;
        const feederHeight = 310;

        if (this.feederNodes.size !== 12 || !container.querySelector("#feederNode_DSYA-01")) {
            let html = "";
            for (let i = 0; i < 12; i++) {
                const id = `DSYA-${String(i + 1).padStart(2, '0')}`;
                const x = startX + i * (feederWidth + gap);
                const isSpare = i >= 10;
                const current = isSpare ? 0 : 35.0;
                const temp = 32.0;

                html += `
                <g class="dsya-unit" id="feederNode_${id}" transform="translate(${x}, ${startY})" style="cursor: pointer;" onclick="window.panoDigitalTwin.selectFeeder('${id}')">
                    <!-- Outer DSYA vertical casing -->
                    <rect data-role="shell" width="${feederWidth}" height="${feederHeight}" rx="4" fill="${isSpare ? c.feederSpareBg : c.feederActiveBg}" stroke="${isSpare ? c.feederSpareStroke : c.feederActiveStroke}" stroke-width="1.5"/>

                    <!-- DSYA Disconnector Handle / Fuse Carrier -->
                    <rect x="5" y="8" width="${feederWidth - 10}" height="32" rx="3" fill="${c.fuseHandleBg}" stroke="${c.fuseHandleStroke}" stroke-width="1"/>
                    <text x="${feederWidth / 2}" y="28" fill="${c.fuseHandleText}" font-size="10.5" font-family="'Outfit', sans-serif" font-weight="800" text-anchor="middle">${id}</text>

                    <!-- Fuse Body 3-Phase Windows (L1, L2, L3 NH Bıçaklı Sigorta) -->
                    <g class="fuse-slot">
                        <rect x="5" y="46" width="${feederWidth - 10}" height="48" rx="3" fill="${c.fuseSlotBg}" stroke="${c.fuseSlotStroke}" stroke-width="1"/>
                        <rect x="10" y="50" width="${feederWidth - 20}" height="40" rx="2" fill="${c.fuseInnerBg}" stroke="${c.fuseInnerStroke}" stroke-width="0.8"/>
                        <text x="${feederWidth / 2}" y="67" fill="${c.fusePhaseText}" font-size="12" font-family="'JetBrains Mono', monospace" font-weight="800" text-anchor="middle">L1</text>
                        <text x="${feederWidth / 2}" y="82" fill="${c.fuseSigortaText}" font-size="8.5" font-family="'Outfit', sans-serif" font-weight="700" text-anchor="middle" letter-spacing="0.5">SİGORTA</text>
                    </g>

                    <g class="fuse-slot">
                        <rect x="5" y="98" width="${feederWidth - 10}" height="48" rx="3" fill="${c.fuseSlotBg}" stroke="${c.fuseSlotStroke}" stroke-width="1"/>
                        <rect x="10" y="102" width="${feederWidth - 20}" height="40" rx="2" fill="${c.fuseInnerBg}" stroke="${c.fuseInnerStroke}" stroke-width="0.8"/>
                        <text x="${feederWidth / 2}" y="119" fill="${c.fusePhaseText}" font-size="12" font-family="'JetBrains Mono', monospace" font-weight="800" text-anchor="middle">L2</text>
                        <text x="${feederWidth / 2}" y="134" fill="${c.fuseSigortaText}" font-size="8.5" font-family="'Outfit', sans-serif" font-weight="700" text-anchor="middle" letter-spacing="0.5">SİGORTA</text>
                    </g>

                    <g class="fuse-slot">
                        <rect x="5" y="150" width="${feederWidth - 10}" height="48" rx="3" fill="${c.fuseSlotBg}" stroke="${c.fuseSlotStroke}" stroke-width="1"/>
                        <rect x="10" y="154" width="${feederWidth - 20}" height="40" rx="2" fill="${c.fuseInnerBg}" stroke="${c.fuseInnerStroke}" stroke-width="0.8"/>
                        <text x="${feederWidth / 2}" y="171" fill="${c.fusePhaseText}" font-size="12" font-family="'JetBrains Mono', monospace" font-weight="800" text-anchor="middle">L3</text>
                        <text x="${feederWidth / 2}" y="186" fill="${c.fuseSigortaText}" font-size="8.5" font-family="'Outfit', sans-serif" font-weight="700" text-anchor="middle" letter-spacing="0.5">SİGORTA</text>
                    </g>

                    <!-- Live Metrics Badge on Feeder -->
                    <rect data-role="metrics" x="4" y="206" width="${feederWidth - 8}" height="45" rx="3" fill="${c.metricsBg}" stroke="${isSpare ? c.feederSpareStroke : c.feederActiveStroke}" stroke-width="1"/>
                    <text data-role="current" x="${feederWidth / 2}" y="222" fill="${c.currentText}" font-size="11" font-family="'JetBrains Mono', monospace" font-weight="700" text-anchor="middle">${current.toFixed(0)} A</text>
                    <text data-role="temp" x="${feederWidth / 2}" y="242" fill="${c.tempText}" font-size="11" font-family="'JetBrains Mono', monospace" font-weight="800" text-anchor="middle">${temp.toFixed(1)}°C</text>

                    <!-- Status LED -->
                    <circle data-role="led" cx="${feederWidth / 2}" cy="265" r="5" fill="${isSpare ? '#64748b' : c.unitAccent}"/>

                    <!-- Subtitle / Fuse spec -->
                    <text x="${feederWidth / 2}" y="285" fill="${c.ratingText}" font-size="8.5" font-family="'Inter', sans-serif" font-weight="600" text-anchor="middle">${i < 5 ? '250A' : (i < 10 ? '400A' : 'YDK')}</text>
                    <text x="${feederWidth / 2}" y="298" fill="${c.unitDesc}" font-size="7.5" font-family="'Inter', sans-serif" font-weight="500" text-anchor="middle">${isSpare ? 'Boş' : 'Çıkış'}</text>
                </g>
                `;
            }
            container.innerHTML = html;
            this.cacheFeederNodes(container);
        }

        for (let i = 0; i < 12; i++) {
            const id = `DSYA-${String(i + 1).padStart(2, '0')}`;
            const refs = this.feederNodes.get(id);
            if (!refs) continue;

            const data = feedersData ? feedersData[i] : null;
            const isSpare = i >= 10;
            const current = Number.isFinite(data?.current_amps) ? data.current_amps : (isSpare ? 0 : 35.0);
            const temp = Number.isFinite(data?.surface_temp_c) ? data.surface_temp_c : 32.0;
            const isOverheating = data?.contact_status === "OVERHEATING";

            let borderColor = isSpare ? c.feederSpareStroke : c.feederActiveStroke;
            let fillColor = isSpare ? c.feederSpareBg : c.feederActiveBg;
            if (isOverheating || temp > 75) {
                borderColor = c.unitAccent;
                fillColor = "rgba(0, 229, 255, 0.14)";
            } else if (temp > 65) {
                borderColor = c.unitAccent;
                fillColor = "rgba(0, 229, 255, 0.08)";
            }

            refs.shell?.setAttribute("fill", fillColor);
            refs.shell?.setAttribute("stroke", borderColor);
            refs.shell?.setAttribute("stroke-width", (isOverheating || temp > 75) ? "2.5" : "1.5");
            refs.metrics?.setAttribute("stroke", borderColor);
            refs.root.toggleAttribute("filter", isOverheating || temp > 75);
            refs.root.setAttribute("filter", (isOverheating || temp > 75) ? "url(#boxGlow)" : "");
            if (!isOverheating && temp <= 75) refs.root.removeAttribute("filter");
            if (refs.current) {
                refs.current.textContent = `${current.toFixed(0)} A`;
                refs.current.setAttribute("fill", (isOverheating || temp > 75) ? c.unitAccent : c.currentText);
            }
            if (refs.temp) {
                refs.temp.textContent = `${temp.toFixed(1)}°C`;
                refs.temp.setAttribute("fill", (temp > 50 || isOverheating) ? c.unitAccent : c.tempText);
                if (isOverheating || temp > 75) {
                    refs.temp.classList.add("twin-danger-pulse");
                } else {
                    refs.temp.classList.remove("twin-danger-pulse");
                }
            }
            refs.led?.setAttribute("fill", isSpare ? "#64748b" : c.unitAccent);
            if (isOverheating || temp > 75) {
                refs.led?.classList.add("twin-danger-pulse");
            } else {
                refs.led?.classList.remove("twin-danger-pulse");
            }
        }
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
        const tvocWarnMark = document.getElementById("tvocWarnMark");
        if (tvocLed) {
            const c = this.getThemeColors();
            const arc = telemetry.optical_arc || {};
            const tripped = arc.arc_detected || arc.trip_executed || arc.latched || arc.system_state === 2;
            tvocLed.setAttribute("fill", c.unitAccent);
            if (tripped) {
                tvocLed.classList.add("twin-danger-pulse");
                if (tvocWarnMark) tvocWarnMark.style.display = "block";
            } else {
                tvocLed.classList.remove("twin-danger-pulse");
                if (tvocWarnMark) tvocWarnMark.style.display = "none";
            }
        }

        // 3. Update HFCT box
        const pdPps = document.getElementById("twinPdPps");
        const pdPeak = document.getElementById("twinPdPeak");
        if (pdPps) pdPps.textContent = `PD: ${telemetry.environmental_pd.hfct_pd_pps} pps`;
        if (pdPeak) pdPeak.textContent = `${telemetry.environmental_pd.hfct_peak_pc} pC Tepe`;

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

        const c = this.getThemeColors();
        const critColor = c.unitAccent;
        const warnColor = c.unitAccent;
        const okColor = c.unitAccent;

        const isTargetAnomalous = feeder.id === "DSYA-04" && telemetry.scenario === "LOOSE_BOLT";
        const cdi = isTargetAnomalous ? 3.8 : 1.05;
        const residual = isTargetAnomalous ? (feeder.surface_temp_c - (telemetry.thermal.ambient_temp_c + 22.0)).toFixed(1) : "+1.2";

        this.drawerBody.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:8px; font-size:11px;">
                <div style="display:flex; justify-content:space-between; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:4px;">
                    <span style="color:${c.ratingText};">Hücre Tipi:</span>
                    <strong style="color:${c.unitText};">${feeder.name}</strong>
                </div>
                <div style="display:flex; justify-content:space-between;">
                    <span style="color:${c.ratingText};">Yük Akımı:</span>
                    <strong style="color:${okColor}; font-family:'JetBrains Mono';">${feeder.current_amps} A</strong>
                </div>
                <div style="display:flex; justify-content:space-between;">
                    <span style="color:${c.ratingText};">Klemens Sıcaklığı:</span>
                    <strong style="color:${feeder.surface_temp_c > 75 ? critColor : okColor}; font-family:'JetBrains Mono'; font-size:13px;">${feeder.surface_temp_c} °C</strong>
                </div>
                <div style="display:flex; justify-content:space-between;">
                    <span style="color:${c.ratingText};">ΔT Model Farkı:</span>
                    <strong style="color:${isTargetAnomalous ? critColor : okColor}; font-family:'JetBrains Mono';">${residual} °C</strong>
                </div>
                <div style="display:flex; justify-content:space-between;">
                    <span style="color:${c.ratingText};">Kontak Bozulma İndeksi (CDI):</span>
                    <strong style="color:${cdi > 1.5 ? warnColor : okColor}; font-family:'JetBrains Mono';">${cdi}x</strong>
                </div>
                <div style="display:flex; justify-content:space-between;">
                    <span style="color:${c.ratingText};">Bara Terminalleri Mesafesi:</span>
                    <span style="color:${c.unitDesc}; font-family:'JetBrains Mono';">185 mm (TEDAŞ)</span>
                </div>
                <div style="background:${isSanzo ? 'rgba(78,186,126,0.08)' : 'rgba(255,255,255,0.04)'}; padding:6px; border-radius:4px; margin-top:4px; border:1px solid ${isSanzo ? 'rgba(78,186,126,0.2)' : 'rgba(255,255,255,0.06)'};">
                    <span style="display:block; color:${c.ratingText}; font-size:10px;">DURUM ÖZETİ:</span>
                    <p style="color:${isTargetAnomalous ? critColor : okColor}; font-size:10px; margin-top:2px;">
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
