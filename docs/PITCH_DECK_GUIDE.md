# GRID-GUARD AI ⚡
## ADM & GDZ Elektrik Hackathonu — Jüri Sunum ve Savunma Kılavuzu
### "Pano/Hücre İçi Anomali Erken Uyarı Sistemi"

---

## 🎯 1. 5 Dakikalık Sunum Akışı (Slide-by-Slide Pitch Deck)

### 📌 Slayt 1: Problem ve Sahadan Gelen Çığlık (Süre: 45 sn)
* **Mesaj:** AG dağıtım panolarında ve OG hücrelerindeki arızalar bir gecede olmaz; aylar öncesinden ısınma, gevşeme, nem ve mikro-kıvılcım (kısmi deşarj) sinyalleri verir.
* **Mevcut Durumun Zafiyeti:** 
  * Yılda 1 kez yapılan termal kamera ölçümleri o anki yük akımını hesaba katmaz.
  * Statik eşikler (örneğin "Sıcaklık > 75°C ise alarm ver") yanıltıcıdır: 500 A çeken bir baranın 55°C olması normalken, 80 A çeken bir klemensin 55°C olması ölümcül bir gevşemenin habercisidir!
* **Hedefimiz:** Arıza oluştuktan sonra değil; klemens ilk gevşediğinde, ilk çiğ düştüğünde ve ilk mikro deşarj başladığında sahayı haberdar etmek.

---

### 📌 Slayt 2: Şartnamedeki "Büyük Kısıt" & Bizim Çözümümüz (Süre: 45 sn)
* **Jürinin Vurguladığı Challenge:** 
  > *"Panolarda aşırı kablo yığını kaotik hale getirebilir... kontrol ünitesindeki ufak bir çalışma hem hayati risk taşır hem de planlı kesinti gerektirir."*
* **Grid-Guard AI Non-İnvaziv Yaklaşımı:**
  1. **Bara Kesme / Delme YOK:** Techimp HFCT sensörü split-core (kelepçe) yapısıyla doğrudan pano topraklama barasına/örgüsüne dıştan kilitlenir. Montaj esnasında panonun enerjisini kesmeye gerek yoktur (**Zero Downtime Retrofit**).
  2. **Kablo Kalabalığı YOK:** DSYA çıkışlarındaki sıcaklık ölçümleri manyetik alan enerji hasatlayıcı (Energy-Harvesting) pilsiz kablosuz sensörlerle alınır.
  3. **Elektriksel Tehlike YOK:** TVOC-2 optik fiberleri tamamen dielektriktir (iletken içermez); baraya temas etse dahi ark veya kısa devre yaratmaz.

---

### 📌 Slayt 3: Fizik-Bilgilendirilmiş Analitik Çekirdek (Süre: 60 sn)
* **1. Dinamik Joule Isınma Modeli ($I^2 \cdot R$ & Transient $\tau = 1200\text{ s}$):**
  * Panodan geçen gerçek zamanlı akıma göre olması gereken teorik bara/klemens sıcaklığı modellenir.
  * $\Delta T_{\text{residual}} = T_{\text{ölçülen}} - T_{\text{model}}$ hesaplanır. Eğer akım artmadığı halde $\Delta T > 15^\circ\text{C}$ ise klemens gevşemiştir (Contact Degradation Index $\ge 1.6\times$).
* **2. Magnus Çiğ Noktası & Techimp HFCT Füzyonu:**
  * Çiğ noktası marjı ($T_{\text{yüzey}} - T_{\text{çiğ}}$) ve HFCT darbe frekansı ($1-60\text{ MHz}$) birlikte değerlendirilir.
  * İzolasyon üzerinde nem filmi oluşup yüzey atlaması (flashover) riski doğduğunda sistem otomatik alarm üretir.
* **3. TVOC-2 Çift Kriterli Ark Koruması:**
  * Güneş ışığı veya kamera flaşı gibi yanıltıcı etkenlere karşı **Optik Flaş + Aşırı Akım / $\frac{di}{dt}$** çift kriteri şart koşulur. $<1\text{ ms}$ donanım açtırma koruması sağlanır.

---

### 📌 Slayt 4: CANLI DEMO ŞOVU (Süre: 90 sn)
*(Ekranda `http://localhost:8000` SCADA Arayüzü Açılır)*

1. **Excel Gerçek Veri Akışı:**
   * *"Şu an grafiklerde gördüğünüz L1 akımı, şartnamede tarafımıza iletilen `İstenen Veriler.xlsx` dosyasındaki 152 satırlık 15 dakikalık periyodik akım verisinden saniyede bir adımla okunmaktadır."*
2. **Jüri Test Merkezi - Buton 2 (Klemens Gevşemesi):**
   * Butona basın: DSYA-04 çıkış pabucu 85°C'ye fırlar. Model sapması $\Delta T = +25^\circ\text{C}$ ve CDI $2.04\times$ olur. WhatsApp bildiriminde *"Cıvatayı torklayınız"* uyarısı çıkar.
