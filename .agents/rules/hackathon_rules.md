# ADM & GDZ ELEKTRİK HACKATHON: PANO/HÜCRE İÇİ ANOMALİ ERKEN UYARI SİSTEMİ
## KURAL VE KISIT REHBERİ (ZERO-HALLUCINATION & COMPLIANCE RULES)

Bu kurallar projenin tüm geliştirme aşamalarında (kod, mimari, doküman, arayüz, şemalar) harfiyen uygulanacaktır. Asla bu kuralların dışına çıkılmayacak ve halüsinatif varsayımlar yapılmayacaktır.

---

### 1. KESİN YASAKLAR VE İSTENMEYENLER (STRICT FORBIDDEN / ANTI-PATTERNS)

* **YASAK 1: Public Cloud Kesinlikle Yasak.**
  * AWS, Google Cloud, Microsoft Azure, Firebase, Supabase Cloud vb. genel bulut servisleri KESİNLİKLE kullanılmayacaktır.
  * Tüm sistem **On-Premise (Kurum İçi Sunucu)** veya trafo içi **Edge Gateway** altyapısında çalışacaktır.
  
* **YASAK 2: Pano İçi Kablo Kalabalığı ve Canlı Bara Temas Riski Yasak.**
  * 1600 kVA AG pano içerisinde zaten yoğun bara ve 12 adet DSYA kablo kalabalığı mevcuttur.
  * Tasarım asla yeni kablo yumağı yaratmayacak; canlı bara ve enerjili parçalara montaj/bakım esnasında dokunma riski doğurmayacaktır.
  * Tercih: Non-invaziv klipsli (HFCT), optik fiber (TVOC-2) ve kablosuz / manyetik alan enerji hasatlamalı (Energy Harvesting) sensörler.

* **YASAK 3: Yüksek Maliyetli ve Ölçeklenemeyen Donanım Yasak.**
  * Sahada 5 pano değil, **binlerce pano** bulunmaktadır. Her pano için 1500-2000$ maliyetli endüstriyel PC bağımlılığı getirilmeyecektir.
  * Donanım mimarisi düşük maliyetli (BOM optimized), düşük güç tüketen mikrodenetleyici/Edge gateway tabanlı olacaktır.

* **YASAK 4: İlkel ve Statik Eşik Alarmları Yasak.**
  * Sadece "Sıcaklık > 75°C ise alarm ver" gibi ham eşikler erken uyarı sayılamaz.
  * Yaz sıcağında yüksek yük altında 75°C normal olabilirken, kışın düşük yükte 60°C ölümcül bir gevşek bağlantı olabilir.
  * Mutlaka fizik temelli termal model ($I^2 \cdot R$) ve ortam sıcaklığı normalizasyonu yapılacaktır.

* **YASAK 5: Sadece Fikir/Konsept Sunmak Yasak.**
  * Yalnızca sunum slaytı veya rapor yetersizdir.
  * Uçtan uca çalışan canlı web monitoring, Modbus simülatörü, anomali algoritması ve test edilebilir prototip sunulacaktır.

---

### 2. ZORUNLU ÇIKTILAR VE TEKNİK GEREKSİNİMLER (MANDATORY DELIVERABLES)

1. **Fiziksel Modül ve Bağlantı Şeması:**
   * TEDAŞ 1600 kVA AG pano teknik çizimi (EK-II/14, 1600x1500x450 mm) baz alınacaktır.
   * Sensörlerin (HFCT30/50, TVOC-2, MPR-53CS, Sıcaklık/Nem) panodaki yerleşimi ve bağlantı blok şeması sunulacaktır.
   * Montajın kesintisiz mi yoksa kısa süreli planlı kesintiyle mi yapılacağı raporda açıkça belirtilecektir.

2. **Sensör Füzyonu ve Anomali Erken Uyarı Motoru:**
   * **Joule Isınması ($I^2 \cdot R$):** Akım ile bara sıcaklığı korelasyonu (kontak direnci bozulması tespiti).
   * **Çiğ Noktası (Dew Point) & Nem:** Magnus formülü ile yoğuşma riski hesabı ($T_{yüzey} - T_{dp} \le 3^\circ\text{C}$).
   * **Kısmi Deşarj (PD):** Techimp HFCT (1-60 MHz) darbe sıklığı artışı ile izolasyon delinmesi ön uyarısı.
   * **Ark Koruma:** ABB TVOC-2 optik algılama ve akım türevi ($di/dt$) ile <1 ms çift doğrulamalı koruma.
   * **Pano Sağlık İndeksi (Health Index: 0 - 100):** Çok değişkenli birleşik risk skoru.

3. **SCADA ve Modbus RTU / TCP Haritalama:**
   * ENTES MPR-53CS register haritası (Gerilim, Akım, Güç, THD, Max Demand).
   * ABB TVOC-2 register haritası (Trip 1-7 dedektörleri, diyagnostik durumlar, DTC hata kodları).
   * Konsolide SCADA register tablosu.

4. **On-Premise Monitoring Dashboard (Web Tabanlı Canlı Panel):**
   * Pano dijital ikiz görünümü (12 adet DSYA dikey sigortalı yük ayırıcı, bara ve kablo sıcaklıkları).
   * Canlı zaman serisi grafikleri, anomali eşik göstergeleri, anlık alarm logları.

5. **Acil Durum Bildirim Mekanizması:**
   * Kritik anomali seviyelerinde (Seviye 2 Uyarı, Seviye 3 Acil Ark/Yangın) operasyon ekiplerine anında SMS ve WhatsApp bildirim motoru.

6. **Ölçeklenebilirlik:**
   * En az 100 panodan eşzamanlı gelen veriyi işleyebilecek hafif mimari ve kaynak kullanım raporu.

---

### 3. REFERANS VERİLER VE DOKÜMANLAR (TRUTH ANCHORS)
* `İstenen Veriler.xlsx`: L1 sentetik akım verisi (600A primer, 100mA sekonder, 15 dk aralıklar).
* `1600kVA AG Pano Teknik Özellikleri.pdf`: 2x(100x10mm²) bakır bara, 2500/5A akım trafosu, 12 DSYA.
* `AG Pano Teknik Çizim-1600kVA.pdf`: 1600x1500x450 mm, dahili tip AG pano.
* `DS_HFCT30_eng.pdf` & `DS_HFCT50_eng.pdf`: 1-60/80 MHz, 17 mV/mA PD sensörleri.
* `tvoc.pdf` & `1SFC170017M0201_Rev_D_TVOC-2_Modbus_Manual.pdf`: ABB TVOC-2 optik ark sistemi.
* `MPR-53CS_Modbus_Register_Map_EN.pdf`: ENTES şebeke analizörü Modbus registerları.
* `AG PANO MALZEME ŞARTNAMESİ.pdf`: TEDAŞ şartnamesi (TS EN 61439-1 Çizelge 8 sıcaklık artış sınırları).
