# GRID-GUARD AI ⚡
## Pano ve Hücre İçi Anomali Erken Uyarı Sistemi
**ADM & GDZ Elektrik Hackathonu | Ege Bölgesi Dağıtım Şebekesi (İzmir, Manisa, Aydın, Denizli, Muğla)**

---

## 🎯 Projenin Amacı ve Özeti
TEDAŞ-MLZ/2003-06.B şartnamesine uygun **1600 kVA Alçak Gerilim (AG) Dağıtım Panolarında** ve Hücrelerde meydana gelen:
1. **Termal Kontak Gevşemeleri (Joule $I^2 \cdot R$ Direnç Artışı / Gevşek Cıvata):** Yangın veya baranın erimesinden haftalar önce tespit edilir.
2. **Yoğuşma & Kısmi Deşarj (PD) Yüzey Atlama Tehlikesi:** Magnus çiğ noktası formülü ve Techimp HFCT (1-60 MHz) füzyonuyla kirlilik/nem kaynaklı atlama olmadan saatler önce nem alıcı rezistansları uyarır.
3. **Optik Ark Flaş Patlamaları:** ABB TVOC-2 Modbus entegrasyonu ve çift kriterli (optik flaş + $di/dt$ akım türevi) doğrulama ile 1 milisaniyenin altında (<0.85 ms) şalteri açtırır. Yanlış flaşları (kamera flaşı, el feneri) filtreler.

Sistem, **SIFIR DIŞ BULUT (Strict Zero-Cloud)** prensibiyle trafo merkezi içerisindeki yerel bir Endüstriyel Edge Gateway (Advantech / Raspberry Pi 4 / DIN-Rail IPC) üzerinde **%100 On-Premise** çalışır.

---

## 🏗️ Mimari ve Veri Akışı

```
[ENTES MPR-53CS (RS-485)]   [ABB TVOC-2 (Modbus RTU)]   [Techimp HFCT 30/50]   [Sıcaklık & Nem Sensörü]
          │                               │                      │                     │
          └───────────────────────────────┴──────────┬───────────┴─────────────────────┘
                                                     ▼
                               ┌───────────────────────────────────────────┐
                               │  Grid-Guard AI On-Premise Edge Gateway    │
                               │  (FastAPI + Python Core Physics Engines)  │
                               ├───────────────────────────────────────────┤
                               │ 1. Fizik Tabanlı Dinamik Termal Model    │
                               │ 2. Çiğ Noktası & HFCT PD Füzyon Motoru   │
                               │ 3. TVOC-2 Çift Kriterli Ark Koruma Motoru │
                               │ 4. IEEE P3835 Varlık Sağlık İndeksi (HI)  │
                               └─────────────────────┬─────────────────────┘
                                                     │
                         ┌───────────────────────────┴───────────────────────────┐
                         ▼                                                       ▼
      ┌────────────────────────────────────┐                  ┌────────────────────────────────────┐
      │  Yerel SCADA & Web Dashboard       │                  │ Otomatik SMS / WhatsApp Bildirimi  │
      │  - 1600 kVA SVG Dijital İkiz       │                  │ - GSM Modem / SMPP Gateway         │
      │  - 12 DSYA Besleyici Takibi        │                  │ - Sanal Saha Mühendisi Bildirimi   │
      │  - Modbus Register Tablosu         │                  │ - Arıza Lokasyonu & Aksiyon Planı  │
      └────────────────────────────────────┘                  └────────────────────────────────────┘
```

---

## ⚡ Hızlı Başlangıç (Tek Tıkla Çalıştırma)

### Gereksinimler:
* Python 3.9 veya daha yeni bir sürüm.
* İnternet bağlantısı **gerekmez** (Tüm CSS, JavaScript, canvas grafik motoru ve fontlar tamamen yerel/offline çalışır).

### Çalıştırma:
Windows ortamında tek tıkla çalıştırmak için:
```cmd
start.bat
```
Veya manuel olarak:
```bash
pip install -r requirements.txt
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```
Tarayıcınızdan şu adrese gidiniz: **`http://localhost:8000`**

---

## 🧪 Canlı Test ve Jüri Senaryoları
Dashboard üzerinde üst barda bulunan **Jüri Test Merkezi** butonları ile 4 kritik durum anlık olarak simüle edilebilir:
1. **🟢 Senaryo 1: Normal İşletme:** Şebeke nominal akımda, termal residual ~0°C, Health Index %95+.
2. **🟡 Senaryo 2: Klemens Gevşemesi (ΔT Residual):** DSYA-04 çıkış pabucunda cıvata gevşemesi. Akım normal kalırken yüzey sıcaklığı Joule modelinden +25°C fazla sapar. WhatsApp ve SCADA'ya cıvata torklama uyarısı düşer.
3. **🟠 Senaryo 3: Yoğuşma & Kısmi Deşarj (HFCT):** Gece nemi %93'e çıkar, çiğ noktası marjı 1.2°C'ye düşer, Techimp HFCT darbe sıklığı 90 pps'e fırlar. İzolasyon atlama uyarısı verilir.
4. **🔴 Senaryo 4: Ark Flaş (TVOC-2 <1 ms):** DSYA-04 hücresinde optik flaş ve 3450A akım patlaması. 0.85 ms içinde şalter açtırma emri verilir, kilitlenir (latch) ve register'a yazılır.

---

## 📊 100 Pano Eşzamanlılık Doğrulaması
Sistem tek bir panoyla sınırlı değildir. Trafo merkezindeki 100 panoyu eşzamanlı işleyebilme kapasitesi doğrulanmıştır:
```bash
python tests/benchmark_100_panels.py
```
* **100 Pano Analiz Süresi:** `~1.51 ms` (Döngü periyodu: 1000 ms).
* **Tek Çekirdek Kapasitesi:** Tek bir edge CPU çekirdeğinde saniyede **66.000+ pano analizi**.

---

## 📁 Proje Dizin Yapısı
* `backend/`
  * `core/`: Fizik tabanlı modeller (`physics_thermal_model.py`, `dew_point_pd_fusion.py`, `arc_protection.py`, `health_index.py`).
  * `simulator/`: Excel akım verisini oynatan Modbus simülatörü ve donanım adaptörü (`modbus_hardware.py`).
  * `services/`: Alarm ve SMS/WhatsApp yönetim servisi (`notification_service.py`).
  * `main.py`: FastAPI On-Premise SCADA sunucusu ve WebSocket telemetri motoru.
* `frontend/`: Sıfır harici bağımlılıkla çalışan karanlık SCADA arayüzü, SVG dijital ikiz (`digital_twin.js`), canvas grafik motoru (`charts.js`), Modbus register denetleyicisi.
* `docs/`: Mühendislik dokümantasyonu (`HARDWARE_DESIGN.md`, `SCADA_MODBUS_MAPPING.md`, `ALGORITHM_THEORY.md`).
* `tests/`: Birim testler (`test_core_engines.py`) ve 100 pano benchmark testi (`benchmark_100_panels.py`).
