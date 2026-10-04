import React, { useState, useEffect } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase.ts';
import { X, Lock, Mail, User, KeyRound, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  initialMode?: 'login' | 'signup' | 'forgot' | 'reset';
  onClose: () => void;
  onSuccess: (token: string, user?: any) => void;
}

export function AuthModal({ isOpen, initialMode = 'login', onClose, onSuccess }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot' | 'reset'>(initialMode);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [githubConfigHelp, setGithubConfigHelp] = useState<{ callbackUrl: string } | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [generatedSandboxToken, setGeneratedSandboxToken] = useState<string | null>(null);

  useEffect(() => {
    setMode(initialMode);
    setError(null);
    setGithubConfigHelp(null);
  }, [initialMode, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleMessage = (event: MessageEvent) => {
      const origin = event.origin || '';
      if (
        origin &&
        !origin.endsWith('.run.app') &&
        !origin.endsWith('.onrender.com') &&
        !origin.includes('localhost') &&
        origin !== window.location.origin
      ) {
        return;
      }
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS' && event.data?.token) {
        setLoading(false);
        onSuccess(event.data.token, event.data.user);
        onClose();
      } else if (event.data?.type === 'OAUTH_AUTH_ERROR') {
        setLoading(false);
        setError(event.data.error || 'GitHub authentication failed.');
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isOpen, onSuccess, onClose]);

  if (!isOpen) return null;

  const handleGithubSignIn = async () => {
    setError(null);
    setGithubConfigHelp(null);
    setLoading(true);
    try {
      const origin = window.location.origin;
      const res = await fetch(`/api/auth/github/url?origin=${encodeURIComponent(origin)}`);
      const data = await res.json();

      if (res.status === 503 && data.configurationError) {
        setError(data.error);
        setGithubConfigHelp({ callbackUrl: data.callbackUrl || `${origin}/auth/github/callback` });
        setLoading(false);
        return;
      }
      if (!res.ok || !data.url) {
        throw new Error(data.error || 'Failed to initiate GitHub OAuth flow.');
      }

      const popup = window.open(data.url, 'github_oauth_popup', 'width=600,height=720');
      if (!popup) {
        window.location.href = data.url;
      } else {
        setLoading(false);
      }
    } catch (err: any) {
      setError(err.message || 'GitHub Sign-In failed.');
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      const cred = await signInWithPopup(auth, googleAuthProvider);
      const idToken = await cred.user.getIdToken();
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to authenticate with backend.');
      }
      onSuccess(idToken, data.user);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Google Sign-In failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Login failed.');
        onSuccess(data.token, data.user);
        onClose();
      } else if (mode === 'signup') {
        const res = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, name, password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Registration failed.');
        onSuccess(data.token, data.user);
        onClose();
      } else if (mode === 'forgot') {
        const res = await fetch('/api/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        const data = await res.json();
        if (res.status === 503 && data.configurationError) {
          setError(data.error);
          if (data.verificationResetToken) {
            setGeneratedSandboxToken(data.verificationResetToken);
            setResetToken(data.verificationResetToken);
            setInfoMessage(data.message);
          }
          return;
        }
        if (!res.ok) throw new Error(data.error || 'Failed to generate reset token.');
        setInfoMessage(data.message);
        setMode('reset');
      } else if (mode === 'reset') {
        const res = await fetch('/api/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: resetToken, newPassword }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to reset password.');
        setInfoMessage(data.message);
        setGeneratedSandboxToken(null);
        setPassword('');
        setMode('login');
      }
    } catch (err: any) {
      setError(err.message || 'Authentication error.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 min-h-[100dvh] overflow-y-auto bg-black/85 backdrop-blur-md px-3 py-4 sm:px-5 sm:py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="w-full max-w-md min-h-[calc(100dvh-2rem)] sm:min-h-0 sm:my-auto mx-auto rounded-2xl border border-zinc-800 bg-[#0D0D12] p-5 sm:p-6 shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80">
          <div>
            <h2 id="auth-modal-title" className="text-lg font-bold text-white">
              {mode === 'login' && 'Sign In to Site Forge AI'}
              {mode === 'signup' && 'Create Site Forge AI Account'}
              {mode === 'forgot' && 'Reset Account Password'}
              {mode === 'reset' && 'Enter Single-Use Reset Token'}
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              {mode === 'login' && 'Connect with GitHub to analyze websites, rebuild code, and push repositories.'}
              {mode === 'signup' && 'Authenticate with GitHub or register developer credentials.'}
              {mode === 'forgot' && 'Generate a single-use cryptographic password reset token.'}
              {mode === 'reset' && 'Consume your reset token and set a new bcrypt-hashed password.'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white rounded-xl hover:bg-zinc-800/60 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-xl border border-rose-500/40 bg-rose-950/30 text-xs text-rose-200 space-y-2">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1">{error}</div>
            </div>
            {githubConfigHelp && (
              <div className="p-2.5 rounded-lg bg-[#08080C] border border-zinc-800 text-[11px] text-zinc-300 space-y-1.5 font-mono">
                <div className="text-rose-400 font-sans font-semibold">
                  Configure GitHub OAuth App (https://github.com/settings/developers):
                </div>
                <div>1. Set Authorization Callback URL:</div>
                <div className="p-1.5 bg-zinc-900 rounded border border-zinc-800 text-white break-all select-all">
                  {githubConfigHelp.callbackUrl}
                </div>
                <div>2. Set Environment Variables:</div>
                <div className="text-zinc-400">
                  GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, GITHUB_CALLBACK_URL
                </div>
              </div>
            )}
          </div>
        )}

        {infoMessage && (
          <div className="mt-4 p-3 rounded-xl border border-rose-500/40 bg-rose-500/10 text-xs text-rose-200 flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p>{infoMessage}</p>
              {generatedSandboxToken && mode === 'forgot' && (
                <div className="mt-2 pt-2 border-t border-rose-500/30">
                  <div className="font-mono text-[11px] text-white bg-zinc-950 px-2.5 py-1.5 rounded border border-zinc-800 break-all">
                    {generatedSandboxToken}
                  </div>
                  <button
                    type="button"
                    onClick={() => setMode('reset')}
                    className="mt-2 px-3 py-1.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition-colors"
                  >
                    Proceed to Reset Password Form →
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {(mode === 'login' || mode === 'signup') && (
          <div className="mt-5 mb-4 rounded-xl border border-zinc-800/80 bg-[#101017] p-3 text-center">
            <p className="text-[11px] text-zinc-400">Use your Site Forge AI account credentials below, or connect securely with a provider.</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 mt-3">
          {mode === 'signup' && (
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">Full Name</label>
              <div className="relative">
                <User className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ada Lovelace"
                  className="w-full pl-10 pr-4 py-2 rounded-xl border border-zinc-800 bg-[#08080C] text-sm text-white focus:border-rose-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          {(mode === 'login' || mode === 'signup' || mode === 'forgot') && (
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="developer@company.com"
                  className="w-full pl-10 pr-4 py-2 rounded-xl border border-zinc-800 bg-[#08080C] text-sm text-white focus:border-rose-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          {(mode === 'login' || mode === 'signup') && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-zinc-300">Password</label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setInfoMessage(null);
                      setMode('forgot');
                    }}
                    className="text-xs text-rose-400 hover:text-rose-300"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  className="w-full pl-10 pr-4 py-2 rounded-xl border border-zinc-800 bg-[#08080C] text-sm text-white focus:border-rose-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          {mode === 'reset' && (
            <>
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">Single-Use Reset Token</label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    required
                    value={resetToken}
                    onChange={(e) => setResetToken(e.target.value)}
                    placeholder="sf_rst_..."
                    className="w-full pl-10 pr-4 py-2 rounded-xl border border-zinc-800 bg-[#08080C] text-sm font-mono text-white focus:border-rose-500 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">New Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    className="w-full pl-10 pr-4 py-2 rounded-xl border border-zinc-800 bg-[#08080C] text-sm text-white focus:border-rose-500 focus:outline-none"
                  />
                </div>
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-sm font-bold text-white flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            <span>
              {loading
                ? 'Processing...'
                : mode === 'login'
                ? 'Sign In with Email'
                : mode === 'signup'
                ? 'Create Account'
                : mode === 'forgot'
                ? 'Generate Reset Token'
                : 'Reset Password'}
            </span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {(mode === 'login' || mode === 'signup') && (
          <div className="mt-5 pt-4 border-t border-zinc-800/80">
            <p className="text-center text-[10px] uppercase tracking-[0.18em] text-zinc-500 mb-3">Connect with</p>
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                aria-label="Continue with Google"
                title="Continue with Google"
                className="w-12 h-12 rounded-xl border border-zinc-700 bg-[#08080C] hover:bg-zinc-900 hover:border-zinc-500 text-white flex items-center justify-center transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-rose-500/60"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M21.35 12.23c0-.79-.07-1.55-.2-2.27H12v4.3h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.69 2.91-4.18 2.91-7.42Z"/>
                  <path fill="#34A853" d="M12 21.99c2.63 0 4.84-.87 6.45-2.34l-3.14-2.45c-.87.58-1.98.92-3.31.92-2.55 0-4.71-1.72-5.49-4.04H3.27v2.53A9.74 9.74 0 0 0 12 21.99Z"/>
                  <path fill="#FBBC05" d="M6.51 14.08A5.86 5.86 0 0 1 6.2 12c0-.72.12-1.42.31-2.08V7.39H3.27A9.97 9.97 0 0 0 2.25 12c0 1.66.4 3.23 1.02 4.61l3.24-2.53Z"/>
                  <path fill="#EA4335" d="M12 5.88c1.43 0 2.72.49 3.74 1.46l2.8-2.8C16.84 2.98 14.63 2 12 2a9.74 9.74 0 0 0-8.73 5.39l3.24 2.53C7.29 7.6 9.45 5.88 12 5.88Z"/>
                </svg>
              </button>

              <button
                type="button"
                onClick={handleGithubSignIn}
                disabled={loading}
                aria-label="Continue with GitHub"
                title="Continue with GitHub"
                className="w-12 h-12 rounded-xl border border-zinc-700 bg-[#08080C] hover:bg-zinc-900 hover:border-zinc-500 text-white flex items-center justify-center transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-rose-500/60"
              >
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                  <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
                </svg>
              </button>
            </div>
          </div>
        )}

        <div className="mt-5 pt-4 border-t border-zinc-800/80 flex items-center justify-between text-xs text-zinc-400">
          {mode === 'login' ? (
            <>
              <span>New to Site Forge AI?</span>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setInfoMessage(null);
                  setMode('signup');
                }}
                className="text-rose-400 hover:text-rose-300 font-semibold"
              >
                Create an account
              </button>
            </>
          ) : (
            <>
              <span>Already have an account?</span>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setInfoMessage(null);
                  setMode('login');
                }}
                className="text-rose-400 hover:text-rose-300 font-semibold"
              >
                Back to Sign In
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
