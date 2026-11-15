# Aİ istifadəsi haqqında bəyannamə

**Layihə:** SafeFlow — Urban Crisis & Crowd Evacuation Engine
**Məqsəd:** Bu sənəd hakaton zamanı süni intellekt (Aİ) alətlərindən harada, necə və hansı nəzarətlə istifadə etdiyimizi açıq şəkildə göstərir.

> Qeyd: Claude ilə bağlı hissələr git tarixçəsinə əsasən yazılıb. **Meta AI** və **Gemini** komanda tərəfindən də istifadə olunub, lakin onların konkret istifadəsini komanda özü doldurmalıdır — aşağıda `[Komanda doldurmalıdır]` ilə işarələnmiş yerlər hələ boşdur.

## 1. İstifadə olunan alətlər

| Alət | Təminatçı | İstifadə forması |
|---|---|---|
| **Claude Code** (model: Claude Opus) | Anthropic | Repozitoriyada işləyən kodlaşdırma agenti (terminal/IDE) |
| **Meta AI** | Meta | [Komanda doldurmalıdır: hansı formada — veb çat, mobil və s.] |
| **Gemini** | Google | [Komanda doldurmalıdır: hansı formada — veb çat, API və s.] |

Bundan əlavə, **məhsulun özü** (runtime-da) istəyə görə Claude API (Anthropic), Whisper (STT) və YOLOv8 (vision) provider-lərini çağıra bilir. Bu, inkişaf alətindən fərqli məsələdir — açarlar verilmədikdə bütün AI funksiyaları deterministik mock məlumatla işləyir və cavablarda `mock: true` ilə işarələnir.

## 2. Mərhələlər üzrə istifadə

