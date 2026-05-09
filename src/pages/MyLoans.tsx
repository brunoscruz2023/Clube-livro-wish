import React, { useState, useEffect } from 'react';
import { BookLoan, Book, Location } from '../types';
import { BookService } from '../services/BookService';
import { collection, query, where, getDocs, doc, getDoc, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { 
  Clock, 
  RotateCcw, 
  CheckCircle2, 
  History, 
  Book as BookIcon, 
  Calendar,
  MapPin,
  AlertCircle,
  Home,
  Building
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface ActiveLoan extends BookLoan {
  book: Book;
}

export function MyLoans() {
  const [loans, setLoans] = useState<ActiveLoan[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const [returningId, setReturningId] = useState<string | null>(null);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<ActiveLoan | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>('MY_APARTMENT');

  useEffect(() => {
    if (user?.apartmentId) {
      loadLoans();
      loadLocations();
    }
  }, [user]);

  async function loadLocations() {
    try {
      const q = query(collection(db, 'locations'), where('active', '==', true), orderBy('name'));
      const snapshot = await getDocs(q);
      setLocations(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Location)));
    } catch (err) {
      console.error("Error loading locations:", err);
    }
  }

  async function loadLoans() {
    if (!user?.apartmentId) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, 'book_loans'),
        where('apartmentId', '==', user.apartmentId),
        where('status', '==', 'ACTIVE')
      );
      const snapshot = await getDocs(q);
      const loansData = await Promise.all(snapshot.docs.map(async (d) => {
        const loan = { id: d.id, ...d.data() } as BookLoan;
        const bookDoc = await getDoc(doc(db, 'books', loan.bookId));
        return {
          ...loan,
          book: { id: bookDoc.id, ...bookDoc.data() } as Book
        };
      }));
      setLoans(loansData);
    } catch (error) {
      console.error(error);
    }
    setLoading(false);
  }

  const handleRenew = async (loanId: string) => {
    try {
      await BookService.renewLoan(loanId);
      alert('Renovação realizada!');
      loadLoans();
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleReturnClick = (loan: ActiveLoan) => {
    setSelectedLoan(loan);
    setSelectedLocationId('MY_APARTMENT');
    setShowReturnModal(true);
  };

  const confirmReturn = async () => {
    if (!selectedLoan || !user) return;

    let finalType: any = 'FIXED_POINT';
    let finalLabel = '';

    if (selectedLocationId === 'MY_APARTMENT') {
      finalType = 'APARTMENT';
      const blockPart = user.apartmentBlock ? ` - ${user.apartmentBlock}` : '';
      finalLabel = `Apto ${user.apartmentNumber || 'do Morador'}${blockPart}`;
    } else {
      const loc = locations.find(l => l.id === selectedLocationId);
      finalLabel = loc?.name || '';
    }

    setReturningId(selectedLoan.id);
    try {
      await BookService.returnLoan(selectedLoan.id, selectedLoan.bookId, {
        type: finalType,
        label: finalLabel
      });
      setShowReturnModal(false);
      alert('Livro devolvido! Obrigado.');
      loadLoans();
    } catch (error: any) {
      console.error(error);
      alert(error.message || 'Erro ao devolver');
    } finally {
      setReturningId(null);
    }
  };

  if (!user?.apartmentId) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle className="mb-4 h-12 w-12 text-amber-500" />
        <h2 className="text-2xl font-bold">Apartamento não configurado</h2>
        <p className="mt-2 text-slate-500">Vá ao seu perfil para definir o seu número de apartamento.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Empréstimos Ativos</h1>
          <p className="mt-1 text-slate-500">Gerencie os livros que estão com o Apto {user.apartmentId}.</p>
        </div>
        <div className="flex items-center gap-2 rounded-2xl bg-indigo-50 px-4 py-2 text-indigo-700 border border-indigo-100">
           <BookIcon className="h-5 w-5" />
           <span className="font-bold">{loans.length} / 3</span>
        </div>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
        </div>
      ) : loans.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl bg-white border border-slate-100 p-20 text-center shadow-sm">
          <History className="mb-4 h-12 w-12 text-slate-200" />
          <h3 className="text-xl font-semibold text-slate-900">Nenhum empréstimo ativo</h3>
          <p className="mt-2 text-slate-500">Que tal pegar um livro novo no catálogo?</p>
        </div>
      ) : (
        <div className="grid gap-6">
          {loans.map((loan) => {
            const dueDate = loan.dueAt.toDate();
            const daysLeft = differenceInDays(dueDate, new Date());
            const isOverdue = daysLeft < 0;

            return (
              <motion.div
                layout
                key={loan.id}
                className="flex flex-col overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-sm md:flex-row"
              >
                <div className="aspect-[3/4] w-full bg-slate-50 md:w-32 flex-shrink-0 flex items-center justify-center">
                  <BookIcon className="h-10 w-10 text-slate-200" />
                </div>
                <div className="flex flex-1 flex-col p-6">
                  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                    <div>
                      <h3 className="text-xl font-bold text-slate-900">{loan.book.title}</h3>
                      <p className="text-slate-500">{loan.book.author}</p>
                    </div>
                    <div className={cn(
                      "inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold ring-1 ring-inset",
                      isOverdue 
                        ? "bg-red-50 text-red-700 ring-red-600/20" 
                        : "bg-blue-50 text-blue-700 ring-blue-600/20"
                    )}>
                      <Calendar className="h-3.5 w-3.5" />
                      {isOverdue ? 'Atrasado' : `Vence em ${daysLeft} dias`}
                    </div>
                  </div>

                  <div className="mt-6 grid grid-cols-2 gap-4 border-y border-slate-100 py-6 sm:grid-cols-4">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Pegou em</p>
                      <p className="mt-1 text-sm font-semibold">{format(loan.loanedAt.toDate(), "dd/MM/yyyy", { locale: ptBR })}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Vence em</p>
                      <p className="mt-1 text-sm font-semibold text-indigo-600">{format(dueDate, "dd/MM/yyyy", { locale: ptBR })}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Renovações</p>
                      <p className="mt-1 text-sm font-semibold">{loan.renewalCount} / 3</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Status</p>
                      <p className="mt-1 text-sm font-semibold text-emerald-600 capitalize">Ativo</p>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-wrap gap-3">
                    <button
                      onClick={() => handleRenew(loan.id)}
                      disabled={loan.renewalCount >= 3}
                      className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition-all hover:bg-slate-50 active:scale-95 disabled:opacity-50"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Renovar
                    </button>
                    <button
                      onClick={() => handleReturnClick(loan)}
                      disabled={returningId === loan.id}
                      className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-2 text-sm font-bold text-white transition-all hover:bg-slate-800 active:scale-95 disabled:opacity-50 min-w-[140px]"
                    >
                      {returningId === loan.id ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4" />
                          Devolver Livro
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {showReturnModal && selectedLoan && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowReturnModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-sm rounded-3xl bg-white p-8 shadow-2xl"
            >
              <div className="mb-6 flex flex-col items-center text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                  <RotateCcw className="h-8 w-8" />
                </div>
                <h3 className="text-xl font-bold text-slate-900">Devolver Livro</h3>
                <p className="mt-2 text-slate-500">
                  Onde você deixará o livro <span className="font-bold text-slate-800">"{selectedLoan.book.title}"</span>?
                </p>
                
                <div className="mt-6 w-full space-y-3 text-left">
                  <label className="ml-1 text-xs font-bold uppercase tracking-wider text-slate-500">Escolha o Local</label>
                  
                  <div className="grid gap-2">
                    <button
                      onClick={() => setSelectedLocationId('MY_APARTMENT')}
                      className={cn(
                        "flex items-center gap-3 rounded-xl border p-3 transition-all text-sm font-medium",
                        selectedLocationId === 'MY_APARTMENT'
                          ? "border-indigo-600 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      )}
                    >
                      <Home className="h-5 w-5 opacity-70" />
                      Meu Apartamento
                    </button>

                    {locations.map(loc => (
                      <button
                        key={loc.id}
                        onClick={() => setSelectedLocationId(loc.id)}
                        className={cn(
                          "flex items-center gap-3 rounded-xl border p-3 transition-all text-sm font-medium",
                          selectedLocationId === loc.id
                            ? "border-indigo-600 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600"
                            : "border-slate-200 text-slate-600 hover:bg-slate-50"
                        )}
                      >
                        <MapPin className="h-5 w-5 opacity-70" />
                        {loc.name}
                      </button>
                    ))}
                  </div>

                  <p className="ml-1 mt-2 text-[10px] text-slate-400">
                    Isso informa aos outros moradores exatamente onde encontrar o livro.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowReturnModal(false)}
                  className="flex-1 rounded-xl border border-slate-200 py-3 font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmReturn}
                  className="flex-1 rounded-xl bg-indigo-600 py-3 font-bold text-white shadow-lg shadow-indigo-100 hover:bg-indigo-700 disabled:opacity-50"
                >
                  Confirmar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
