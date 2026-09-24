import { ArrowRight, KeyRound, LoaderCircle, Mail, RotateCcw } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router'
import { Splash } from '../../app/Splash'
import { Alert } from '../../components/Alert'
import { stagger } from '../../components/stagger'
import { buttonStyles, inputStyles } from '../../components/styles'
import { Wordmark } from '../../components/Wordmark'
import { authRedirectUrl, supabase } from '../../lib/supabase'
import { authErrorMessage } from './authErrors'
import {
  clearPendingLogin,
  lastUsedEmail,
  loadPendingLogin,
  savePendingLogin,
  type PendingLogin,
} from './pendingLogin'
import { StagePreview } from './StagePreview'
import { useAuth } from './useAuth'

/** Supabase lets you request a new login email once a minute. */
const RESEND_COOLDOWN_S = 60

export function LoginPage() {
  const { session, loading, urlError } = useAuth()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'

  if (loading) return <Splash />
  if (session) return <Navigate to={from} replace />

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <div className="flex flex-col px-5 pt-8 pb-12 sm:px-10 lg:min-h-dvh lg:py-12">
        <div className="rise-in">
          <Wordmark />
        </div>
        <div className="mt-16 w-full max-w-sm lg:mx-auto lg:my-auto lg:py-12">
          <LoginForm urlError={urlError} />
        </div>
        <p className="mt-16 text-xs text-ink-faint lg:mt-0">אפליקציה אישית למשתמש יחיד.</p>
      </div>
      <StagePreview />
    </div>
  )
}

function useSecondsLeft(pending: PendingLogin | null): number {
  const [now, setNow] = useState(() => Date.now())
  const left = pending ? Math.max(0, RESEND_COOLDOWN_S - Math.floor((now - pending.sentAt) / 1000)) : 0

  useEffect(() => {
    if (left <= 0) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [left])

  return left
}

function LoginForm({ urlError }: { urlError: string | null }) {
  const [pending, setPending] = useState<PendingLogin | null>(() => loadPendingLogin())
  const [email, setEmail] = useState(() => pending?.email ?? lastUsedEmail())
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(urlError)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const secondsLeft = useSecondsLeft(pending)

  async function sendEmail(event?: FormEvent) {
    event?.preventDefault()
    const address = email.trim()
    if (!address) return
    setBusy(true)
    setError(null)
    setNotice(null)
    const { error: sendError } = await supabase.auth.signInWithOtp({
      email: address,
      options: { emailRedirectTo: authRedirectUrl() },
    })
    setBusy(false)
    if (sendError) {
      setError(authErrorMessage(sendError))
      return
    }
    const next = { email: address, sentAt: Date.now() }
    if (pending) setNotice('שלחנו מייל חדש.')
    savePendingLogin(next)
    setPending(next)
    setCode('')
  }

  async function verifyCode(event: FormEvent) {
    event.preventDefault()
    if (!pending) return
    setBusy(true)
    setError(null)
    setNotice(null)
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: pending.email,
      token: code,
      type: 'email',
    })
    setBusy(false)
    if (verifyError) {
      setError(authErrorMessage(verifyError))
      return
    }
    // The session arrives through onAuthStateChange; LoginPage then redirects.
    clearPendingLogin()
  }

  function switchEmail() {
    clearPendingLogin()
    setPending(null)
    setCode('')
    setError(null)
    setNotice(null)
  }

  if (!pending) {
    return (
      <div className="rise-in" style={stagger(1)}>
        <h1 className="font-display text-[38px] leading-tight font-semibold">כניסה</h1>
        <p className="mt-2 leading-relaxed text-ink-soft">נשלח אליך מייל עם קישור כניסה וקוד.</p>

        <form onSubmit={(e) => void sendEmail(e)} className="mt-8 space-y-4">
          <label className="block">
            <span className="text-sm font-medium">אימייל</span>
            <input
              type="email"
              dir="ltr"
              required
              autoComplete="email"
              inputMode="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`${inputStyles} mt-1.5 text-left`}
            />
          </label>
          {error ? <Alert>{error}</Alert> : null}
          <button type="submit" disabled={busy} className={`${buttonStyles.primary} w-full`}>
            {busy ? <LoaderCircle size={18} className="animate-spin" aria-hidden="true" /> : <Mail size={18} aria-hidden="true" />}
            שלח קישור וקוד
          </button>
        </form>
      </div>
    )
  }

  const digits = code.replace(/\D/g, '')

  return (
    <div className="rise-in">
      <h1 className="font-display text-[38px] leading-tight font-semibold">בדוק את המייל</h1>
      <p className="mt-2 leading-relaxed text-ink-soft">
        שלחנו מייל אל{' '}
        <span dir="ltr" className="font-medium text-ink">
          {pending.email}
        </span>
        .
      </p>
      <ul className="mt-4 space-y-1.5 text-[15px] text-ink-soft">
        <li>
          <span className="font-medium text-ink">במחשב:</span> לחץ על הקישור שבמייל.
        </li>
        <li>
          <span className="font-medium text-ink">בטלפון, באפליקציה המותקנת:</span> הקלד כאן את הקוד.
        </li>
      </ul>

      <form onSubmit={(e) => void verifyCode(e)} className="mt-7 space-y-4">
        <label className="block">
          <span className="text-sm font-medium">קוד מהמייל</span>
          <input
            dir="ltr"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={10}
            placeholder="••••••"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            className={`${inputStyles} mt-1.5 h-14 text-center font-mono text-2xl tracking-[0.45em]`}
          />
        </label>
        {error ? <Alert>{error}</Alert> : null}
        {notice ? <p className="text-sm text-good">{notice}</p> : null}
        <button type="submit" disabled={busy || digits.length < 6} className={`${buttonStyles.primary} w-full`}>
          {busy ? <LoaderCircle size={18} className="animate-spin" aria-hidden="true" /> : <KeyRound size={18} aria-hidden="true" />}
          כניסה
        </button>
      </form>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => void sendEmail()}
          disabled={busy || secondsLeft > 0}
          className={`${buttonStyles.ghost} h-9 text-sm`}
        >
          <RotateCcw size={15} aria-hidden="true" />
          {secondsLeft > 0 ? `שליחה חוזרת בעוד ${secondsLeft} שנ׳` : 'שלח שוב'}
        </button>
        <button type="button" onClick={switchEmail} className={`${buttonStyles.ghost} h-9 text-sm`}>
          <ArrowRight size={15} aria-hidden="true" />
          כתובת אחרת
        </button>
      </div>
    </div>
  )
}
