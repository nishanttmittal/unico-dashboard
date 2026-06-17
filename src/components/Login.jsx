import { useState } from 'react'
import { signInWithGoogle } from '../firebase'

export default function Login({ onError, blocked }) {
  const [busy, setBusy] = useState(false)

  async function go() {
    setBusy(true)
    try { await signInWithGoogle() }
    catch (e) { onError?.(e.message || 'Sign-in failed') }
    finally { setBusy(false) }
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 text-center">
      <div className="rise w-full max-w-sm">
        <div className="mx-auto mb-6 grid h-20 w-20 place-items-center rounded-3xl bg-surface-2 border border-hair text-4xl shadow-xl">
          🏭
        </div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">UNICO</h1>
        <p className="mt-1 text-muted">CEO Dashboard · Factory OS</p>

        {blocked ? (
          <div className="mt-8 rounded-2xl border border-hair bg-surface p-5 text-sm text-pending">
            This account isn’t allowed to view the dashboard.<br />
            Ask the owner to add your Google email.
          </div>
        ) : (
          <button
            onClick={go}
            disabled={busy}
            className="mt-8 w-full rounded-2xl bg-people py-4 text-lg font-semibold text-canvas
                       shadow-lg shadow-people/20 transition active:scale-[.98] disabled:opacity-60"
          >
            {busy ? 'Opening…' : 'Sign in with Google'}
          </button>
        )}
        <p className="mt-6 text-xs text-muted">Owner &amp; managers only · read-only view</p>
      </div>
    </div>
  )
}
