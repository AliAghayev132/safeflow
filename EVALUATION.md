# SafeFlow — Hakaton qiymətləndirməsi

Tarix: 15.11.2026 · Komanda: Core (23) · Baxılanlar: kod (`backend/`, `client-citizen/`, `client-dispatcher/`, `edge/`), `git log` (26 commit), testlər, `REPORT.md`, Canva təqdimatı (11 slayd).

> Yoxlama: `npm run test:unit` yerli olaraq işə salındı, nəticə **119/119 keçdi** (~2 s). İnteqrasiya testləri (125) MongoDB tələb etdiyi üçün bu yoxlamada işə salınmadı.

## 1. Ballar

| # | Meyar | Bal (1–10) |
|---|---|---|
| 1 | Əsas funksionallığın düzgünlüyü | **8** |
| 2 | Əlavə texniki şərtlərə uyğunlaşma | **8** |
| 3 | Arxitektura və kod keyfiyyəti | **8** |
| 4 | Test etibarlılığı və dayanıqlılıq | **7** |
| 5 | Aİ alətlərindən nəzarətli istifadə | **7** |
| | **Orta** | **7.6** |
| | Təqdimat (ayrıca) | **5.5** |

## 2. Hər meyar üzrə qeydlər

### 1) Əsas funksionallıq — 8
- Bütün əsas axın var: bir toxunuşla SOS, toplanış məntəqəsinin doluluğu, marşrut, dispetçer üçün prioritet növbəsi, qırmızı həyəcan (4 SOS / 5 dəq / 500 m, 90% / 95%) və bir kliklə qərar.
- Kənar hallar düşünülüb: `clientId` ilə idempotentlik, spam bloklanmır, sadəcə işarələnir, "Təhlükəsizəm" statusu klasterdən çıxarılır, marşrut üçün OSRM → Dijkstra → düz xətt fallback zənciri qurulub (cavabda `approximate: true` qaytarılır).
- Simulyator (Yasamal zəlzələsi, Səbail seli) demonu etibarlı edir.
- Zəif tərəf: yol şəbəkəsi real Bakı koordinatları üzərində sintetik qəfəsdir. Bunu açıq demək lazımdır.
- **Təkmilləşdirmə:** demo ssenarisində "4-cü SOS → qırmızı həyəcan (~18 ms)" anını canlı göstərin. Sintetik yol şəbəkəsini slaydda məhdudiyyət kimi qeyd edin.

### 2) Əlavə texniki şərtlərə uyğunlaşma — 8
- Yeni tələblər ayrıca modullar kimi gəlib: `partner` (OAuth2, mTLS, webhook), `volunteers`, `accessibility` (Morse, WCAG 2.1 AA), `drones`, `edge` (oflayn lokal şəbəkə), `ai`. Hər biri runtime feature flag ilə idarə olunur.
- `modules/index.js` müqaviləsi bunu təmin edir: yeni modul = bir import sətri. Qaydalar `config/defaults` + MongoDB-dədir və restart olmadan dəyişir. Yeni rol `rbac.json`-da bir sətirdir.
- Commit tarixi uyğunlaşmanı addım-addım göstərir. Reset hook-u, çoxbriqadalı dispatch kimi düzəlişlər də var.
- **Təkmilləşdirmə:** "challenge drop → hansı modul / flag / test" cədvəlini README-yə və təqdimata əlavə edin. Hazırda bu əlaqə heç yerdə yazılmayıb.

### 3) Arxitektura və kod keyfiyyəti — 8
- Qatlar təmiz ayrılıb: Controller → Service → EventBus → RuleEngine / Realtime. `engine/` I/O-suz, saf məntiqdir və unit testlərlə örtülüb.
- RBAC permission əsaslıdır, rol adına bağlı deyil, həm REST, həm WS-də tətbiq olunur. Realtime `seq` + `sync` + polling fallback ilə qurulub, audit jurnalı append-only-dir.
- Konvensiyalar sabitdir: `#` / `@` alias-lar, barrel faylları, `lib/` vasitəsilə import, ESLint (jsx-a11y daxil).
- Zəif tərəflər: README AI / drone / edge modullarını təsvir etmir. Monorepo-da CI yoxdur (`.github` yoxdur). Agent worktree merge-ləri tarixdə "Merge branch 'worktree-agent-…'" kimi görünür.
- **Təkmilləşdirmə:** README-yə modul xəritəsi və arxitektura diaqramı (AI provider qatı daxil) əlavə edin.

