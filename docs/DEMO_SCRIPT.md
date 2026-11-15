# SafeFlow — demo video ssenarisi

**Ümumi müddət:** ~13–15 dəqiqə · **Çəkiliş üçün:** `demo/split.html` (solda telefon çərçivəsində vətəndaş tətbiqi `:5173`, sağda dispetçer paneli `:5174`).

## Hazırlıq (çəkilişdən əvvəl)

1. MongoDB işləyir; `backend` (`npm run dev`), `client-citizen` və `client-dispatcher` işə salınıb.
2. Dispetçer panelinə `dispatcher / Dispatcher123!` ilə daxil olun (admin səhnələri üçün ayrıca tabda `admin / Admin123!`).
3. İdarəetmə → "Reset simulation" ilə təmiz vəziyyət.
4. `demo/split.html`-i brauzerdə tam ekran açın (F11). Hər səhnədə üst zolaqdakı başlığı klikləyib səhnə adını yazın.
5. Görünüş düymələri: **Yalnız mobil** (klaviatura `1`), **Yan-yana** (`2`), **Yalnız dispetçer** (`3`).
6. Qayda: hər ekranda mətni oxumağa vaxt verin — siçanı yavaş hərəkət etdirin, kliklərdən sonra 2–3 saniyə gözləyin.

Görünüş qaydası: funksiya yalnız telefonda olursa — **Yalnız mobil**; vətəndaş ↔ dispetçer qarşılıqlı əlaqəsi varsa — **Yan-yana**; yalnız panel funksiyasıdırsa — **Yalnız dispetçer**.

---

