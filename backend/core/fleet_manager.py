# Fleet Management Core for 100 Distribution Switchgear Panels (TEDAS 1600 kVA AG).
# Complies with ADM & GDZ Hackathon Specification Clause 5 (Concurrency & Scalability).

from typing import Dict, Any, List, Optional
import random

class FleetManager:
    def __init__(self, total_panels: int = 100):
        self.total_panels = total_panels
        self.substation_names = [
            ('GDZ', 'Izmir Buca TM'),
            ('GDZ', 'Izmir Bornova TM'),
            ('GDZ', 'Izmir Karsiyaka TM'),
            ('GDZ', 'Izmir Konak TM'),
            ('GDZ', 'Izmir Cigli TM'),
            ('GDZ', 'Izmir Gaziemir TM'),
            ('GDZ', 'Izmir Torbali TM'),
            ('GDZ', 'Izmir Menemen TM'),
            ('GDZ', 'Izmir Bayrakli TM'),
            ('GDZ', 'Izmir Kemalpasa TM'),
            ('GDZ', 'Izmir Urla TM'),
            ('GDZ', 'Izmir Cesme TM'),
            ('GDZ', 'Izmir Seferihisar TM'),
            ('GDZ', 'Izmir Bergama TM'),
            ('GDZ', 'Izmir Tire TM'),
            ('GDZ', 'Izmir Odemis TM'),
            ('GDZ', 'Izmir Aliaga TM'),
            ('GDZ', 'Manisa Yunusemre TM'),
            ('GDZ', 'Manisa Sehzadeler TM'),
            ('GDZ', 'Manisa Turgutlu TM'),
            ('GDZ', 'Manisa Salihli TM'),
            ('GDZ', 'Manisa Akhisar TM'),
            ('GDZ', 'Manisa Soma TM'),
            ('ADM', 'Denizli Pamukkale TM'),
            ('ADM', 'Denizli Merkezefendi TM'),
            ('ADM', 'Denizli Honaz TM'),
            ('ADM', 'Denizli Saraykoy TM'),
            ('ADM', 'Aydin Efeler TM'),
            ('ADM', 'Aydin Kusadasi TM'),
            ('ADM', 'Aydin Soke TM'),
            ('ADM', 'Aydin Didim TM'),
            ('ADM', 'Aydin Nazilli TM'),
            ('ADM', 'Mugla Bodrum TM'),
            ('ADM', 'Mugla Fethiye TM'),
            ('ADM', 'Mugla Marmaris TM'),
            ('ADM', 'Mugla Milas TM'),
            ('ADM', 'Mugla Mentese TM'),
            ('ADM', 'Mugla Yatagan TM'),
            ('ADM', 'Mugla Ortaca TM'),
            ('ADM', 'Mugla Dalaman TM')
        ]
        self.panels: List[Dict[str, Any]] = self._init_panels()

    def _init_panels(self) -> List[Dict[str, Any]]:
        panels = []
        for i in range(1, self.total_panels + 1):
            sub_idx = (i - 1) % len(self.substation_names)
            region, tm_name = self.substation_names[sub_idx]
            short_tm = tm_name.replace('Izmir ', '').replace('Manisa ', '').replace('Denizli ', '').replace('Aydin ', '').replace('Mugla ', '')

            if i == 1:
                panel = {
                    'id': 1,
                    'panel_id': 'PANO-001',
                    'code': f'{region}-BUCA-AG-001',
                    'name': 'Pano #1 (Buca TM - Aktif Dijital Ikiz)',
                    'region': region,
                    'substation': tm_name,
                    'transformer_kva': 1600,
                    'status': 'OPTIMAL',
                    'health_index': 98.0,
                    'active_alarms': 0,
                    'anomaly_detail': 'Nominal Isletme (Tum sensorler saglikli)',
                    'is_active_twin': True,
                    'last_inspected': '12.09.2026 00:00',
                    'feeder_count': 12,
                    'load_pct': 68.4,
                    'temp_c': 36.2,
                    'residual_dt_c': 1.4,
                    'dew_margin_c': 20.6,
                    'hfct_pd_pps': 4.8
                }
            elif i == 17:
                panel = {
                    'id': 17,
                    'panel_id': 'PANO-017',
                    'code': f'{region}-CIGLI-AG-017',
                    'name': 'Pano #17 (Cigli TM - AG #17)',
                    'region': region,
                    'substation': tm_name,
                    'transformer_kva': 1600,
                    'status': 'WARNING',
                    'health_index': 76.0,
                    'active_alarms': 1,
                    'anomaly_detail': 'DSYA-02 Klemens Gevsekligi (Delta-T: +18.2C)',
                    'is_active_twin': False,
                    'last_inspected': '11.09.2026 22:14',
                    'feeder_count': 12,
                    'load_pct': 82.1,
                    'temp_c': 54.8,
                    'residual_dt_c': 18.2,
                    'dew_margin_c': 16.4,
                    'hfct_pd_pps': 6.1
                }
            elif i == 42:
                panel = {
                    'id': 42,
                    'panel_id': 'PANO-042',
                    'code': f'{region}-PAMUK-AG-042',
                    'name': 'Pano #42 (Pamukkale TM - AG #42)',
                    'region': region,
                    'substation': tm_name,
                    'transformer_kva': 1600,
                    'status': 'CRITICAL',
                    'health_index': 48.0,
                    'active_alarms': 1,
                    'anomaly_detail': 'Yogusma & Kismi Desarj Riski (HFCT: 142 pps)',
                    'is_active_twin': False,
                    'last_inspected': '11.09.2026 21:50',
                    'feeder_count': 12,
                    'load_pct': 74.5,
                    'temp_c': 18.5,
                    'residual_dt_c': 0.8,
                    'dew_margin_c': 1.4,
                    'hfct_pd_pps': 142.0
                }
            else:
                hi = round(random.uniform(92.0, 99.0), 1)
                load_pct = round(random.uniform(45.0, 85.0), 1)
                panel = {
                    'id': i,
                    'panel_id': f'PANO-{i:03d}',
                    'code': f'{region}-TM{sub_idx+1:02d}-AG-{i:03d}',
                    'name': f'Pano #{i} ({short_tm} - AG #{i})',
                    'region': region,
                    'substation': tm_name,
                    'transformer_kva': 1600,
                    'status': 'OPTIMAL',
                    'health_index': hi,
                    'active_alarms': 0,
                    'anomaly_detail': 'Nominal Isletme',
                    'is_active_twin': False,
                    'last_inspected': '11.09.2026',
                    'feeder_count': 12,
                    'load_pct': load_pct,
                    'temp_c': round(28.0 + (load_pct / 100.0) ** 2 * 16.0 + random.uniform(-1.0, 1.0), 1),
                    'residual_dt_c': round(random.uniform(-0.5, 2.1), 1),
                    'dew_margin_c': round(random.uniform(14.0, 24.0), 1),
                    'hfct_pd_pps': round(random.uniform(2.0, 6.5), 1)
                }
            panels.append(panel)
        return panels

    def update_primary_panel(self, active_scenario: str = "NORMAL", health_index: float = 98.0, active_alarms: int = 0, temp_c: float = 36.0, residual_c: float = 1.0, **kwargs):
        if not self.panels:
            return
        # Support kwargs alias
        if "scenario" in kwargs:
            active_scenario = kwargs["scenario"]
        if "main_busbar_temp" in kwargs:
            temp_c = kwargs["main_busbar_temp"]
        if "residual_delta_t" in kwargs:
            residual_c = kwargs["residual_delta_t"]

        p1 = self.panels[0]
        p1['health_index'] = round(health_index, 1)
        p1['active_alarms'] = 0 if active_scenario == 'NORMAL' else active_alarms
        p1['temp_c'] = round(temp_c, 1)
        p1['residual_dt_c'] = round(residual_c, 1)
        
        if active_scenario == 'NORMAL':
            p1['status'] = 'OPTIMAL' if health_index >= 85.0 else ('ATTENTION' if health_index >= 70.0 else 'WARNING')
            p1['anomaly_detail'] = 'Nominal Isletme (Tum sensorler saglikli)'
        elif active_scenario == 'LOOSE_BOLT':
            p1['status'] = 'CRITICAL'
            p1['anomaly_detail'] = 'DSYA-04 Klemens Gevsekligi (Delta-T > +50C)'
        elif active_scenario == 'CONDENSATION_PD':
            p1['status'] = 'CRITICAL'
            p1['anomaly_detail'] = 'Yogusma & HFCT Kismi Desarj Riski'
        elif active_scenario == 'ARC_FLASH':
            p1['status'] = 'CRITICAL'
            p1['anomaly_detail'] = 'TVOC-2 Optik Ark Flas Tetiklendi (Actirma Kilitli)'

    def get_all_panels(self) -> List[Dict[str, Any]]:
        return self.panels

    def get_panel(self, panel_id: Any) -> Optional[Dict[str, Any]]:
        target_id = None
        if isinstance(panel_id, int):
            target_id = panel_id
        elif isinstance(panel_id, str):
            clean = panel_id.upper().replace('PANO-', '').replace('PANO #', '').replace('#', '').strip()
            if clean.isdigit():
                target_id = int(clean)
        
        for p in self.panels:
            if p['id'] == target_id or p['code'] == panel_id or str(p['id']) == str(panel_id):
                return p
        return None

    def get_fleet_summary(self) -> Dict[str, Any]:
        healthy_count = sum(1 for p in self.panels if p['status'] in ['OPTIMAL', 'HEALTHY', 'NORMAL'])
        warning_count = sum(1 for p in self.panels if p['status'] in ['WARNING', 'ATTENTION'])
        critical_count = sum(1 for p in self.panels if p['status'] == 'CRITICAL')
        total_alarms = sum(p['active_alarms'] for p in self.panels)

        return {
            'total_panels': self.total_panels,
            'normal': healthy_count,
            'alarms': warning_count + critical_count,
            'healthy_count': healthy_count,
            'warning_count': warning_count,
            'critical_count': critical_count,
            'total_alarms': total_alarms,
            'fleet_health_avg': round(sum(p['health_index'] for p in self.panels) / max(1, len(self.panels)), 1),
            'summary_badge': f'Filo: {self.total_panels} Pano ({healthy_count} OK / {warning_count + critical_count} Alarm)',
            'panels': self.panels
        }

    def get_panel_detail(self, panel_id: int) -> Optional[Dict[str, Any]]:
        return self.get_panel(panel_id)

