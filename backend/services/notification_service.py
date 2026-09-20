"""Local, simulation-friendly alarm recording service."""

from __future__ import annotations

import json
import os
import re
import time
import uuid
from typing import Any, Callable, Dict, List, Optional

EMOJI_PATTERN = re.compile(
    r"[\U00010000-\U0010ffff]|[\u2600-\u27bf]|[\u2300-\u23ff]|[\u2b50-\u2b55]"
)


def strip_emojis(val: Any) -> Any:
    """Recursively removes emojis from strings, dicts, and lists."""
    if isinstance(val, str):
        cleaned = EMOJI_PATTERN.sub("", val)
        # Normalize excessive whitespace left by stripped emojis
        lines = [re.sub(r"[ \t]+", " ", l).strip() for l in cleaned.split("\n")]
        return "\n".join(lines).strip()
    elif isinstance(val, dict):
        return {k: strip_emojis(v) for k, v in val.items()}
    elif isinstance(val, list):
        return [strip_emojis(v) for v in val]
    return val


class NotificationService:
    """Creates actionable alarm records without pretending to send messages."""

    def __init__(
        self,
        history_path: Optional[str] = None,
        clock: Callable[[], float] = time.time,
    ):
        self.notification_history: List[Dict[str, Any]] = []
        self.subscribers = [
            {"name": "Ege Bölge SCADA Nöbetçi Mühendisi", "phone": "+90 532 000 1122", "channel": "WHATSAPP"},
            {"name": "Saha Arıza Onarım Bakım Şefi (İzmir-Buca)", "phone": "+90 533 000 3344", "channel": "SMS"},
            {"name": "Şebeke Operasyon Merkezi (ADM/GDZ)", "phone": "+90 530 000 5566", "channel": "WHATSAPP"},
        ]
        self.last_sent_timestamp = 0.0
        self.cooldown_seconds = 60.0
        self.last_dispatched_signature: Optional[str] = None
        self._clock = clock
        self.history_path = history_path or os.path.abspath(
            os.path.join(os.path.dirname(__file__), "..", "..", "data", "alerts.jsonl")
        )
        self._load_history()

    def _load_history(self) -> None:
        try:
            with open(self.history_path, "r", encoding="utf-8") as history_file:
                for line in history_file:
                    if not line.strip():
                        continue
                    record = json.loads(line)
                    if isinstance(record, dict):
                        self.notification_history.append(strip_emojis(record))
            self.notification_history = list(reversed(self.notification_history[-50:]))
        except FileNotFoundError:
            return
        except (OSError, json.JSONDecodeError):
            # A damaged local audit file must not prevent the gateway demo from starting.
            self.notification_history = []

    def _persist(self, record: Dict[str, Any]) -> None:
        try:
            parent = os.path.dirname(self.history_path)
            if parent:
                os.makedirs(parent, exist_ok=True)
            with open(self.history_path, "a", encoding="utf-8") as history_file:
                history_file.write(json.dumps(record, ensure_ascii=False) + "\n")
        except OSError:
            # Notification creation remains available even if local persistence is unavailable.
            return

    def reset_state(self) -> None:
        """Reset incident deduplication when the scenario is explicitly returned to normal."""
        self.last_dispatched_signature = None
        self.last_sent_timestamp = 0.0

    def dispatch_alert(
        self,
        severity: str,
        anomaly_type: str,
        component_location: str,
        metrics: Dict[str, Any],
        recommended_action: str,
        substation_name: str = "GDZ Buca TM-1600kVA Pano #1",
    ) -> Optional[Dict[str, Any]]:
        now = self._clock()
        signature = f"{severity}:{anomaly_type}:{component_location}"
        if signature == self.last_dispatched_signature and now - self.last_sent_timestamp < self.cooldown_seconds:
            return None

        self.last_dispatched_signature = signature
        self.last_sent_timestamp = now
        alert_id = f"ALR-{uuid.uuid4().hex[:6].upper()}"
        formatted_time = time.strftime("%H:%M:%S", time.localtime(now))
        formatted_date = time.strftime("%d.%m.%Y", time.localtime(now))
        safe_metrics = dict(metrics or {})

        sms_body = (
            f"[GDZ/ADM ERKEN UYARI - {severity}]\n"
            f"Konum: {substation_name} | {component_location}\n"
            f"Arıza: {anomaly_type}\n"
            f"Özet: {safe_metrics.get('highlight_summary', '')}\n"
            f"Aksiyon: {recommended_action}\n"
            f"Zaman: {formatted_time}"
        )
        whatsapp_message = {
            "title": f"PANO ANOMALİ ERKEN UYARI BİLDİRİMİ ({severity})",
            "header_color": "#ef4444" if severity == "CRITICAL" else "#f59e0b",
            "substation": substation_name,
            "component": component_location,
            "anomaly": anomaly_type,
            "metrics": safe_metrics,
            "action": recommended_action,
            "timestamp": f"{formatted_date} {formatted_time}",
            "recipients": [subscriber["name"] for subscriber in self.subscribers],
        }
        record = {
            "id": alert_id,
            "timestamp": f"{formatted_date} {formatted_time}",
            "epoch": now,
            "severity": severity,
            "anomaly_type": anomaly_type,
            "location": component_location,
            "metrics": safe_metrics,
            "recommended_action": recommended_action,
            "sms_text": sms_body,
            "whatsapp_payload": whatsapp_message,
            "transport_mode": "SIMULATED",
            "delivery_status": "SIMULATED_DELIVERY",
            "delivered": False,
        }
        self.notification_history.insert(0, record)
        self.notification_history = self.notification_history[:50]
        self._persist(record)
        return record

    def get_latest_alerts(self, limit: int = 10) -> List[Dict[str, Any]]:
        return strip_emojis(self.notification_history[: max(0, limit)])
