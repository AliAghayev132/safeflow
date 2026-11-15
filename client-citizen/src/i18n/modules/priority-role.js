// Challenge Drop #1 — limited-mobility role + backup routing notice
export default {
  az: {
    priorityRole: {
      title: 'Prioritet SOS rolu · Priority #1',
      desc: 'Hərəkət məhdudiyyətli vətəndaş: SOS-unuz avtomatik kritik prioritet alır və sizə yalnız panduslu, maneəsiz marşrut göstərilir.',
    },
    role: { priority_citizen: 'Hərəkət məhdudiyyətli vətəndaş (Prioritet SOS)' },
    evacuation: { fallbackNotice: 'Oflayn / Ehtiyat marşrut rejimində işləyir — xarici xəritə xidməti əlçatan deyil, marşrut lokal yol bazasından hesablanır.' },
  },
  en: {
    priorityRole: {
      title: 'Priority SOS role · Priority #1',
      desc: 'Citizen with limited mobility: your SOS automatically gets critical priority and only step-free, ramp-accessible routes are shown.',
    },
    role: { priority_citizen: 'Citizen with limited mobility (Priority SOS)' },
    evacuation: { fallbackNotice: 'Running in Offline / Backup routing mode — the external map service is unavailable, routes are computed from the local road database.' },
  },
  ru: {
    priorityRole: {
      title: 'Роль «Приоритетный SOS» · Priority #1',
      desc: 'Маломобильный гражданин: ваш SOS автоматически получает критический приоритет, показываются только безбарьерные маршруты с пандусами.',
    },
    role: { priority_citizen: 'Маломобильный гражданин (приоритетный SOS)' },
    evacuation: { fallbackNotice: 'Работает в режиме «Офлайн / Резервный маршрут» — внешний картографический сервис недоступен, маршрут строится по локальной базе дорог.' },
  },
}
