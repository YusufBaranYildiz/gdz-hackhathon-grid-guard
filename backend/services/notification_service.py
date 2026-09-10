"""
Automated SMS & WhatsApp Emergency Notification Service for Field Operations.
Formulates structured, actionable alerts and dispatches them to operation teams.
"""

from typing import Dict, Any, List, Optional
import time
import uuid

class NotificationService:
    def __init__(self):
        self.notification_history: List[Dict[str, Any]] = []
        self.subscribers = [
            {"name": "Ege Bölge SCADA Nöbetçi Mühendisi", "phone": "+90 532 000 1122", "channel": "WHATSAPP"},
            {"name": "Saha Arıza Onarım Bakım Şefi (İzmir-Buca)", "phone": "+90 533 000 3344", "channel": "SMS"},
            {"name": "Şebeke Operasyon Merkezi (ADM/GDZ)", "phone": "+90 530 000 5566", "channel": "WHATSAPP"}
        ]
        self.last_sent_timestamp: float = 0.0
        self.cooldown_seconds: float = 60.0  # 60s cooldown for repeat alerts
        self.last_dispatched_signature: Optional[str] = None

    def reset_state(self):
        """Resets cooldown when scenario returns to normal."""
        self.last_dispatched_signature = None
        self.last_sent_timestamp = 0.0

    def dispatch_alert(
        self,
        severity: str,
        anomaly_type: str,
        component_location: str,
        metrics: Dict[str, Any],
        recommended_action: str,
        substation_name: str = "GDZ Buca TM-1600kVA Pano #1"
    ) -> Optional[Dict[str, Any]]:
        """
        Builds and logs a structured WhatsApp / SMS operational alert.
        Ensures alerts are sent only once per incident (deduplicated).
        """
        now = time.time()
        signature = f"{severity}:{anomaly_type}:{component_location}"

        # If identical anomaly was already alerted and cooldown hasn't expired, suppress duplicate
        if signature == self.last_dispatched_signature and (now - self.last_sent_timestamp < self.cooldown_seconds):
            return None

        self.last_dispatched_signature = signature
        self.last_sent_timestamp = now
        alert_id = f"ALR-{uuid.uuid4().hex[:6].upper()}"
        formatted_time = time.strftime("%H:%M:%S")
        formatted_date = time.strftime("%d.%m.%Y")

        sms_body = (
            f"⚠️ [GDZ/ADM ERKEN UYARI - {severity}]\n"
            f"📍 {substation_name} | {component_location}\n"
            f"⚡ Arıza: {anomaly_type}\n"
            f"📊 {metrics.get('highlight_summary', '')}\n"
            f"🔧 Aksiyon: {recommended_action}\n"
            f"🕒 {formatted_time}"
        )

        whatsapp_message = {
            "title": f"🚨 PANO ANOMALİ ERKEN UYARI BİLDİRİMİ ({severity})",
            "header_color": "#ef4444" if severity == "CRITICAL" else "#f59e0b",
            "substation": substation_name,
            "component": component_location,
            "anomaly": anomaly_type,
            "metrics": metrics,
            "action": recommended_action,
            "timestamp": f"{formatted_date} {formatted_time}",
            "recipients": [s["name"] for s in self.subscribers]
        }

        record = {
            "id": alert_id,
            "timestamp": f"{formatted_date} {formatted_time}",
            "epoch": now,
            "severity": severity,
            "anomaly_type": anomaly_type,
            "location": component_location,
            "sms_text": sms_body,
            "whatsapp_payload": whatsapp_message,
            "delivered": True
        }

        self.notification_history.insert(0, record)
        # Keep last 50 alerts
        if len(self.notification_history) > 50:
            self.notification_history.pop()

        return record

    def get_latest_alerts(self, limit: int = 10) -> List[Dict[str, Any]]:
        return self.notification_history[:limit]
