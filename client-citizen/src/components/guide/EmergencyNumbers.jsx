import { useTranslation } from 'react-i18next'
import { Phone } from 'lucide-react'
import { Icon3D } from '@components/ui'
import { emergencyNumbers } from '@constants'

/** Emergency numbers (bundled — available offline) with tel: links. */
export const EmergencyNumbers = () => {
  const { t } = useTranslation()
  return (
    <section className="rounded-3xl border border-line bg-surface p-4">
      <h2 className="text-base font-extrabold text-ink">{t('guide.numbersTitle')}</h2>
      <ul className="mt-3 grid grid-cols-2 gap-2">
        {emergencyNumbers.map((n) => (
          <li key={n.number}>
            <a
              href={`tel:${n.number}`}
              className="flex min-h-16 items-center gap-2 rounded-2xl border-2 border-line-strong p-2.5 hover:border-sos"
              aria-label={`${t('guide.call')} ${n.number} — ${t(`guide.numbers.n${n.number}`)}`}
            >
              <Icon3D name={n.icon} size={30} />
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block text-xl font-extrabold text-sos">{n.number}</span>
                <span className="block truncate text-[11px] font-semibold text-muted">{t(`guide.numbers.n${n.number}`)}</span>
              </span>
              <Phone className="h-4 w-4 text-ink-soft" aria-hidden />
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}
