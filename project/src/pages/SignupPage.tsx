import { useState, FormEvent, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Mail, Lock, User, AlertCircle, Loader2, ArrowRight, Calendar, Sparkles, CheckCircle2 } from 'lucide-react';
import { CATEGORY_ICONS, CATEGORY_LABELS, CATEGORY_LIST } from '@/lib/categories';
import type { UserRole, TalentCategory } from '@/types';

export default function SignupPage() {
  const { signUp, signInWithGoogle, session, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState<UserRole>('host');
  const [talentCategory, setTalentCategory] = useState<TalentCategory>('singer_vocalist');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);

  useEffect(() => {
    if (session && !authLoading) {
      navigate('/', { replace: true });
    }
  }, [session, authLoading, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setSubmitting(true);
    const { error } = await signUp(email, password, role, fullName, role === 'artist' ? talentCategory : undefined);
    setSubmitting(false);
    if (error) setError(error);
    else setSignupSuccess(true);
  };

  const handleGoogleSignUp = async () => {
    setError('');
    if (!fullName.trim()) { setError('Please enter your full name first'); return; }
    setGoogleLoading(true);
    const { error } = await signInWithGoogle(role, fullName.trim(), role === 'artist' ? talentCategory : undefined);
    if (error) {
      setError(error);
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-paper relative">
      {/* Left: form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 overflow-y-auto">
        <div className="w-full max-w-sm animate-scale-in py-8">
          <Link to="/" aria-label="HostMeUp home" className="font-display text-2xl font-bold text-ink tracking-tightest mb-10 inline-block">HostMeUp</Link>

          <h1 className="font-display text-3xl font-bold text-ink mb-2">Create your account.</h1>
          <p className="text-sm text-ink-400 mb-8">Choose your role and get started.</p>

          {/* Role selection */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <button type="button" onClick={() => setRole('host')}
              className={`flex flex-col items-center gap-2 p-5 border-2 transition-all rounded-none ${role === 'host' ? 'border-ink bg-ink text-paper' : 'border-line text-ink-500 hover:border-ink/30'}`}>
              <Calendar className="w-5 h-5" />
              <span className="text-sm font-semibold">I'm a Host</span>
              <span className={`text-xs ${role === 'host' ? 'text-paper/60' : 'text-ink-300'}`}>Book talent</span>
            </button>
            <button type="button" onClick={() => setRole('artist')}
              className={`flex flex-col items-center gap-2 p-5 border-2 transition-all rounded-none ${role === 'artist' ? 'border-ink bg-ink text-paper' : 'border-line text-ink-500 hover:border-ink/30'}`}>
              <Sparkles className="w-5 h-5" />
              <span className="text-sm font-semibold">I'm Talent</span>
              <span className={`text-xs ${role === 'artist' ? 'text-paper/60' : 'text-ink-300'}`}>Get booked</span>
            </button>
          </div>

          {/* Talent category */}
          {role === 'artist' && (
            <div className="mb-6 animate-fade-in">
              <label className="block text-xs uppercase tracking-wide-sm text-ink-400 mb-2">Talent Category</label>
              <div className="grid grid-cols-2 gap-2">
                {CATEGORY_LIST.map((cat) => {
                  const Icon = CATEGORY_ICONS[cat.value];
                  return (
                    <button key={cat.value} type="button" onClick={() => setTalentCategory(cat.value)}
                      className={`flex items-center gap-2 p-3 border text-left transition-all rounded-none ${talentCategory === cat.value ? 'border-accent bg-accent-50 text-accent' : 'border-line text-ink-500 hover:border-ink/30'}`}>
                      <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="text-xs font-medium leading-tight">{cat.shortLabel}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-ink-300 mt-2">{CATEGORY_LABELS[talentCategory]}</p>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 p-3 mb-6 border border-red-200 bg-red-50 text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /><span>{error}</span>
            </div>
          )}

          {signupSuccess && (
            <div className="flex items-start gap-2 p-4 mb-6 border border-emerald-200 bg-emerald-50 text-emerald-800 text-sm">
              <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>Account created successfully. Redirecting you now...</span>
            </div>
          )}

          {/* Google sign-in */}
          <button onClick={handleGoogleSignUp} disabled={googleLoading || submitting}
            className="w-full flex items-center justify-center gap-3 py-3.5 border border-line text-sm font-medium text-ink-600 hover:bg-paper-200 transition-colors disabled:opacity-50 mb-4">
            {googleLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.23 0 2.35.42 3.23 1.25l2.37-2.37C17.46 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            )}
            Continue with Google
          </button>

          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-line" />
            <span className="text-xs text-ink-300 uppercase tracking-wide-sm">or</span>
            <div className="flex-1 h-px bg-line" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs uppercase tracking-wide-sm text-ink-400 mb-2">Full Name</label>
              <div className="relative">
                <User className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-300" />
                <input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)}
                  className="input-editorial w-full pl-8 pr-4 py-3 text-sm" placeholder="Jane Doe" />
              </div>
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wide-sm text-ink-400 mb-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-300" />
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  className="input-editorial w-full pl-8 pr-4 py-3 text-sm" placeholder="you@example.com" />
              </div>
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wide-sm text-ink-400 mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-300" />
                <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                  className="input-editorial w-full pl-8 pr-4 py-3 text-sm" placeholder="At least 6 characters" />
              </div>
            </div>
            <button type="submit" disabled={submitting}
              className="btn-primary w-full flex items-center justify-center gap-2 py-3.5 text-xs uppercase tracking-wide-sm disabled:opacity-50">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Create Account <ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>

          <p className="text-sm text-center text-ink-400 mt-8">
            Already have an account? <Link to="/login" aria-label="Sign in to your account" className="font-medium text-ink hover:text-accent transition-colors">Sign in</Link>
          </p>
        </div>
      </div>

      {/* Right: image */}
      <div className="hidden lg:block w-2/5 relative overflow-hidden bg-paper-300">
        <img src="https://images.pexels.com/photos/28863302/pexels-photo-28863302.jpeg?auto=compress&cs=tinysrgb&h=1200&w=800"
          alt="Creative professional preparing for a photoshoot" width={800} height={1200} className="absolute inset-0 w-full h-full object-cover" />
      </div>

      {/* Credit */}
      <div className="absolute bottom-4 left-0 right-0 text-center">
        <p className="text-xs text-ink-300">Designed & Developed by Sakhele Mbatha</p>
      </div>
    </div>
  );
}
