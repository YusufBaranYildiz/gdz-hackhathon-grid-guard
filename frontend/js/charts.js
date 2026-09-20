/**
 * Lightweight On-Premise Canvas Chart Renderer.
 * Zero external library dependencies - 100% offline & SCADA compliant.
 */

class ScadaChart {
    constructor(canvasId, options = {}) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas ? this.canvas.getContext("2d") : null;
        this.options = options;
        this.dataHistory = [];
        this.maxPoints = 40;
        this.renderFrame = null;
        this.displayWidth = 0;
        this.displayHeight = 0;

        this.initCanvasResolution();
        window.addEventListener("resize", () => this.initCanvasResolution());
    }

    initCanvasResolution() {
        if (!this.canvas) return;
        const rect = this.canvas.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;
        const dpr = window.devicePixelRatio || 1;
        const pixelWidth = Math.max(1, Math.round(width * dpr));
        const pixelHeight = Math.max(1, Math.round(height * dpr));
        const dimensionsChanged = width !== this.displayWidth
            || height !== this.displayHeight
            || dpr !== this.dpr
            || pixelWidth !== this.canvas.width
            || pixelHeight !== this.canvas.height;

        this.displayWidth = width;
        this.displayHeight = height;
        this.dpr = dpr;

        if (!dimensionsChanged) return;

        this.canvas.width = pixelWidth;
        this.canvas.height = pixelHeight;
        if (this.ctx) {
            // Reset transform matrix before re-applying DPR scale to prevent cumulative scaling bug
            if (this.ctx.resetTransform) {
                this.ctx.resetTransform();
            } else {
                this.ctx.setTransform(1, 0, 0, 1, 0, 0);
            }
            this.ctx.scale(this.dpr, this.dpr);
        }
        this.scheduleRender();
    }

    scheduleRender() {
        if (this.renderFrame !== null) return;
        const requestFrame = window.requestAnimationFrame || ((callback) => setTimeout(callback, 0));
        this.renderFrame = requestFrame(() => {
            this.renderFrame = null;
            this.render();
        });
    }

    pushData(point) {
        if (!point) return;
        this.dataHistory.push(point);
        if (this.dataHistory.length > this.maxPoints) {
            this.dataHistory.shift();
        }
        this.scheduleRender();
    }

    setHistory(points) {
        if (!Array.isArray(points)) return;
        this.dataHistory = [...points, ...this.dataHistory].slice(-this.maxPoints);
        this.scheduleRender();
    }

    render() {
        if (!this.ctx || !this.canvas) return;
        const width = this.displayWidth;
        const height = this.displayHeight;
        if (width <= 0 || height <= 0) return;

        this.ctx.clearRect(0, 0, width, height);

        const isLight = document.body.classList.contains("theme-light");
        const isSanzo = document.body.classList.contains("theme-sanzo-wada");

        // Dynamic theme colors
        const gridColor = isLight ? "rgba(15, 23, 42, 0.08)" : (isSanzo ? "rgba(247, 244, 235, 0.08)" : "rgba(255, 255, 255, 0.05)");
        const axisColor = isLight ? "#475569" : (isSanzo ? "#a4b89d" : "#64748b");
        const modelLineColor = isSanzo ? "#a4b89d" : (isLight ? "#64748b" : "#94a3b8");
        const measuredLineColor = isSanzo ? "#cf4336" : (isLight ? "#e11d48" : "#ee6670");
        const currentLineColor = isSanzo ? "#4eba7e" : (isLight ? "#0284c7" : "rgba(38, 198, 218, 0.78)");
        const dewLineColor = isSanzo ? "#4eba7e" : (isLight ? "#0284c7" : "#26c6da");
        const pdLineColor = isSanzo ? "#e6823b" : (isLight ? "#d97706" : "#e8aa52");

        // Draw background grid lines
        this.ctx.strokeStyle = gridColor;
        this.ctx.lineWidth = 1;
        for (let y = 20; y < height; y += 30) {
            this.ctx.beginPath();
            this.ctx.moveTo(35, y);
            this.ctx.lineTo(width - 10, y);
            this.ctx.stroke();
        }

        if (this.dataHistory.length < 2) return;

        const paddingLeft = 35;
        const paddingRight = 10;
        const paddingTop = 15;
        const paddingBottom = 20;
        const plotWidth = width - paddingLeft - paddingRight;
        const plotHeight = height - paddingTop - paddingBottom;

        if (this.options.type === "thermal") {
            // Plot: current (scaled), measured_temp, model_temp
            // Temp scale: 15°C to 100°C
            const minT = 15.0;
            const maxT = 100.0;

            const getX = (idx) => paddingLeft + (idx / (this.dataHistory.length - 1)) * plotWidth;
            const getY = (val) => paddingTop + plotHeight - ((val - minT) / (maxT - minT)) * plotHeight;

            // 1. Draw Model Temp (Dashed slate)
            this.ctx.setLineDash([4, 4]);
            this.ctx.strokeStyle = modelLineColor;
            this.ctx.lineWidth = 1.5;
            this.ctx.beginPath();
            this.dataHistory.forEach((pt, idx) => {
                const x = getX(idx);
                const val = Number.isFinite(pt.temp_predicted)
                    ? pt.temp_predicted
                    : (Number.isFinite(pt.temp_model) ? pt.temp_model : 32);
                const y = getY(val);
                if (idx === 0) this.ctx.moveTo(x, y);
                else this.ctx.lineTo(x, y);
            });
            this.ctx.stroke();
            this.ctx.setLineDash([]);

            // 2. Draw Measured Busbar / Feeder Temp (Solid Red)
            this.ctx.strokeStyle = measuredLineColor;
            this.ctx.lineWidth = 2.5;
            this.ctx.beginPath();
            this.dataHistory.forEach((pt, idx) => {
                const x = getX(idx);
                const val = Number.isFinite(pt.temp_measured)
                    ? pt.temp_measured
                    : (Number.isFinite(pt.temp_dsya4) && (pt.temp_dsya4 > 40 || pt.scenario === "LOOSE_BOLT" || pt.scenario === "ARC_FLASH")
                        ? pt.temp_dsya4
                        : (Number.isFinite(pt.temp_busbar) ? pt.temp_busbar : 35));
                const y = getY(val);
                if (idx === 0) this.ctx.moveTo(x, y);
                else this.ctx.lineTo(x, y);
            });
            this.ctx.stroke();

            // 3. Draw Scaled Current (Blue line)
            // Smart dynamic current scale: if fault current surge (e.g. Arc Flash > 800A), scale up to 4000A so it doesn't clip; otherwise 600A for crisp nominal view
            const maxCurObserved = this.dataHistory.reduce((max, p) => Math.max(max, Number.isFinite(p.i_l1) ? p.i_l1 : 0), 0);
            const currentScaleMax = maxCurObserved > 800 ? 4000.0 : 600.0;

            this.ctx.strokeStyle = currentLineColor;
            this.ctx.lineWidth = 1.5;
            this.ctx.beginPath();
            this.dataHistory.forEach((pt, idx) => {
                const x = getX(idx);
                const cur = Number.isFinite(pt.i_l1) ? pt.i_l1 : 300;
                const curVal = Math.max(0, Math.min(cur, currentScaleMax));
                const mappedVal = minT + (curVal / currentScaleMax) * (maxT - minT);
                const rawY = getY(mappedVal);
                const y = Math.max(paddingTop, Math.min(paddingTop + plotHeight, rawY));
                if (idx === 0) this.ctx.moveTo(x, y);
                else this.ctx.lineTo(x, y);
            });
            this.ctx.stroke();

            // 4. Draw Leading Point Indicators (Live Telemetry Pulse)
            if (this.dataHistory.length > 0) {
                const lastIdx = this.dataHistory.length - 1;
                const lastX = getX(lastIdx);
                const lastPt = this.dataHistory[lastIdx];

                // Blue dot: Current
                const lastCur = Number.isFinite(lastPt.i_l1) ? lastPt.i_l1 : 300;
                const curVal = Math.max(0, Math.min(lastCur, currentScaleMax));
                const mappedVal = minT + (curVal / currentScaleMax) * (maxT - minT);
                const curY = Math.max(paddingTop, Math.min(paddingTop + plotHeight, getY(mappedVal)));
                this.ctx.fillStyle = currentLineColor;
                this.ctx.beginPath();
                this.ctx.arc(lastX, curY, 3.5, 0, Math.PI * 2);
                this.ctx.fill();

                // Red dot: Measured Temp
                const measVal = Number.isFinite(lastPt.temp_measured)
                    ? lastPt.temp_measured
                    : (Number.isFinite(lastPt.temp_dsya4) ? lastPt.temp_dsya4 : 35);
                const measY = getY(measVal);
                this.ctx.fillStyle = measuredLineColor;
                this.ctx.beginPath();
                this.ctx.arc(lastX, measY, 3.5, 0, Math.PI * 2);
                this.ctx.fill();
            }

            // Axis labels (Left: Temperature °C, Right: Current scale)
            this.ctx.fillStyle = axisColor;
            this.ctx.font = "9px 'JetBrains Mono'";
            this.ctx.textAlign = "left";
            this.ctx.fillText("90°C", 5, getY(90) + 3);
            this.ctx.fillText("50°C", 5, getY(50) + 3);
            this.ctx.fillText("25°C", 5, getY(25) + 3);

            this.ctx.textAlign = "right";
            this.ctx.fillText(currentScaleMax > 1000 ? "4kA" : "600A", width - 8, getY(90) + 3);
            this.ctx.fillText(currentScaleMax > 1000 ? "2kA" : "300A", width - 8, getY(57.5) + 3);
            this.ctx.fillText("0A", width - 8, getY(15) - 2);
            this.ctx.textAlign = "left";

        } else if (this.options.type === "dew_pd") {
            // Plot: Dew Margin (0 to 30°C) and HFCT PD (0 to 120 pps)
            const minM = 0.0;
            const maxM = 30.0;
            const maxPD = 120.0;

            const getX = (idx) => paddingLeft + (idx / (this.dataHistory.length - 1)) * plotWidth;
            const getYMargin = (val) => paddingTop + plotHeight - (Math.max(0, val - minM) / (maxM - minM)) * plotHeight;
            const getYPD = (val) => paddingTop + plotHeight - (Math.min(maxPD, val) / maxPD) * plotHeight;

            // Critical 3°C Condensation Threshold line (Dashed red)
            this.ctx.setLineDash([3, 3]);
            this.ctx.strokeStyle = "rgba(238, 102, 112, 0.6)";
            this.ctx.lineWidth = 1;
            const critY = getYMargin(3.0);
            this.ctx.beginPath();
            this.ctx.moveTo(paddingLeft, critY);
            this.ctx.lineTo(width - 10, critY);
            this.ctx.stroke();
            this.ctx.setLineDash([]);
            this.ctx.fillStyle = "#ee6670";
            this.ctx.font = "8px 'Inter'";
            this.ctx.fillText("3°C Yoğuşma Eşiği", width - 90, critY - 3);

            // 1. Draw Dew Margin (Emerald Green)
            this.ctx.strokeStyle = dewLineColor;
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.dataHistory.forEach((pt, idx) => {
                const x = getX(idx);
                const y = getYMargin(Number.isFinite(pt.dew_margin) ? pt.dew_margin : 18);
                if (idx === 0) this.ctx.moveTo(x, y);
                else this.ctx.lineTo(x, y);
            });
            this.ctx.stroke();

            // 2. Draw HFCT PD pps (Amber / Yellow)
            this.ctx.strokeStyle = pdLineColor;
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.dataHistory.forEach((pt, idx) => {
                const x = getX(idx);
                const y = getYPD(Number.isFinite(pt.hfct_pd) ? pt.hfct_pd : 5);
                if (idx === 0) this.ctx.moveTo(x, y);
                else this.ctx.lineTo(x, y);
            });
            this.ctx.stroke();

            // 3. Draw Leading Point Indicators (Live Telemetry Pulse)
            if (this.dataHistory.length > 0) {
                const lastIdx = this.dataHistory.length - 1;
                const lastX = getX(lastIdx);
                const lastPt = this.dataHistory[lastIdx];

                // Green dot: Dew margin
                const dewVal = Number.isFinite(lastPt.dew_margin) ? lastPt.dew_margin : 18;
                const dewY = getYMargin(dewVal);
                this.ctx.fillStyle = dewLineColor;
                this.ctx.beginPath();
                this.ctx.arc(lastX, dewY, 3.5, 0, Math.PI * 2);
                this.ctx.fill();

                // Amber dot: HFCT PD
                const pdVal = Number.isFinite(lastPt.hfct_pd) ? lastPt.hfct_pd : 5;
                const pdY = getYPD(pdVal);
                this.ctx.fillStyle = pdLineColor;
                this.ctx.beginPath();
                this.ctx.arc(lastX, pdY, 3.5, 0, Math.PI * 2);
                this.ctx.fill();
            }

            // Axis labels
            this.ctx.fillStyle = axisColor;
            this.ctx.font = "9px 'JetBrains Mono'";
            this.ctx.fillText("25°C", 5, getYMargin(25) + 3);
            this.ctx.fillText("10°C", 5, getYMargin(10) + 3);
            this.ctx.fillText("0°C", 5, getYMargin(0) + 3);
        }
    }
}

// Instantiate Charts
document.addEventListener("DOMContentLoaded", () => {
    window.chartThermal = new ScadaChart("chartThermal", { type: "thermal" });
    window.chartDewPD = new ScadaChart("chartDewPD", { type: "dew_pd" });
});
