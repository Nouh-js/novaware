import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Boxes, Mail, Lock, User, Eye, EyeOff, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';

type AuthView = 'login' | 'register' | 'forgot' | 'forgot-sent' | 'reset';

export function AuthPage({ onReset }: { onReset?: boolean }) {
  const [view, setView] = useState<AuthView>(onReset ? 'reset' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const clearError = () => setError('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    if (!email || !password) { setError('Veuillez remplir tous les champs.'); return; }
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (err) {
      if (err.message.includes('Invalid login credentials')) setError('Email ou mot de passe incorrect.');
      else setError(err.message);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    if (!fullName.trim()) { setError('Le nom complet est requis.'); return; }
    if (!email) { setError("L'adresse email est requise."); return; }
    if (password.length < 6) { setError('Le mot de passe doit contenir au moins 6 caractères.'); return; }
    if (password !== confirmPassword) { setError('Les mots de passe ne correspondent pas.'); return; }
    setLoading(true);
    const { error: err } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    setLoading(false);
    if (err) {
      if (err.message.includes('already registered')) setError('Cette adresse email est déjà utilisée.');
      else setError(err.message);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    if (!email) { setError("L'adresse email est requise."); return; }
    setLoading(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}${window.location.pathname}#type=recovery`,
    });
    setLoading(false);
    if (err) { setError(err.message); return; }
    setView('forgot-sent');
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    if (password.length < 6) { setError('Le mot de passe doit contenir au moins 6 caractères.'); return; }
    if (password !== confirmPassword) { setError('Les mots de passe ne correspondent pas.'); return; }
    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (err) { setError(err.message); return; }
    setView('login');
    setPassword('');
    setConfirmPassword('');
  };

  return (
    <div className="flex min-h-screen">
      {/* Left — branding panel */}
      <div className="hidden w-[480px] shrink-0 flex-col justify-between bg-gradient-to-br from-brand-700 via-brand-600 to-brand-800 p-10 lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 shadow-soft">
            <Boxes size={22} className="text-white" />
          </div>
          <span className="font-display text-xl font-bold text-white">Nexus ERP</span>
        </div>
        <div>
          <h1 className="font-display text-4xl font-bold leading-tight text-white">
            Pilotez votre activité<br />avec précision
          </h1>
          <p className="mt-4 text-base text-brand-100 leading-relaxed">
            Ventes, achats, stock, caisse, comptabilité et rapports — tout en un seul endroit, accessible à toute votre équipe selon son rôle.
          </p>
          <div className="mt-10 space-y-3">
            {[
              { icon: '📊', label: 'Tableau de bord en temps réel' },
              { icon: '🧾', label: 'Facturation & devis en quelques secondes' },
              { icon: '📦', label: 'Gestion des stocks FIFO / LIFO / CMUP' },
              { icon: '🔒', label: 'Contrôle d\'accès par rôle' },
            ].map((f) => (
              <div key={f.label} className="flex items-center gap-3">
                <span className="text-xl">{f.icon}</span>
                <span className="text-sm text-brand-100">{f.label}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-brand-300">© 2026 Nexus ERP · Tous droits réservés</p>
      </div>

      {/* Right — auth form */}
      <div className="flex flex-1 flex-col items-center justify-center bg-white p-6 dark:bg-ink-950">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="mb-8 flex items-center justify-center gap-3 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-soft">
              <Boxes size={18} />
            </div>
            <span className="font-display text-lg font-bold">Nexus ERP</span>
          </div>

          {/* LOGIN */}
          {view === 'login' && (
            <form onSubmit={handleLogin} className="animate-fade-in space-y-5">
              <div>
                <h2 className="font-display text-2xl font-bold tracking-tight">Connexion</h2>
                <p className="mt-1 text-sm text-ink-500">Accédez à votre espace de gestion</p>
              </div>
              {error && <ErrorBanner message={error} />}
              <FieldInput icon={<Mail size={16} />} type="email" placeholder="votre@email.com" value={email} onChange={setEmail} label="Adresse email" />
              <FieldInput
                icon={<Lock size={16} />}
                type={showPass ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={setPassword}
                label="Mot de passe"
                suffix={
                  <button type="button" onClick={() => setShowPass((v) => !v)} className="text-ink-400 hover:text-ink-600">
                    {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                }
              />
              <div className="flex justify-end">
                <button type="button" onClick={() => { setView('forgot'); clearError(); }} className="text-xs text-brand-600 hover:underline">
                  Mot de passe oublié ?
                </button>
              </div>
              <SubmitButton loading={loading} label="Se connecter" />
              <p className="text-center text-sm text-ink-500">
                Pas encore de compte ?{' '}
                <button type="button" onClick={() => { setView('register'); clearError(); }} className="font-medium text-brand-600 hover:underline">
                  Créer un compte
                </button>
              </p>
            </form>
          )}

          {/* REGISTER */}
          {view === 'register' && (
            <form onSubmit={handleRegister} className="animate-fade-in space-y-4">
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => { setView('login'); clearError(); }} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100">
                  <ArrowLeft size={16} />
                </button>
                <div>
                  <h2 className="font-display text-2xl font-bold tracking-tight">Créer un compte</h2>
                  <p className="mt-0.5 text-sm text-ink-500">Premier compte = Administrateur</p>
                </div>
              </div>
              {error && <ErrorBanner message={error} />}
              <FieldInput icon={<User size={16} />} type="text" placeholder="Prénom et Nom" value={fullName} onChange={setFullName} label="Nom complet" />
              <FieldInput icon={<Mail size={16} />} type="email" placeholder="votre@email.com" value={email} onChange={setEmail} label="Adresse email" />
              <FieldInput
                icon={<Lock size={16} />}
                type={showPass ? 'text' : 'password'}
                placeholder="Min. 6 caractères"
                value={password}
                onChange={setPassword}
                label="Mot de passe"
                suffix={
                  <button type="button" onClick={() => setShowPass((v) => !v)} className="text-ink-400 hover:text-ink-600">
                    {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                }
              />
              <FieldInput icon={<Lock size={16} />} type={showPass ? 'text' : 'password'} placeholder="Confirmer le mot de passe" value={confirmPassword} onChange={setConfirmPassword} label="Confirmer le mot de passe" />
              <SubmitButton loading={loading} label="Créer mon compte" />
              <p className="text-center text-sm text-ink-500">
                Déjà un compte ?{' '}
                <button type="button" onClick={() => { setView('login'); clearError(); }} className="font-medium text-brand-600 hover:underline">
                  Se connecter
                </button>
              </p>
            </form>
          )}

          {/* FORGOT PASSWORD */}
          {view === 'forgot' && (
            <form onSubmit={handleForgot} className="animate-fade-in space-y-5">
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => { setView('login'); clearError(); }} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100">
                  <ArrowLeft size={16} />
                </button>
                <div>
                  <h2 className="font-display text-2xl font-bold tracking-tight">Réinitialisation</h2>
                  <p className="mt-0.5 text-sm text-ink-500">Recevez un lien par email</p>
                </div>
              </div>
              {error && <ErrorBanner message={error} />}
              <FieldInput icon={<Mail size={16} />} type="email" placeholder="votre@email.com" value={email} onChange={setEmail} label="Adresse email" />
              <SubmitButton loading={loading} label="Envoyer le lien" />
            </form>
          )}

          {/* FORGOT SENT */}
          {view === 'forgot-sent' && (
            <div className="animate-fade-in space-y-5 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50">
                <CheckCircle2 size={32} />
              </div>
              <div>
                <h2 className="font-display text-xl font-bold">Email envoyé !</h2>
                <p className="mt-2 text-sm text-ink-500">
                  Vérifiez votre boîte mail et cliquez sur le lien de réinitialisation. Le lien expire dans 1 heure.
                </p>
              </div>
              <button onClick={() => setView('login')} className="btn-primary w-full">
                Retour à la connexion
              </button>
            </div>
          )}

          {/* RESET PASSWORD */}
          {view === 'reset' && (
            <form onSubmit={handleReset} className="animate-fade-in space-y-5">
              <div>
                <h2 className="font-display text-2xl font-bold tracking-tight">Nouveau mot de passe</h2>
                <p className="mt-1 text-sm text-ink-500">Choisissez un mot de passe sécurisé</p>
              </div>
              {error && <ErrorBanner message={error} />}
              <FieldInput
                icon={<Lock size={16} />}
                type={showPass ? 'text' : 'password'}
                placeholder="Nouveau mot de passe"
                value={password}
                onChange={setPassword}
                label="Nouveau mot de passe"
                suffix={
                  <button type="button" onClick={() => setShowPass((v) => !v)} className="text-ink-400 hover:text-ink-600">
                    {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                }
              />
              <FieldInput icon={<Lock size={16} />} type={showPass ? 'text' : 'password'} placeholder="Confirmer" value={confirmPassword} onChange={setConfirmPassword} label="Confirmer" />
              <SubmitButton loading={loading} label="Enregistrer le mot de passe" />
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function FieldInput({
  icon, type, placeholder, value, onChange, label, suffix,
}: {
  icon: React.ReactNode;
  type: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  label: string;
  suffix?: React.ReactNode;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="relative">
        <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400">{icon}</div>
        <input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="input pl-9 pr-9"
          autoComplete={type === 'email' ? 'email' : type === 'password' ? 'current-password' : 'off'}
        />
        {suffix && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">{suffix}</div>
        )}
      </div>
    </div>
  );
}

function SubmitButton({ loading, label }: { loading: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="btn-primary w-full justify-center py-2.5 text-base"
    >
      {loading ? (
        <span className="flex items-center gap-2">
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Traitement…
        </span>
      ) : label}
    </button>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
      <AlertCircle size={15} className="mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
