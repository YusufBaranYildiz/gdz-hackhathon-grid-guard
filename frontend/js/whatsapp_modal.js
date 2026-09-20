/**
 * Virtual Smartphone Notification Simulator & GSM Modem SMS Dispatcher.
 * Supports dual-channel preview: WhatsApp Business API and Cellular GSM SMS (AT+CMGS).
 * Strictly zero emojis, muted by default, and never opens without user click.
 */

class WhatsAppModal {
    constructor() {
        this.modal = document.getElementById("phoneModal");
        this.btnOpen = document.getElementById("btnOpenPhone");
        this.btnClose = document.getElementById("btnClosePhone");
        this.messagesContainer = document.getElementById("waMessagesContainer");
        this.smsContainer = document.getElementById("smsMessagesContainer");
        this.smsFeed = document.getElementById("smsFeed");
        this.waFooter = document.getElementById("waChatFooter");
        this.tabWhatsapp = document.getElementById("tabChannelWhatsapp");
        this.tabSms = document.getElementById("tabChannelSms");
        this.unreadBadge = document.getElementById("unreadAlertCount");
        this.unreadCount = 0;
        this.maxMessages = 100;
        this.messageBubbles = [];
        this.smsCards = [];
        this.audioCtx = null;
        this.soundEnabled = false; // Muted by default so it never annoys the user
        this.activeChannel = "whatsapp";

        this.initEvents();
        this.updateBadge();

        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get("openWa") === "1" || urlParams.get("openWa") === "true") {
            setTimeout(() => this.openModal(), 200);
        }
        if (urlParams.get("channel") === "sms") {
            this.switchChannel("sms");
        }
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

        if (this.tabWhatsapp) {
            this.tabWhatsapp.addEventListener("click", () => this.switchChannel("whatsapp"));
        }

