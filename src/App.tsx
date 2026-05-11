import { 
  BrowserRouter as Router, 
  Routes, 
  Route, 
  Navigate,
  Link,
  useLocation,
  useNavigate
} from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { InAppBrowserGuard } from './components/InAppBrowserGuard';
import { 
  BookOpen, 
  Library, 
  User, 
  LogOut, 
  Search, 
  Clock, 
  CheckCircle,
  Plus,
  ArrowRight,
  Menu,
  X,
  CreditCard,
  Settings,
  Mail,
  Lock,
  User as UserIcon,
  Loader2,
  Building
} from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { cn } from './lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from './lib/firebase';
import { Apartment, Block } from './types';

import { Catalog } from './pages/Catalog';
import { MyLoans } from './pages/MyLoans';
import { Admin } from './pages/Admin';
import { Profile } from './pages/Profile';

import { ResidencyInfo } from './components/ResidencyInfo';

function Shell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();

  if (user && !user.active && user.role !== 'ADMIN') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
            <Lock className="h-10 w-10" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Aguardando Aprovação</h2>
          <p className="mt-4 text-slate-500">
            Olá, <span className="font-bold">{user.name}</span>! Seu cadastro foi recebido com sucesso.
          </p>
          <p className="mt-2 text-sm text-slate-400">
            Por segurança, um administrador precisa validar seu cadastro antes de liberar o acesso ao catálogo.
          </p>
          <div className="mt-8 space-y-3">
             <div className="rounded-lg bg-slate-50 p-4 text-left text-xs text-slate-500">
                <p className="font-bold uppercase mb-1">Informações enviadas:</p>
                <p>Residência: {user.residencyNote || 'Não informada'}</p>
                <p>E-mail: {user.email}</p>
             </div>
             <button 
               onClick={logout}
               className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 py-3 font-semibold text-slate-600 hover:bg-slate-50 transition-all"
             >
               <LogOut className="h-4 w-4" /> Sair
             </button>
          </div>
        </div>
      </div>
    );
  }

  const navItems = [
    { label: 'Catálogo', path: '/', icon: Library },
    { label: 'Meus Empréstimos', path: '/loans', icon: Clock },
    { label: 'Perfil', path: '/profile', icon: UserIcon },
    ...(user?.role === 'ADMIN' ? [{ label: 'Admin', path: '/admin', icon: Settings }] : []),
  ];

  const displayName = user?.name && user.name !== 'Morador' ? user.name : 'Configurar Perfil';

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Navbar */}
      <nav className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-200">
              <BookOpen className="h-6 w-6" />
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900 uppercase">Clube do Livro</span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex md:items-center md:gap-4">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  location.pathname === item.path 
                    ? "bg-indigo-50 text-indigo-700" 
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
            <div className="ml-4 flex items-center gap-3 border-l border-slate-200 pl-4">
              <div className="flex flex-col items-end">
                <span className={cn(
                  "text-sm font-semibold",
                  user?.name === 'Morador' ? "text-amber-600" : "text-slate-900"
                )}>
                  {displayName}
                </span>
                <ResidencyInfo 
                   apartmentNumber={user?.apartmentNumber} 
                   apartmentBlock={user?.apartmentBlock}
                   residencyNote={user?.residencyNote}
                   className="text-[10px] text-slate-500 font-medium"
                   showIcon={false}
                />
              </div>
              <button 
                onClick={logout}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Mobile Menu Button */}
          <button 
            className="md:hidden rounded-lg p-2 text-slate-600 hover:bg-slate-100"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </nav>

      {/* Mobile Nav */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed inset-x-0 top-16 z-30 border-b border-slate-200 bg-white md:hidden"
          >
            <div className="space-y-1 p-4">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-3 text-base font-medium",
                    location.pathname === item.path 
                      ? "bg-indigo-50 text-indigo-700" 
                      : "text-slate-600 active:bg-slate-50"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </Link>
              ))}
              <div className="mt-4 border-t border-slate-100 pt-4 pb-2 px-3">
                <div className="flex items-center gap-3">
                  <div className="flex flex-col">
                    <span className={cn(
                      "text-sm font-semibold",
                      user?.name === 'Morador' ? "text-amber-600" : "text-slate-900"
                    )}>
                      {displayName}
                    </span>
                    <ResidencyInfo 
                      apartmentNumber={user?.apartmentNumber} 
                      apartmentBlock={user?.apartmentBlock}
                      residencyNote={user?.residencyNote}
                      className="text-xs text-slate-500 font-medium"
                      showIcon={false}
                    />
                  </div>
                  <button 
                    onClick={logout}
                    className="ml-auto flex items-center gap-2 text-sm font-medium text-red-600"
                  >
                    Sair
                    <LogOut className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}

