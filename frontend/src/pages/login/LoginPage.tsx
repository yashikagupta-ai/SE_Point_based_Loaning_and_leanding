import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useDispatch, useSelector } from 'react-redux';
import { Eye, EyeOff, Mail, Lock, ArrowRight, AlertCircle, Package, Coins, ShieldCheck, Users } from 'lucide-react';
import type { AppDispatch, RootState } from '@/store';
import { loginUser, clearError } from '@/store/authSlice';

const LoginPage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { isLoading, error, isAuthenticated } = useSelector((s: RootState) => s.auth);
  const [email,        setEmail]        = useState('');
  const [password,     setPassword]     = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => { if (isAuthenticated) navigate('/dashboard', { replace: true }); }, [isAuthenticated, navigate]);
  useEffect(() => () => { dispatch(clearError()); }, [dispatch]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    dispatch(loginUser({ email, password }));
  };

  const features = [
    { icon: Package, text: 'Post items you want to lend out'       },
    { icon: Coins,   text: 'Borrow items by paying with points'    },
    { icon: ShieldCheck, text: 'KYC-verified community'            },
    { icon: Users,   text: 'Mahindra University students only'     },
  ];

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-3/5 bg-gradient-to-br from-[#5B6CFF] to-[#3FAF7D] relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-64 h-64 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-white rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 flex flex-col justify-between p-12 xl:p-20 w-full">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-lg">
              <Package className="w-7 h-7 text-[#5B6CFF]" />
            </div>
            <span className="text-2xl font-bold text-white">Item<span className="text-white/80">Lend</span></span>
          </div>

          <div className="max-w-lg">
            <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className="text-4xl xl:text-5xl font-bold text-white leading-tight">
              Lend items, <span className="text-white/85">earn points</span>
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              className="mt-6 text-lg text-white/80">
              A peer-to-peer item lending platform for the Mahindra University community. Have something useful? Lend it and earn points. Need something? Borrow it with points.
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
              className="mt-10 space-y-4">
              {features.map((f, i) => (
                <div key={i} className="flex items-center gap-3 text-white/90">
                  <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                    <f.icon className="w-5 h-5" />
                  </div>
                  <span>{f.text}</span>
                </div>
              ))}
            </motion.div>
          </div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
            className="flex gap-12">
            {[['100 pts', 'Signup Bonus'], ['Free', 'To Join'], ['KYC', 'Verified Only']].map(([val, label]) => (
              <div key={label}>
                <p className="text-3xl font-bold text-white">{val}</p>
                <p className="text-white/70">{label}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 bg-[#F8F9FA]">
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}
          className="w-full max-w-md">
          <div className="lg:hidden flex items-center justify-center gap-2 mb-8">
            <div className="w-10 h-10 bg-gradient-to-br from-[#5B6CFF] to-[#3FAF7D] rounded-lg flex items-center justify-center">
              <Package className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">Item<span className="text-[#5B6CFF]">Lend</span></span>
          </div>

          <div className="bg-white rounded-3xl shadow-xl p-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900">Welcome back</h2>
              <p className="mt-2 text-gray-500">Sign in with your university email</p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                    placeholder="you@mahindrauniversity.edu.in"
                    className="w-full pl-10 pr-4 h-12 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B6CFF]/30 focus:border-[#5B6CFF] text-sm transition-colors" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input type={showPassword ? 'text' : 'password'} value={password}
                    onChange={e => setPassword(e.target.value)} required placeholder="Enter your password"
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); dispatch(loginUser({ email, password })); } }}
                    className="w-full pl-10 pr-10 h-12 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B6CFF]/30 focus:border-[#5B6CFF] text-sm transition-colors" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="flex justify-end">
                <Link to="/forgot-password" className="text-sm text-[#5B6CFF] hover:text-[#4a5be0] font-medium">
                  Forgot password?
                </Link>
              </div>

              <button type="submit" disabled={isLoading}
                className="w-full h-12 bg-[#5B6CFF] hover:bg-[#4a5be0] disabled:opacity-60 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2">
                {isLoading
                  ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <>Sign In <ArrowRight className="w-5 h-5" /></>}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-gray-600">
              Don't have an account?{' '}
              <Link to="/register" className="text-[#5B6CFF] hover:text-[#4a5be0] font-semibold">Create one</Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default LoginPage;
