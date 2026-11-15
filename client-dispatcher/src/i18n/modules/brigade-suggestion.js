// Brigade auto-suggestion (ETA, alternatives, soonest free)
export default {
  az: {
    suggest: {
      eta: '~{{minutes}} dəq',
      choose: 'Briqadanı seçin',
      otherType: 'fərqli növ',
      noneFree: 'Boş briqada yoxdur. Ən tez boşalacaq: {{name}} — ~{{free}} dəq sonra, çatma ~{{eta}} dəq.',
      noneAtAll: 'Boş briqada yoxdur və tezliklə boşalacaq briqada tapılmadı.',
    },
  },
  en: {
    suggest: {
      eta: '~{{minutes}} min',
      choose: 'Choose a brigade',
      otherType: 'other type',
      noneFree: 'No free brigade. Soonest free: {{name}} — in ~{{free}} min, arrival ~{{eta}} min.',
      noneAtAll: 'No free brigade and none expected to free up soon.',
    },
  },
  ru: {
    suggest: {
      eta: '~{{minutes}} мин',
      choose: 'Выберите бригаду',
      otherType: 'другой тип',
      noneFree: 'Свободных бригад нет. Раньше всех освободится: {{name}} — через ~{{free}} мин, прибытие ~{{eta}} мин.',
      noneAtAll: 'Свободных бригад нет, и скоро не освободится ни одна.',
    },
  },
}
