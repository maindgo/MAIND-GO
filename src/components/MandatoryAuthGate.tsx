import {Lock, LogIn, UserPlus} from 'lucide-react';
import {useState} from 'react';
import {useAuth} from '../context/AuthContext';
import {UnitSystem} from '../types/weather';

interface MandatoryAuthGateProps {
  units: UnitSystem;
}

export function MandatoryAuthGate({units}: MandatoryAuthGateProps) {
  const {authBusy, authError, clearAuthError, signInWithGoogle} = useAuth();
  const [authTab, setAuthTab] = useState<'signup' | 'login'>('signup');
  const [signupName, setSignupName] = useState('');
  const [signupUnits, setSignupUnits] = useState<UnitSystem>(units);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="mandatory-auth-title"
      className="fixed inset-0 z-50 bg-[#07090E]/92 backdrop-blur-md p-4 sm:p-6 flex items-center justify-center overflow-y-auto"
    >
      <div className="max-w-md w-full bg-[#0B0E17] border border-slate-700/90 rounded-2xl p-6 sm:p-8 space-y-5 shadow-2xl">
        <div className="text-center space-y-2">
          <div className="w-11 h-11 rounded-xl bg-cyan-500/15 border border-cyan-500/35 flex items-center justify-center mx-auto">
            <Lock className="w-5 h-5 text-cyan-400" aria-hidden="true" />
          </div>
          <p className="text-xs font-mono tracking-wider uppercase text-cyan-300">
            MAIND GO Free Watch Trial Complete
          </p>
          <h2 id="mandatory-auth-title" className="font-display text-2xl font-bold text-white text-balance">
            Sign Up or Log In to Continue
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            Your free preview has ended. Create a free MAIND GO account or log in to continue using live satellite radar, hourly charts, and saved locations.
          </p>
        </div>

        <div className="grid grid-cols-2 p-1 bg-[#111827] border border-slate-800 rounded-xl">
          <button
            type="button"
            onClick={() => {
              setAuthTab('signup');
              clearAuthError();
            }}
            className={`py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
              authTab === 'signup' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Sign Up</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthTab('login');
              clearAuthError();
            }}
            className={`py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
              authTab === 'login' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Log In</span>
          </button>
        </div>

        {authTab === 'signup' && (
          <div className="space-y-3">
            <div>
              <label htmlFor="gate-display-name" className="block text-xs text-slate-400 mb-1">
                Display Name (optional)
              </label>
              <input
                id="gate-display-name"
                type="text"
                maxLength={80}
                value={signupName}
                onChange={(e) => setSignupName(e.target.value)}
                placeholder="How should MAIND GO greet you?"
                className="w-full px-3 py-2 rounded-lg bg-[#111827] border border-slate-700 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div>
              <span className="block text-xs text-slate-400 mb-1">Preferred Units</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSignupUnits('METRIC')}
                  className={`py-2 rounded-lg border text-xs font-mono transition-colors ${
                    signupUnits === 'METRIC'
                      ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-300'
                      : 'bg-[#111827] border-slate-800 text-slate-400'
                  }`}
                >
                  °C Metric
                </button>
                <button
                  type="button"
                  onClick={() => setSignupUnits('IMPERIAL')}
                  className={`py-2 rounded-lg border text-xs font-mono transition-colors ${
                    signupUnits === 'IMPERIAL'
                      ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-300'
                      : 'bg-[#111827] border-slate-800 text-slate-400'
                  }`}
                >
                  °F Imperial
                </button>
              </div>
            </div>
          </div>
        )}

        {authError && (
          <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800/60 text-xs text-rose-200">
            {authError}
          </div>
        )}

        <button
          type="button"
          disabled={authBusy}
          onClick={() =>
            void signInWithGoogle(
              authTab === 'signup'
                ? {displayName: signupName || undefined, preferredUnits: signupUnits}
                : undefined
            )
          }
          className="w-full py-2.5 px-4 rounded-lg bg-cyan-500 text-slate-950 font-semibold text-sm hover:bg-cyan-400 disabled:opacity-60 flex items-center justify-center gap-2 transition-colors"
        >
          <span>
            {authBusy
              ? 'Connecting...'
              : authTab === 'signup'
                ? 'Sign Up with Google'
                : 'Log In with Google'}
          </span>
        </button>

        <p className="text-[11px] text-center text-slate-500">
          Signing in unlocks continued access and syncs your saved weather stations across sessions.
        </p>
      </div>
    </div>
  );
}