| Mərhələ | Claude (Claude Code) | Meta AI | Gemini |
|---|---|---|---|
| Arxitektura seçimi | Komandanın verdiyi tələblər əsasında struktur təklif etdi: Express + MongoDB + Socket.IO, təmiz `engine/` qatı, event bus + rule engine, config-driven RBAC, sonradan feature-modul reyestri və provider qatı. Son qərarı komanda verdi. | [Komanda doldurmalıdır: hansı mərhələdə, nə üçün] | [Komanda doldurmalıdır: hansı mərhələdə, nə üçün] |
| Kod yazılması | Backend (servislər, qaydalar, middleware-lər, modullar) və hər iki frontend (React/Vite) kodunun böyük hissəsini agent kimi yazdı; refaktorlar etdi. Bəzi modullar paralel agentlərlə ayrı git worktree-lərdə yazılıb birləşdirildi. | [Komanda doldurmalıdır: hansı mərhələdə, nə üçün] | [Komanda doldurmalıdır: hansı mərhələdə, nə üçün] |
| Testlər | Unit testlər (`node --test`), inteqrasiya testləri (API + WebSocket + MongoDB), Artillery yük/stress ssenariləri, realtime və SOS bütövlüyü skriptləri, hesabat generatoru. | [Komanda doldurmalıdır: hansı mərhələdə, nə üçün] | [Komanda doldurmalıdır: hansı mərhələdə, nə üçün] |
| Challenge Drop həlləri | Hər yeni tələb paketində (spesifikasiya paketi, dispetçer performansı, Priority #1 + maneəsiz marşrut, 7 feature modul, UX düzəlişləri, 5 AI modulu) dəyişiklik planı və implementasiya. | [Komanda doldurmalıdır: hansı mərhələdə, nə üçün] | [Komanda doldurmalıdır: hansı mərhələdə, nə üçün] |
| UI / dizayn | Komandanın təsvirinə görə komponentlərin implementasiyası: vətəndaş tətbiqinin mobil redizaynı, custom Select/Confirm, admin bölməsinin kateqoriyalaşdırılması, WCAG 2.1 AA düzəlişləri. | [Komanda doldurmalıdır: hansı mərhələdə, nə üçün] | [Komanda doldurmalıdır: hansı mərhələdə, nə üçün] |
| Sənədləşdirmə | README, bu bəyannamə, texniki izah (`docs/Texniki_izah.docx`), demo ssenarisi və `demo/split.html` qaralamaları. Komanda yoxlayıb redaktə edir. | [Komanda doldurmalıdır: hansı mərhələdə, nə üçün] | [Komanda doldurmalıdır: hansı mərhələdə, nə üçün] |
| Debugging / performans | SOS seli altında dispetçerin donmasının profillənməsi və düzəldilməsi (event batching, xəritə klasterləşməsi), simulyasiya reset xətasının düzəldilməsi, Mongo pool / keşlər / koalesləşdirilmiş qayda qiymətləndirməsi ilə gecikmənin azaldılması. | [Komanda doldurmalıdır: hansı mərhələdə, nə üçün] | [Komanda doldurmalıdır: hansı mərhələdə, nə üçün] |

## 3. Claude ilə iş prosesi

1. Komanda tələbi (məsələn, yeni Challenge Drop mətni) Claude Code-a verirdi və prioritetləri müəyyən edirdi.
2. Claude repozitoriyanı oxuyur, plan təklif edir, kodu yazır və testləri işə salırdı.
3. Komanda nəticəni nəzərdən keçirir, brauzerdə əl ilə yoxlayır, düzəliş tələb edir və ya istiqaməti dəyişirdi.
4. Hər tamamlanmış hissə ayrıca commit kimi saxlanılırdı (git tarixçəsində izlənə bilir).

Claude-un yazdığı heç bir hissə yoxlanılmadan "son nəticə" sayılmayıb; məsuliyyət komandaya aiddir.

## 4. Meta AI

- **Hansı mərhələdə:** [Komanda doldurmalıdır]
- **Nə üçün:** [Komanda doldurmalıdır]
- **Nəticə necə yoxlanıldı:** [Komanda doldurmalıdır]

## 5. Gemini

- **Hansı mərhələdə:** [Komanda doldurmalıdır]
- **Nə üçün:** [Komanda doldurmalıdır]
- **Nəticə necə yoxlanıldı:** [Komanda doldurmalıdır]

## 6. Nəzarət və yoxlama

- **İnsan nəzarəti:** hər dəyişiklik komanda tərəfindən oxunub, işə salınıb və brauzerdə (vətəndaş PWA + dispetçer paneli) yoxlanılıb.
- **Avtomatik testlər:** 120 unit test və 125 inteqrasiya testi (7 fayl) (API + WebSocket + MongoDB); Artillery ilə yük/stress testləri, 1000+ socket realtime testi, spam selində SOS bütövlüyü testi (`backend/tests/load/reports/REPORT.md`).
- **Linting:** ESLint (o cümlədən `jsx-a11y` əlçatanlıq qaydaları) və Prettier.
- **Məhsul daxilində AI nəzarəti (human-in-the-loop):** dron zərər analizi defolt olaraq avtomatik tətbiq olunmur (`ai.vision.autoApply=false`) — AI nəticəsi təklifdir, dispetçer onu "Xəritəyə tətbiq et" ilə təsdiqləyir (`POST /api/ai/damage/:id/approve`, audit log-a yazılır) və geri qaytara (revert) bilər.
- **Sirlər:** heç bir real API açarı və ya parol repozitoriyaya commit olunmayıb; yalnız `.env.example` placeholder dəyərlərlə saxlanılır. Test hesabları yalnız dev/test üçündür.
- **Mock məlumatın işarələnməsi:** AI provider-ləri olmadıqda bütün AI cavabları `mock: true` ilə qaytarılır və UI-da mock kimi göstərilir; simulyasiya olunmuş şəhər (sintetik yol şəbəkəsi) README-də açıq qeyd olunub.

## 7. Məhdudiyyətlər

- Aİ tərəfindən yaradılan kod səhvlər və ya nəzərdən qaçmış kənar hallar ehtiva edə bilər; testlər bütün mümkün ssenariləri əhatə etmir.
- Yük testləri bir developer maşınında aparılıb; real istehsal mühitində nəticələr fərqli olacaq.
- Demo-dakı AI nəticələri (səs tanıma, zərər analizi, proqnoz, çatbot, təchizat planı) açar verilmədikdə mock-dur və real modelin keyfiyyətini əks etdirmir.
- Yol şəbəkəsi real Bakı koordinatları üzərində sintetik qrafdır, real küçə xəritəsi deyil.
- Meta AI və Gemini istifadəsi bu sənəddə hələ komanda tərəfindən doldurulmayıb.
