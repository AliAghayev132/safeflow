// React
import { useState } from 'react'

// React Router
import { useLocation, useNavigate } from 'react-router'

// Redux
import { useDispatch } from 'react-redux'
import { useLoginMutation, apiErrorMessage } from '@store/api'
import { setCredentials } from '@store/slices/authSlice'

// i18n
import { useTranslation } from 'react-i18next'

// Components
import { Button, Input, Icon3D, LanguageSwitcher } from '@components'

// Utils
import { unlockAudio } from '@utils'

export const LoginPage = () => {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation()
  const [login, { isLoading }] = useLoginMutation()
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')

  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }))

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    unlockAudio() // user gesture → later alarm beeps are allowed
    try {
      const data = await login(form).unwrap()
      dispatch(setCredentials(data))
      navigate(location.state?.from ?? '/', { replace: true })
    } catch (err) {
      setError(apiErrorMessage(err, 'login.failed'))
    }
  }

  return (
    <div className="min-h-screen bg-bg flex">
      {/* Left: identity panel */}
      <div className="hidden lg:flex w-[44%] bg-panel border-r border-border flex-col justify-between p-12">
        <div className="flex items-center gap-3">
          <Icon3D name="shield" size={44} />
          <div>
            <p className="font-bold tracking-wide">{t('login.brand')}</p>
            <p className="text-sm text-muted">{t('login.brandSub')}</p>
          </div>
        </div>

        <div>
          <h1 className="text-3xl font-bold leading-tight">
            {t('login.headline1')}
            <br />
            {t('login.headline2')}
          </h1>
          <p className="text-muted mt-4 max-w-md leading-relaxed">{t('login.intro')}</p>
          <div className="grid grid-cols-3 gap-3 mt-8 max-w-md">
            {[
              { icon: 'sos', key: 'featureSos' },
              { icon: 'stadium', key: 'featureShelters' },
              { icon: 'fireEngine', key: 'featureBrigades' },
            ].map((f) => (
              <div key={f.key} className="bg-panel-2 border border-border rounded-xl p-4 text-center">
                <Icon3D name={f.icon} size={40} />
                <p className="text-xs text-muted mt-2">{t(`login.${f.key}`)}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-subtle">{t('login.footer')}</p>
      </div>

      {/* Right: form */}
      <div className="flex-1 flex flex-col p-6">
        <div className="flex justify-end">
          <LanguageSwitcher />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <form onSubmit={onSubmit} className="w-full max-w-sm">
            <Icon3D name="lock" size={48} className="mb-4" />
            <h2 className="text-2xl font-bold">{t('login.title')}</h2>
            <p className="text-sm text-muted mt-1 mb-6">{t('login.subtitle')}</p>

            <div className="space-y-4">
              <Input
                id="username"
                name="username"
                label={t('login.username')}
                autoComplete="username"
                value={form.username}
                onChange={onChange}
                required
                autoFocus
              />
              <Input
                id="password"
                name="password"
                type="password"
                label={t('login.password')}
                autoComplete="current-password"
                value={form.password}
                onChange={onChange}
                required
              />
            </div>

            {error && (
              <p
                role="alert"
                className="mt-4 text-sm text-critical bg-critical-soft border border-critical/40 rounded-lg px-3 py-2"
              >
                {error}
              </p>
            )}

            <Button type="submit" size="lg" fullWidth className="mt-6" loading={isLoading}>
              {t('login.submit')}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
