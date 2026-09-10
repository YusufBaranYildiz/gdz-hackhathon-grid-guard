# GRID-GUARD AI: DONANIM VE ELEKTRONİK TASARIM DOKÜMANTASYONU
## TEDAŞ 1600 kVA Dahili AG Pano Non-İnvaziv Sensör Entegrasyonu ve Saha Uygulanabilirliği

**Hazırlayan:** Grid-Guard AI Takımı  
**Proje:** ADM & GDZ Elektrik Hackathonu — Pano/Hücre İçi Anomali Erken Uyarı Sistemi  
**Referans Şartname:** TEDAŞ-MLZ/2003-06.B (EK-II/14)  

---

### 1. Saha Gerçeği ve "Sıfır Kablo Karmaşası" Çözüm Felsefesi

Toplantı transkriptinde ADM AR-GE Yöneticisi Nazlıcan Hanım'ın en çok vurguladığı husus:
> *"Kablo yığınları, sigortalar vesaireler pano içinde zaten çok fazla bir kalabalığa sebebiyet vermekte... Tercihen kablosuz tak-çalıştır modeller bizler için çok daha pratik oluyor."*

Mevcut 1600 kVA AG Panolarda $2 \times (100 \times 10\text{ mm}^2)$ kesitinde 3 faz ve nötr ana bakır baraları ile 12 adet Dikey Sigortalı Yük Ayırıcı (DSYA) bulunmaktadır. Bu panoların içine onlarca yeni kablo çekmek, klemens aralarına girmek ve canlı baraları delmek **hayati elektrik çarpması, kısa devre ve yangın riski** taşır.

Grid-Guard AI donanım mimarisi **"Sıfır İnvaziv Müdahale (Zero-Intrusion)"** prensibiyle tasarlanmıştır:

```
                  ┌──────────────────────────────────────────────────────────┐
                  │          1600 kVA AG PANO (TEDAŞ EK-II/14)               │
                  │                                                          │
                  │   [ANA BARA: 2x(100x10 mm²)]                             │
                  │      ▲               ▲               ▲                   │
                  │      │ (Optik Fiber) │ (Manyetik CT) │ (Yüzey Sensörü)   │
                  │      │               │               │                   │
                  │   ┌──┴──────┐    ┌───┴─────────┐ ┌───┴────────────────┐  │
                  │   │TVOC-2   │    │Energy-      │ │Kablosuz Sıcaklık   │  │
                  │   │Optik Ded│    │Harvesting   │ │ve Nem Probları     │  │
                  │   └────┬────┘    └─────┬───────┘ └──────┬─────────────┘  │
                  │        │ (Fiber)       │ (Sub-1GHz)     │ (BLE / RF)     │
                  │        ▼               ▼                ▼                │
                  │   ┌──────────────────────────────────────────────────┐   │
                  │   │      GRID-GUARD AI ON-PREMISE EDGE GATEWAY       │   │
                  │   │  (Düşük Güç Tüketimli STM32 / ESP32-S3 Endüstriyel) │   │
                  │   └──────────────────────┬───────────────────────────┘   │
                  │                          │                               │
                  │        ┌─────────────────┴──────────────────┐            │
                  │        │ (RS-485 İki Telli Korumalı Bus)   │            │
                  │        ▼                                    ▼            │
                  │  ┌───────────────┐                  ┌───────────────┐    │
                  │  │ ENTES MPR-53CS│                  │  ABB TVOC-2   │    │
                  │  │ Şebeke Analiz │                  │  Ark Monitörü │    │
                  │  └───────────────┘                  └───────────────┘    │
                  │                                                          │
                  │   [KABLO ÇIKIŞ BÖLGESİ - TOPRAKLAMA ÖRGÜSÜ]              │
                  │        ▲                                                 │
                  │        │ (BNC Koaksiyel Kablo - 50 Ohm)                  │
                  │   ┌────┴───────────────┐                                 │
                  │   │ TECHIMP HFCT 30/50 │ (Topraklama Örgüsüne Klipsli)   │
                  │   │ Kısmi Deşarj (PD)  │ (Bara Kesme / Delme YOK)        │
                  │   └────────────────────┘                                 │
                  └──────────────────────────────────────────────────────────┘
```