| # | Səhnə | Görünüş | Müddət | Nə etmək / nəyə klikləmək | Nəyi demək (qısa) |
|---|---|---|---|---|---|
| 1 | Giriş | Yan-yana | 25 s | Heç nəyə klikləməyin; hər iki ekranı göstərin. | "SafeFlow — vətəndaş və böhran mərkəzi bir real-vaxt platformasında." |
| 2 | Vətəndaş ana ekranı və dil | Yalnız mobil | 30 s | Ana ekranı göstərin → dil seçicisində az → en → az. | Anonim cihaz, hesab tələb olunmur; az/en/ru. |
| 3 | Toplanma məntəqəsi və marşrut | Yalnız mobil | 35 s | "Toplanma məntəqəsi" kartını açın → dolulluq göstəricisi → "Marşrut". | Ən uyğun məntəqə çəkili bal ilə seçilir; status ikon + mətn + rəng. |
| 4 | Bir toxunuşla SOS | Yan-yana | 35 s | Telefonda **SOS** → təsdiq. Sağda SOS-un növbədə və xəritədə dərhal görünməsini göstərin. | SOS dispetçerə ~17 ms-də çatır (p95). |
| 5 | Məhdud hərəkət — Priority #1 | Yan-yana | 35 s | Telefonda profil → "Məhdud hərəkət" seçin → yeni SOS. Sağda bu SOS-un növbənin başına keçməsini göstərin. Telefonda maneəsiz marşrutu açın. | Əlil arabası olanlar birinci; marşrut pilləkənsiz. |
| 6 | Offline rejim və idempotentlik | Yalnız mobil | 40 s | DevTools → Network → Offline (və ya Wi-Fi-ı söndürün) → SOS göndərin, "növbədə" statusunu göstərin → Online → avtomatik göndərilir. | Şəbəkə qayıdanda eyni `clientId` ilə göndərilir — dublikat tiket yoxdur. |
| 7 | "Mən təhlükəsizəm" | Yan-yana | 25 s | Telefonda "Mən təhlükəsizəm" → sağda SOS statusunun dəyişməsi. | Bu SOS klaster sayından çıxır. |
| 8 | Simulyator: "Yasamalda zəlzələ" | Yalnız dispetçer | 40 s | Əməliyyatlar → Simulyasiya → **Yasamalda zəlzələ** → Başlat. Xəritədə SOS-ların klasterləşməsini, növbənin dolmasını göstərin. | Real vaxtda SOS axını, sığınacaq axını, yol bağlanmaları, spam partlayışı. |
| 9 | Xəritə klasterləşməsi və performans | Yalnız dispetçer | 30 s | Xəritəni zoom in/out edin, klasterlərin açılmasını göstərin; növbəni sürüşdürün. | SOS seli altında panel donmur — batching + klasterləşmə. |
| 10 | Qırmızı alert | Yalnız dispetçer | 35 s | Qırmızı alert kartını açın: zona, cihaz sayı, vaxt pəncərəsi. | 5 dəq / 500 m-də ≥ 4 fərqli cihaz; spam və "təhlükəsiz" sayılmır. |
| 11 | Təsdiq + briqada təklifi + multi-brigade | Yan-yana | 40 s | Alert → **Təsdiqlə** → təklif olunan briqadalar (ETA üzrə sıralı) → iki briqada seçin → custom təsdiq dialoqu → Göndər. Solda vətəndaşın statusunun "Kömək yoldadır"-a dəyişməsi. | Bir kliklə qərar; bir neçə briqada; hər əməliyyat audit log-a. |
| 12 | Sığınacaq balanslaşdırması | Yalnız dispetçer | 30 s | Əməliyyatlar → Toplanış məntəqələri: 90% / 95% həddlərini və yönləndirməni göstərin. | Smart balancing — dolu məntəqədən yaxındakına yönləndirmə. |
| 13 | Dron sorğuları | Yan-yana | 40 s | Toplanma məntəqəsinin ehtiyacları (needs) görünüşü → bir dialoqda dron sorğusu → sağda dron missiyasının xəritədə hərəkəti. | Toplanma məntəqələrinə dronla su/dərman. |
| 14 | Edge node | Yalnız mobil | 30 s | Edge portal (məntəqə Wi-Fi-ı) ekranını göstərin; offline-da SOS və məntəqə məlumatı. | İnternet yoxdursa məntəqədəki yerli server işləyir, sonra mərkəzlə sinxronlaşır. |
| 15 | Əlçatanlıq | Yalnız mobil | 35 s | Qısayol SOS-u göstərin → Morse səs/işıq siqnalını işə salın. | WCAG 2.1 AA; görmə/eşitmə məhdudiyyəti olanlar üçün. |
| 16 | Könüllülər | Yan-yana | 35 s | Telefonda "Könüllü ol" → peşə seçin → razılıq checkbox → qeydiyyat. Sağda könüllülər siyahısı və tapşırıq təyini. | Peşəkar könüllülər şəbəkəsi, açıq razılıqla. |
| 17 | AI 1 — Səsli SOS + NLP | Yan-yana | 40 s | Telefonda mikrofon → qısa cümlə ("Binada iki yaralı var, üçüncü mərtəbə") → sağda strukturlaşdırılmış SOS (yaralı sayı, mərtəbə, təcililik). | STT + NLP; açar yoxdursa mock (`mock: true`). |
| 18 | AI 2 — Dron görüntüsündən zərər analizi | Yalnız dispetçer | 40 s | Süni intellekt → Zərər analizi (dron) → şəkil yükləyin → aşkarlamalar → **"Xəritəyə tətbiq et"** → sonra revert-i göstərin. | Human-in-the-loop: AI təklif edir, dispetçer təsdiqləyir; audit olunur. |
| 19 | AI 3 — İzdiham proqnozu | Yalnız dispetçer | 30 s | Süni intellekt → İzdiham proqnozu: məntəqələrin dolma vaxtı proqnozunu göstərin. | Növbəti dəqiqələr üçün dolma proqnozu. |
| 20 | AI 4 — RAG çatbot | Yalnız mobil | 35 s | Telefonda köməkçi → "Ən yaxın sığınacaq haradadır?" → "Zəlzələdə nə etməli?" | Cavablar rəsmi təlimatlara və canlı məlumata əsaslanır. |
| 21 | AI 5 — Təchizat planı | Yalnız dispetçer | 30 s | Süni intellekt → Təchizat planı: məntəqələr üzrə su/qida/dərman ehtiyacı və dron/briqada bölgüsü. | Arxa fon job-u; API dərhal cavab verir. |
| 22 | Partner API | Yalnız dispetçer | 25 s | İdarəetmə → Partnyor qurumlar: client, scope-lar, webhook. | OAuth2, scope, mTLS; minimum məlumat paylaşımı. |
| 23 | Admin konfiqurasiyası | Yalnız dispetçer | 40 s | İdarəetmə → Konfiqurasiya (kateqoriyalar): klaster həddini 4 → 3 dəyişin → Saxla; Feature flag-lardan birini söndürün → həmin bölmənin yoxa çıxmasını göstərin → geri açın. | Restart-sız runtime config, validasiya; bağlı modul `404 FEATURE_DISABLED`. |
| 24 | Rollar və icazələr | Yalnız dispetçer | 25 s | İdarəetmə → Rollar və icazələr. | RBAC `rbac.json`-dan; menyu icazələrdən qurulur. |
| 25 | Reset və yekun | Yan-yana | 30 s | Əməliyyatlar → Simulyasiya → Sıfırla → hər iki ekranın təmizlənməsi. Sonda test/yük nəticələri slaydı (və ya `REPORT.md`). | 120 unit + 125 inteqrasiya testi; 1020 socket; spam selində 0 itki. |

---

## Çəkiliş məsləhətləri

- Səhnələr arasında 1–2 saniyəlik pauza saxlayın — montajda kəsmək asan olur.
- Səsli SOS səhnəsində brauzer mikrofon icazəsini əvvəlcədən verin.
- Simulyatoru (səhnə 8) çox uzun işlətməyin — 20–30 saniyə kifayətdir, sonra səhnə 10–11 üçün alert hazır olur.
- Admin səhnələrindən (23) sonra dəyişdirilmiş həddi geri qaytarın.