### 4) Test etibarlılığı və dayanıqlılıq — 7
- Test bazası güclüdür: 119 unit test (sərhəd halları: 499/501 m, 4:59/5:01, 89/90%), 125 inteqrasiya testi (7 fayl, RBAC, 429, replay), Artillery yük və stress testləri, 1020 socket və SOS integrity testi.
- Etibarlılıq nəticələri yaxşıdır. Spam selində 500 real SOS-dan **0 itki, 0 dublikat**. Fan-out p95 **16.6 ms**, həyəcanın yaranması p95 **28.8 ms**.
- **Problem:** ümumi yük testində p95 **1653 ms**, p99 2231 ms-dir, yəni **p95 < 300 ms hədəfi keçilmir**. Hədəf yalnız ~100 req/s-ə qədər tutulur (8-ci pəncərəyə qədər p95 ≤ 198 ms). Stress testində sınma nöqtəsi ~145 req/s-dir. Ölçmə Windows dev maşınında, iki Vite server ilə eyni hostda aparılıb.
- README-də test sayları köhnədir: "35 / 29" yazılıb, faktiki say 119 / 125-dir. CI yoxdur.
- **Təkmilləşdirmə:** README-dəki sayları düzəldin. Yük nəticəsini dürüst izah edin: "≤100 req/s-də p95 < 200 ms; ondan yuxarıda tək Node prosesi darboğaz olur, həll yolu cluster / PM2 + indekslərdir".

### 5) Aİ alətlərindən nəzarətli istifadə — 7
- Provider qatı düzgün qurulub: `auto | anthropic | local | mock`. Açar yoxdursa, deterministik mock işləyir və cavabda `mock: true` + `fallbackReason` qaytarılır. Səsli SOS-da əvvəl qayda əsaslı "fast" mərhələ, sonra AI ilə "enriched" mərhələ gəlir, ona görə AI olmadan da işləyir.
- İnsan nəzarəti qismən var: təchizat planında hər drone göndərişini dispetçer təsdiqləyir, həyəcanlar operator qərarı ilə bağlanır.
- **Risk:** `vision.autoApply: true` (confidence ≥ 0.6) olduqda dron şəkli əsasında yollar **insan təsdiqi olmadan** bağlanır. `voice.autoSend: true` də eyni məntiqlə işləyir. "Nəzarətli istifadə" meyarı üçün bu, ən zəif nöqtədir.
- İnkişafda AI istifadəsi haqqında bəyannamə yoxdur: README-də "hansı hissəni AI yazdı, necə yoxladıq" bölməsi yazılmayıb. Commit tarixi agent worktree-lərini göstərir, yəni AI geniş istifadə olunub, amma bu açıq deyilmir.
- **Təkmilləşdirmə:** `autoApply` default dəyərini `false` edin, yəni dispetçer təsdiq növbəsi. Və ya ən azı təqdimatda "eşik + audit + bir kliklə geri qaytarma" mexanizmini göstərin. Qısa "AI Declaration" əlavə edin: alətlər, rol bölgüsü, yoxlama (testlər, code review).

## 3. Təqdimatın qiymətləndirilməsi (Canva, 11 slayd)

**Ümumi:** problem və həll aydın və emosionaldır ("Hər dəqiqə bir həyatdır"). Amma deck **ilkin MVP səviyyəsində qalıb**. Ondan sonra görülən işin çoxu (6 modul, 244 test, yük nəticələri, AI qatı) slaydlarda görünmür. Ən ciddi ziddiyyət budur: 9-cu slayd "süni intellektlə izdiham proqnozu" funksiyasını **"Gələcək"** kimi göstərir, halbuki bu artıq kodda var (`ai/forecast`, Holt modeli).

| Meyar | Deck-də necə göstərilib | Nə çatışmır |
|---|---|---|
| 1. Funksionallıq | Yaxşı göstərilib (slayd 4–6) | Ekran görüntüləri, canlı demo linki (slayd 10-da "url" placeholder qalıb) |
| 2. Challenge drop-lar | Göstərilməyib | Volunteers, drones, edge, partner API, a11y, AI: heç biri yoxdur |
| 3. Arxitektura | Bir cümlə (slayd 9) | Diaqram, modul və feature flag konsepsiyası, RBAC |
| 4. Testlər | "Sistem dayanmamalıdır" kimi ümumi ifadə | 119 / 125 test, 0 itki, 1020 socket, p95 rəqəmləri |
| 5. AI | Yalnız "gələcək" kimi | AI modulları, mock / real provider, insan nəzarəti, development zamanı AI bəyannaməsi |