3. **Jüri Test Merkezi - Buton 4 (Ark Patlaması):**
   * Butona basın: 3450 A ark akımı ve optik flaş ile sistem kilitlenir. TVOC-2 Modbus tablosunda PDU 100 register'ı **0x0800 (Bit 11 = X2:2)** olarak anında güncellenir.
4. **Çift Yönlü Modbus Kontrolü & TVOC-2 Reset:**
   * TVOC-2 kartındaki **"TVOC-2 Reset (PDU 1000)"** butonuna basın. Modbus PDU 1000'e 1 yazıldığı ve sistemin güvenle normale döndüğü gösterilir.
5. **Olay Raporu İndir:**
   * Alarm sekmesindeki **"📄 Olay Raporunu İndir (JSON)"** butonuna basın ve oluşan adli bilişim tutanağını gösterin.

---

### 📌 Slayt 5: Ölçeklenebilirlik, Güvenlik ve Kapanış (Süre: 45 sn)
* **100 Pano Performansı:**
  * Terminalde `python tests/benchmark_100_panels.py` çıktısını gösterin: 100 pano tek çekirdekte **1.78 ms** (pano başına 0.018 ms). 1 trafo merkezinde 100 pano olsa bile CPU kullanımı %1'in altındadır.
* **Strict Zero-Cloud (%100 On-Premise):**
  * Veriler şebeke güvenliği gereği asla AWS/Google Cloud/Azure'a çıkmaz; yerel endüstriyel Edge Gateway üzerinde çalışır.
* **Maliyet / Fayda:**
  * 1 adet 1600 kVA AG pano yangını ve trafo hasarı ortalama **1.500.000 TL** doğrudan donanım zararı ve enerji kesintisi tazminatına yol açar.
  * Grid-Guard AI, mevcut panoya sıfır kablo kargaşasıyla entegre olarak bu riski kökten ortadan kaldırır.

---

## 🛡️ 2. Jüri Tuzak Soruları ve "Öldürücü" Cevaplar

### Soru 1: *"Neden pano içine termal kamera koymadınız? Termal kamera daha kolay değil mi?"*
> **Cevap:** *"Termal kameralar panolarda 3 büyük zafiyet yaratır: Birincisi, pano içi 12 adet DSYA ve ana baralarla doludur; kameraların kör noktaları vardır ve her klemensi göremezler. İkincisi, endüstriyel termal kameralar çok yüksek maliyetlidir; 100 panoya uygulamak bütçeyi katlar. Üçüncüsü, kamera akım bilgisine sahip değildir; 50°C gördüğünde bunun normal bir yük mü yoksa düşük yükte bir gevşeme mi olduğunu ayırt edemez. Bizim fizik tabanlı Joule modelimiz ise $I^2R$ üzerinden doğrudan temas direncini (CDI) hesaplar."*

### Soru 2: *"Verilerin doğruluğundan nasıl eminsiniz? Modbus adresleriniz gerçek cihazlarla uyumlu mu?"*
> **Cevap:** *"Evet, sistemimiz ezbere değil, doğrudan üretici datasheet'lerine göre inşa edildi. ENTES MPR-53CS'nin Register 0 (V_L1), Register 6 (I_L1), Register 58 (Frekans) ve Register 32769 (CT Oranı) gibi tüm PDU adresleri kullanım kılavuzundan doğrulandı. ABB TVOC-2'nin PDU 100, 101, 102, 149, 500, 1000 ve 1300 adresleri kılavuza birebir uymaktadır. Hatta X2:2 optik sensörü tetiklendiğinde PDU 100'de tam olarak Bit 11'in (0x0800) yandığını Modbus tablomuzda görebilirsiniz."*

### Soru 3: *"Saha ekibine WhatsApp/SMS atarken internet veya bulut kullanıyor musunuz?"*
> **Cevap:** *"Hayır, sistemimiz 'Strict Zero-Cloud' felsefesine sahiptir. Saha bildirimleri, Edge Gateway üzerindeki yerel RS-232/USB endüstriyel GSM/4G modem üzerinden doğrudan operatör SMSC/şebekesiyle iletilir. Dış buluta veya üçüncü taraf sunuculara tek bir bayt veri dahi sızmaz."*

### Soru 4: *"HFCT kısmi deşarj sensörünü canlı panoya nasıl takacaksınız, çarpılma riski yok mu?"*
> **Cevap:** *"Techimp HFCT 30/50 sensörü 'split-core' yani mandallı açılır-kapanır kelepçe tipindedir. Bu sensör enerjili baraya değil; kablo başlıklarının dışındaki topraklama örgüsüne (ground link) takılır. Topraklama hattında normalde gerilim sıfırdır ve sensör 25 kVpeak elektriksel yalıtıma sahiptir. Dolayısıyla pano enerjisi kesilmeden, planlı kesinti yapmadan tamamen güvenli bir şekilde tak-çalıştır montajı yapılabilir."*
