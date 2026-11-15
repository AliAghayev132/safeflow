# Urban Crisis & Crowd Evacuation Engine

Zəlzələ, sel, sənaye qəzası və kütləvi tədbirlər zamanı vətəndaşları ən yaxın təhlükəsiz toplanış
məntəqəsinə yönləndirən və dispetçerə SOS axınını real vaxtda idarə etməyə imkan verən sistem.

```
Core Project/
├── backend/             # Express 5 + MongoDB (Mongoose) + Socket.IO — ortaq server
├── client-citizen/      # Modul 1 — Vətəndaş tətbiqi (React, mobile-first, :5173)
└── client-dispatcher/   # Modul 2 — Dispetçer paneli (React, dashboard, :5174)
```

Struktur `AliAghayev132/template` şablonunu izləyir:

- Serverdə `#` subpath aliasları (`package.json → imports`) istifadə olunur.
- Clientlərdə `@` aliasları istifadə olunur (`vite.config.js` və `jsconfig.json`, hər ikisi sinxron saxlanılır).
- Hər qovluğun `index.js` barrel faylı var.
- Bütün xarici modullar `lib/` qovluğundan import olunur.

## İşə salma

Tələblər: Node 20+ və lokal MongoDB (`mongodb://localhost:27017`).

```bash
cd backend && npm install && npm run dev
```

```bash
cd client-citizen && npm install && npm run dev
```

```bash
cd client-dispatcher && npm install && npm run dev
```

İlk açılışda backend iki şeyi avtomatik yaradır:
- simulyasiya şəhərini: 6 rayon, 88 kəsişmə, 157 yol seqmenti, 17 məntəqə (5-i ehtiyat), 9 briqada;
- dispetçer hesabını: `.env` faylındakı `DEFAULT_OPERATOR_*` dəyərləri ilə.

Hamısını sıfırlamaq üçün:

```bash
cd backend && npm run seed
```

## Arxitektura (backend)

Sistem hadisə əsaslıdır. Hər dəyişiklik `EventBus` vasitəsilə domain event kimi yayılır:

```
Servis (SOS, Shelter, Road, Brigade, Alert)
   │ publish(domainEvent)
   ▼
EventBus ──► RuleEngine ──► rules/*.rule.js     (kritik böhran qaydaları)
   │
   └──────► RealtimeService ──► Socket.IO otaqları (dispatchers / citizens / citizen:<deviceId>)
```

| Qayda | Tetikləyici | Nəticə |
| --- | --- | --- |
| `sos-cluster` | `sos.created` | Eyni zonada **və ya** 500 m radiusda, 5 dəqiqə ərzində ≥4 **fərqli** cihazdan SOS gələrsə, qırmızı həyəcan yaranır. Həyəcan iki tövsiyə daşıyır: əlavə briqada göndərmək və yeni məntəqə açmaq. |
| `shelter-overload` | `shelter.updated` | Doluluq >95% olarsa, qırmızı həyəcan yaranır (eyni tövsiyələrlə). |
| `citizen-reroute` | `road.updated`, `shelter.updated`, `shelter.activated` | Yol bağlananda, məntəqə ≥90% dolanda və ya yeni məntəqə açılanda vətəndaşa avtomatik alternativ marşrut göndərilir. |

- Bütün həddlər `config/config.js → crisis` bölməsindədir və `.env` ilə dəyişdirilə bilər.
- Hər qayda öz növbəsində ardıcıl icra olunur, ona görə SOS dalğası zamanı dublikat həyəcan yaranmır.
- Yeni qayda əlavə etmək üçün `rules/` qovluğunda `<ad>.rule.js` faylı yaradın və onu `rules/index.js`-ə əlavə edin.

Marşrutlaşdırma `RoutingService` ilə aparılır. O, yol qrafını yaddaşda saxlayır və Dijkstra alqoritmini işlədir:
- bağlı yollar keçilmir;
- tıxac yolun "çəkisini" artırır.

Bu servis xarici marşrut API-si (OSRM / OpenRouteService) üçün tək dəyişdirmə nöqtəsidir. Yol şəbəkəsi Bakı koordinatları üzərində **sintetik qəfəsdir**, real küçə xəritəsi deyil.

### API xülasəsi

| Modul | Endpoint |
| --- | --- |
| Vətəndaş | `GET /api/citizen/zones`, `GET /api/citizen/shelters`, `GET /api/citizen/evacuation?lat&lng\|zone&deviceId`, `GET /api/citizen/state`, `POST /api/citizen/sos`, `PATCH /api/citizen/status`, `POST /api/citizen/checkin` |
| Yol/nəqliyyat | `GET /api/roads`, `GET /api/roads/traffic` |
| Auth | `POST /api/auth/login`, `GET /api/auth/me` |
| Dispetçer | `GET /api/dispatcher/overview`, `GET /api/dispatcher/rules`, `GET /api/dispatcher/alerts`, `POST /api/dispatcher/alerts/:id/approve\|reject\|resolve`, `PATCH /api/dispatcher/brigades/:id/status`, `PATCH /api/dispatcher/sos/:id/status`, `PATCH /api/dispatcher/shelters/:id` |
| Simulyasiya | `POST /api/simulation/roads/random-close`, `/roads/:edgeId/close\|open`, `/traffic`, `/shelters/:id/occupancy`, `/sos-wave`, `/reset` |

### Socket hadisələri

`sos:new`, `sos:updated`, `shelter:updated`, `road:updated`, `brigade:updated`, `alert:new`,
`alert:updated`, `route:updated` (yalnız həmin vətəndaşa göndərilir), `stats:updated`, `system:reset`.

## Dizayn

- Yalnız solid rənglər istifadə olunur, gradient yoxdur.
- Rəng tokenləri Tailwind v4 `@theme` ilə `App.css` faylında təyin olunub.
- 3D ikonlar: Microsoft Fluent Emoji 3D (MIT lisenziyası). Ikonlar `src/assets/icons3d/` qovluğundadır və `Icon3D` komponenti ilə göstərilir.
