import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useDispatch, useSelector } from 'react-redux';
import { Eye, EyeOff, Mail, Lock, User, ArrowRight, AlertCircle, Package } from 'lucide-react';
import type { AppDispatch, RootState } from '@/store';
import { registerUser, clearError } from '@/store/authSlice';

const RegisterPage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { isLoading, error, isAuthenticated } = useSelector((s: RootState) => s.auth);
  const [form,         setForm]         = useState({ name: '', email: '', password: '', confirm: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [valErr,       setValErr]       = useState('');

  useEffect(() => { if (isAuthenticated) navigate('/dashboard', { replace: true }); }, [isAuthenticated, navigate]);
  useEffect(() => () => { dispatch(clearError()); }, [dispatch]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValErr('');
    if (form.password !== form.confirm) { setValErr('Passwords do not match'); return; }
    if (form.password.length < 6)       { setValErr('Password must be at least 6 characters'); return; }
    dispatch(registerUser({ name: form.name, email: form.email, password: form.password }));
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA] p-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        className="w-full max-w-md">

        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 bg-gradient-to-br from-[#5B6CFF] to-[#3FAF7D] rounded-lg flex items-center justify-center">
            <Package className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-bold text-gray-900">Item<span className="text-[#5B6CFF]">Lend</span></span>
        </div>

        <div className="bg-white rounded-3xl shadow-xl p-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900">Create your account</h2>
            <p className="mt-2 text-gray-500">Join with your university email and get <strong>100 points</strong> free 🎉</p>
          </div>

          {(error || valErr) && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-700">{valErr || error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {[
              { key: 'name',  label: 'Full Name',        icon: User, type: 'text',  placeholder: 'John Doe'                            },
              { key: 'email', label: 'University Email', icon: Mail, type: 'email', placeholder: 'you@mahindrauniversity.edu.in'        },
            ].map(({ key, label, icon: Icon, type, placeholder }) => (
              <div key={key} className="space-y-2">
                <label className="text-sm font-medium text-gray-700">{label}</label>
                <div className="relative">
                  <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input type={type} value={(form as any)[key]} required placeholder={placeholder}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    className="w-full pl-10 pr-4 h-12 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B6CFF]/30 focus:border-[#5B6CFF] text-sm transition-colors" />
                </div>
              </div>
            ))}

            {(['password', 'confirm'] as const).map(key => (
              <div key={key} className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  {key === 'password' ? 'Password' : 'Confirm Password'}
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input type={showPassword ? 'text' : 'password'} value={form[key]} required
                    placeholder={key === 'password' ? 'Min. 6 characters' : 'Repeat password'}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    onKeyDown={key === 'confirm' ? (e => { if (e.key === 'Enter') { e.preventDefault(); handleSubmit(e as any); } }) : undefined}
                    className="w-full pl-10 pr-10 h-12 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B6CFF]/30 focus:border-[#5B6CFF] text-sm transition-colors" />
                  {key === 'password' && (
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  )}
                </div>
              </div>
            ))}

            <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700">
              Only <code className="bg-blue-100 px-1 rounded">@mahindrauniversity.edu.in</code> email addresses are accepted.
            </div>

            <button type="submit" disabled={isLoading}
              className="w-full h-12 bg-[#5B6CFF] hover:bg-[#4a5be0] disabled:opacity-60 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2">
              {isLoading
                ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <>Create Account <ArrowRight className="w-5 h-5" /></>}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-600">
            Already have an account?{' '}
            <Link to="/login" className="text-[#5B6CFF] hover:text-[#4a5be0] font-semibold">Sign in</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default RegisterPage;
