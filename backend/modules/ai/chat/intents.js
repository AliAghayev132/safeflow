/**
 * Intent detection + grounded template answers for the citizen assistant
 * (pure). Used as the instant answer and as the mock when no LLM is
 * configured. Every fact comes from the retrieved live context — nothing
 * is invented.
 */
const N = (s) =>
  String(s ?? "")
    .toLowerCase()
    .replace(/ə/g, "e")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g");

const INTENTS = {
  sos: ["sos", "komek", "imdad", "help me", "trapped", "dying", "помог", "спаси"],
  water: ["su ", "su?", "icmeli", "susuz", "water", "drink", "вода", "воды", "пить"],
  medical: ["hekim", "tibbi", "derman", "yarali", "xeste", "doctor", "medic", "hospital", "injur", "врач", "медиц", "больниц", "аптек"],
  food: ["yemek", "qida", "acam", "food", "eat", "hungry", "еда", "поесть", "голод"],
  route: ["yol", "marsrut", "nece gedim", "hara gedim", "route", "how do i get", "way to", "дорог", "маршрут", "как добраться"],
  shelter: ["siginacaq", "menteqe", "toplanis", "tehlukesiz yer", "shelter", "safe place", "assembly", "укрыт", "пункт сбора", "убежищ"],
  earthquake: ["zelzele", "earthquake", "землетряс"],
  fire: ["yangin", "tustu", "fire", "smoke", "пожар", "дым"],
  flood: ["sel", "daskin", "su basir", "flood", "наводн", "затоп"],
};

export const detectIntents = (text) => {
  const t = ` ${N(text)} `;
  const found = Object.entries(INTENTS)
    .filter(([, words]) => words.some((w) => t.includes(w)))
    .map(([k]) => k);
  return found.length ? found : ["shelter"];
};

