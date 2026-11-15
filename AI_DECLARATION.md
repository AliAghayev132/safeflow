# Aİ istifadəsi haqqında bəyannamə

**Layihə:** SafeFlow — Urban Crisis & Crowd Evacuation Engine
**Məqsəd:** Bu sənəd hakaton zamanı süni intellekt (Aİ) alətlərindən harada, necə və hansı insan nəzarəti ilə istifadə etdiyimizi açıq şəkildə göstərir.

## 1. İstifadə olunan alətlər

| Alət | Təminatçı | Rolu | İstifadə forması |
|---|---|---|---|
| **Gemini** | Google | Prompt / tələb mühəndisliyi | Veb çat — komandanın fikirlərini və Challenge Drop mətnlərini strukturlaşdırılmış, detallı tapşırıqlara (prompt) çevirmək |
| **Claude** (Claude Code, model: Claude Opus) | Anthropic | İcraçı kodlaşdırma agenti | Repozitoriyada işləyən agent — plan, kod, test, debugging, sənədləşdirmə |

**İş axını bir cümlədə:** komanda ideyanı yazır → **Gemini** onu dəqiq, ölçülə bilən tələblərə (prompt) çevirir → komanda promptu yoxlayıb **Claude**-a göndərir → Claude implementasiya edir və test edir → komanda nəticəni brauzerdə və testlərlə yoxlayır, lazım olsa düzəliş tələb edir.

> **Məhsulun özündə Aİ** (runtime) inkişaf alətlərindən ayrı məsələdir: SafeFlow istəyə görə Gemini, Claude API, Whisper (STT) və YOLOv8 (vision) provider-lərini çağıra bilir. Açarlar dispetçer panelində (İdarəetmə → AI provayderləri) şifrəli saxlanılır; açar verilmədikdə bütün AI funksiyaları deterministik demo (mock) məlumatla işləyir və cavablarda `mock: true` / "demo məlumat" kimi işarələnir.

## 2. İş prosesi (Gemini → Claude)

1. **Fikir / tələb (komanda).** Komanda hakatonun problem mətnini və hər yeni Challenge Drop-u oxuyub öz sözləri ilə (əsasən Azərbaycan dilində) nə istədiyini yazırdı.
2. **Promptun hazırlanması (Gemini).** Bu qaralama Gemini-yə verilirdi; Gemini onu strukturlaşdırılmış, detallı tapşırığa çevirirdi: funksional tələblər, qəbul meyarları, texniki şərtlər (RBAC, rate limiting, audit, i18n az/ru/en, feature flag, unit + inteqrasiya testləri), performans hədləri.
3. **Yoxlama (komanda).** Komanda Gemini-nin hazırladığı promptu oxuyur, layihəyə aid olmayan və ya yanlış hissələri silir/düzəldirdi.
4. **İcra (Claude).** Prompt Claude Code-a göndərilirdi. Claude repozitoriyanı oxuyur, plan qurur, kodu yazır, testləri işə salır və hər tamamlanmış hissəni ayrıca commit kimi saxlayırdı (git tarixçəsində izlənə bilir).
5. **Qəbul (komanda).** Komanda nəticəni brauzerdə (vətəndaş tətbiqi + dispetçer paneli) yoxlayır; problem görəndə yeni, qısa düzəliş promptu yazırdı (bəzən birbaşa Claude-a, bəzən yenidən Gemini vasitəsilə).

## 3. Mərhələlər üzrə istifadə

| Mərhələ | Gemini | Claude (Claude Code) | Komandanın rolu |
|---|---|---|---|
| Problemin analizi | Problem mətnini və modul təsvirlərini strukturlaşdırılmış tələb siyahısına çevirdi | Tələbləri oxuyub sistem dizaynı təklif etdi | Prioritetləri və əhatəni müəyyən etdi |
| Arxitektura seçimi | Texniki şərtləri (offline rejim, REST/WebSocket replay, idempotent SOS, sliding-window klaster, RBAC, fallback marşrut) prompt şəklində formalaşdırdı | Express + MongoDB + Socket.IO, təmiz `engine/` qatı, event bus + rule engine, config-driven RBAC, feature-modul reyestri, AI provider qatı | Stack-i (React + Redux, Express + MongoDB) və qovluq strukturunu (öz template repo-su) özü təyin etdi; son qərarı verdi |
| Kod yazılması | — | Backend (servislər, qaydalar, middleware-lər, modullar) və hər iki frontend kodunun böyük hissəsi; bəzi modullar paralel agentlərlə ayrı git worktree-lərdə yazılıb birləşdirildi | Kodu nəzərdən keçirdi, işə saldı, düzəliş tələb etdi |
| Challenge Drop həlləri | Hər yeni drop-u (7 əlavə modul, 5 AI modulu, <300 ms tələbi və s.) RBAC, rate limit, audit, i18n, test, feature flag tələbləri ilə detallı prompta çevirdi | Hər drop üçün dəyişiklik planı və implementasiya | Drop-ları oxudu, promptları yoxladı, nəticəni qəbul etdi |
| Testlər | Test tələblərini (unit, inteqrasiya, yük, stress) promptda dəqiqləşdirdi | Unit testlər (`node --test`), inteqrasiya testləri (API + WebSocket + MongoDB), Artillery yük/stress ssenariləri, gecikmə testi | Testlərin keçdiyini yoxladı |
| UI / dizayn | Dizayn istəklərini (solid rənglər, 3D ikonlar, mobil-first) prompta çevirdi | Komponentlərin implementasiyası, mobil redizayn, animasiyalar, WCAG 2.1 AA düzəlişləri | Referans dizayn (Figma, nümunə ekran şəkli) verdi, nəticəni vizual yoxladı |
| Debugging / performans | — | Dispetçerdə SOS selində donmanın profillənməsi (event batching, xəritə klasterləşməsi), reset xətası, Mongo pool, gecikmə ölçmələri | Problemləri özü tapıb bildirdi (aşağıda nümunələr) |
| Sənədləşdirmə | Təhvil verilməli materialların siyahısını və məzmun tələblərini formalaşdırdı | README, bu bəyannamə, texniki izah (`docs/Texniki_izah.docx`) qaralamaları | Yoxladı və redaktə etdi |

