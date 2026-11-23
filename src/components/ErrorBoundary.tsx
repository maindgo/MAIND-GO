import {Component, ErrorInfo, ReactNode} from 'react';
import {AlertTriangle, RefreshCw} from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {hasError: false, errorMessage: ''};
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || 'An unexpected error occurred.',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Application ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-screen bg-[#07090E] text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-[#0B0E17] border border-rose-500/40 rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h1 className="font-display text-lg font-semibold text-white">Application Recovery</h1>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed break-words">
              A service error interrupted this view. Please reload to restore live weather telemetry.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500 text-slate-950 text-xs font-semibold hover:bg-cyan-400 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reload MAIND GO</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
