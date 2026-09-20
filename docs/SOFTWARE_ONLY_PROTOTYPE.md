# Grid-Guard AI Yazılım-Only Prototip Tasarımı

## Amaç

Bu doküman, gerçek sensör veya pano kurulumu olmadan şartnameye uygun uçtan uca gösterimin nasıl yapıldığını açıklar. Prototip, sentetik sensör verilerini gerçek saha cihazlarının kavramsal adapter noktalarından geçirerek analiz eder.

## Veri akışı

```text
Sentetik MPR-53CS / TVOC-2 / HFCT / sıcaklık-nem verisi
                         |
                         v
                 Sensor adapter katmanı
                         |
                         v
                  FastAPI Edge Gateway
                         |
        +----------------+----------------+
        |                                 |
        v                                 v
   Fizik motorları                  Alarm servisi
        |                                 |
        v                                 v
   Health Index                  Simulated notification
        |
        v
 Web dashboard + Modbus mapping
```

## Kavramsal kabin modülü

Gerçek donanım satın alınmadan önerilen saha yerleşimi:

- Kablosuz sıcaklık/nem sensörleri: bara, kablo pabucu ve pano mikrokliması için.
- MPR-53CS adapter noktası: akım ve elektriksel kalite verisi için.
- TVOC-2 adapter noktası: optik ark olay ve durum register’ları için.
- HFCT adapter noktası: pulse rate ve peak amplitude verisi için.
- DIN-ray Edge Gateway: veri toplama, analiz, yerel kayıt ve dashboard servisi için.
- Kurum içi ağ: merkezi SCADA veya operasyon ekranına aktarım için.

Bu bileşenler prototipte Python simülatörleriyle temsil edilir. Fiziksel kurulum, kablo güzergâhı, izolasyon ve EMC doğrulaması kapsam dışıdır.

## I/O ve adapter sözleşmesi

| Kaynak | Gerçek saha rolü | Prototip karşılığı |
|---|---|---|
| MPR-53CS | Akım, gerilim, THD | `ModbusPanoSimulator` register’ları |
| TVOC-2 | Optik ark ve trip state | `ArcProtectionEngine` |
| HFCT | PD pulse rate ve peak | `DewPointPDFusion` girdileri |
| Sıcaklık sensörü | Ortam/yüzey sıcaklığı | Sentetik thermal telemetry |
| Nem sensörü | Bağıl nem | Scenario mutation |
| GSM/WhatsApp | Operasyon bildirimi | `NotificationService` simulated transport |

## Alarm yaşam döngüsü

1. Sentetik veri normal veya anormal senaryoya geçer.
2. Fizik motoru sapmayı hesaplar.
3. Health Index risk seviyesini üretir.
4. Bildirim servisi incident kaydı oluşturur ve aynı alarmı deduplicate eder.
5. Dashboard alarmı ve önerilen aksiyonu gösterir.
6. Alarm kaydı yerel JSONL geçmişine yazılır.
7. Senaryo açıkça `NORMAL` yapıldığında latch ve incident deduplication durumu resetlenir.

## Bildirim sınırı

Bu prototip gerçek SMS, WhatsApp veya GSM gönderimi yapmaz. Kayıtlar şu alanlarla açıkça simüle edilir:

- `transport_mode: SIMULATED`
- `delivery_status: SIMULATED_DELIVERY`
- `delivered: false`

Gerçek saha kurulumunda aynı servis sözleşmesine GSM modem, kurum içi SMS gateway veya onaylı bir mesajlaşma adapter’ı eklenebilir.

## Şartname uyumluluğu

- Sentetik veriyle gösterim: mevcut.
- On-premise çalışma: mevcut.
- Monitoring: mevcut.
- Modbus mapping: dokümante edilmiş prototip entegrasyonu.
- 100 modül: CPU hesaplama benchmarkı mevcut.
- Fiziksel modül: kavramsal yerleşim ve I/O sözleşmesiyle gösterilir.
- Gerçek saha kurulumu: hackathon kapsamı dışında.