function Login() {
  const { user, signIn, signInWithEmail, signUpWithEmail, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [selectedBlock, setSelectedBlock] = useState('');
  const [selectedApto, setSelectedApto] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (isRegistering) {
        if (!name) throw new Error('Nome é obrigatório');
        if (!selectedApto) throw new Error('Descrição da residência é obrigatória');
        
        console.log('Starting registration...');
        await signUpWithEmail(email, password, name, selectedApto);
        
        // Clear form and show success
        setName('');
        setEmail('');
        setPassword('');
        setSelectedApto('');
        setIsRegistering(false);
        setError('CADASTRO REALIZADO COM SUCESSO! Aguarde a aprovação do administrador para acessar o sistema.');
      } else {
        await signInWithEmail(email, password);
      }
    } catch (err: any) {
      console.error('Submit error:', err);
      if (err.code === 'auth/email-already-in-use' || err.message?.includes('already-in-use')) {
        setError('Este e-mail já possui uma conta no sistema de login. Tente "Entrar" com sua senha.');
      } else if (err.code === 'auth/invalid-credential' || err.message?.includes('invalid-credential')) {
        setError('E-mail ou senha inválidos. Verifique seus dados.');
      } else if (err.message?.includes('permission-denied') || err.code?.includes('permission-denied')) {
        setError('Erro de permissão no banco de dados. Contate o administrador.');
      } else {
        setError(err.message || 'Erro ao realizar autenticação');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setSubmitting(true);
    try {
      await signIn();
    } catch (err: any) {
      console.error('Google sign-in button error:', err);
      setError(err.message || 'Erro ao entrar com Google');
    } finally {
      if (!isMobile()) {
        setSubmitting(false);
      }
    }
  };

  // Helper to detect mobile just for the submitting state logic
  const isMobile = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl shadow-slate-200">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-200">
            <BookOpen className="h-10 w-10" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Clube do Livro</h1>
          <p className="mt-2 text-slate-500">O sistema de compartilhamento de livros do seu condomínio.</p>
        </div>

        {error && (
          <div className={cn(
            "mb-6 rounded-lg p-3 text-sm font-medium border",
            error.includes('sucesso') 
              ? "bg-emerald-50 text-emerald-700 border-emerald-100" 
              : "bg-red-50 text-red-600 border-red-100"
          )}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 mb-6">
          {isRegistering && (
            <>
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Nome Completo</label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm outline-none transition-all focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10"
                    placeholder="Seu nome"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Residência (Bloco e Apto)</label>
                <div className="relative">
                  <Building className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={selectedApto}
                    onChange={(e) => setSelectedApto(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm outline-none transition-all focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10"
                    placeholder="Ex: Bloco 2, Apto 201"
                  />
                </div>
                <p className="text-[10px] text-slate-400 italic ml-1">
                  Seu acesso será liberado após conferência pelo administrador.
                </p>
              </div>
            </>
          )}
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">E-mail</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm outline-none transition-all focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10"
                placeholder="exemplo@email.com"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Senha</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm outline-none transition-all focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10"
                placeholder="******"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting || authLoading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-4 font-bold text-white shadow-lg shadow-indigo-100 transition-all hover:bg-indigo-700 active:scale-95 disabled:opacity-50"
          >
            {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : (isRegistering ? 'Criar Conta' : 'Entrar')}
          </button>
        </form>

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-2 text-slate-400 font-bold tracking-widest">ou</span>
          </div>
        </div>

        <button
          onClick={handleGoogleSignIn}
          disabled={submitting || authLoading}
          className="flex w-full items-center justify-center gap-3 rounded-xl bg-white border border-slate-200 px-6 py-4 font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-[0.98] disabled:opacity-50"
        >
          {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : (
            <>
              <img src="https://www.google.com/favicon.ico" className="h-5 w-5" alt="Google" />
              Entrar com Google
            </>
          )}
        </button>

        <p className="mt-8 text-center text-sm text-slate-500">
          {isRegistering ? 'Já tem uma conta?' : 'Novo por aqui?'}
          <button
            onClick={() => setIsRegistering(!isRegistering)}
            className="ml-1 font-bold text-indigo-600 hover:underline px-1"
          >
            {isRegistering ? 'Entrar' : 'Cadastre-se'}
          </button>
        </p>

        <p className="mt-8 text-center text-xs text-slate-400 italic">
          Ao entrar, você concorda com as regras de convivência e empréstimo do condomínio.
        </p>
      </div>
    </div>
  );
}

function PrivateRoute({ children, adminOnly = false }: { children: React.ReactNode, adminOnly?: boolean }) {
  const { user, loading } = useAuth();

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
    </div>
  );

  if (!user) return <Navigate to="/login" />;
  if (adminOnly && user.role !== 'ADMIN') return <Navigate to="/" />;

  return <Shell>{children}</Shell>;
}

export default function App() {
  return (
    <AuthProvider>
      <InAppBrowserGuard>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<PrivateRoute><Catalog /></PrivateRoute>} />
            <Route path="/loans" element={<PrivateRoute><MyLoans /></PrivateRoute>} />
            <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
            <Route path="/admin" element={<PrivateRoute adminOnly><Admin /></PrivateRoute>} />
          </Routes>
        </Router>
      </InAppBrowserGuard>
    </AuthProvider>
  );
}
