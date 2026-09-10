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

        this.initCanvasResolution();
        window.addEventListener("resize", () => this.initCanvasResolution());
    }

    initCanvasResolution() {
        if (!this.canvas) return;
        const rect = this.canvas.getBoundingClientRect();
        this.dpr = window.devicePixelRatio || 1;
        this.canvas.width = rect.width * this.dpr;
        this.canvas.height = rect.height * this.dpr;
        if (this.ctx) {
            // Reset transform matrix before re-applying DPR scale to prevent cumulative scaling bug
            if (this.ctx.resetTransform) {
                this.ctx.resetTransform();
            } else {
                this.ctx.setTransform(1, 0, 0, 1, 0, 0);
            }
            this.ctx.scale(this.dpr, this.dpr);
        }
    }

    pushData(point) {
        this.dataHistory.push(point);
        if (this.dataHistory.length > this.maxPoints) {
            this.dataHistory.shift();
        }
        this.render();
    }

    render() {
        if (!this.ctx || !this.canvas) return;
        const width = this.canvas.getBoundingClientRect().width;
        const height = this.canvas.getBoundingClientRect().height;

        this.ctx.clearRect(0, 0, width, height);

        // Draw background grid lines
        this.ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
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
            this.ctx.strokeStyle = "#94a3b8";
            this.ctx.lineWidth = 1.5;
            this.ctx.beginPath();
            this.dataHistory.forEach((pt, idx) => {
                const x = getX(idx);
                const y = getY(pt.temp_model || 32);
                if (idx === 0) this.ctx.moveTo(x, y);
                else this.ctx.lineTo(x, y);
            });
            this.ctx.stroke();
            this.ctx.setLineDash([]);

            // 2. Draw Measured Busbar / Feeder Temp (Solid Red)
            this.ctx.strokeStyle = "#f43f5e";
            this.ctx.lineWidth = 2.5;
            this.ctx.beginPath();
            this.dataHistory.forEach((pt, idx) => {
                const x = getX(idx);
                const val = pt.temp_dsya4 > 60 ? pt.temp_dsya4 : (pt.temp_busbar || 35);
                const y = getY(val);
                if (idx === 0) this.ctx.moveTo(x, y);
                else this.ctx.lineTo(x, y);
            });
            this.ctx.stroke();

            // 3. Draw Scaled Current (Blue line)
            // Current scale 0 to 600A mapped to 15 to 100 on graph
            this.ctx.strokeStyle = "rgba(56, 189, 248, 0.7)";
            this.ctx.lineWidth = 1.5;
            this.ctx.beginPath();
            this.dataHistory.forEach((pt, idx) => {
                const x = getX(idx);
                const cur = pt.i_l1 || 300;
                // map 0-600A to minT-maxT
                const mappedVal = minT + (cur / 600.0) * (maxT - minT);
                const y = getY(mappedVal);
                if (idx === 0) this.ctx.moveTo(x, y);
                else this.ctx.lineTo(x, y);
            });
            this.ctx.stroke();

            // Axis labels
            this.ctx.fillStyle = "#64748b";
            this.ctx.font = "9px 'JetBrains Mono'";
            this.ctx.fillText("90°C", 5, getY(90) + 3);
            this.ctx.fillText("50°C", 5, getY(50) + 3);
            this.ctx.fillText("25°C", 5, getY(25) + 3);

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
            this.ctx.strokeStyle = "rgba(239, 68, 68, 0.6)";
            this.ctx.lineWidth = 1;
            const critY = getYMargin(3.0);
            this.ctx.beginPath();
            this.ctx.moveTo(paddingLeft, critY);
            this.ctx.lineTo(width - 10, critY);
            this.ctx.stroke();
            this.ctx.setLineDash([]);
            this.ctx.fillStyle = "#ef4444";
            this.ctx.font = "8px 'Inter'";
            this.ctx.fillText("3°C Yoğuşma Eşiği", width - 90, critY - 3);

            // 1. Draw Dew Margin (Emerald Green)
            this.ctx.strokeStyle = "#10b981";
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.dataHistory.forEach((pt, idx) => {
                const x = getX(idx);
                const y = getYMargin(pt.dew_margin || 18);
                if (idx === 0) this.ctx.moveTo(x, y);
                else this.ctx.lineTo(x, y);
            });
            this.ctx.stroke();

            // 2. Draw HFCT PD pps (Amber / Yellow)
            this.ctx.strokeStyle = "#f59e0b";
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.dataHistory.forEach((pt, idx) => {
                const x = getX(idx);
                const y = getYPD(pt.hfct_pd || 5);
                if (idx === 0) this.ctx.moveTo(x, y);
                else this.ctx.lineTo(x, y);
            });
            this.ctx.stroke();

            // Axis labels
            this.ctx.fillStyle = "#64748b";
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