const L = {
  az: {
    calm: "Sakit olun — kömək mövcuddur.",
    sos: "Həyatınız təhlükədədirsə, dərhal ana ekrandakı qırmızı SOS düyməsinə toxunun və ya 112-yə zəng edin.",
    shelter: (s) => `Ən yaxın açıq toplanış məntəqəsi: ${s.name} (${s.distance}, piyada ~${s.walkMin} dəq). Doluluq ${s.pct}%${s.full ? " — demək olar doludur, alternativə baxın" : ""}.`,
    alt: (s) => `Alternativ: ${s.name} (${s.distance}, ${s.pct}% dolu).`,
    route: "Marşrut üçün «Təxliyə» bölməsini açın — yol bağlıdırsa, sistem avtomatik alternativ verir.",
    closed: (n) => `Yaxınlığınızda ${n} yol seqmenti bağlıdır; təxliyə marşrutu bunları nəzərə alır.`,
    water: (s) => `İçməli su paylanma nöqtəsi: ${s.name} (${s.distance})${s.delivered ? " — bu gün dronla su çatdırılıb" : ""}.`,
    medical: (s) => `Tibbi yardım məntəqəsi: ${s.name} (${s.distance}).`,
    noMedical: "Yaxınlıqda tibbi məntəqə tapılmadı — ağır vəziyyətdə SOS göndərin.",
    food: (s) => `Qida payları toplanış məntəqələrində verilir. Ən yaxını: ${s.name} (${s.distance}).`,
    alert: (n) => `Diqqət: rayonunuzda ${n} aktiv həyəcan var — dispetçerlər vəziyyəti izləyir.`,
    earthquake: "Zəlzələdə: çök, örtün, tutun; sarsıntı bitəndə pilləkənlə (lift yox) çıxın, binalardan və elektrik xətlərindən uzaq durun.",
    fire: "Yanğında: tüstüdən aşağı əyilərək çıxın, qapını açmazdan əvvəl əlinizlə yoxlayın, lift istifadə etməyin.",
    flood: "Sel zamanı: hündür yerə qalxın, axan suya girməyin, elektrik cihazlarını söndürün.",
    none: "Hazırda yaxınlıqda açıq məntəqə məlumatı yoxdur. Mövqeyinizi «Təxliyə» bölməsində təyin edin.",
  },
  en: {
    calm: "Stay calm — help is available.",
    sos: "If your life is in danger, tap the red SOS button on the home screen right away or call 112.",
    shelter: (s) => `Nearest open assembly point: ${s.name} (${s.distance}, ~${s.walkMin} min on foot). Occupancy ${s.pct}%${s.full ? " — almost full, check the alternative" : ""}.`,
    alt: (s) => `Alternative: ${s.name} (${s.distance}, ${s.pct}% full).`,
    route: "Open “Evacuation” for the route — if a road is closed, the system offers an alternative automatically.",
    closed: (n) => `${n} road segments near you are closed; the evacuation route avoids them.`,
    water: (s) => `Drinking water point: ${s.name} (${s.distance})${s.delivered ? " — water was delivered by drone today" : ""}.`,
    medical: (s) => `Medical aid point: ${s.name} (${s.distance}).`,
    noMedical: "No medical point found nearby — send an SOS if it is serious.",
    food: (s) => `Food rations are handed out at assembly points. Nearest: ${s.name} (${s.distance}).`,
    alert: (n) => `Note: ${n} active alerts in your district — dispatchers are on it.`,
    earthquake: "Earthquake: drop, cover, hold on; when shaking stops leave by the stairs (no lift), keep away from buildings and power lines.",
    fire: "Fire: stay low under the smoke, check doors with your hand before opening, never use the lift.",
    flood: "Flood: move to higher ground, do not walk into moving water, switch off electrical devices.",
    none: "No open assembly point data near you right now. Set your location in “Evacuation”.",
  },
  ru: {
    calm: "Сохраняйте спокойствие — помощь рядом.",
    sos: "Если ваша жизнь в опасности, сразу нажмите красную кнопку SOS на главном экране или звоните 112.",
    shelter: (s) => `Ближайший открытый пункт сбора: ${s.name} (${s.distance}, пешком ~${s.walkMin} мин). Заполненность ${s.pct}%${s.full ? " — почти заполнен, посмотрите альтернативу" : ""}.`,
    alt: (s) => `Альтернатива: ${s.name} (${s.distance}, заполнен на ${s.pct}%).`,
    route: "Откройте «Эвакуация» для маршрута — если дорога закрыта, система сама предложит обход.",
    closed: (n) => `Рядом с вами закрыто участков дорог: ${n}; маршрут их обходит.`,
    water: (s) => `Пункт питьевой воды: ${s.name} (${s.distance})${s.delivered ? " — сегодня вода доставлена дроном" : ""}.`,
    medical: (s) => `Пункт медпомощи: ${s.name} (${s.distance}).`,
    noMedical: "Медпункт поблизости не найден — при тяжёлом состоянии отправьте SOS.",
    food: (s) => `Продуктовые пайки выдают в пунктах сбора. Ближайший: ${s.name} (${s.distance}).`,
    alert: (n) => `Внимание: в вашем районе активных тревог: ${n} — диспетчеры следят за ситуацией.`,
    earthquake: "Землетрясение: пригнитесь, укройтесь, держитесь; после толчков выходите по лестнице (не на лифте), держитесь подальше от зданий и проводов.",
    fire: "Пожар: двигайтесь пригнувшись ниже дыма, проверяйте дверь рукой перед открытием, не пользуйтесь лифтом.",
    flood: "Наводнение: поднимитесь повыше, не входите в текущую воду, отключите электроприборы.",
    none: "Сейчас нет данных об открытых пунктах рядом. Укажите местоположение в разделе «Эвакуация».",
  },
};

/** Compose a grounded answer from intents + retrieved context. */
export const composeAnswer = (intents, ctx, lang = "az") => {
  const l = L[lang] ?? L.az;
  const out = [l.calm];
  const [first, second] = ctx.shelters;
  if (intents.includes("sos")) out.push(l.sos);
  for (const hazard of ["earthquake", "fire", "flood"]) if (intents.includes(hazard)) out.push(l[hazard]);
  if (intents.includes("shelter") || intents.includes("route")) {
    if (first) out.push(l.shelter(first));
    if (first?.full && second) out.push(l.alt(second));
    if (!first) out.push(l.none);
  }
  if (intents.includes("route")) {
    out.push(l.route);
    if (ctx.closedRoads > 0) out.push(l.closed(ctx.closedRoads));
  }
  if (intents.includes("water") && ctx.waterPoints[0]) out.push(l.water(ctx.waterPoints[0]));
  if (intents.includes("food") && first) out.push(l.food(first));
  if (intents.includes("medical")) out.push(ctx.medicalPoints[0] ? l.medical(ctx.medicalPoints[0]) : l.noMedical);
  if (ctx.activeAlerts > 0) out.push(l.alert(ctx.activeAlerts));
  return out.join(" ");
};
