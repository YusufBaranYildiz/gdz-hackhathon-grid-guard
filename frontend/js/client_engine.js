/**
 * Grid-Guard AI - Client-Side Autonomous Edge Engine & Physics Simulator.
 * Allows the dashboard to run 100% standalone on static platforms like Netlify, GitHub Pages,
 * or offline tablets when the Python backend is not reachable.
 * Matches 100% with backend/main.py, physics_thermal_model.py, dew_point_pd_fusion.py, and arc_protection.py.
 */

class ClientSimulatorEngine {
    constructor() {
        this.activeScenario = "NORMAL";
        this.currentStep = 0;
        this.ambientTempC = 27.5;
        this.relativeHumidityPct = 48.2;
        this.smoothBusbarTemp = 36.2;
        this.smoothFeederTemps = new Map();
        this.arcTripCount = 0;
        this.arcLatched = false;
        this.arcSystemState = 0;
        this.latestAlert = null;
        this.alertHistory = [];

        // 100-Panel synthetic fleet generator
        this.substations = [
            ["GDZ", "Izmir Buca TM"], ["GDZ", "Izmir Bornova TM"], ["GDZ", "Izmir Konak TM"],
            ["GDZ", "Izmir Karsiyaka TM"], ["GDZ", "Izmir Bayrakli TM"], ["GDZ", "Izmir Cigli TM"],
            ["GDZ", "Izmir Gaziemir TM"], ["GDZ", "Manisa Yunusemre TM"], ["GDZ", "Manisa Sehzadeler TM"],
            ["ADM", "Denizli Pamukkale TM"], ["ADM", "Denizli Merkezefendi TM"], ["ADM", "Aydin Efeler TM"],
            ["ADM", "Aydin Kusadasi TM"], ["ADM", "Mugla Bodrum TM"], ["ADM", "Mugla Fethiye TM"]
        ];
        this.fleetPanels = this.initFleet();
    }

    initFleet() {
        const panels = [];
        for (let i = 1; i <= 100; i++) {
            const sub = this.substations[(i - 1) % this.substations.length];
            const isPano1 = i === 1;
            const health = isPano1 ? 98.0 : Math.round(91 + (Math.sin(i) * 0.5 + 0.5) * 8);
            const loadPct = Math.round(50 + (Math.cos(i) * 0.5 + 0.5) * 35);
            const bTemp = Number((28.0 + Math.pow(loadPct / 100.0, 2) * 14.0).toFixed(1));
            const rDt = isPano1 ? 1.4 : Number((0.2 + (Math.sin(i * 2) * 0.5 + 0.5) * 1.5).toFixed(1));
            const dewMargin = Number((16.0 + (Math.cos(i * 3) * 0.5 + 0.5) * 6.0).toFixed(1));

            panels.push({
                id: i,
                panel_id: `PANO-${String(i).padStart(3, '0')}`,
                code: `${sub[0]}-TM${String(i % 20).padStart(2, '0')}-AG-${String(i).padStart(3, '0')}`,
                name: `Pano #${i} (${sub[1].replace(/^(Izmir|Manisa|Denizli|Aydin|Mugla)\s+/, '')} - AG #${i})`,
                region: sub[0],
                substation: sub[1],
                transformer_kva: 1600,
                status: "OPTIMAL",
                health_index: health,
                active_alarms: 0,
                anomaly_detail: "Nominal Isletme",
                is_active_twin: isPano1,
                last_inspected: "18.09.2026",
                feeder_count: 12,
                load_pct: loadPct,
                temp_c: bTemp,
                residual_dt_c: rDt,
                dew_margin_c: dewMargin,
                hfct_pd_pps: Number((3.0 + (Math.sin(i) * 0.5 + 0.5) * 3.0).toFixed(1)),
                relative_humidity_pct: 48.2,
                ambient_temp_c: 27.5
            });
        }
        return panels;
    }

    setScenario(name) {
        const valid = ["NORMAL", "LOOSE_BOLT", "CONDENSATION_PD", "ARC_FLASH"];
        const upper = String(name).toUpperCase();
        if (valid.includes(upper)) {
            this.activeScenario = upper;
            if (upper === "NORMAL") {
                this.arcLatched = false;
                this.arcSystemState = 0;
                this.smoothBusbarTemp = 35.5;
                this.smoothFeederTemps.clear();
                this.latestAlert = null;
            }
        }
        return this.activeScenario;
    }

