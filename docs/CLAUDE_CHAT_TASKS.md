# Claude chat üçün tapşırıqlar — slayd düzəlişləri və video çəkilişi

Bu sənəd iki hissədən ibarətdir:

- **A. Slaydlar (Canva).** Claude chat-da Canva konnektoru qoşuludursa, düzəlişləri birbaşa o edə bilər. Hazır prompt aşağıdadır.
- **B. Video.** Heç bir Claude (nə chat, nə Claude Code) ekranı **video kimi yaza bilməz**. Videonu siz çəkirsiniz (Win+Alt+R və ya OBS). Claude yalnız ssenari, mətn və brauzerdə tətbiqi idarə etmək işində kömək edə bilər. Addım-addım təlimat aşağıdadır.

Faktlar (slaydlarda istifadə üçün, hamısı yoxlanılıb):

| Nə | Dəyər |
|---|---|
| Testlər | **120 unit + 125 inteqrasiya = 245 test**, hamısı keçir |
| Spam selində SOS bütövlüyü | 500/500 real SOS qəbul olundu, **0 itki, 0 dublikat** |
| Realtime | 1020 eyni vaxtda socket; dispetçerə çatma p95 **16.6 ms** |
| Qırmızı həyəcanın yaranması | p95 **28.8 ms** (4-cü SOS-dan sonra) |
| 40 eyni vaxtda sorğu (isinmədən sonra, ayrı prosesdən ölçülüb) | SOS p95 ≈150 ms · səsli SOS 190–250 ms · çatbot ≈100 ms · proqnoz / plan ≈50 ms; soyuq start ilk dalğa ≈300 ms |
| Artillery yük testi (dürüst) | ≤100 req/s-də p95 < 200 ms; sınma nöqtəsi ≈145 SOS/s (tək Node prosesi). Növbəti addım: cluster / PM2 |
| Modullar (feature flag ilə) | Partner API, Könüllülər, Əlçatanlıq, Dronlar, Edge node (oflayn), 5 AI modulu |
| 5 AI modulu | Səsli SOS + NLP · Dron görüntüsü ilə zərər analizi · 15–30 dəq izdiham proqnozu (Holt) · Canlı məlumatla vətəndaş köməkçisi (RAG) · AI təchizat planı |
| AI nəzarəti | Açar yoxdursa demo (mock) məlumat, UI-da "demo məlumat" yazılır · zərər analizi yalnız **təklifdir**, dispetçer "Xəritəyə tətbiq et" ilə təsdiqləyir, audit + geri qaytarma · açarlar paneldə şifrəli |
| Development-də AI | Gemini → prompt / tələb hazırlığı; Claude (Claude Code) → kod, test, debugging; komanda → yoxlama və qərar (`AI_DECLARATION.md`) |

> Qeyd: `EVALUATION.md` qiymətləndirmə edildikdən sonra iki problem artıq həll olunub: README yenilənib (test sayları düzgündür) və `vision.autoApply` indi defolt olaraq `false`-dur (insan təsdiqi). Slaydlarda köhnə zəif tərəf kimi göstərməyin.

---

## A. Slayd düzəlişləri (Canva: https://www.canva.com/design/DAHa9-BF-CQ/pI1wn4NyycBTa6xH4qar_g/edit)

### Slayd-slayd

