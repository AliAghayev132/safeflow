/**
 * Fast rule-based emergency-text parser (az / en / ru) — pure, < 1 ms.
 *
 * It is the voice-SOS fast path (the SOS is created from this result right
 * away) and the mock for the LLM parser. When a real LLM is configured, its
 * structured result later enriches the same SOS in the background.
 */
const norm = (s) =>
  String(s ?? "")
    .toLowerCase()
    .replace(/[ə]/g, "e")
    .replace(/[ı]/g, "i")
    .replace(/[ö]/g, "o")
    .replace(/[ü]/g, "u")
    .replace(/[ş]/g, "s")
    .replace(/[ç]/g, "c")
    .replace(/[ğ]/g, "g")
    .replace(/ё/g, "е");

const HAZARDS = {
  fire: ["yangin", "alov", "tustu", "yanir", "fire", "smoke", "burning", "flames", "пожар", "огон", "дым", "горит"],
  collapse: [
    "ucub", "ucdu", "ucur", "dagint", "zelzele", "bina", "collapse", "rubble", "debris", "earthquake", "trapped",
    "обруш", "завал", "землетряс", "рухну",
  ],
  flood: ["su bas", "sel", "dasqin", "su qalxir", "flood", "water rising", "наводн", "затоп", "потоп"],
  medical: [
    "huş", "hus", "qan", "yarali", "urek", "nefes", "xeste", "dogus", "bleeding", "injured", "unconscious", "heart",
    "breath", "без сознан", "кров", "ранен", "сердц", "дыш",
  ],
};

const NUMBER_WORDS = {
  bir: 1, iki: 2, uc: 3, dord: 4, bes: 5, alti: 6, yeddi: 7, sekkiz: 8, doqquz: 9, on: 10,
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  один: 1, одна: 1, два: 2, двое: 2, две: 2, три: 3, трое: 3, четыре: 4, четверо: 4, пять: 5, пятеро: 5,
  шесть: 6, семь: 7, восемь: 8, девять: 9, десять: 10,
};
const PEOPLE = ["nefer", "adam", "nefer", "people", "persons", "of us", "человек", "нас", "людей"];

const VULNERABLE = {
  child: ["usaq", "korpe", "bala", "child", "kid", "baby", "ребен", "дети", "детей", "младен"],
  elderly: ["yasli", "qoca", "nene", "baba", "elderly", "old", "grandm", "grandf", "пожил", "бабуш", "дедуш"],
  disabled: ["elil", "arabasi", "yeriye bilmir", "wheelchair", "disabled", "cannot walk", "can't walk", "инвалид", "коляск"],
};

const NEEDS = {
  medical_aid: ["hekim", "tibbi", "derman", "doctor", "medic", "ambulance", "врач", "скор", "лекарств"],
  water: ["su lazim", "susuz", "icmeli", "water", "thirst", "воды", "вода"],
  rescue_trapped: ["altinda", "qalmisiq", "cixa bilmir", "trapped", "stuck", "under the", "завал", "застрял", "не можем выйти"],
  evacuation: ["cixarin", "tex", "evacuat", "эвакуац", "вывез"],
  food: ["yemek", "aclig", "food", "hungry", "еда", "еды", "голод"],
  shelter: ["siginacaq", "gecelemek", "shelter", "укрыт", "ночлег"],
  power: ["isiq yox", "elektrik", "power", "electricity", "свет", "электрич"],
};

const CRITICAL = ["olur", "olum", "nefes ala bilmir", "huşsuz", "hussuz", "dying", "not breathing", "unconscious", "умира", "не дыш", "без сознан"];
const URGENT = ["tecili", "komek", "imdad", "help", "urgent", "hurry", "помог", "срочно", "спасите"];

const ORDINALS = {
  birinci: 1, ikinci: 2, ucuncu: 3, dorduncu: 4, besinci: 5, altinci: 6, yeddinci: 7, sekkizinci: 8, doqquzuncu: 9,
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6,
  первом: 1, втором: 2, третьем: 3, четвертом: 4, пятом: 5,
};

const has = (text, words) => words.some((w) => text.includes(w));

