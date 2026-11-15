// Priority #1 / special-needs labels on SOS tickets (core triage)
export default {
  az: {
    a11yTriage: {
      priorityOne: 'PRİORİTET #1',
      flag: {
        wheelchair: 'Əlil arabası',
        limitedMobility: 'Hərəkət məhdudiyyəti',
        speechImpaired: 'Danışa bilmir',
        hearingImpaired: 'Eşidə bilmir',
        visionImpaired: 'Görmə məhdudiyyəti',
      },
    },
    triage: { breakdownKeys: { priorityOne: 'Prioritet #1', accessibility: 'Xüsusi ehtiyac' } },
  },
  en: {
    a11yTriage: {
      priorityOne: 'PRIORITY #1',
      flag: {
        wheelchair: 'Wheelchair',
        limitedMobility: 'Limited mobility',
        speechImpaired: 'Cannot speak',
        hearingImpaired: 'Cannot hear',
        visionImpaired: 'Vision impaired',
      },
    },
    triage: { breakdownKeys: { priorityOne: 'Priority #1', accessibility: 'Special needs' } },
  },
  ru: {
    a11yTriage: {
      priorityOne: 'ПРИОРИТЕТ №1',
      flag: {
        wheelchair: 'Инвалидная коляска',
        limitedMobility: 'Ограниченная мобильность',
        speechImpaired: 'Не может говорить',
        hearingImpaired: 'Не слышит',
        visionImpaired: 'Нарушение зрения',
      },
    },
    triage: { breakdownKeys: { priorityOne: 'Приоритет №1', accessibility: 'Особые потребности' } },
  },
}
