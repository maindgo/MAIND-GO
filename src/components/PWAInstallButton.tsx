import {Download, Share, X} from 'lucide-react';
import {useState} from 'react';
import {usePWAInstall} from '../hooks/usePWAInstall';

export function PWAInstallButton() {
  const {canInstall, isInstalled, isIOS, triggerInstall} = usePWAInstall();
  const [showIosModal, setShowIosModal] = useState(false);

  if (isInstalled || (!canInstall && !isIOS)) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (canInstall) {
            void triggerInstall();
          } else {
            setShowIosModal(true);
          }
        }}
        title="Install MAIND GO App"
        className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-2 min-h-[38px] rounded-lg bg-[#111827] border border-slate-700/80 hover:border-cyan-400/60 text-xs font-medium text-slate-200 hover:text-white whitespace-nowrap shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
      >
        <Download className="w-3.5 h-3.5 text-cyan-400 shrink-0" aria-hidden="true" />
        <span className="hidden lg:inline">Install App</span>
      </button>

      {showIosModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-ios-title"
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="max-w-sm w-full bg-[#0B0E17] border border-slate-700/90 rounded-2xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="pwa-ios-title" className="font-display text-base font-bold text-white">
                  Install MAIND GO on iOS
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Add MAIND GO to your home screen for full-screen radar and weather alerts.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowIosModal(false)}
                aria-label="Close installation guide"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <ol className="space-y-2.5 text-xs text-slate-200 bg-[#111827] border border-slate-800 rounded-xl p-3.5">
              <li className="flex items-center gap-2.5">
                <span className="w-5 h-5 rounded bg-cyan-500/20 text-cyan-300 font-mono text-[11px] flex items-center justify-center shrink-0">
                  1
                </span>
                <span className="flex items-center gap-1">
                  Tap the <Share className="w-3.5 h-3.5 text-cyan-400 inline" /> Share button in Safari.
                </span>
              </li>
              <li className="flex items-center gap-2.5">
                <span className="w-5 h-5 rounded bg-cyan-500/20 text-cyan-300 font-mono text-[11px] flex items-center justify-center shrink-0">
                  2
                </span>
                <span>Scroll down and select &quot;Add to Home Screen&quot;.</span>
              </li>
              <li className="flex items-center gap-2.5">
                <span className="w-5 h-5 rounded bg-cyan-500/20 text-cyan-300 font-mono text-[11px] flex items-center justify-center shrink-0">
                  3
                </span>
                <span>Tap &quot;Add&quot; to launch MAIND GO as an app.</span>
              </li>
            </ol>

            <button
              type="button"
              onClick={() => setShowIosModal(false)}
              className="w-full py-2.5 rounded-lg bg-cyan-500 text-slate-950 font-semibold text-xs hover:bg-cyan-400 transition-colors"
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </>
  );
}