---

### 2. Kullanılan Sensörler ve Montaj Detayları

#### A. Kısmi Deşarj (PD) Sensörü: Techimp HFCT 30 / 50
* **Montaj Yeri:** Pano altındaki kablo kompartımanında bulunan kablo başlıklarının topraklama örgüsü (ground braid / earth return link) üzerine.
* **Non-İnvaziv Özelliği:** Sensör bölünmüş çekirdekli (split-core) indüktif akım trafosudur. Kabloyu kesmeden veya sökmeden kelepçe gibi doğrudan topraklama hattına klipsle kilitlenir.
* **Güvenlik:** 25 kVpeak yalıtım sınıfına sahiptir. Topraklama örgüsünde voltaj olmadığı için montaj personeli için sıfır elektriksel risk taşır.
* **Sinyal İletimi:** $50\ \Omega$ RG-58 BNC koaksiyel kablo ile Edge Gateway'in yüksek hızlı analog ön yüzüne (AFE) bağlanır.

#### B. Optik Ark Koruma Dedektörleri: ABB TVOC-2
* **Montaj Yeri:** 
  * 10 adet dedektör (X1 modülü): Ana bara odası ve giriş buşonları üzerine.
  * 10 adet dedektör (X2 modülü): 12 adet DSYA dikey sigortalı yük ayırıcı hücrelerinin arasına.
  * 10 adet dedektör (X3 modülü): Sayaç odası, kompanzasyon ve sokak aydınlatma bölmesine.
* **Non-İnvaziv Özelliği:** Optik fiber kablolar dielektriktir (içinde metal iletken yoktur). Canlı baraya temas etse bile kısa devre yapmaz, elektrik çarpma riski taşımaz.
* **Tepki Süresi:** $< 1\text{ ms}$ içinde optik parlama sinyalini TVOC-2 ana ünitesine ulaştırır.

#### C. İletken ve Klemens Sıcaklık Sensörleri (Energy-Harvesting Kablosuz Düğümler)
* **2025/2026 İnovasyonu:** DSYA klemenslerine ve ana baraya pilsiz, manyetik alan enerji hasatlayıcı (Magnetic Field Energy Harvester) kelepçe sensörler takılır.
* Baradan geçen yük akımı ($> 15\text{ A}$) sensörün mikro-bobininde indüklenen voltajla sensörün çalışmasını sağlar.
* **Haberleşme:** 2.4 GHz BLE veya 868 MHz Sub-1GHz endüstriyel kablosuz protokol ile Edge Gateway'e veri fırlatır. Pano içine **TEK BİR KABLO BİLE ÇEKİLMEZ**.

#### D. Şebeke Analizörü: ENTES MPR-53CS
* Pano sağ kompartımanındaki mevcut ölçü hücresine (EÖ) monte edilir. 
* Mevcut $2500/5\text{ A}$ akım trafolarından ve faz gerilimlerinden beslenir.
* RS-485 portu üzerinden standart Modbus RTU protokolüyle Edge Gateway'e bağlanır.

---

### 3. Edge Gateway Elektronik Kart Mimarisi (PCB Blok Diyagramı)

Binlerce trafo için ölçeklenebilir ve düşük maliyetli olması amacıyla Gateway tasarımı standart endüstriyel bir SoC mimarisine dayanır:

