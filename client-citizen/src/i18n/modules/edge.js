/** Edge-node (local network) texts — deep-merged into the base locales. */
export default {
  az: {
    edge: {
      title: 'Lokal şəbəkə · {{shelter}}',
      desc: 'İnternet yoxdur. SOS və “Təhlükəsizəm” statusunuz bu məntəqədə qəbul olunur və əlaqə bərpa olunan kimi mərkəzə ötürülür.',
      centerOnline: 'Mərkəzlə əlaqə var · son sinxron {{time}}',
      centerOffline: 'Mərkəzlə əlaqə yoxdur · {{count}} məlumat növbədə',
    },
  },
  en: {
    edge: {
      title: 'Local network · {{shelter}}',
      desc: 'No internet. Your SOS and “I am safe” status are accepted at this assembly point and forwarded to the center as soon as the link is back.',
      centerOnline: 'Connected to the center · last sync {{time}}',
      centerOffline: 'No link to the center · {{count}} item(s) queued',
    },
  },
  ru: {
    edge: {
      title: 'Локальная сеть · {{shelter}}',
      desc: 'Интернета нет. Ваш SOS и статус «Я в безопасности» принимаются в этом пункте и будут переданы в центр, как только связь восстановится.',
      centerOnline: 'Связь с центром есть · синхронизация {{time}}',
      centerOffline: 'Нет связи с центром · в очереди: {{count}}',
    },
  },
}
