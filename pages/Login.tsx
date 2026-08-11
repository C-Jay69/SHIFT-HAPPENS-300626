import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAppStore } from '../store.tsx';
import { Loader2, Lock, LogIn, UserPlus, ArrowLeft } from 'lucide-react';

const Login = () => {
  const { login, register, isAuthenticated } = useAppStore();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) {
    navigate('/admin', { replace: true });
    return null;
  }

  const handleSubmit = async () => {
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(email, password);
        navigate('/admin', { replace: true });
      } else {
        await register(email, password);
        setMode('login');
        setError('Account created. Sign in with the same credentials.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-[80vh]">
      <div className="bg-white p-8 rounded-2xl shadow-2xl border border-gray-200 w-full max-w-sm text-center space-y-6">
        <div className="w-16 h-16 bg-gradient-to-br from-shift-blue to-shift-magenta rounded-full flex items-center justify-center mx-auto text-white">
          <Lock size={28} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-shift-dark">
            {mode === 'login' ? 'Sign In' : 'Create Account'}
          </h2>
          <p className="text-gray-500 text-sm">
            {mode === 'login'
              ? 'Access the SHIFT HAPPENS! console'
              : 'Register with the backend API (requires a database)'}
          </p>
        </div>

        <div className="space-y-4 text-left">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder="manager@restaurant.com"
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-shift-blue"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder="••••••••"
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-shift-blue"
            />
          </div>
        </div>

        {error && (
          <p className={`text-sm font-bold ${error.startsWith('Account created') ? 'text-green-600' : 'text-red-600'}`}>
            {error}
          </p>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading || !email || !password}
          className="w-full py-3 bg-shift-blue text-white font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? (
            <Loader2 size={18} className="animate-spin" />
          ) : mode === 'login' ? (
            <LogIn size={18} />
          ) : (
            <UserPlus size={18} />
          )}
          {mode === 'login' ? 'SIGN IN' : 'CREATE ACCOUNT'}
        </button>

        <button
          onClick={() => {
            setMode(mode === 'login' ? 'register' : 'login');
            setError('');
          }}
          className="text-sm font-bold text-gray-400 hover:text-shift-blue transition-colors"
        >
          {mode === 'login' ? 'Need an account? Register' : 'Already have an account? Sign in'}
        </button>

        <Link to="/" className="flex items-center justify-center gap-1 text-xs text-gray-300 hover:text-gray-500">
          <ArrowLeft size={12} /> Back to dashboard
        </Link>
      </div>
    </div>
  );
};

export default Login;