```
 ┌────────────────────────────────────────────────────────────────────────┐
 │                   GRID-GUARD EDGE GATEWAY (PCB BLOK)                   │
 │                                                                        │
 │  ┌─────────────────┐      ┌──────────────────────────────────────┐     │
 │  │ 24V DC / 230V AC│      │   ÇİFT ÇEKİRDEKLİ ENDÜSTRİYEL MCU    │     │
 │  │ Endüstriyel Güç │─────▶│ (ESP32-S3-WROOM-1 / STM32H7 Serisi) │     │
 │  │ Kaynağı (DIN-Ray│      │  • 240 MHz / 8MB PSRAM / 16MB Flash  │     │
 │  └─────────────────┘      │  • Donanımsal Kriptografi Motoru    │     │
 │                           └──────────────────┬───────────────────┘     │
 │                                              │                         │
 │     ┌────────────────┬───────────────────────┼────────────────────┐    │
 │     ▼                ▼                       ▼                    ▼    │
 │ ┌──────────┐   ┌──────────┐           ┌─────────────┐     ┌──────────┐ │
 │ │RS-485 (1)│   │RS-485 (2)│           │HFCT PD Hızlı│     │Sub-1GHz /│ │
 │ │İzoleli   │   │İzoleli   │           │ADC Katı     │     │BLE Alıcı │ │
 │ │(MPR-53CS)│   │(TVOC-2)  │           │(1-60 MHz)   │     │(Kablosuz)│ │
 │ └──────────┘   └──────────┘           └─────────────┘     └──────────┘ │
 │                                                                        │
 │  ┌────────────────────────────────────────────────────────────────┐    │
 │  │ YEREL ARAYÜZLER: Ethernet RJ45 (SCADA LAN) + 4G LTE/SMS Fallback│    │
 │  └────────────────────────────────────────────────────────────────┘    │
 └────────────────────────────────────────────────────────────────────────┘
```

---

### 4. Malzeme Listesi (BOM) ve Maliyet Karşılaştırması

Şartnamede ve mülakatta belirtilen *"Sahada binlerce pano var, maliyet optimum olmalı"* kriterine yanıt:

| Bileşen | Klasik Yöntem (Pano Başına IPC) | Grid-Guard AI Modüler Mimarisi |
| :--- | :--- | :--- |
| **İşlemci / Gateway** | Endüstriyel PC ($1.500 - $2.500) | Endüstriyel Edge MCU Gateway ($65) |
| **Kablolama & İşçilik** | Ağır kablaj, klemens revizyonu ($400) | Non-invaziv tak-çalıştır klips ($45) |
| **Sensör Ağı** | Kablolu PT100 sensör yığını ($350) | Energy-harvesting kablosuz sensörler ($120) |
| **PD İzleme** | Laboratuvar tipi pahalı cihaz ($3.000+) | Techimp HFCT + Entegre AFE katı ($95) |
| **TOPLAM MALİYET** | **~$5.500 / Pano** | **~$325 / Pano (17 KAT DAHA UCUZ!)** |

> **Ölçeklenebilirlik Çıkarımı:** GDZ ve ADM bölgesindeki 10.000 panonun izlenmesi durumunda, endüstriyel PC yaklaşımı 55 milyon dolar maliyet çıkarırken, Grid-Guard AI mimarisi sadece 3.25 milyon dolara tüm şebekeyi akıllı hale getirebilmektedir.

---

### 5. Planlı Kesinti Analizi ve Montaj Prosedürü

Nazlıcan Hanım'ın *"Eğer bir planlı kesintiyle kurulum varsa bunu muhakkak projenizin içerisinde belirtmenizi bekleriz"* direktifine tam uyum:

* **HFCT Montajı:** **SIFIR KESİNTİ.** Topraklama örgüsü enerjisiz olduğu için trafo enerjiliyken bile emniyet eldiveniyle 3 dakikada takılır.
* **TVOC-2 Fiberleri:** **SIFIR KESİNTİ.** Dielektrik fiberler pano kapakları açıkken emniyet mesafelerine uyularak kılavuz kanallardan döşenir.
* **Energy-Harvesting Kelepçe Sensörler:** **SIFIR KESİNTİ VEYA 15 DAKİKA.** Baraya vidalanmaz, klipsle tutturulur. Eğer şirket İSG prosedürü canlı bara yakınında çalışmayı yasaklıyorsa, montaj için sadece **15 dakikalık planlı manevra kesintisi** yeterlidir.
