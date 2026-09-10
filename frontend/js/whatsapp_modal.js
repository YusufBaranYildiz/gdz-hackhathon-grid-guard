/**
 * Virtual Smartphone WhatsApp Simulator Modal & Audio Dispatcher.
 * Muted by default and NEVER auto-opens without user action.
 */

class WhatsAppModal {
    constructor() {
        this.modal = document.getElementById("phoneModal");
        this.btnOpen = document.getElementById("btnOpenPhone");
        this.btnClose = document.getElementById("btnClosePhone");
        this.messagesContainer = document.getElementById("waMessagesContainer");
        this.unreadBadge = document.getElementById("unreadAlertCount");
        this.unreadCount = 0;
        this.audioCtx = null;
        this.soundEnabled = false; // Muted by default so it never annoys the user

        this.initEvents();
    }

    initEvents() {
        if (this.btnOpen) {
            this.btnOpen.addEventListener("click", () => {
                this.openModal();
            });
        }

        if (this.btnClose) {
            this.btnClose.addEventListener("click", () => {
                this.closeModal();
            });
        }

        // Close on overlay backdrop click
        if (this.modal) {
            this.modal.addEventListener("click", (e) => {
                if (e.target === this.modal) {
                    this.closeModal();
                }
            });
        }

        // Add ESC key listener to close modal
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && this.modal && this.modal.classList.contains("active")) {
                this.closeModal();
            }
        });
    }

    openModal() {
        if (this.modal) {
            this.modal.classList.add("active");
            this.unreadCount = 0;
            this.updateBadge();
            setTimeout(() => {
                if (this.messagesContainer) {
                    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
                }
            }, 100);
        }
    }

    closeModal() {
        if (this.modal) {
            this.modal.classList.remove("active");
        }
    }

    toggleSound() {
        this.soundEnabled = !this.soundEnabled;
        return this.soundEnabled;
    }

    updateBadge() {
        if (this.unreadBadge) {
            this.unreadBadge.textContent = this.unreadCount;
            this.unreadBadge.style.display = this.unreadCount > 0 ? "inline-block" : "none";
        }
    }

    playAlertChime() {
        // Only play if sound was explicitly enabled by user
        if (!this.soundEnabled) return;

        try {
            if (!this.audioCtx) {
                this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (this.audioCtx.state === "suspended") {
                this.audioCtx.resume();
            }

            const now = this.audioCtx.currentTime;
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();

            osc.type = "sine";
            osc.frequency.setValueAtTime(880, now);
            osc.frequency.exponentialRampToValueAtTime(1320, now + 0.15);

            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

            osc.connect(gain);
            gain.connect(this.audioCtx.destination);

            osc.start(now);
            osc.stop(now + 0.3);
        } catch (e) {
            // Browser audio policy
        }
    }

    pushAlert(alertData) {
        if (!alertData || !this.messagesContainer) return;

        const isCritical = alertData.severity === "CRITICAL";
        const timeStr = alertData.timestamp ? alertData.timestamp.split(" ")[1] : "Şimdi";

        const bubble = document.createElement("div");
        bubble.className = `wa-bubble ${isCritical ? 'critical' : 'warning'}`;

        const payload = alertData.whatsapp_payload || {};
        const metrics = alertData.metrics || {};

        bubble.innerHTML = `
            <div class="wa-bubble-header ${isCritical ? 'critical' : 'warning'}">
                <span>${payload.title || '🚨 PANO ANOMALİ ERKEN UYARI'}</span>
            </div>
            <div class="wa-bubble-body">
                <p><strong>📍 Trafo:</strong> ${payload.substation || 'Buca TM 1600 kVA AG Pano'}</p>
                <p><strong>⚡ Hücre / Kol:</strong> ${payload.component || alertData.location}</p>
                <p><strong>⚠️ Anomali:</strong> ${alertData.anomaly_type}</p>
                <p><strong>📊 Ölçümler:</strong> ${metrics.highlight_summary || 'Eşik aşımı tespit edildi.'}</p>
                <div class="wa-action-box">
                    <strong>🔧 ÖNERİLEN SAHA AKSİYONU:</strong>
                    <span>${payload.action || 'Hücre klemens bağlantısını tork anahtarıyla kontrol ediniz.'}</span>
                </div>
            </div>
            <div class="wa-msg-meta">
                <span>${timeStr}</span>
                <span class="ticks">✓✓</span>
            </div>
        `;

        this.messagesContainer.appendChild(bubble);
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;

        // If modal is not open, increment unread count badge
        if (!this.modal.classList.contains("active")) {
            this.unreadCount++;
            this.updateBadge();
        }

        // Play chime only if user enabled sound
        this.playAlertChime();

        // NOTE: Modal will NEVER open automatically to avoid disrupting user!
        // User can click 'Saha WhatsApp Alarmı' whenever they wish to view it.
    }
}

// Instantiate
document.addEventListener("DOMContentLoaded", () => {
    window.whatsappModal = new WhatsAppModal();
});
