# GRID-GUARD AI: SİSTEM VE DONANIM MİMARİ ŞEMASI

Bu doküman, ADM & GDZ Elektrik Hackathonu sunumu ve video çekimi için projenin **Yazılım Sistem Mimarisi**, **Donanım / Sensör Entegrasyon Mimarisi** ve **Pano İçi Fiziksel Yerleşim Şemalarını** hem görsel Mermaid diyagramları hem de endüstriyel blok şemalar halinde sunar.

---

## 1. 🏗️ Genel Sistem ve Veri Akış Mimarisi (Software & Edge Architecture)

```mermaid
flowchart TD
    subgraph SAHA_SENSORLERI ["SAHA & DONANIM KATMANI (TEDAŞ 1600 kVA AG Pano)"]
        direction TB
        MPR["ENTES MPR-53CS<br/>Şebeke Analizörü<br/>(V, I, P, Q, Cos φ, THD)"]
        TVOC["ABB TVOC-2<br/>Optik Ark Koruma<br/>(30 Optik Fiber Kanal)"]
        HFCT["Techimp HFCT 30/50<br/>Kısmi Deşarj Sensörü<br/>(1-60 MHz / Topraklama Örgüsü)"]
        ENV["Kablosuz Energy-Harvesting<br/>Sıcaklık ve Nem Sensörleri<br/>(Bara Yüzeyi & Klemensler)"]
    end

    subgraph ILETISIM_KATMANI ["NON-INVAZIV İLETİŞİM & VERİ TOPLAMA"]
        direction LR
        RS485_1["RS-485 Modbus RTU<br/>(İzole Port 1)"]
        RS485_2["RS-485 Modbus RTU<br/>(İzole Port 2)"]
        COAX["50 Ω BNC Koaksiyel<br/>(Yüksek Hızlı AFE)"]
        SUB1G["Sub-1GHz / BLE<br/>(Endüstriyel Pilsiz RF)"]
    end

    MPR --> RS485_1
    TVOC --> RS485_2
    HFCT --> COAX
    ENV --> SUB1G

    subgraph EDGE_GATEWAY ["GRID-GUARD AI ON-PREMISE EDGE GATEWAY (%100 SIFIR BULUT)"]
        direction TB
        subgraph FIZIK_MOTORLARI ["Fizik Destekli Analitik Motorlar (Python / Core)"]
            JOULE["1. Dinamik Joule Termal Modeli<br/>• I²·R Isıl Zaman Sabiti (τ=300s)<br/>• Termal Residual: ΔT = Tölç - Tmodel<br/>• Kontak Bozulma İndeksi (CDI)"]
            DEW["2. Magnus Çiğ Noktası & HFCT Füzyonu<br/>• Magnus-Tetens Formülü (Tdp)<br/>• Yoğuşma Marjı (Mdew = T - Tdp)<br/>• CIGRE TB 837 Kısmi Deşarj Füzyonu"]
            ARC["3. Çift Doğrulamalı Ark Koruması<br/>• Optik Işık Flaşı + di/dt > 500 A/ms<br/>• Yanlış Açtırma Önleme<br/>• < 0.85 ms IGBT Donanım Açtırma"]
            HEALTH["4. IEEE P3835 Varlık Sağlık İndeksi<br/>• %35 Termal + %25 İzolasyon PD<br/>• %20 Çiğ Noktası + %20 Güç Kalitesi<br/>• Çok Boyutlu AHP Skoru (0-100)"]
        end
        
        MODBUS_SRV["SCADA Modbus RTU / TCP Server<br/>(MPR-53CS + TVOC-2 + AI Sanal Registerlar 40001-40010)"]
        FASTAPI["FastAPI Web & WebSocket Sunucusu<br/>(Yerel 127.0.0.1:8000 / 1 Hz Telemetri)"]
    end

    RS485_1 --> FIZIK_MOTORLARI
    RS485_2 --> FIZIK_MOTORLARI
    COAX --> FIZIK_MOTORLARI
    SUB1G --> FIZIK_MOTORLARI

    FIZIK_MOTORLARI --> MODBUS_SRV
    FIZIK_MOTORLARI --> FASTAPI

    subgraph KULLANICI_KATMANI ["İZLEME, SCADA & BİLDİRİM ARAYÜZLERİ"]
        direction LR
        DASHBOARD["Yerel SCADA Web Dashboard<br/>• TEDAŞ 1600 kVA SVG Dijital İkiz<br/>• 12 DSYA Besleyici Isı Haritası<br/>• Canlı Termal & PD Grafikleri<br/>• 100 Pano Filo Yönetimi"]
        NOTIF["Yerel Bildirim Motoru<br/>• Sanal WhatsApp Görünümü<br/>• Hücresel GSM SMS (AT+CMGS)<br/>• Reçeteli Bakım Direktifleri"]
    end

    FASTAPI --> DASHBOARD
    FASTAPI --> NOTIF
```

