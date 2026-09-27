'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  Lock,
  User,
  Eye,
  EyeOff,
  Sparkles,
  ShieldCheck,
  GraduationCap,
  BookOpen,
  KeyRound,
  ArrowRight,
  Database,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';

export default function LoginPage() {
  const { user, login } = useAuth();
  const router = useRouter();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'student' | 'faculty' | 'admin'>('student');

  useEffect(() => {
    if (user) {
      router.push('/');
    }
  }, [user, router]);

  const handleQuickFill = (role: 'student' | 'faculty' | 'admin') => {
    setActiveTab(role);
    setError('');
    if (role === 'student') {
      setUsername('student');
      setPassword('fdsa4321');
    } else if (role === 'faculty') {
      setUsername('faculty');
      setPassword('asdf1234');
    } else if (role === 'admin') {
      setUsername('admin');
      setPassword('asdf4321');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Please enter both username and password.');
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      const res = await login(username, password);
      if (!res.success) {
        setError(res.error || 'Invalid credentials. Please try again.');
      }
    } catch (err: any) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/60 relative overflow-hidden">
      {/* Background Decorative Glows */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-pink-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Main Login Card */}
      <div className="w-full max-w-md bg-slate-900/80 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-8 shadow-2xl relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 p-0.5 shadow-lg shadow-indigo-500/20 mb-3">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
              <Sparkles className="w-7 h-7 text-indigo-400" />
            </div>
          </div>
          <h1 className="text-2xl font-bold font-heading text-white tracking-tight">
            Research Dashboard Login
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Spatial Multi-Omics Benchmark & Analysis Platform
          </p>
        </div>

        {/* Quick Role Selector Pills */}
        <div className="mb-6">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
            <span>Select Master Role</span>
            <span className="text-[10px] text-indigo-400 font-normal">1-Click Auto-Fill</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => handleQuickFill('student')}
              className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-medium transition-all ${
                activeTab === 'student'
                  ? 'bg-indigo-500/20 border-indigo-500/60 text-indigo-300 shadow-sm shadow-indigo-500/10'
                  : 'bg-slate-800/50 border-slate-700/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <BookOpen className="w-4 h-4 mb-1 text-indigo-400" />
              <span>Student</span>
            </button>

            <button
              type="button"
              onClick={() => handleQuickFill('faculty')}
              className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-medium transition-all ${
                activeTab === 'faculty'
                  ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300 shadow-sm shadow-emerald-500/10'
                  : 'bg-slate-800/50 border-slate-700/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <GraduationCap className="w-4 h-4 mb-1 text-emerald-400" />
              <span>Faculty</span>
            </button>

            <button
              type="button"
              onClick={() => handleQuickFill('admin')}
              className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-medium transition-all ${
                activeTab === 'admin'
                  ? 'bg-pink-500/20 border-pink-500/60 text-pink-300 shadow-sm shadow-pink-500/10'
                  : 'bg-slate-800/50 border-slate-700/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <ShieldCheck className="w-4 h-4 mb-1 text-pink-400" />
              <span>Admin</span>
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-5 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Username
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <User className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="student / faculty / admin"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950/60 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all font-sans"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full pl-10 pr-10 py-2.5 bg-slate-950/60 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all font-sans"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-2 py-3 px-4 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:from-indigo-600 hover:via-purple-600 hover:to-pink-600 text-white font-medium text-sm rounded-xl shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Verifying Secure Access...</span>
              </>
            ) : (
              <>
                <span>Sign In to Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Security / Database Footer Note */}
        <div className="mt-6 pt-5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-indigo-400" />
            <span>MongoDB + Bcrypt Hash</span>
          </div>
          <div className="flex items-center gap-1 text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>JWT Secure Session</span>
          </div>
        </div>
      </div>
    </div>
  );
}
