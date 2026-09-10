# GRID-GUARD AI: SCADA & MODBUS HARİTALAMA DOKÜMANTASYONU
## ENTES MPR-53CS ve ABB TVOC-2 Konsolide SCADA Register Tablosu

**Protokol Standardı:** Modbus RTU over RS-485 (2-Telli Korumalı Kablo) / Modbus TCP Gateway  
**Baud Rate:** 19200 bps | **Veri Bitleri:** 8 | **Parite:** Even (Çift) | **Stop Biti:** 1  
**Slave ID:** ENTES MPR-53CS = `1`, ABB TVOC-2 = `2`, Grid-Guard Fused Gateway = `10`  

---

### 1. Konsolide SCADA Register Haritası (Fonksiyon Kodu 03 & 04)

ADM/GDZ SCADA sistemlerinin tek bir sorgu bloğuyla panonun tüm elektrik, termal ve ark verilerini okuyabilmesi için konsolide harita oluşturulmuştur:

| Register (Dec) | Adres (Hex) | SCADA Etiket Adı (Tag) | Cihaz Kaynağı | Açıklama | Çarpan / Birim | Veri Tipi |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **0** | `0x0000` | `TR_PANO_V_L1` | MPR-53CS | L1 Faz-Nötr Gerilimi | $0.1\text{ V}$ | Unsigned Int |
| **2** | `0x0002` | `TR_PANO_V_L2` | MPR-53CS | L2 Faz-Nötr Gerilimi | $0.1\text{ V}$ | Unsigned Int |
| **4** | `0x0004` | `TR_PANO_V_L3` | MPR-53CS | L3 Faz-Nötr Gerilimi | $0.1\text{ V}$ | Unsigned Int |
| **6** | `0x0006` | `TR_PANO_I_L1` | MPR-53CS | L1 Faz Akımı | $0.001\text{ A} \times CT$ | Unsigned Int |
| **8** | `0x0008` | `TR_PANO_I_L2` | MPR-53CS | L2 Faz Akımı | $0.001\text{ A} \times CT$ | Unsigned Int |
| **10** | `0x000A` | `TR_PANO_I_L3` | MPR-53CS | L3 Faz Akımı | $0.001\text{ A} \times CT$ | Unsigned Int |
| **12** | `0x000C` | `TR_PANO_I_NEUTRAL` | MPR-53CS | Nötr Hattı Akımı | $0.001\text{ A} \times CT$ | Unsigned Int |
| **14** | `0x000E` | `TR_PANO_U_L12` | MPR-53CS | L1-L2 Faz-Faz Gerilimi | $0.1\text{ V}$ | Unsigned Int |
| **38** | `0x0026` | `TR_PANO_COS_L1` | MPR-53CS | L1 Güç Faktörü ($\cos \phi$) | $0.001$ | Signed Int |
| **58** | `0x003A` | `TR_PANO_FREQ` | MPR-53CS | Şebeke Frekansı | $0.01\text{ Hz}$ | Unsigned Int |
| **72** | `0x0048` | `TR_PANO_THD_V` | MPR-53CS | Gerilim Toplam Harmonik | $0.1\text{ \%}$ | Unsigned Int |
| **78** | `0x004E` | `TR_PANO_THD_I` | MPR-53CS | Akım Toplam Harmonik | $0.1\text{ \%}$ | Unsigned Int |
| **100** | `0x0064` | `TVOC_TRIP1_DET_LOW` | TVOC-2 | Trip 1 Optik Dedektör Bitleri (X1:1 - X2:5) | Bitfield | HEX Word |
| **101** | `0x0065` | `TVOC_TRIP1_DET_HIGH` | TVOC-2 | Trip 1 Optik Dedektör Bitleri (X2:6 - X3:10) | Bitfield | HEX Word |
| **102** | `0x0066` | `TVOC_TRIP1_RELAY` | TVOC-2 | Açtıran Röleler (K4, K5, K6) | Bitfield (LSb=K4) | HEX Word |
| **149** | `0x0095` | `TVOC_TRIP_COUNT` | TVOC-2 | Toplam Kaydedilen Ark Trip Sayısı | $1$ | Unsigned Int |
| **500** | `0x01F4` | `TVOC_MODULES` | TVOC-2 | Kurulu Modüller (0x000E: X2+X3+HMI) | Bitfield | HEX Word |
| **1000** | `0x03E8` | `TVOC_TRIP_RESET` | TVOC-2 | Trip Reset Komutu (Yazma: 1 = Reset) | Command | Write-Only |
| **1300** | `0x0514` | `TVOC_SYSTEM_STATE`| TVOC-2 | Sistem Durumu (0: Normal, 1: Hata, 2: Tripped) | Durum Kodu | Unsigned Int |
| **1301** | `0x0515` | `TVOC_ACTIVE_DTC1` | TVOC-2 | Aktif Tanı Kodu (DTC #1) | Diagnostic | Unsigned Int |

---

### 2. Grid-Guard AI Tarafından Üretilen İleri Seviye Sanal Register'lar (40000+ Bloğu)

SCADA operatörlerinin anomali durumunu doğrudan okuyabilmesi için Edge Gateway üzerinde hesaplanan **Fizik Destekli Sanal Register'lar**:

| Register (Dec) | Adres (Hex) | SCADA Etiket Adı | Açıklama | Çarpan / Birim | Eşik Sınırları |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **40001** | `0x9C41` | `AI_ASSET_HEALTH_INDEX` | Pano Sağlık İndeksi (Health Index) | $0.1\text{ \%}$ | $0 - 1000$ ($850\text{+} = \text{Normal}$) |
| **40002** | `0x9C42` | `AI_BUSBAR_MEASURED_TEMP`| Ölçülen Ana Bara Sıcaklığı | $0.1^\circ\text{C}$ | TS EN 61439-1 ($<105^\circ\text{C}$) |
| **40003** | `0x9C43` | `AI_JOULE_PREDICTED_TEMP`| Fiziksel Joule Modeli Tahmin Sıcaklığı | $0.1^\circ\text{C}$ | $T_{ortam} + I^2 \cdot R_{th} \cdot R_e$ |
| **40004** | `0x9C44` | `AI_THERMAL_RESIDUAL_DT` | Termal Artık Sıcaklık Farkı ($\Delta T_{res}$)| $0.1^\circ\text{C}$ | $>15^\circ\text{C} = \text{Uyarı}$, $>25^\circ\text{C} = \text{Kritik}$ |
| **40005** | `0x9C45` | `AI_CONTACT_DEG_INDEX`  | Kontak Bozulma İndeksi (CDI) | $0.01\text{ x}$ | $>1.5\text{x} = \text{Gevşek Bağlantı}$ |
| **40006** | `0x9C46` | `AI_DEW_POINT_TEMP`     | Magnus Çiğ Noktası Sıcaklığı | $0.1^\circ\text{C}$ | $f(T_{ortam}, RH)$ |
| **40007** | `0x9C47` | `AI_DEW_MARGIN`         | Yoğuşma Güvenlik Marjı ($T_{yüzey} - T_{dp}$)| $0.1^\circ\text{C}$ | $\le 3.0^\circ\text{C} = \text{Yoğuşma Riski}$ |
| **40008** | `0x9C48` | `AI_HFCT_PD_PPS`        | Kısmi Deşarj Darbe Sıklığı | $0.1\text{ pps}$| $>40\text{ pps} = \text{İzolasyon Uyarısı}$ |
| **40009** | `0x9C49` | `AI_HFCT_PEAK_PC`       | Kısmi Deşarj Tepe Genliği | $1\text{ pC}$ | $>250\text{ pC} = \text{Kritik Deşarj}$ |
| **40010** | `0x9C4A` | `AI_ANOMALY_ALARM_WORD` | Alarm Durum Kelimesi (Bit 0: Termal, Bit 1: PD, Bit 2: Nem, Bit 3: Ark) | Bitfield | HEX Word |