1. **Başlıq.** Saxlayın. Altına bir sətir: **"6 modul · 5 AI funksiyası · 245 test · 0 itirilmiş SOS"**.
2. **Problem.** Saxlayın.
3. **Mövcud həllər.** Saxlayın (yer lazımdırsa, 2-ci slaydla birləşdirin).
4. **Həll (2 modul).** Altına əlavə: "+ Admin konfiqurasiya · Partner API · Edge node (internetsiz) · Könüllülər · Dronlar".
5. **Vətəndaş tətbiqi.** Əlavə edin: səsli SOS (AI ilə struktur: təhlükə, yer, insan sayı, prioritet) · AI köməkçi · Morse səs/işıq siqnalı · maneəsiz marşrut (Priority #1). Mobil ekran görüntüsü qoyun.
6. **Dispetçer paneli.** Əlavə edin: qırmızı həyəcan + bir kliklə qərar · ETA ilə briqada təklifi · **bir hadisəyə bir neçə briqada** · məntəqəyə ehtiyaca görə **dron sorğusu**. Ekran görüntüsü qoyun.
7. **Ağıllı paylanma.** "15–30 dəqiqəlik izdiham proqnozu **artıq işləyir** (Holt zaman sırası modeli): daşma, dar boğaz və SOS artımı xəbərdarlıqları + yönləndirmə tövsiyələri".
8. **Təhlükəsizlik.** Rəqəmlər: spam selində 500/500 SOS qəbul, 0 dublikat · rate limit IP/cihaz/istifadəçi üzrə (429 + Retry-After) · RBAC · append-only audit · AI açarları şifrəli.
9. **Arxitektura.** **"Gələcək: süni intellektlə izdiham proqnozu" ifadəsini silin.** Yerinə diaqram: `Vətəndaş PWA / Dispetçer → REST + Socket.IO → Express (auth/RBAC, rate limit, feature flag) → EventBus → RuleEngine + modullar → MongoDB` və yanında `AI provider qatı: Gemini / Claude / Whisper / YOLOv8 / mock`. Diaqramın mətn variantı `README.md`-dədir.
10. **Demo.** "url" placeholder-ini silin. Yerinə: GitHub linki (https://github.com/AliAghayev132/safeflow) + QR, və 3 addımlıq demo: "Yasamalda zəlzələ → 4 SOS → qırmızı həyəcan → bir kliklə komanda göndərilir → vətəndaşın marşrutu yenilənir".
11. **Təşəkkür.** GitHub linki + QR.

### Yeni slaydlar (9-cudan sonra əlavə edin)

- **"Challenge Drop-lara uyğunlaşma"** — cədvəl:

  | Drop | Nə əlavə olundu | Necə |
  |---|---|---|
  | Spesifikasiya paketi | Oflayn rejim, replay, idempotent SOS, RBAC, fallback marşrut, i18n | Event bus + rule engine, rbac.json |
  | Performans | Xəritə klasterləşməsi, event batching | Dispetçer donmadan 2000 SOS |
  | Priority #1 | Maneəsiz marşrut | Yol seqment maneələri |
  | 7 modul | Dron, edge, partner, əlçatanlıq, könüllü, balans, briqada təklifi | Modul = 1 import sətri + feature flag |
  | 5 AI modulu | Səs, görüntü, proqnoz, çatbot, təchizat | Provider qatı: real açar və ya mock |
  | < 300 ms | Fon işləri, keş, Mongo pool | Avtomatik gecikmə testi |

- **"Test və performans"** — yuxarıdakı fakt cədvəlindən: 245 test, 0 itki, 16.6 ms / 28.8 ms, 40 eyni vaxtda sorğuda p95 rəqəmləri, və dürüst sətir: "≤100 req/s-də p95 < 200 ms; daha yuxarı üçün cluster".
- **"AI — nəzarət altında"** — 4 bənd: (1) açar yoxdursa demo məlumat, açıq işarələnir; (2) AI zərər analizi yalnız təklifdir, dispetçer təsdiqləyir, audit + geri qaytarma; (3) model çağırışları sorğunu gözlətmir; (4) development: Gemini promptları hazırladı → Claude kodu yazdı → komanda yoxladı (245 test, brauzer yoxlaması).

### Tövsiyə olunan sıra (~5 dəqiqəlik pitch)
1 Başlıq → 2 Problem → 4 Həll → 5–6 Vətəndaş + Dispetçer → 10 Canlı demo → 7 Proqnoz → 9 Arxitektura → **Challenge Drop** → **Test və performans** → **AI nəzarət altında** → 8 Təhlükəsizlik → 11 Təşəkkür.

### Claude chat üçün kopyala-yapışdır prompt (slaydlar)

```
Canva-da bu dizaynı aç: https://www.canva.com/design/DAHa9-BF-CQ/pI1wn4NyycBTa6xH4qar_g/edit
Bu, "SafeFlow" adlı böhran/təxliyə layihəmizin hakaton təqdimatıdır. Dizayn stilini (rənglər, şriftlər, ikonlar) dəyişmə, yalnız məzmunu yenilə. Gradient istifadə etmə, solid rənglər.

1) Slayd 1: başlığın altına əlavə et: "6 modul · 5 AI funksiyası · 245 test · 0 itirilmiş SOS".
2) Slayd 4: altına əlavə et: "+ Admin konfiqurasiya · Partner API · Edge node (internetsiz) · Könüllülər · Dronlar".
3) Slayd 5 (vətəndaş): əlavə et: "Səsli SOS (AI: təhlükə, yer, insan sayı, prioritet) · AI köməkçi · Morse səs/işıq siqnalı · Maneəsiz marşrut (Priority #1)".
4) Slayd 6 (dispetçer): əlavə et: "Qırmızı həyəcan + bir kliklə qərar · ETA ilə briqada təklifi · Bir hadisəyə bir neçə briqada · Məntəqəyə ehtiyaca görə dron sorğusu".
5) Slayd 7: "15–30 dəqiqəlik izdiham proqnozu artıq işləyir (Holt modeli): daşma, dar boğaz, SOS artımı xəbərdarlıqları + yönləndirmə tövsiyələri".
6) Slayd 8: əlavə et: "Spam selində 500/500 SOS qəbul, 0 dublikat · Rate limit IP/cihaz/istifadəçi (429 + Retry-After) · RBAC · Append-only audit · AI açarları şifrəli".
7) Slayd 9: "Gələcək: süni intellektlə izdiham proqnozu" mətnini SİL. Yerinə sadə arxitektura sxemi çək: "Vətəndaş PWA / Dispetçer → REST + Socket.IO → Express API (RBAC, rate limit, feature flag) → EventBus → Rule Engine + Modullar → MongoDB"; yanında ayrı blok: "AI provider qatı: Gemini / Claude / Whisper / YOLOv8 / demo (mock)".
8) Slayd 10: "url" yazısını sil, yerinə "github.com/AliAghayev132/safeflow" yaz və 3 addımlıq demo: "Yasamalda zəlzələ → 4 SOS → qırmızı həyəcan → bir kliklə komanda göndərilir → vətəndaşın marşrutu yenilənir".
9) Slayd 9-dan sonra 3 yeni slayd əlavə et, eyni dizaynla:
   a) "Challenge Drop-lara uyğunlaşma" — cədvəl: Drop | Nə əlavə olundu | Necə:
      Spesifikasiya paketi | Oflayn rejim, replay, idempotent SOS, RBAC, fallback marşrut, 3 dil | Event bus + rule engine, rbac.json
      Performans | Xəritə klasterləşməsi, event batching | 2000 SOS-da dispetçer donmur
      Priority #1 | Maneəsiz marşrut | Yol maneələri modeli
      7 modul | Dron, edge, partner, əlçatanlıq, könüllü, balans, briqada təklifi | Modul = 1 import + feature flag
      5 AI modulu | Səs, görüntü, proqnoz, çatbot, təchizat | Real açar və ya demo (mock)
      < 300 ms | Fon işləri, keş, Mongo pool | Avtomatik gecikmə testi
   b) "Test və performans": "245 test (120 unit + 125 inteqrasiya) · 500/500 SOS, 0 itki · 1020 socket, dispetçerə çatma p95 16.6 ms · Qırmızı həyəcan p95 28.8 ms · 40 eyni vaxtda sorğu: SOS p95 ≈150 ms, çatbot ≈100 ms · ≤100 req/s-də p95 < 200 ms; daha yuxarı üçün cluster".
   c) "AI — nəzarət altında": "Açar yoxdursa demo məlumat, açıq işarələnir · AI zərər analizi yalnız təklifdir — dispetçer təsdiqləyir, audit, geri qaytarma · Model çağırışları sorğunu gözlətmir · Development: Gemini promptları hazırladı → Claude kodu yazdı → komanda yoxladı".
10) Hər dəyişiklikdən sonra mətnin slayddan kənara çıxmadığını yoxla, lazım olsa şrifti kiçilt. Sonda nə dəyişdiyini siyahı şəklində mənə yaz.
```

> Claude chat-da Canva konnektoru yoxdursa, eyni siyahını özünüz Canva-da tətbiq edin və ya bu promptu Canva-nın öz AI-ına verin.

---

## B. Video çəkilişi

### Hazırlıq (1 dəfə, ~5 dəq)
1. MongoDB işləyir. Üç terminal: `cd backend && npm run dev` · `cd client-citizen && npm run dev` (5173) · `cd client-dispatcher && npm run dev` (5174).
2. Dispetçerə `admin` / `Admin123!` ilə daxil olun (test hesabı, `.env.example`-də).
3. **Simulyasiya → Sıfırla** — təmiz başlanğıc.
4. `demo/split.html` faylını Chrome-da açın (iki dəfə klikləyin). Klavişlər: **1** = yalnız mobil, **2** = yan-yana, **3** = yalnız dispetçer. Yuxarıdakı başlığa səhnənin adını yazmaq olar.
5. Brauzer zoom 100%, ekran 1920×1080, bildirişlər söndürülüb (Windows: Fokus rejimi).
6. Yazı alətləri:
   - **Win+Alt+R** (Xbox Game Bar) — ən sadəsi, aktiv pəncərəni yazır.
   - **OBS Studio** (pulsuz) — Display Capture, 1920×1080, 30 fps, MP4. Mikrofonla səsləndirmə edəcəksinizsə, OBS daha yaxşıdır.

### Çəkiliş qaydaları
- Hər səhnə **25–40 saniyə**; hər klikdən sonra **2–3 saniyə gözləyin** ki, izləyici oxuya bilsin.
- Siçanı yavaş hərəkət etdirin, vacib yerə 1 saniyə saxlayın.
- Yalnız mobil funksiya → **1** (yalnız telefon). Vətəndaş ↔ dispetçer qarşılıqlı işi → **2** (yan-yana). Yalnız dispetçer → **3**.
- Hər səhnəni ayrı fayl kimi çəkin; sonra birləşdirin (Clipchamp — Windows-da hazırdır). Səhv olsa, yalnız o səhnəni təkrar çəkərsiniz.

### Səhnələr (ətraflı ssenari: `docs/DEMO_SCRIPT.md`)

| # | Görünüş | Nə göstərilir |
|---|---|---|
| 1 | Mobil | SOS ana ekranı, dil dəyişmə (az/en/ru), animasiyalar |
| 2 | Yan-yana | Bir toxunuşla SOS → dispetçerin triage növbəsində dərhal görünür |
| 3 | Yan-yana | **Səsli SOS (AI)**: telefonda danışın → nəticə kartı (təhlükə, insan sayı, prioritet) → dispetçerdə "AI analiz" nişanı |
| 4 | Yan-yana | Simulyasiya → "Yasamalda zəlzələ" → 4+ SOS → **qırmızı həyəcan** |
| 5 | Yalnız dispetçer | Həyəcanda **bir neçə briqada** seçib təsdiq (ETA) |
| 6 | Yan-yana | Yol bağlanır / məntəqə dolur → vətəndaşda **avtomatik alternativ marşrut** |
| 7 | Mobil | Təxliyə: rayon çipləri, tövsiyə olunan məntəqə, maneəsiz marşrut |
| 8 | Mobil | **AI köməkçi**: "Ən yaxın məntəqə", "Su" çipləri → mənbələrlə cavab |
| 9 | Mobil | Oflayn rejim (DevTools → Network → Offline) → SOS növbəyə düşür → online olanda göndərilir |
| 10 | Mobil | Əlçatanlıq: Morse səs/işıq siqnalı, yüksək kontrast |
| 11 | Yalnız dispetçer | Xəritə klasterləşməsi (zoom out/in) |
| 12 | Yalnız dispetçer | Toplanış məntəqəsi → **Dron tələbi** (ehtiyac kartları) → Dronlar səhifəsi |
| 13 | Yalnız dispetçer | Süni intellekt → **İzdiham proqnozu** (15/30 dəq, xəbərdarlıq, tövsiyə) |
| 14 | Yalnız dispetçer | Süni intellekt → **Zərər analizi**: dron kəşfiyyatı → nəticələr → **Xəritəyə tətbiq et** → geri qaytar |
| 15 | Yalnız dispetçer | Süni intellekt → **Təchizat planı** → seçilənlər üçün sorğu yarat |
| 16 | Yan-yana | Könüllülər: telefonda qeydiyyat ↔ dispetçerdə çağırış |
| 17 | Yalnız dispetçer | İdarəetmə → Konfiqurasiya (bir funksiyanı söndür → menyudan yox olur) · Rollar · Audit · AI provayderləri (açar paneli) |
| 18 | Yalnız dispetçer | Simulyasiya → Sıfırla (hər şey təmizlənir) |

Ümumi: ~10–13 dəqiqə.

### Claude chat üçün kopyala-yapışdır prompt (video ssenarisi və səsləndirmə)

```
SafeFlow adlı böhran/təxliyə layihəmizin demo videosunu çəkirəm. Ekranı özüm yazacağam (OBS / Win+Alt+R).
Mənə hər səhnə üçün Azərbaycan dilində qısa səsləndirmə mətni (1–3 cümlə, sakit və aydın, 25–40 saniyəyə sığsın) və "nəyə klikləyim" addımlarını yaz.
Səhnələr: [yuxarıdakı 18 səhnəlik cədvəli bura yapışdırın].
Qaydalar: mobil-only səhnələrdə yalnız telefon, qarşılıqlı səhnələrdə yan-yana; hər klikdən sonra 2–3 saniyə pauza; rəqəmləri şişirtmə — test və performans üçün bu faktlardan istifadə et: [yuxarıdakı fakt cədvəlini yapışdırın].
Sonda videonun əvvəli üçün 15 saniyəlik giriş, sonu üçün 10 saniyəlik yekun mətni yaz.
```

> **Claude in Chrome** (brauzer genişlənməsi) qoşuludursa, onu tətbiqi addım-addım idarə etmək üçün də istifadə edə bilərsiniz, amma yazını yenə də siz başladırsınız. Səsləndirmə ilə çəkəcəksinizsə, tətbiqi özünüz idarə etmək daha təbii görünür.