const countPeople = (text) => {
  // "4 nəfər", "dörd nəfərik", "we are 3", "нас четверо"
  const tokens = text.split(/[^\p{L}\d]+/u).filter(Boolean);
  for (let i = 0; i < tokens.length; i++) {
    const n = /^\d{1,3}$/.test(tokens[i]) ? Number(tokens[i]) : NUMBER_WORDS[tokens[i]];
    if (!n) continue;
    const near = tokens.slice(Math.max(0, i - 2), i + 3).join(" ");
    if (PEOPLE.some((p) => near.includes(p)) || /nefer|человек/.test(tokens[i + 1] ?? "")) return Math.min(n, 500);
  }
  return null;
};

/**
 * @param {string} text   transcript
 * @param {Array<{code,name}>} zones  for location matching
 * @returns structured emergency report (same shape as the LLM schema)
 */
export const parseEmergencyText = (text, zones = []) => {
  const t = norm(text);
  const scores = Object.fromEntries(Object.entries(HAZARDS).map(([k, words]) => [k, words.filter((w) => t.includes(w)).length]));
  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  const hazardType = best && best[1] > 0 ? best[0] : "general";

  const vulnerable = Object.fromEntries(Object.entries(VULNERABLE).map(([k, words]) => [k, has(t, words)]));
  const needs = Object.entries(NEEDS)
    .filter(([, words]) => has(t, words))
    .map(([k]) => k);
  if (hazardType === "collapse" && !needs.includes("rescue_trapped") && /altinda|trapped|завал/.test(t)) needs.push("rescue_trapped");
  if (hazardType === "medical" && !needs.includes("medical_aid")) needs.push("medical_aid");

  const injured = has(t, ["yarali", "qan", "sinib", "injur", "bleed", "broken", "ранен", "кров", "перелом"]);
  const trapped = needs.includes("rescue_trapped");
  const peopleCount = countPeople(t);

  let priority = "medium";
  if (has(t, CRITICAL) || (trapped && (vulnerable.child || vulnerable.elderly))) priority = "critical";
  else if (trapped || injured || vulnerable.child || vulnerable.elderly || vulnerable.disabled || (peopleCount ?? 0) >= 5) priority = "high";
  else if (!has(t, URGENT) && hazardType === "general") priority = "low";

  const zone = zones.find((z) => t.includes(norm(z.name)));
  const floorMatch = t.match(/(\d{1,2}|\p{L}+)\s*(?:-?ci|-?cu|th|st|nd|rd)?\s*(?:mertebe|floor|этаж)/u);
  const floorValue = floorMatch ? (/^\d+$/.test(floorMatch[1]) ? Number(floorMatch[1]) : ORDINALS[floorMatch[1]]) : null;
  const floor = floorValue ? [null, floorValue] : null;
  const street = String(text).match(/([A-ZƏÖÜŞÇĞİ][\p{L}-]+\s+(küçəsi|prospekti|pr\.|street|st\.|avenue|улица|проспект))/u);

  return {
    hazardType,
    peopleCount,
    priority,
    injuries: injured,
    trapped,
    vulnerable,
    needs,
    location: {
      text: [street?.[1], zone?.name].filter(Boolean).join(", ") || null,
      zoneCode: zone?.code ?? null,
      floor: floor?.[1] ? Number(floor[1]) : null,
    },
    summary: summarize({ hazardType, peopleCount, trapped, injured, zone }),
  };
};

const summarize = ({ hazardType, peopleCount, trapped, injured, zone }) =>
  [
    hazardType,
    peopleCount ? `${peopleCount} people` : null,
    trapped ? "trapped" : null,
    injured ? "injured" : null,
    zone ? zone.name : null,
  ]
    .filter(Boolean)
    .join(" · ");

/** Parsed report → SOS details accepted by SosService. */
export const toSosDetails = (parsed, transcript) => ({
  transcript: String(transcript ?? "").slice(0, 1000),
  ...(parsed.peopleCount ? { headcount: parsed.peopleCount } : {}),
  ...(parsed.needs.length ? { needs: parsed.needs } : {}),
  vulnerable: parsed.vulnerable,
  ...(parsed.injuries ? { injuries: parsed.trapped ? "Dağıntı altında / yaralı" : "Yaralı var" } : {}),
  note: [parsed.location?.text, parsed.location?.floor ? `${parsed.location.floor}. mərtəbə` : null]
    .filter(Boolean)
    .join(" · ")
    .slice(0, 280) || undefined,
});