## 4. İnsan nəzarətinin konkret nümunələri

Aşağıdakılar Claude-un ilk nəticəsini komandanın yoxlayıb **dəyişdirdiyi** hallardır:

- **Dizayn:** "Gradient olmasın, solid rənglər olsun" — bütün UI yalnız solid rənglərə keçirildi; sonradan SOS düyməsindəki bulanıq kölgə də "gradient kimi görünür" deyə silindi.
- **Performans:** komanda dispetçer panelində çoxlu SOS zamanı donma olduğunu gördü → profilləmə, event batching və xəritə klasterləşməsi edildi.
- **Xəta:** komanda "ssenarini sıfırlayanda silinmə olmur" xətasını tapdı → hər modul üçün gözlənilən reset hook-u və dispetçer store-unun təmizlənməsi əlavə edildi, test yazıldı.
- **UX:** native `<select>` və `alert/confirm` dialoqlarının dizayna uyğun olmadığı bildirildi → custom Select və Confirm komponentləri yazıldı; admin bölməsinin qarışıq olduğu bildirildi → kateqoriyalara bölündü.
- **Funksionallıq:** bir hadisəyə bir neçə briqada göndərmək, toplanış məntəqəsinə ehtiyaclara görə dron sorğusu — komandanın tələbi ilə əlavə edildi.
- **AI nəzarəti:** öz qiymətləndirməmizdə dron zərər analizinin yolları insan təsdiqi olmadan bağladığı aşkarlandı → defolt davranış dəyişdirildi: AI nəticəsi yalnız **təklifdir**, dispetçer "Xəritəyə tətbiq et" ilə təsdiqləyir, audit log-a yazılır, geri qaytarıla bilir.
- **Performans tələbi:** "kütləvi sorğularda 300 ms altında" tələbi verildi → AI modulları yavaş model çağırışlarını sorğu yolundan çıxaracaq şəkildə qurulub (fon işləri, keş), gecikmə ölçülüb və avtomatik testə əlavə edilib; ölçmə nəticələri (o cümlədən hədəfin pozulduğu yük səviyyələri) README-də dürüst göstərilib.

## 5. Nəzarət və yoxlama

- **İnsan nəzarəti:** hər dəyişiklik komanda tərəfindən oxunub, işə salınıb və brauzerdə (vətəndaş PWA + dispetçer paneli) yoxlanılıb.
- **Avtomatik testlər:** 120 unit test və 137 inteqrasiya testi (8 fayl: API + WebSocket + MongoDB, o cümlədən 3 rəsmi Challenge Drop üçün ayrıca test faylı); Artillery ilə yük/stress testləri, 1000+ socket realtime testi, spam selində SOS bütövlüyü testi (`backend/tests/load/reports/REPORT.md`).
- **Linting:** ESLint (o cümlədən `jsx-a11y` əlçatanlıq qaydaları) və Prettier.
- **Məhsul daxilində AI nəzarəti (human-in-the-loop):** zərər analizi təsdiqsiz tətbiq olunmur (`ai.vision.autoApply=false`); bütün AI əməliyyatları audit log-a yazılır; çatbot sualın mətnini saxlamır (yalnız mövzusunu); AI cavabları yalnız canlı məlumat bazasındakı faktlara əsaslanır.
- **Sirlər:** heç bir real API açarı repozitoriyaya commit olunmayıb; panel vasitəsilə daxil edilən açarlar AES-256-GCM ilə şifrələnir, brauzerə yalnız son 4 simvol qaytarılır.
- **Mock məlumatın işarələnməsi:** provider olmadıqda AI cavabları `mock: true` ilə qaytarılır və UI-da "demo məlumat" kimi göstərilir.
- **İzlənə bilmə:** bütün iş git tarixçəsində mərhələ-mərhələ commit-lərlə saxlanılıb.

## 6. Məhdudiyyətlər

- Aİ tərəfindən yaradılan kod səhvlər və ya nəzərdən qaçmış kənar hallar ehtiva edə bilər; testlər bütün mümkün ssenariləri əhatə etmir.
- Gemini-nin hazırladığı promptlar bəzən layihəyə aid olmayan və ya həddindən artıq geniş tələblər ehtiva edirdi; onları komanda süzgəcdən keçirdi.
- Yük testləri bir developer maşınında aparılıb; real istehsal mühitində nəticələr fərqli olacaq.
- Demo-dakı AI nəticələri (səs tanıma, zərər analizi, proqnoz, çatbot, təchizat planı) açar verilmədikdə mock-dur və real modelin keyfiyyətini əks etdirmir. Gemini provider-i real açarla sınaqdan keçirilməyib.
- Yol şəbəkəsi real Bakı koordinatları üzərində sintetik qrafdır, real küçə xəritəsi deyil.
