/**
 * Turns a spoken transcript into an SOS payload: type, needs and headcount.
 * Simple keyword matching per language — robust enough for short, stressed
 * phrases like "binanın altında qalmışıq, üç nəfərik, yaralı var".
 */

const DICT = {
  az: {
    types: {
      medical: ['yaralı', 'qan', 'ürək', 'nəfəs', 'xəstə', 'huşsuz', 'sınıq', 'həkim', 'yaralan'],
      fire: ['yanğın', 'alov', 'yanır', 'tüstü', 'od'],
      collapse: ['uçqun', 'uçub', 'dağıl', 'dağıntı', 'altında', 'zəlzələ', 'çökdü', 'divar'],
      flood: ['sel', 'daşqın', 'su basır', 'su basıb', 'su gəlir', 'su qalxır'],
    },
    needs: {
      rescue_trapped: ['altında', 'qalmış', 'çıxa bilmir', 'sıxışmış', 'ilişib'],
      medical_aid: ['yaralı', 'qan', 'dərman', 'həkim', 'sınıq'],
      water: ['su lazım', 'susuz', 'içməli', 'su yoxdur'],
      shelter: ['sığınacaq', 'soyuq', 'yer yoxdur', 'evsiz'],
      evacuation: ['təxliyə', 'çıxarın', 'aparın'],
      food: ['yemək', 'acıq', 'qida'],
      power: ['işıq', 'elektrik', 'batareya', 'şarj'],
    },
    numbers: { bir: 1, iki: 2, üç: 3, dörd: 4, beş: 5, altı: 6, yeddi: 7, səkkiz: 8, doqquz: 9, on: 10 },
    people: /(\d+|bir|iki|üç|dörd|beş|altı|yeddi|səkkiz|doqquz|on)\s*(nəfər|adam)/i,
  },
  en: {
    types: {
      medical: ['injured', 'bleeding', 'blood', 'heart', 'breathe', 'unconscious', 'broken', 'doctor', 'hurt'],
      fire: ['fire', 'flame', 'burning', 'smoke'],
      collapse: ['collapse', 'collapsed', 'rubble', 'trapped under', 'earthquake', 'debris', 'building fell'],
      flood: ['flood', 'water rising', 'flooding', 'water is coming'],
    },
    needs: {
      rescue_trapped: ['trapped', 'stuck', 'under the rubble', "can't get out", 'pinned'],
      medical_aid: ['injured', 'bleeding', 'medicine', 'doctor', 'broken'],
      water: ['need water', 'thirsty', 'drinking water', 'no water'],
      shelter: ['shelter', 'cold', 'nowhere to stay', 'homeless'],
      evacuation: ['evacuate', 'get us out', 'take us'],
      food: ['food', 'hungry'],
      power: ['power', 'electricity', 'battery', 'charge'],
    },
    numbers: { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 },
    people: /(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s*(people|persons|of us)/i,
  },
  ru: {
    types: {
      medical: ['ранен', 'кровь', 'кровотечение', 'сердце', 'дышать', 'без сознания', 'перелом', 'врач'],
      fire: ['пожар', 'огонь', 'горит', 'дым'],
      collapse: ['обрушение', 'обрушил', 'завал', 'под завалом', 'землетрясение', 'рухнул'],
      flood: ['наводнение', 'затоп', 'вода прибывает', 'потоп'],
    },
    needs: {
      rescue_trapped: ['завал', 'застрял', 'не могу выбраться', 'зажат'],
      medical_aid: ['ранен', 'кровь', 'лекарств', 'врач', 'перелом'],
      water: ['нужна вода', 'питьев', 'нет воды', 'жажд'],
      shelter: ['укрыти', 'холодно', 'негде'],
      evacuation: ['эвакуац', 'вывезите', 'заберите'],
      food: ['еда', 'голод'],
      power: ['свет', 'электричеств', 'батаре', 'заряд'],
    },
    numbers: { один: 1, два: 2, три: 3, четыре: 4, пять: 5, шесть: 6, семь: 7, восемь: 8, девять: 9, десять: 10 },
    people: /(\d+|один|два|три|четыре|пять|шесть|семь|восемь|девять|десять)\s*(человек|чел)/i,
  },
}

// medical > fire > collapse > flood (same order as backend triage severity)
const SEVERITY = ['medical', 'fire', 'collapse', 'flood']

const hits = (text, words) => words.filter((w) => text.includes(w)).length

export const parseTranscript = (transcript, lang = 'az') => {
  const dict = DICT[lang] ?? DICT.az
  const text = ` ${String(transcript).toLowerCase()} `

  let type = 'general'
  let best = 0
  for (const candidate of SEVERITY) {
    const score = hits(text, dict.types[candidate])
    if (score > best) {
      best = score
      type = candidate
    }
  }

  const needs = Object.entries(dict.needs)
    .filter(([, words]) => hits(text, words) > 0)
    .map(([need]) => need)

  let headcount
  const m = text.match(dict.people)
  if (m) {
    const raw = m[1].toLowerCase()
    headcount = Number.isFinite(Number(raw)) ? Number(raw) : dict.numbers[raw]
  }

  return { type, needs, headcount }
}

export const speechSupported = () =>
  typeof window !== 'undefined' && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition)