        if (this.tabSms) {
            this.tabSms.addEventListener("click", () => this.switchChannel("sms"));
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

    switchChannel(channel) {
        this.activeChannel = channel;
        if (channel === "whatsapp") {
            this.tabWhatsapp?.classList.add("active");
            this.tabSms?.classList.remove("active");
            if (this.messagesContainer) this.messagesContainer.style.display = "flex";
            if (this.smsContainer) this.smsContainer.style.display = "none";
            if (this.waFooter) this.waFooter.style.display = "flex";
            if (this.messagesContainer) {
                this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
            }
        } else {
            this.tabSms?.classList.add("active");
            this.tabWhatsapp?.classList.remove("active");
            if (this.messagesContainer) this.messagesContainer.style.display = "none";
            if (this.smsContainer) this.smsContainer.style.display = "flex";
            if (this.waFooter) this.waFooter.style.display = "none";
            if (this.smsContainer) {
                this.smsContainer.scrollTop = this.smsContainer.scrollHeight;
            }
        }
    }

    openModal() {
        if (this.modal) {
            this.modal.classList.add("active");
            this.unreadCount = 0;
            this.updateBadge();
            setTimeout(() => {
                if (this.activeChannel === "whatsapp" && this.messagesContainer) {
                    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
                } else if (this.activeChannel === "sms" && this.smsContainer) {
                    this.smsContainer.scrollTop = this.smsContainer.scrollHeight;
                }
            }, 100);
        }
    }

    closeModal() {
        if (this.modal) {
            this.modal.classList.remove("active");
        }
    }

    resetCount() {
        this.unreadCount = 0;
        this.updateBadge();
    }

    toggleSound() {
        this.soundEnabled = !this.soundEnabled;
        return this.soundEnabled;
    }

    updateBadge() {
        if (this.unreadBadge) {
            this.unreadBadge.textContent = this.unreadCount;
            if (this.unreadCount > 0) {
                this.unreadBadge.style.display = "inline-block";
                this.unreadBadge.classList.add("active-alert");
            } else {
                this.unreadBadge.style.display = "none";
                this.unreadBadge.classList.remove("active-alert");
            }
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
        if (!alertData) return;

        const isCritical = alertData.severity === "CRITICAL";
        const timeStr = alertData.timestamp ? alertData.timestamp.split(" ")[1] : "Simdi";

        const text = (value, fallback) => value === undefined || value === null ? fallback : String(value);
        const addText = (parent, tag, value, className) => {
            const node = document.createElement(tag);
            if (className) node.className = className;
            node.textContent = value;
            parent.appendChild(node);
            return node;
        };

        // 1. Build WhatsApp Bubble
        if (this.messagesContainer) {
            const bubble = document.createElement("div");
            bubble.className = `wa-bubble ${isCritical ? 'critical' : 'warning'}`;

            const payload = alertData.whatsapp_payload || {};
            const metrics = alertData.metrics || payload.metrics || {};

            const header = document.createElement("div");
            header.className = `wa-bubble-header ${isCritical ? "critical" : "warning"}`;
            addText(header, "span", text(payload.title, "PANO ANOMALI ERKEN UYARI"));

            const body = document.createElement("div");
            body.className = "wa-bubble-body";
            const addLine = (label, value) => {
                const paragraph = document.createElement("p");
                const strong = document.createElement("strong");
                strong.textContent = label;
                paragraph.appendChild(strong);
                paragraph.appendChild(document.createTextNode(` ${value}`));
                body.appendChild(paragraph);
            };
            addLine("Trafo:", text(payload.substation, "Buca TM 1600 kVA AG Pano"));
            addLine("Hücre / Kol:", text(payload.component || alertData.location, "Bilinmiyor"));
            addLine("Anomali:", text(alertData.anomaly_type, "Tanimsiz alarm"));
            addLine("Ölçümler:", text(metrics.highlight_summary, "Esik asimi tespit edildi."));

            const actionBox = document.createElement("div");
            actionBox.className = "wa-action-box";
            addText(actionBox, "strong", "ÖNERILEN SAHA AKSIYONU:");
            addText(actionBox, "span", text(payload.action || alertData.recommended_action, "Hücre klemens baglantisini kontrol ediniz."));
            body.appendChild(actionBox);

            const meta = document.createElement("div");
            meta.className = "wa-msg-meta";
            addText(meta, "span", timeStr);
            addText(meta, "span", "✓✓", "ticks");

            bubble.append(header, body, meta);
            this.messagesContainer.appendChild(bubble);
            this.messageBubbles.push(bubble);
            while (this.messageBubbles.length > this.maxMessages) {
                const oldestBubble = this.messageBubbles.shift();
                oldestBubble?.remove();
            }
        }

        // 2. Build Raw Cellular GSM SMS Card
        if (this.smsFeed) {
            const smsCard = document.createElement("div");
            smsCard.className = `sms-bubble ${isCritical ? 'critical' : 'warning'}`;

            const smsMeta = document.createElement("div");
            smsMeta.className = "sms-bubble-meta";
            smsMeta.innerHTML = `<span class="sms-sender">ADM-GDZ-ALARM</span><span class="sms-time">${timeStr}</span><span class="sms-delivery">GSM ILETILDI</span>`;

            const smsPre = document.createElement("pre");
            smsPre.className = "sms-text-content";
            const rawSms = alertData.sms_text || (
                `[GDZ/ADM ERKEN UYARI - ${alertData.severity || 'WARNING'}]\n` +
                `Konum: ${alertData.location || 'GDZ Buca TM'}\n` +
                `Ariza: ${alertData.anomaly_type || 'Bilinmeyen'}\n` +
                `Özet: ${(alertData.metrics && alertData.metrics.highlight_summary) || ''}\n` +
                `Aksiyon: ${alertData.recommended_action || ''}\n` +
                `Zaman: ${timeStr}`
            );
            smsPre.textContent = rawSms;

            smsCard.append(smsMeta, smsPre);
            this.smsFeed.appendChild(smsCard);
            this.smsCards.push(smsCard);
            while (this.smsCards.length > this.maxMessages) {
                const oldest = this.smsCards.shift();
                oldest?.remove();
            }
        }

        const modalIsOpen = this.modal?.classList.contains("active");
        if (modalIsOpen) {
            if (this.activeChannel === "whatsapp" && this.messagesContainer) {
                this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
            } else if (this.activeChannel === "sms" && this.smsContainer) {
                this.smsContainer.scrollTop = this.smsContainer.scrollHeight;
            }
        }

        // If modal is not open, increment unread count badge
        if (!modalIsOpen) {
            this.unreadCount++;
            this.updateBadge();
        }

        // Play chime only if user enabled sound
        this.playAlertChime();
    }
}

// Instantiate
document.addEventListener("DOMContentLoaded", () => {
    window.whatsappModal = new WhatsAppModal();
});