---

## 2. 🔌 Donanım Entegrasyon ve Sensör Yerleşim Şeması (Hardware Topology)

TEDAŞ 1600 kVA AG Panosu içinde **sıfır kablo karmaşası** ve **sıfır invaziv delme/kesme** prensibiyle sensörlerin yerleşimi:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│               TEDAŞ 1600 kVA DAHİLİ AG DAĞITIM PANOSU (TEDAŞ-MLZ/2003-06.B)            │
│               Boyutlar: 1600 mm (Genişlik) x 1500 mm (Yükseklik) x 450 mm (Derinlik)    │
├───────────────────────────────────────────────────────────────────┬────────────────────┤
│ ÜST KOMPARTIMAN: KORUMA, ÖLÇÜ & SERVİS BÖLÜMÜ                     │ SAĞ HÜCRE (EÖ)     │
│                                                                   │                    │
│  ┌────────────────────────┐         ┌──────────────────────────┐  │ ┌────────────────┐ │
│  │ ABB TVOC-2 ARK MONİTÖRÜ│         │ GRID-GUARD AI GATEWAY    │  │ │ ENTES MPR-53CS │ │
│  │ 30 Optik Fiber Kanalı  │         │ Endüstriyel DIN-Ray Montaj│ │ │ Şebeke         │ │
│  │ IGBT Hızlı Açtırma     │         │ Çift Çekirdek 240 MHz    │  │ │ Analizörü      │ │
│  └───────────┬────────────┘         └────────────┬─────────────┘  │ └───────┬────────┘ │
│              │ (Dielektrik Fiberler)             │ (RS-485 Veri Yolu)       │          │
├──────────────┼───────────────────────────────────┼──────────────────────────┼──────────┤
│ ANA BARA BÖLMESİ: 3 Faz + Nötr [2 x (100 x 10 mm²) Elektrolitik Bakır]      │          │
│                                                                             │          │
│   L1 (R): ═════════════════════════════════════════════════════════════════ │          │
│   L2 (S): ═════════════════════════════════════════════════════════════════ │          │
│   L3 (T): ═════════════════════════════════════════════════════════════════ │          │
│                                                                             │          │
│   [Sensör Yerleşimi]:                                                       │          │
│    • TVOC-2 X1 Fiberleri (10 Nokta) ──▶ Ana Giriş Buşonları & Bara Dirsekleri          │
│    • Energy-Harvesting Klips Sensör ──▶ Pilsiz Manyetik İndüksiyon Sıcaklık Sensörü    │
├─────────────────────────────────────────────────────────────────────────────┼──────────┤
│ ÇIKIŞ BÖLMESİ: 12 Adet Dikey Sigortalı Yük Ayırıcı (DSYA NH-3 630A / NH-2 400A)        │
│                                                                                        │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ... │
│  │DSYA01│ │DSYA02│ │DSYA03│ │DSYA04│ │DSYA05│ │DSYA06│ │DSYA07│ │DSYA08│ │DSYA09│     │
│  │      │ │      │ │      │ │ ⚠️   │ │      │ │      │ │      │ │      │ │      │     │
│  │Klem. │ │Klem. │ │Klem. │ │Klem. │ │Klem. │ │Klem. │ │Klem. │ │Klem. │ │Klem. │     │
│  │Sensör│ │Sensör│ │Sensör│ │Sensör│ │Sensör│ │Sensör│ │Sensör│ │Sensör│ │Sensör│     │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘     │
│  * Her DSYA çıkış pabucuna kablosuz RF sıcaklık düğümü (Cıvata gevşemesi tespiti)      │
│  * TVOC-2 X2 Fiberleri ──▶ DSYA sigorta bıçak aralıklarına doğrudan bakar               │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ ALT KABLO GİRİŞ / ÇIKIŞ & TOPRAKLAMA BÖLGESİ                                           │
│                                                                                        │
│        [Kablo Başlıkları Topraklama Örgüsü / Earth Return]                             │
│                  │                                                                     │
│             ┌────┴────────────────────────┐                                            │
│             │  TECHIMP HFCT 30/50         │ (Kelepçe Tipi Klips Montaj)                │
│             │  Kısmi Deşarj (PD) Sensörü  │ (SIFIR KESİNTİ - Canlı Baraya Dokunmaz)     │
│             └────────────┬────────────────┘                                            │
│                          │ (50 Ohm RG-58 BNC Koaksiyel)                                │
│                          └──────────────────────────────▶ [Gateway Hızlı AFE Girişi]   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. ⏱️ Çok Katmanlı Erken Uyarı Zaman Çizelgesi (Time-to-Fault)