    resetArcTrip() {
        this.arcLatched = false;
        this.arcSystemState = 0;
        if (this.activeScenario === "ARC_FLASH") {
            this.activeScenario = "NORMAL";
        }
        this.latestAlert = null;
    }

    calculateDewPoint(tempC, rhPct) {
        const a = 17.27;
        const b = 237.7;
        const alpha = ((a * tempC) / (b + tempC)) + Math.log(Math.max(1.0, rhPct) / 100.0);
        return Number(((b * alpha) / (a - alpha)).toFixed(1));
    }

    step() {
        this.currentStep++;
        const t = this.currentStep;

        // 1. Realistic Industrial Grid Feeder Load Dynamics (Aegean 1600kVA feeder)
        // Multi-frequency organic oscillation between ~255A and ~415A
        const baseCycle = Math.sin(t * 0.16) * 52.0;       // Primary cyclical wave (~40s period, +/-52A)
        const subCycle = Math.cos(t * 0.42) * 24.0;        // Secondary feeder cycle (~15s period, +/-24A)
        const microJitter = (Math.sin(t * 1.25) * 0.6 + Math.cos(t * 2.8) * 0.4) * 6.5; // Sensor ripple
        let iL1 = Math.max(140.0, 335.0 + baseCycle + subCycle + microJitter);
        let iL2 = iL1 * (0.975 + Math.sin(t * 0.3) * 0.015);
        let iL3 = iL1 * (1.02 + Math.cos(t * 0.35) * 0.015);

        // 2. Ambient Environmental Breathing
        let ambTemp = this.ambientTempC + Math.sin(t * 0.07) * 0.6;
        let rh = this.relativeHumidityPct + Math.cos(t * 0.07) * 2.4;

        // 3. Techimp HFCT High-Frequency Partial Discharge (1-60 MHz)
        // Natural corona & electromagnetic background noise actively flickers between 4.0 and 13.5 pps
        let hfctPps = 6.8 + Math.sin(t * 0.45) * 3.4 + Math.cos(t * 1.15) * 2.2 + Math.sin(t * 2.4) * 1.0;
        let hfctPeak = 32.0 + Math.sin(t * 0.35) * 6.0 + Math.cos(t * 0.9) * 4.5;
        let diDt = 15.0 + Math.sin(t * 0.5) * 3.0;
        let opticalFlash = false;

        // 4. Physics-Informed Joule Heating & Conductor Thermal Inertia
        // TS EN 61439-1: Conductor rise tracks current squared (P ~ I^2 * R)
        const jouleRiseModel = 9.5 * Math.pow(iL1 / 400.0, 2);
        let busbarPred = ambTemp + jouleRiseModel;

        // Busbar copper thermal mass low-pass filter (tau ~ 6-8s):
        // In normal state, measured busbar tracks predicted temperature with nominal contact drop (+1.2°C to +1.6°C residual)
        const targetMeas = busbarPred + 1.35 + Math.sin(t * 0.28) * 0.35;
        this.smoothBusbarTemp += 0.22 * (targetMeas - this.smoothBusbarTemp);
        let busbarTemp = this.smoothBusbarTemp;

        // Apply Scenario Mutations
        if (this.activeScenario === "LOOSE_BOLT") {
            // Busbar is normal, DSYA-04 contact has loose bolt
        } else if (this.activeScenario === "CONDENSATION_PD") {
            rh = 93.4 + Math.sin(t * 0.25) * 1.2;
            ambTemp = 17.5 + Math.sin(t * 0.1) * 0.3;
            busbarTemp = 18.2 + Math.cos(t * 0.15) * 0.2;
            hfctPps = 94.0 + Math.cos(t * 0.5) * 14.0 + Math.sin(t * 1.7) * 6.0;
            hfctPeak = 320.0 + Math.sin(t * 0.5) * 45.0;
        } else if (this.activeScenario === "ARC_FLASH") {
            opticalFlash = true;
            iL1 = 3450.0 + Math.sin(t * 0.8) * 80.0;
            iL2 = 3400.0 + Math.cos(t * 0.7) * 70.0;
            iL3 = 3480.0 + Math.sin(t * 0.9) * 90.0;
            diDt = 1850.0 + Math.sin(t * 1.5) * 120.0;
            this.arcLatched = true;
            this.arcSystemState = 2;
        }

        // Dew point & margin
        const tdp = this.calculateDewPoint(ambTemp, rh);
        const dewMargin = Number((busbarTemp - tdp).toFixed(1));

        // Feeders KCL
        const feeders = [];
        const weights = [0.105, 0.098, 0.102, 0.095, 0.108, 0.097, 0.101, 0.096, 0.103, 0.095];
        let sumCurrent = 0;

        for (let idx = 0; idx < 12; idx++) {
            const isSpare = idx >= 10;
            let fAmps = 0;
            let fTemp = ambTemp + 0.3;
            let fStatus = isSpare ? "SPARE" : "OK";

            if (this.activeScenario === "ARC_FLASH") {
                if (idx === 3) {
                    fAmps = iL1;
                    fTemp = 82.5;
                    fStatus = "ARC_FAULT";
                } else {
                    fAmps = 0;
                    fTemp = ambTemp + 0.3;
                }
            } else if (!isSpare) {
                if (idx === 9) {
                    fAmps = Number((iL1 - sumCurrent).toFixed(1));
                } else {
                    fAmps = Number((iL1 * weights[idx]).toFixed(1));
                    sumCurrent += fAmps;
                }
                const expRise = 18.0 * Math.pow(fAmps / 250.0, 2);
                const normTarget = ambTemp + expRise;

                if (this.activeScenario === "LOOSE_BOLT" && idx === 3) {
                    const faultTarget = normTarget + 20.2;
                    const prev = this.smoothFeederTemps.get(idx) || faultTarget;
                    const curr = prev + 0.25 * (faultTarget - prev);
                    this.smoothFeederTemps.set(idx, curr);
                    fTemp = Number(curr.toFixed(1));
                    fStatus = "OVERHEATING";
                } else {
                    fTemp = Number(normTarget.toFixed(1));
                }
            }

            feeders.push({
                id: `DSYA-${String(idx + 1).padStart(2, '0')}`,
                name: `Çıkış Kolu ${idx + 1} (${idx < 6 ? '250A Boy-1' : '400A Boy-2'})`,
                is_active: !isSpare,
                fuse_size: idx < 6 ? '250A' : '400A',
                current_amps: fAmps,
                surface_temp_c: fTemp,
                contact_status: fStatus
            });
        }

        const dsya4Feeder = feeders[3];
        const dsya4Pred = Number((ambTemp + 18.0 * Math.pow(dsya4Feeder.current_amps / 250.0, 2)).toFixed(1));
        const dsya4Res = Number((dsya4Feeder.surface_temp_c - dsya4Pred).toFixed(1));

        // Health index calculation
        let healthScore = 98.0;
        let hiStatus = "OPTIMAL";
        let subThermal = 98.0;
        let subPd = 96.0;
        let subDew = 95.0;
        let subElec = 99.0;

        if (this.activeScenario === "ARC_FLASH" || this.arcLatched) {
            healthScore = 0.0;
            hiStatus = "CRITICAL";
            subThermal = 0.0;
            subElec = 0.0;
        } else if (this.activeScenario === "LOOSE_BOLT") {
            subThermal = Math.max(20.0, Number((100 - dsya4Res * 3.5).toFixed(1)));
            healthScore = Number((0.35 * subThermal + 0.25 * subPd + 0.20 * subDew + 0.20 * subElec).toFixed(1));
            hiStatus = "WARNING";
        } else if (this.activeScenario === "CONDENSATION_PD") {
            subDew = Math.max(10.0, Number((dewMargin * 12.5).toFixed(1)));
            subPd = Math.max(0.0, Number((100 - (hfctPps - 20) * 1.3).toFixed(1)));
            healthScore = Number((0.35 * subThermal + 0.25 * subPd + 0.20 * subDew + 0.20 * subElec).toFixed(1));
            hiStatus = "WARNING";
        }

        // Alerts & Notification
        let activeAlert = null;
        const nowStr = new Date().toLocaleTimeString('tr-TR');
        if (this.activeScenario === "LOOSE_BOLT" && dsya4Res >= 15.0) {
            activeAlert = {
                id: "ALR-STANDALONE-BOLT",
                timestamp: nowStr,
                severity: "WARNING",
                anomaly_type: "Termal Kontak Direnci Bozulması (Gevşek Cıvata)",
                location: "DSYA-04 Çıkış Pabucu & Bara Bağlantısı",
                metrics: {
                    highlight_summary: `Yüzey: ${dsya4Feeder.surface_temp_c}°C | Model: ${dsya4Pred}°C (ΔT: +${dsya4Res}°C)`,
                    measured_temp: `${dsya4Feeder.surface_temp_c}°C`,
                    residual: `+${dsya4Res}°C`,
                    current: `${dsya4Feeder.current_amps} A`
                },
                recommended_action: "DSYA-04 klemens cıvatalarını tork anahtarı ile torklayınız ve korozyon temizliği yapınız.",
                sms_text: `[GDZ/ADM ERKEN UYARI - WARNING]\nKonum: GDZ Buca TM-1600kVA Pano #1 | DSYA-04 Çıkış Pabucu\nArıza: Termal Kontak Direnci Bozulması (Gevşek Cıvata)\nÖzet: Yüzey: ${dsya4Feeder.surface_temp_c}°C (ΔT: +${dsya4Res}°C)\nAksiyon: 45 Nm torklama ve kontak temizliği yapınız.\nZaman: ${nowStr}`,
                whatsapp_payload: {
                    title: "PANO ANOMALİ ERKEN UYARI BİLDİRİMİ (WARNING)",
                    substation: "GDZ Buca TM-1600kVA Pano #1",
                    component: "DSYA-04 Çıkış Pabucu & Bara Bağlantısı",
                    anomaly: "Termal Kontak Direnci Bozulması (Gevşek Cıvata)",
                    action: "DSYA-04 klemens cıvatalarını 45 Nm tork anahtarı ile torklayınız ve korozyon temizliği yapınız.",
                    timestamp: nowStr,
                    metrics: {
                        highlight_summary: `Yüzey: ${dsya4Feeder.surface_temp_c}°C | Model: ${dsya4Pred}°C (ΔT: +${dsya4Res}°C)`
                    }
                },
                transport_mode: "STANDALONE_SIMULATED"
            };
        } else if (this.activeScenario === "CONDENSATION_PD") {
            activeAlert = {
                id: "ALR-STANDALONE-DEW",
                timestamp: nowStr,
                severity: "CRITICAL",
                anomaly_type: "Yoğuşma & Kısmi Deşarj Atlama Riski",
                location: "1600kVA Pano İçi Mesnet İzolatörleri",
                metrics: {
                    highlight_summary: `Çiğ Noktası Marjı: ${dewMargin}°C | HFCT PD: ${hfctPps.toFixed(1)} pps`,
                    dew_margin: `${dewMargin}°C`,
                    pd_pulse_rate: `${hfctPps.toFixed(1)} pps`
                },
                recommended_action: "Pano içi nem önleyici ısıtıcıyı (anti-condensation heater) derhal devreye alınız.",
                sms_text: `[GDZ/ADM ERKEN UYARI - CRITICAL]\nKonum: GDZ Buca TM-1600kVA Pano #1\nArıza: Yoğuşma & Kısmi Deşarj Atlama Riski\nÖzet: Çiğ Marjı: ${dewMargin}°C | HFCT PD: ${hfctPps.toFixed(1)} pps\nAksiyon: Anti-kondenzasyon ısıtıcısını devreye alınız.\nZaman: ${nowStr}`,
                whatsapp_payload: {
                    title: "PANO ANOMALİ ERKEN UYARI BİLDİRİMİ (CRITICAL)",
                    substation: "GDZ Buca TM-1600kVA Pano #1",
                    component: "1600kVA Pano İçi Mesnet İzolatörleri",
                    anomaly: "Yoğuşma & Kısmi Deşarj Atlama Riski",
                    action: "Pano içi nem önleyici ısıtıcıyı (anti-condensation heater) derhal devreye alınız.",
                    timestamp: nowStr,
                    metrics: {
                        highlight_summary: `Çiğ Noktası Marjı: ${dewMargin}°C | HFCT PD: ${hfctPps.toFixed(1)} pps`
                    }
                },
                transport_mode: "STANDALONE_SIMULATED"
            };
        } else if (this.activeScenario === "ARC_FLASH" || this.arcLatched) {
            activeAlert = {
                id: "ALR-STANDALONE-ARC",
                timestamp: nowStr,
                severity: "CRITICAL",
                anomaly_type: "Hücre İçi Ark Flaş Patlaması (TVOC-2 Tetiklendi)",
                location: "DSYA Feeder 3-4 Compartment",
                metrics: {
                    highlight_summary: `Ark Akımı: ${iL1.toFixed(1)}A | Açtırma: 0.85 ms`,
                    current: `${iL1.toFixed(1)} A`,
                    clearing_time: "0.85 ms"
                },
                recommended_action: "Hücreyi açmadan önce emniyet topraklaması yapınız, TVOC-2 optik dedektör kontrolü sağlayınız.",
                sms_text: `[GDZ/ADM ERKEN UYARI - CRITICAL]\nKonum: GDZ Buca TM-1600kVA Pano #1\nArıza: Hücre İçi Ark Flaş Patlaması (TVOC-2 Tetiklendi)\nÖzet: Ark Akımı: ${iL1.toFixed(1)}A | Açtırma: 0.85 ms\nAksiyon: Emniyet topraklaması yapınız ve optik dedektör inceleyiniz.\nZaman: ${nowStr}`,
                whatsapp_payload: {
                    title: "PANO ANOMALİ ERKEN UYARI BİLDİRİMİ (CRITICAL)",
                    substation: "GDZ Buca TM-1600kVA Pano #1",
                    component: "DSYA Feeder 3-4 Compartment",
                    anomaly: "Hücre İçi Ark Flaş Patlaması (TVOC-2 Tetiklendi)",
                    action: "Hücreyi açmadan önce emniyet topraklaması yapınız, TVOC-2 optik dedektör kontrolü sağlayınız.",
                    timestamp: nowStr,
                    metrics: {
                        highlight_summary: `Ark Akımı: ${iL1.toFixed(1)}A | Açtırma: 0.85 ms`
                    }
                },
                transport_mode: "STANDALONE_SIMULATED"
            };
        }

        if (activeAlert) {
            this.latestAlert = activeAlert;
            this.alertHistory.unshift(activeAlert);
            if (this.alertHistory.length > 30) this.alertHistory.pop();
        }

        // Modbus registers
        const mprRegs = {
            "0": 2298, "2": 2301, "4": 2312,
            "6": Math.round(iL1), "8": Math.round(iL2), "10": Math.round(iL3),
            "12": 2, "14": 3995, "16": 4002, "18": 3989,
            "38": 965, "40": 971, "42": 958, "58": 5002,
            "72": 14, "78": 26, "32768": 1, "32769": 500
        };

        const tvocRegs = {
            "149": this.arcLatched ? 1 : 0,
            "1300": this.arcLatched ? 2 : 0,
            "100": this.arcLatched ? 2048 : 0,
            "101": 0,
            "102": this.arcLatched ? 7 : 0,
            "500": 14,
            "1000": 0
        };

        const aiRegs = {
            "40001": Math.round(healthScore * 10),
            "40002": Math.round(busbarTemp * 10),
            "40003": Math.round(busbarPred * 10),
            "40004": Math.round((busbarTemp - busbarPred) * 10),
            "40005": 100,
            "40006": Math.round(tdp * 10),
            "40007": Math.round(dewMargin * 10),
            "40008": Math.round(hfctPps * 10),
            "40009": Math.round(hfctPeak),
            "40010": this.activeScenario === "ARC_FLASH" ? 8 : (this.activeScenario === "CONDENSATION_PD" ? 6 : (this.activeScenario === "LOOSE_BOLT" ? 1 : 0))
        };

        return {
            timestamp: nowStr,
            scenario: this.activeScenario,
            scenario_description: this.activeScenario === "NORMAL" 
                ? "Normal çalışma döngüsü. Tüm sensörler nominal sınırlarda."
                : (this.activeScenario === "LOOSE_BOLT"
                    ? "ANOMALİ: DSYA-04 klemensinde yüksek kontak direnci! Termal aşırı ısınma tespit edildi."
                    : (this.activeScenario === "CONDENSATION_PD"
                        ? "ANOMALİ: Yüksek bağıl nem/yoğuşma riski ve şiddetli HFCT kısmi deşarj (PD) tespiti!"
                        : "KRİTİK: Hücre içi optik ark flaş patlaması! Milisaniye altı açtırma tetiklendi.")),
            active_alarm_count: activeAlert ? 1 : 0,
            fleet_summary: {
                total_panels: 100,
                normal: activeAlert ? 97 : 98,
                warning: this.activeScenario === "LOOSE_BOLT" ? 2 : 1,
                critical: (this.activeScenario === "ARC_FLASH" || this.activeScenario === "CONDENSATION_PD") ? 2 : 1,
                alarms: activeAlert ? 3 : 2
            },
            electrical: {
                voltage_l1: 229.8,
                voltage_l2: 230.1,
                voltage_l3: 231.2,
                current_l1: Number(iL1.toFixed(1)),
                current_l2: Number(iL2.toFixed(1)),
                current_l3: Number(iL3.toFixed(1)),
                neutral_current: 2.1,
                frequency: 50.02,
                power_factor: 0.97,
                thd_current: 2.6,
                di_dt: diDt
            },
            thermal: {
                ambient_temp_c: Number(ambTemp.toFixed(1)),
                main_busbar_temp_c: Number(busbarTemp.toFixed(1)),
                main_busbar_predicted_c: Number(busbarPred.toFixed(1)),
                residual_delta_t: Number((busbarTemp - busbarPred).toFixed(1)),
                contact_degradation_index: 1.0,
                thermal_status: "NORMAL",
                feeders: feeders,
                dsya4_eval: {
                    channel_id: "DSYA-04",
                    measured_temp_c: dsya4Feeder.surface_temp_c,
                    predicted_temp_c: dsya4Pred,
                    residual_delta_t: dsya4Res,
                    ambient_temp_c: Number(ambTemp.toFixed(1)),
                    current_amps: dsya4Feeder.current_amps,
                    contact_degradation_index: Math.max(1.0, Number((dsya4Res / 2.0).toFixed(1))),
                    status: dsya4Res >= 15.0 ? "WARNING" : "NORMAL",
                    anomaly_detected: dsya4Res >= 15.0,
                    description: dsya4Res >= 15.0 ? "Erken Uyarı! Klemens gevşekliği şüphesi." : "İletken termal durumu nominal."
                }
            },
            environmental_pd: {
                ambient_temp_c: Number(ambTemp.toFixed(1)),
                relative_humidity_pct: Number(rh.toFixed(1)),
                surface_temp_c: Number(busbarTemp.toFixed(1)),
                dew_point_c: tdp,
                dew_margin_c: dewMargin,
                condensation_risk: dewMargin <= 3.0 ? "HIGH_RISK" : "SAFE",
                hfct_pd_pps: Number(hfctPps.toFixed(1)),
                hfct_peak_pc: Number(hfctPeak.toFixed(1)),
                pd_state: hfctPps >= 40.0 ? "CRITICAL" : "NORMAL",
                status: this.activeScenario === "CONDENSATION_PD" ? "CRITICAL_FLASHOVER_RISK" : "NORMAL",
                anomaly_detected: this.activeScenario === "CONDENSATION_PD",
                description: this.activeScenario === "CONDENSATION_PD" 
                    ? `IMMINENT SURFACE FLASHOVER RISK! Dew margin is ${dewMargin}°C, HFCT: ${hfctPps.toFixed(1)} pps.` 
                    : `Insulation stable. Dew margin: ${dewMargin}°C.`
            },
            optical_arc: {
                arc_detected: this.arcLatched,
                trip_executed: this.arcLatched,
                latched: this.arcLatched,
                dual_criteria_satisfied: this.arcLatched,
                system_state: this.arcSystemState,
                hardware_clearing_time_ms: 0.85,
                trip_detail: this.arcLatched ? {
                    trip_id: 1,
                    timestamp: nowStr,
                    sensor_id: "X2:2",
                    zone: "DSYA Feeder 3-4 Compartment",
                    current_amps: 3450.0,
                    di_dt: 1850.0,
                    clearing_time_ms: 0.85,
                    relays_tripped: ["K4_MAIN_BREAKER", "K5_SCADA_ALARM"],
                    status: "CIRCUIT_BREAKER_LOCKED_OUT"
                } : null,
                description: this.arcLatched ? "CRITICAL: TVOC-2 optical arc trip executed (<1 ms)!" : "Optical arc monitors active."
            },
            health_index: {
                health_index: healthScore,
                status_label: hiStatus,
                color_code: healthScore >= 85 ? "#00e5ff" : (healthScore >= 50 ? "#f59e0b" : "#ee6670"),
                sub_scores: {
                    thermal_contact: subThermal,
                    insulation_pd: subPd,
                    environmental_dew: subDew,
                    electrical_quality: subElec
                }
            },
            active_alert: activeAlert,
            mpr53cs_registers: mprRegs,
            tvoc2_registers: tvocRegs,
            ai_registers: aiRegs
        };
    }
}

const _rootContext = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this);
_rootContext.clientSimulatorEngine = new ClientSimulatorEngine();
