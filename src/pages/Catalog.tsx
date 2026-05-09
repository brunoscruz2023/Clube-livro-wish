import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Book, BookStatus } from '../types';
import { BookService } from '../services/BookService';
import { 
  Search, 
  Filter, 
  Book as BookIcon, 
  User, 
  MapPin, 
  CheckCircle, 
  Clock, 
  Plus,
  QrCode,
  Scan
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../hooks/useAuth';

export function Catalog() {
  const navigate = useNavigate();
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'AVAILABLE' | 'LOANED'>('ALL');
  const { user } = useAuth();
  const [isLoanModalOpen, setIsLoanModalOpen] = useState(false);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);

  useEffect(() => {
    loadBooks();
  }, []);

  async function loadBooks() {
    setLoading(true);
    const data = await BookService.listBooks();
    if (data) setBooks(data);
    setLoading(false);
  }

  const filteredBooks = books.filter(book => {
    const matchesSearch = book.title.toLowerCase().includes(search.toLowerCase()) || 
                         book.author.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'ALL' || book.status === filter;
    return matchesSearch && matchesFilter;
  });

  const [loaningId, setLoaningId] = useState<string | null>(null);
  const [confirmLoanBook, setConfirmLoanBook] = useState<Book | null>(null);

  const handleLoan = async (book: Book) => {
    if (!user?.apartmentId) {
      alert('Por favor, configure seu apartamento no perfil antes de pegar um livro.');
      return;
    }
    setConfirmLoanBook(book);
  };

  const confirmLoan = async () => {
    if (!selectedBookForAction || !user?.apartmentId) return;
    
    const book = selectedBookForAction;
    setLoaningId(book.id);
    setConfirmLoanBook(null);
    try {
      await BookService.createLoan(book.id, user.apartmentId, user.id);
      alert('Empréstimo realizado com sucesso!');
      loadBooks();
    } catch (error: any) {
      console.error(error);
      alert(error.message || 'Erro ao realizar empréstimo');
    } finally {
      setLoaningId(null);
    }
  };

  const selectedBookForAction = confirmLoanBook;

  return (
    <div className="space-y-8">
      {/* Search and Filters */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por título ou autor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
          {(['ALL', 'AVAILABLE', 'LOANED'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-all shadow-sm",
                filter === f 
                  ? "bg-indigo-600 text-white" 
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              )}
            >
              {f === 'ALL' ? 'Todos' : f === 'AVAILABLE' ? 'Disponíveis' : 'Emprestados'}
            </button>
          ))}
        </div>
        {user?.role === 'ADMIN' && (
          <button 
            onClick={() => navigate('/admin')}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white transition-all hover:bg-indigo-700 active:scale-95 shadow-lg shadow-indigo-100"
          >
            <Plus className="h-5 w-5" />
            Novo Livro
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
        </div>
      ) : filteredBooks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-200 py-20 text-center">
          <BookIcon className="mb-4 h-12 w-12 text-slate-300" />
          <h3 className="text-xl font-semibold text-slate-900">Nenhum livro encontrado</h3>
          <p className="mt-2 text-slate-500">Tente ajustar sua busca ou filtro.</p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredBooks.map((book) => (
            <motion.div
              layout
              key={book.id}
              className="group relative flex flex-col overflow-hidden rounded-2xl bg-white border border-slate-100 shadow-xl shadow-slate-100/50 transition-all hover:shadow-2xl hover:shadow-indigo-100/40"
            >
              <div className="aspect-[3/4] w-full bg-slate-100 overflow-hidden relative">
                 {/* Placeholder for cover or generic icon */}
                 <div className="absolute inset-0 flex items-center justify-center text-slate-300 group-hover:scale-110 transition-transform duration-500">
                    <BookIcon className="h-20 w-20 opacity-20" />
                 </div>
                 <div className="absolute top-3 left-3">
                    <span className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold shadow-sm",
                      book.status === 'AVAILABLE' 
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-100" 
                        : book.status === 'LOANED'
                          ? "bg-amber-50 text-amber-700 border border-amber-100"
                          : "bg-slate-50 text-slate-700 border border-slate-100"
                    )}>
                      {book.status === 'AVAILABLE' ? (
                        <><CheckCircle className="h-3 w-3" /> Disponível</>
                      ) : book.status === 'LOANED' ? (
                        <><Clock className="h-3 w-3" /> Emprestado</>
                      ) : 'Inativo'}
                    </span>
                 </div>
                 {book.category && (
                    <div className="absolute top-3 right-3">
                      <span className="rounded-full bg-slate-900/60 backdrop-blur-sm px-2 py-0.5 text-[10px] uppercase tracking-wider text-white font-bold">
                        {book.category}
                      </span>
                    </div>
                 )}
              </div>
              <div className="flex flex-1 flex-col p-5">
                <h3 className="text-lg font-bold leading-tight text-slate-900 line-clamp-2">{book.title}</h3>
                <p className="mt-1 text-sm font-medium text-slate-500">{book.author}</p>
                
                <div className="mt-4 flex flex-col gap-2">
                   {book.status === 'LOANED' && (
                     <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100">
                       <User className="h-3.5 w-3.5" />
                       <span className="font-medium truncate">Emprestado para: {book.availableLocationLabel || 'Morador' }</span>
                     </div>
                   )}
                   {book.status === 'AVAILABLE' && (
                     <div className="flex items-center gap-2 text-xs text-indigo-600 bg-indigo-50/50 p-2 rounded-lg border border-indigo-100/50">
                       <MapPin className="h-3.5 w-3.5" />
                       <span className="font-semibold truncate">
                         Local: {book.availableLocationLabel || 'Disponível no condomínio'}
                       </span>
                     </div>
                   )}
                </div>

                <div className="mt-6 flex gap-2">
                  <button
                    onClick={() => handleLoan(book)}
                    disabled={book.status !== 'AVAILABLE' || loaningId === book.id}
                    className={cn(
                      "flex-1 rounded-xl py-2.5 text-sm font-bold transition-all active:scale-95 flex items-center justify-center gap-2",
                      book.status === 'AVAILABLE'
                        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100 hover:bg-indigo-700"
                        : "bg-slate-100 text-slate-400 cursor-not-allowed"
                    )}
                  >
                    {loaningId === book.id ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                    ) : book.status === 'AVAILABLE' ? 'Pegar Emprestado' : 'Indisponível'}
                  </button>
                  <button 
                    disabled={book.status !== 'AVAILABLE'}
                    className="flex aspect-square items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 active:scale-90 transition-all"
                  >
                    <Scan className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {confirmLoanBook && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmLoanBook(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-sm rounded-3xl bg-white p-8 shadow-2xl"
            >
              <div className="mb-6 flex flex-col items-center text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                  <BookIcon className="h-8 w-8" />
                </div>
                <h3 className="text-xl font-bold text-slate-900">Confirmar Empréstimo</h3>
                <p className="mt-2 text-slate-500">
                  Deseja mesmo pegar o livro <span className="font-bold text-slate-800">"{confirmLoanBook.title}"</span>?
                </p>
                <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-500 border border-slate-100">
                  Você terá 14 dias para devolvê-lo.
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmLoanBook(null)}
                  className="flex-1 rounded-xl border border-slate-200 py-3 font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmLoan}
                  className="flex-1 rounded-xl bg-indigo-600 py-3 font-bold text-white shadow-lg shadow-indigo-100 hover:bg-indigo-700"
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