Grid-Guard AI fizik motorlarının arıza modlarına göre koruma ve erken uyarı hiyerarşisi:

```
ZAMAN ÖLÇEĞİ:
|<------------- HAFTALAR / AYLAR ÖNCESİ ------------->|<--- GÜNLER / SAATLER --->|<-- <1 ms -->|

1. TERMAL RESIDUAL (JOULE İZLEME)
   Cıvata Gevşemesi -> Direnç Artışı (ΔT > +15°C, CDI > 1.5x)
   [Erken Torklama Reçetesi & Planlı Bakım]
   ---------------------------------------------------->

2. KONDENZASYON & HFCT PD FÜZYONU
   Nem > %90 + Marj < 3°C + HFCT > 40 pps
   [İzolasyon Yüzey Atlama / Bozulma Uyarısı]
   --------------------------------------------------------------------------->

3. ABB TVOC-2 & ÇİFT KRİTERLİ ARK KORUMA
   Işık Flaşı + di/dt > 500 A/ms
   [Donanımsal IGBT Kesici Açtırma: < 0.85 ms]
   ------------------------------------------------------------------------------------------->|
```

---

## 4. 📁 Proje İçindeki İlgili Mimari Dokümanlar

| Doküman | Yol | Kapsam |
| :--- | :--- | :--- |
| **Donanım & Elektronik Tasarım** | [`docs/HARDWARE_DESIGN.md`](file:///c:/Users/Userr/Projects/grzhackhathon/docs/HARDWARE_DESIGN.md) | Sensör montajı, kablosuz düğümler, PCB blok şeması, BOM maliyet tablosu |
| **Akademik & Algoritma Teorisi** | [`docs/ALGORITHM_THEORY.md`](file:///c:/Users/Userr/Projects/grzhackhathon/docs/ALGORITHM_THEORY.md) | Joule $I^2 R$, Magnus denklemi, TVOC-2 çift kriter, AHP Sağlık İndeksi |
| **Yazılım Mimarisi & Başlangıç** | [`README.md`](file:///c:/Users/Userr/Projects/grzhackhathon/README.md) | FastAPI, WebSocket, 4 senaryo ve veri akış kutuları |
| **Modbus SCADA Register Haritası** | [`docs/SCADA_MODBUS_MAPPING.md`](file:///c:/Users/Userr/Projects/grzhackhathon/docs/SCADA_MODBUS_MAPPING.md) | ENTES MPR-53CS + ABB TVOC-2 + Grid-Guard AI (40001-40010) register tablosu |
| **Video Konuşma Metni** | [`video_konusma_metni.md`](file:///C:/Users/Userr/.gemini/antigravity/brain/f13ff0a6-2214-4f33-8f3c-626ab5e962f3/video_konusma_metni.md) | 5 dakikalık eksiksiz video sunum rehberi |