### Slayd-slayd düzəlişlər
1. **Başlıq:** yaxşıdır. Altına bir cümlə əlavə edin: "6 modul · 244 test · 0 itirilmiş SOS".
2. **Problem:** saxlayın.
3. **Mövcud həllər:** saxlayın, 2-ci slaydla birləşdirmək olar.
4. **Həll (2 modul):** "+ admin, partner API, edge node" sətrini əlavə edin.
5. **Vətəndaş:** səsli SOS, Morse / əlçatanlıq və AI çatbotu əlavə edin, bir ekran görüntüsü qoyun.
6. **Dispetçer:** həyəcan ekranının görüntüsünü, briqada təklifini (ETA) və çoxbriqadalı dispatch-i əlavə edin.
7. **Ağıllı paylanma:** Holt proqnozunu burada "artıq işləyir" kimi göstərin.
8. **Təhlükəsizlik:** rəqəmləri əlavə edin: spam selində 500/500 SOS qəbul olunub, 0 dublikat, 429 + Retry-After, audit.
9. **Arxitektura:** "Gələcək: AI" ifadəsini **silin**. Əvəzinə diaqram qoyun (EventBus → RuleEngine → modullar, feature flag-lar, RBAC) və challenge drop → modul cədvəlini əlavə edin.
10. **Demo:** "url" placeholder-ini real link və ya QR ilə əvəz edin. Ssenarini 3 addımla yazın.
11. **Təşəkkür:** GitHub linki və QR əlavə edin.
- **Yeni slaydlar:** (a) "Test və performans" — sayılar, fan-out 16.6 ms, həyəcan 28.8 ms, ≤100 req/s-də p95 < 200 ms, sınma nöqtəsi və növbəti addım. (b) "AI — nəzarət altında" — provider zənciri, `mock: true` işarəsi, insan təsdiqi, development-də AI istifadəsinin bəyanı.

### Qısa pitch üçün tövsiyə olunan sıra (~5 dəq)
1. Başlıq + bir cümləlik dəyər → 2. Problem → 3. Həll (vətəndaş + dispetçer, ekran görüntüləri ilə) → 4. **Canlı demo** (zəlzələ: SOS → klaster → qırmızı həyəcan → bir klik → marşrut yenilənir) → 5. Ağıllı paylanma + proqnoz → 6. Arxitektura + challenge drop cədvəli → 7. Test və performans → 8. AI nəzarət altında → 9. Təhlükəsizlik → 10. Təşəkkür + link.

## 4. Son 10 dəqiqədə nə edək (prioritet sırası ilə)

1. **Slayd 9:** "Gələcək: süni intellektlə izdiham proqnozu" ifadəsini silin, əvəzinə "AI modulları işləyir: səsli SOS, dron zərər qiymətləndirməsi, proqnoz, RAG çatbot" yazın. (2 dəq)
2. **Slayd 10:** "url" placeholder-ini real demo linki ilə əvəz edin. Demonu bir dəfə yoxlayın: backend, Mongo və iki client ayaqdadır. (2 dəq)
3. **"Test və performans" slaydı əlavə edin:** 119 unit / 125 inteqrasiya testi, 500/500 SOS və 0 itki, 1020 socket, həyəcan p95 28.8 ms. p95 < 300 ms barədə dürüst olun: "≤100 req/s-də tutulur". (2 dəq)
4. **Challenge drop → modul cədvəli** (bir slayd): partner, volunteers, a11y, drones, edge, ai; hər birinin feature flag-ı var. (2 dəq)
5. **"AI nəzarət altında" bəndi:** auto / mock fallback, `mock: true` işarəsi, dispetçer təsdiqi, development-də AI istifadəsinin bəyanı. `vision.autoApply` sualı gələrsə, cavab hazır olsun: "eşik 0.6, audit, admin paneldən söndürülür". (1 dəq)
6. README-də test saylarını (35/29 → 119/125) düzəltmək 30 saniyəlik işdir. Kodu dəyişmək qadağan deyilsə, bunu da edin. (0.5 dəq)
