# GRID-GUARD AI: AKADEMİK ALTYAPI VE ALGORİTMA TEORİSİ
## 2025 / 2026 IEEE Standartları ve Fizik Destekli Sensör Füzyonu

**Doküman Kodu:** GG-AI-MATH-2026-V1  
**Uluslararası Referanslar:** IEEE P3835 (2025/2026), IEEE C37.21-2026, IEEE Std 1291, IEEE Std 1584, CIGRE TB 837  

---

### 1. Dinamik Fiziksel Termal Model ($I^2 \cdot R$ ve Isıl Zaman Sabiti)

Geleneksel dağıtım panosu izleme sistemleri statik sıcaklık eşikleri kullanır (örn. $T > 75^\circ\text{C}$). Bu yöntem sahadaki fiziksel gerçekliği yansıtmaz çünkü:
* Yazın $40^\circ\text{C}$ ortam sıcaklığında $500\text{ A}$ nominal yükte çalışan bir bara $75^\circ\text{C}$ olabilir ve bu **tamamen güvenlidir**.
* Kışın $10^\circ\text{C}$ ortamda $100\text{ A}$ düşük yük çeken bir fazın $65^\circ\text{C}$'ye fırlaması **ölümcül bir klemens yangını başlangıcıdır**, ancak statik eşik alarm vermez!

Grid-Guard AI, ısı transferinin diferansiyel denklemini çözerek çalışır:

$$C_{th} \frac{dT(t)}{dt} = P_{kayıp}(t) - \frac{T(t) - T_{amb}(t)}{R_{th}}$$

Burada:
* $P_{kayıp}(t) = I(t)^2 \cdot R_e$ (Joule Isınması, $R_e$ elektriksel kontak direnci)
* $R_{th}$ iletkenin çevreye olan ısıl direnci ($\text{K/W}$)
* $C_{th}$ bakır baranın ısıl sığası ($\text{J/K}$)
* $\tau = R_{th} \cdot C_{th}$ ısıl zaman sabiti ($\approx 1200\text{ saniye} = 20\text{ dakika}$)

Ayrık zamanlı adımda ($k$ anında) beklenen bara sıcaklığı:

$$\Delta T_{model}[k] = \Delta T_{model}[k-1] \cdot e^{-\Delta t / \tau} + \left(I[k]^2 \cdot K_{joule}\right) \cdot \left(1 - e^{-\Delta t / \tau}\right)$$
$$T_{model}[k] = T_{amb}[k] + \Delta T_{model}[k]$$

#### Termal Artık (Residual) ve Kontak Bozulma İndeksi (CDI):
$$\Delta T_{residual}[k] = T_{ölçülen}[k] - T_{model}[k]$$
$$CDI[k] = \frac{\Delta T_{ölçülen}[k]}{\Delta T_{model}[k]}$$

* $\Delta T_{residual} \ge +15^\circ\text{C}$ veya $CDI \ge 1.5\text{x}$ $\rightarrow$ **ERKEN KONTAK BOZULMASI / GEVŞEK CIVATA** (Yangından haftalar önce).
* $\Delta T_{residual} \ge +25^\circ\text{C}$ veya $CDI \ge 2.5\text{x}$ $\rightarrow$ **KRİTİK TERMAL RUNAWAY** (Yangın riski).

---

### 2. Magnus Çiğ Noktası ve Techimp HFCT Kısmi Deşarj (PD) Füzyonu

Havadaki su buharının panodaki soğuk yüzeylerde sıvı suya dönüşmesi, yalıtkan yüzey direncini düşürerek **Kısmi Deşarj Başlama Gerilimini (PDIV)** çökertir (CIGRE TB 837).

Magnus-Tetens Formülü ile Çiğ Noktası ($T_{dp}$):
$$\alpha(T_{amb}, RH) = \frac{17.27 \cdot T_{amb}}{237.7 + T_{amb}} + \ln\left(\frac{RH}{100}\right)$$
$$T_{dp} = \frac{237.7 \cdot \alpha(T_{amb}, RH)}{17.27 - \alpha(T_{amb}, RH)}$$

Yoğuşma Güvenlik Marjı ($M_{dew}$):
$$M_{dew} = T_{yüzey} - T_{dp}$$

Techimp HFCT sensöründen okunan yüksek frekanslı nano-saniyelik darbelerin sıklığı ($pps$) ile birleştirildiğinde:
$$\text{Tehlike Durumu} = \begin{cases} 
\text{NORMAL}, & M_{dew} > 5^\circ\text{C} \text{ ve } PD < 20\text{ pps} \\
\text{YOĞUŞMA UYARISI}, & M_{dew} \le 3^\circ\text{C} \text{ ve } PD < 40\text{ pps} \\
\text{KRİTİK YÜZEY ATLAMA RİSKİ}, & M_{dew} \le 3^\circ\text{C} \text{ ve } PD \ge 40\text{ pps}
\end{cases}$$

---

### 3. Çift Doğrulamalı Hızlı Ark Koruma Mantığı (Dual-Criteria Arc Mitigation)

Sadece optik ışık dedektörüne bakıldığında personelin kapağı açması, el feneri veya kamera flaşı yanlış açtırmaya (false trip) neden olabilir.

Grid-Guard AI iki şartı ve-kapısı (AND) ile bağlar:
$$\text{Trip Sinyali} = \left(\text{Optik Işık} > \text{Eşik}\right) \land \left(\frac{I_{anlık}}{I_{nominal}} \ge 1.8 \lor \frac{di}{dt} > 500\text{ A/ms}\right)$$

ABB TVOC-2'nin katı hal IGBT çıkışı sayesinde açtırma süresi **$\mathbf{< 0.85\ ms}$** seviyesindedir. Yangın veya bara patlaması henüz kinetik enerjiye dönüşmeden şebeke kesicisi açılarak felaket önlenir.

---

### 4. 2025/2026 Çok Boyutlu Pano Sağlık İndeksi (Health Index: 0 - 100)

$$HI = 0.35 \cdot S_{termal} + 0.25 \cdot S_{izolasyon} + 0.20 \cdot S_{yoğuşma} + 0.20 \cdot S_{şebeke}$$

* $S_{termal} = \max\left(0, 100 - 4 \cdot \Delta T_{residual}\right)$
* $S_{izolasyon} = \max\left(0, 100 - 1.0 \cdot PD_{pps}\right)$
* $S_{yoğuşma} = \min\left(100, 12.5 \cdot M_{dew}\right)$
* $S_{şebeke} = 100 - 6 \cdot (THD_I - 5.0)$

Bu indeks, SCADA merkezindeki operatörün tek bir bakışta panonun genel yıpranma ve arıza riskini görmesini sağlar.
