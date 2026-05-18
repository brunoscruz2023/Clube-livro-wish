import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Book, Apartment, Block, User, OperationType } from '../types';
import { BookService } from '../services/BookService';
import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp,
  deleteDoc,
  query,
  where,
  orderBy,
  writeBatch
} from 'firebase/firestore';
import { auth, db, handleFirestoreError } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { 
  Search,
  Settings, 
  Users, 
  Building, 
  Book as BookIcon, 
  Plus, 
  Edit2, 
  Trash2,
  Check,
  X,
  ChevronRight,
  Database,
  Wand2,
  Loader2,
  MapPin,
  ShieldAlert,
  ShieldCheck,
  ScanBarcode,
  Image as ImageIcon,
  Camera
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { Location } from '../types';
import { BarcodeScanner } from '../components/BarcodeScanner';
import { CameraCapture } from '../components/CameraCapture';
import { fetchBookDetailsByISBN, ExternalBookInfo } from '../services/bookDetails';
import { uploadImage, resizeImage } from '../services/storageService';

export function Admin() {
  const { user } = useAuth();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const initialAction = searchParams.get('action');

  const [activeTab, setActiveTab] = useState<'BOOKS' | 'USERS' | 'APARTMENTS' | 'BLOCKS' | 'LOCATIONS'>('BOOKS');
  const [data, setData] = useState<any[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState<any | null>(null);
  const [showAddForm, setShowAddForm] = useState(initialAction === 'new-book');
  const [seeding, setSeeding] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showSeedConfirm, setShowSeedConfirm] = useState(false);
  const [showUserSeedConfirm, setShowUserSeedConfirm] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [isCapturingBack, setIsCapturingBack] = useState(false);
  const [fetchingBook, setFetchingBook] = useState(false);
  const [lastScannedBook, setLastScannedBook] = useState<any>(null);
  const [bookCandidates, setBookCandidates] = useState<ExternalBookInfo[]>([]);
  const [selectedLocationType, setSelectedLocationType] = useState<'HALL' | 'APARTMENT'>('HALL');
  const [isbnValue, setIsbnValue] = useState('');
  const [capturedCoverUrl, setCapturedCoverUrl] = useState('');
  const [capturedGSPath, setCapturedGSPath] = useState('');
  const [showNotFound, setShowNotFound] = useState(false);
  const [duplicateFound, setDuplicateFound] = useState<any | null>(null);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [isBlockingDuplicate, setIsBlockingDuplicate] = useState(false);

  // Refs for Add Book form to allow programmatic filling
  const titleRef = React.useRef<HTMLInputElement>(null);
  const authorRef = React.useRef<HTMLInputElement>(null);
  const categoryRef = React.useRef<HTMLInputElement>(null);
  const barcodeRef = React.useRef<HTMLInputElement>(null);
  const coverUrlRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialAction === 'new-book') {
      setActiveTab('BOOKS');
      setShowAddForm(true);
      setIsEditing(null);
    }
  }, [initialAction]);

  useEffect(() => {
    loadData();
    if (activeTab === 'APARTMENTS' || activeTab === 'USERS') {
      loadBlocks();
    }
    if (activeTab === 'USERS') {
      loadApartments();
    }
    if (activeTab === 'BOOKS') {
      loadLocations();
      loadBlocks();
      loadApartments();
    }
  }, [activeTab]);

  async function loadLocations() {
    try {
      const snapshot = await getDocs(collection(db, 'locations'));
      const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Location));
      setLocations(items.sort((a, b) => (a.name || '').localeCompare(b.name || '')));
    } catch (error) {
      console.error('Error loading locations:', error);
    }
  }

  async function loadBlocks() {
    try {
      const snapshot = await getDocs(collection(db, 'blocks'));
      const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Block));
      setBlocks(items.sort((a, b) => (a.name || '').localeCompare(b.name || '')));
    } catch (error) {
      console.error('Error loading blocks:', error);
    }
  }

  async function loadApartments() {
    try {
      const snapshot = await getDocs(collection(db, 'apartments'));
      const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Apartment));
      setApartments(items.sort((a, b) => (a.number || '').localeCompare(b.number || '')));
    } catch (error) {
      console.error('Error loading apartments:', error);
    }
  }

  async function loadData() {
    setLoading(true);
    const pathMap = {
      BOOKS: 'books',
      USERS: 'users',
      APARTMENTS: 'apartments',
      BLOCKS: 'blocks',
      LOCATIONS: 'locations'
    };
    const path = pathMap[activeTab];
    try {
      let q;
      if (activeTab === 'BOOKS' && user?.role !== 'ADMIN') {
        // Simplified query to avoid composite index requirement
        // We filter 'active' in memory
        q = query(
          collection(db, path), 
          where('createdByUserId', '==', auth.currentUser?.uid)
        );
      } else {
        q = query(collection(db, path));
      }
      
      const snapshot = await getDocs(q);
      let items = snapshot.docs.map(d => ({ id: d.id, ...(d.data() as object) } as any));
      
      // Memory filter for non-admin books
      if (activeTab === 'BOOKS' && user?.role !== 'ADMIN') {
        items = items.filter((item: any) => item.active === true);
      }
      
      // Sort in memory if needed
      if (activeTab === 'BOOKS') {
        items.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
      } else if (activeTab === 'APARTMENTS') {
        items.sort((a, b) => (a.number || '').localeCompare(b.number || ''));
      } else {
        items.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      }
      
      setData(items);
    } catch (error) {
      console.error('[Admin] loadData failed:', error);
      setData([]);
      // Don't re-throw here to allow setLoading(false) to run
    } finally {
      setLoading(false);
    }
  }

  const closeAddForm = () => {
    setShowAddForm(false);
    setIsbnValue('');
    setLastScannedBook(null);
    setBookCandidates([]);
    setDuplicateFound(null);
    setIsBlockingDuplicate(false);
    setSelectedLocationType('HALL');
    setShowCamera(false);
    setIsCapturingBack(false);
    setCapturedCoverUrl('');
    
    // Clear refs
    if (titleRef.current) titleRef.current.value = '';
    if (authorRef.current) authorRef.current.value = '';
    if (categoryRef.current) categoryRef.current.value = '';
    if (barcodeRef.current) barcodeRef.current.value = '';
    if (coverUrlRef.current) coverUrlRef.current.value = '';
  };

  const handleSeedData = async () => {
    setShowSeedConfirm(false);
    setSeeding(true);
    try {
      const batch = writeBatch(db);
      const blocksNames = ['A', 'B'];
      
      for (const blockName of blocksNames) {
        const blockRef = doc(collection(db, 'blocks'));
        batch.set(blockRef, {
          name: `Bloco ${blockName}`,
          active: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        // 15 floors, 15 units per floor
        for (let floor = 1; floor <= 15; floor++) {
          for (let unit = 1; unit <= 15; unit++) {
            const unitNumber = `${blockName}${floor}${unit.toString().padStart(2, '0')}`;
            const aptoRef = doc(collection(db, 'apartments'));
            batch.set(aptoRef, {
              blockId: blockRef.id,
              number: unitNumber,
              active: true,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
          }
        }
      }

      await batch.commit();
      loadData();
    } catch (error) {
      console.error(error);
    } finally {
      setSeeding(false);
    }
  };

  const handleSeedUsers = async () => {
    setShowUserSeedConfirm(false);
    setSeeding(true);
    try {
      const users = [
        { name: 'Ricardo Santos', email: 'ricardo@exemplo.com' },
        { name: 'Ana Oliveira', email: 'ana@exemplo.com' },
        { name: 'Marcos Silva', email: 'marcos@exemplo.com' }
      ];

      for (const u of users) {
        // We use a custom ID or let Firestore generate it
        await addDoc(collection(db, 'users'), {
          ...u,
          role: 'RESIDENT',
          active: true,
          apartmentId: null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      loadData();
    } catch (error) {
      console.error(error);
    } finally {
      setSeeding(false);
    }
  };

  const handleBarcodeScan = async (barcode: string) => {
    console.log(`[Admin] Barcode recebido no componente: ${barcode}`);
    setShowScanner(false);
    setFetchingBook(true);
    setBookCandidates([]);
    setDuplicateFound(null);
    setIsBlockingDuplicate(false);
    
    // Fill barcode field
    if (barcodeRef.current) {
      barcodeRef.current.value = barcode;
    }
    setIsbnValue(barcode);

    try {
      // 1. Intercept: Search local Firestore first
      const q = query(collection(db, 'books'), where('barcode', '==', barcode), where('active', '==', true));
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        const books = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
        const myCopy = books.find((b: any) => b.createdByUserId === auth.currentUser?.uid);
        
        console.log(`[Admin] Obra já existente na base local: ${barcode}. Preenchendo formulário.`);
        
        // 1. Fill form immediately with local data
        applyBookInfo({
          title: books[0].title,
          author: books[0].author,
          category: books[0].category,
          description: books[0].descricao || '',
          isbn: barcode,
          coverUrl: books[0].coverUrl || ''
        });

        // 2. Show modal with appropriate state
        setDuplicateFound(books);
        if (myCopy) {
          console.log(`[Admin] Bloqueio imediato: Usuário já possui uma cópia deste ISBN.`);
          setIsBlockingDuplicate(true);
        } else {
          setIsBlockingDuplicate(false);
        }
        setShowDuplicateModal(true);
        setFetchingBook(false);
        return;
      }

      // 2. If not found locally, fetch from external APIs
      const candidates = await fetchBookDetailsByISBN(barcode);
      console.log(`[Admin] Resultado da busca externa:`, candidates);

      if (candidates && candidates.length > 0) {
        if (candidates.length === 1) {
          applyBookInfo(candidates[0]);
        } else {
          // Mostrar seletor para múltiplos resultados
          setBookCandidates(candidates);
        }
      } else {
        console.warn(`[Admin] Nenhum dado retornado para o ISBN ${barcode}`);
        setShowNotFound(true);
      }
    } catch (err) {
      console.error(`[Admin] Erro ao buscar/preencher dados:`, err);
    }
    
    setFetchingBook(false);
  };

  const applyBookInfo = (info: ExternalBookInfo) => {
    console.log(`[Admin] Aplicando informações do livro com Smart Merge:`, info);
    
    // Smart Merge: Se campos estiverem vazios na seleção atual, busca nos outros candidatos
    const mergedInfo = { ...info };
    
    // If we have candidates, merged them. If not (base local), just use info.
    if (bookCandidates.length > 0) {
      bookCandidates.forEach(candidate => {
        if (!mergedInfo.title && candidate.title) mergedInfo.title = candidate.title;
        
        const isAuthorEmpty = !mergedInfo.author || (Array.isArray(mergedInfo.author) && mergedInfo.author.length === 0);
        if (isAuthorEmpty && candidate.author && (!Array.isArray(candidate.author) || candidate.author.length > 0)) {
          mergedInfo.author = candidate.author;
        }
        
        const isCategoryEmpty = !mergedInfo.category || (Array.isArray(mergedInfo.category) && mergedInfo.category.length === 0);
        if (isCategoryEmpty && candidate.category && (!Array.isArray(candidate.category) || candidate.category.length > 0)) {
          mergedInfo.category = candidate.category;
        }
        
        if (!mergedInfo.description && candidate.description) mergedInfo.description = candidate.description;
        if (!mergedInfo.coverUrl && candidate.coverUrl) mergedInfo.coverUrl = candidate.coverUrl;
      });
    }

    setLastScannedBook(mergedInfo);
    
    // Preencher os campos do formulário
    if (titleRef.current) titleRef.current.value = mergedInfo.title || '';
    if (authorRef.current) authorRef.current.value = Array.isArray(mergedInfo.author) ? mergedInfo.author.join(', ') : (mergedInfo.author || '');
    if (categoryRef.current) categoryRef.current.value = Array.isArray(mergedInfo.category) ? mergedInfo.category.join(', ') : (mergedInfo.category || '');
    
    console.log(`[Admin] Sincronizando URL da capa (Smart Merge): ${mergedInfo.coverUrl}`);
    setCapturedCoverUrl(mergedInfo.coverUrl || '');
    
    if (barcodeRef.current && mergedInfo.isbn) {
      barcodeRef.current.value = mergedInfo.isbn;
      setIsbnValue(mergedInfo.isbn);
    }
    
    setBookCandidates([]);
    console.log(`[Admin] Campos preenchidos com sucesso via Smart Merge.`);
  };

  const handleCaptureCover = async (dataUrl: string) => {
    setShowCamera(false);
    setSubmitting(true);
    try {
      const barcode = barcodeRef.current?.value || isbnValue || 'manual';
      const timestamp = Date.now();
      const fileName = isCapturingBack ? `back_${barcode}_${timestamp}.jpg` : `cover_${barcode}_${timestamp}.jpg`;
      const path = `book_covers/${fileName}`;
      
      console.log(`[Admin] Processing captured image for ${path}...`);
      const blob = await resizeImage(dataUrl, 800, 1000);
      
      console.log(`[Admin] Uploading to Storage...`);
      const { downloadUrl, gsPath } = await uploadImage(blob, path);
      
      if (isCapturingBack) {
        // Back cover logic if needed
      } else {
        console.log(`[Admin] Capture success! GS: ${gsPath}`);
        setCapturedCoverUrl(downloadUrl);
        setCapturedGSPath(gsPath);
      }
    } catch (err: any) {
      console.error('[Admin] Error in capture process:', err);
      const msg = err?.message || String(err);
      alert(`Erro no processamento: ${msg}`);
    } finally {
      setSubmitting(false);
      setIsCapturingBack(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;
    
    setSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const collectionName = activeTab.toLowerCase();
    
    try {
      if (activeTab === 'BOOKS') {
        const title = formData.get('title') as string;
        const authorInput = formData.get('author') as string;
        const categoryInput = formData.get('category') as string;
        const barcode = formData.get('barcode') as string;

        // Security check for self-duplicates (even if typed manually)
        if (barcode && auth.currentUser) {
          // Query ONLY by barcode to avoid composite index requirement
          const q = query(
            collection(db, 'books'), 
            where('barcode', '==', barcode)
          );
          const snapshot = await getDocs(q);
          const duplicates = snapshot.docs.filter(d => {
            const data = d.data();
            return data.createdByUserId === auth.currentUser?.uid && data.active === true;
          });
          
          if (duplicates.length > 0) {
            console.log(`[Admin] Tentativa de cadastro bloqueada: ISBN duplicado para o mesmo usuário.`);
            setIsBlockingDuplicate(true);
            setShowDuplicateModal(true);
            setSubmitting(false);
            return;
          }
        }

        // Restore original structure if not modified
        let authorValue: any = authorInput;
        let categoryValue: any = categoryInput;

        if (lastScannedBook) {
          const originalAuthorString = Array.isArray(lastScannedBook.author) ? lastScannedBook.author.join(', ') : lastScannedBook.author;
          if (authorInput === originalAuthorString) {
            authorValue = Array.isArray(lastScannedBook.author) ? lastScannedBook.author : [lastScannedBook.author];
          }

          const originalCategoryString = Array.isArray(lastScannedBook.category) ? lastScannedBook.category.join(', ') : lastScannedBook.category;
          if (categoryInput === originalCategoryString) {
            categoryValue = Array.isArray(lastScannedBook.category) ? lastScannedBook.category : [lastScannedBook.category];
          }
        }

        const newBook = {
          title,
          author: authorValue || '',
          category: categoryValue || '',
          barcode: (formData.get('barcode') as string) || '',
          coverUrl: capturedGSPath || (formData.get('coverUrl') as string) || '', 
          backCoverUrl: (formData.get('backCoverUrl') as string) || '',
          availableLocationType: (formData.get('locationType') as string) || 'HALL',
          availableLocationLabel: (formData.get('locationLabel') as string) || '',
          descricao: lastScannedBook?.description || '',
          status: 'AVAILABLE',
          active: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdByUserId: auth.currentUser?.uid || null,
          createdByUserEmail: auth.currentUser?.email || null
        };
        console.log('[Admin] Salvando novo livro:', JSON.stringify({ ...newBook, createdAt: 'TIMESTAMP', updatedAt: 'TIMESTAMP' }));
        await addDoc(collection(db, 'books'), newBook);
      } else if (activeTab === 'BLOCKS') {
        const newBlock = {
          name: formData.get('name') as string,
          active: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        await addDoc(collection(db, 'blocks'), newBlock);
      } else if (activeTab === 'APARTMENTS') {
        const newApto = {
          number: formData.get('number') as string,
          blockId: formData.get('blockId') as string,
          active: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        await addDoc(collection(db, 'apartments'), newApto);
      } else if (activeTab === 'USERS') {
        const newUser = {
          name: formData.get('name') as string,
          email: formData.get('email') as string,
          role: 'RESIDENT',
          active: true,
          apartmentId: formData.get('apartmentId') as string || null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        await addDoc(collection(db, 'users'), newUser);
      } else if (activeTab === 'LOCATIONS') {
        const newLoc = {
          name: formData.get('name') as string,
          description: formData.get('description') as string,
          active: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        await addDoc(collection(db, 'locations'), newLoc);
      }

      closeAddForm();
      loadData();
    } catch (error: any) {
       console.error('[Admin] Error in handleSubmit:', error);
       const errorMsg = error instanceof Error ? error.message : String(error);
       alert(`Erro ao salvar: ${errorMsg}`);
       handleFirestoreError(error, OperationType.WRITE, collectionName);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isEditing || submitting) return;
    
    setSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const collectionName = activeTab.toLowerCase();
    
    try {
      const updates: any = {
        updatedAt: serverTimestamp(),
        updatedByUserId: auth.currentUser?.uid || null,
        updatedByUserEmail: auth.currentUser?.email || null
      };
      
      if (activeTab === 'BOOKS') {
        updates.title = formData.get('title') as string;
        updates.author = formData.get('author') as string;
        updates.category = formData.get('category') as string;
        updates.barcode = formData.get('barcode') as string;
        updates.coverUrl = capturedGSPath || (formData.get('coverUrl') as string) || ''; // Favor GS path if captured
        updates.backCoverUrl = formData.get('backCoverUrl') as string || '';
        updates.availableLocationType = formData.get('locationType') as string;
        updates.availableLocationLabel = formData.get('locationLabel') as string;
        console.log('[Admin] Atualizando livro com coverUrl:', updates.coverUrl);
      } else if (activeTab === 'BLOCKS') {
        updates.name = formData.get('name') as string;
      } else if (activeTab === 'APARTMENTS') {
        updates.number = formData.get('number') as string;
        updates.blockId = formData.get('blockId') as string;
      } else if (activeTab === 'USERS') {
        updates.name = formData.get('name') as string;
        updates.apartmentId = formData.get('apartmentId') as string || null;
      } else if (activeTab === 'LOCATIONS') {
        updates.name = formData.get('name') as string;
        updates.description = formData.get('description') as string;
      }

      await updateDoc(doc(db, collectionName, isEditing.id), updates);
      setIsEditing(null);
      loadData();
    } catch (error: any) {
       console.error('[Admin] Error in handleUpdate:', error);
       const errorMsg = error instanceof Error ? error.message : String(error);
       alert(`Erro ao atualizar: ${errorMsg}`);
       handleFirestoreError(error, OperationType.UPDATE, collectionName);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (item: any) => {
    const collectionName = activeTab.toLowerCase();
    try {
      await updateDoc(doc(db, collectionName, item.id), {
        active: !item.active,
        updatedAt: serverTimestamp()
      });
      loadData();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${collectionName}/${item.id}`);
    }
  };

  const tabs = [
    { id: 'BOOKS', label: 'Livros', icon: BookIcon },
    { id: 'USERS', label: 'Moradores', icon: Users },
    { id: 'LOCATIONS', label: 'Locais', icon: MapPin },
    { id: 'APARTMENTS', label: 'Apartamentos', icon: Building },
    { id: 'BLOCKS', label: 'Blocos', icon: Database }
  ];

  return (
    <div className="space-y-8">
      {/* Duplicate Found Modal */}
      <AnimatePresence>
        {showDuplicateModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-2xl text-center"
            >
              {isBlockingDuplicate ? (
                <>
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                    <ShieldAlert className="h-8 w-8" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">Limite de Registro</h3>
                  <p className="mt-2 text-slate-500">
                    Você já cadastrou uma cópia deste livro e não pode cadastrar duplicatas de um mesmo ISBN sob sua conta.
                  </p>
                  <button 
                    type="button"
                    onClick={() => {
                        setShowDuplicateModal(false);
                        closeAddForm();
                    }}
                    className="mt-6 w-full rounded-xl bg-slate-900 py-3 font-bold text-white transition-all hover:bg-slate-800"
                  >
                    Entendido
                  </button>
                </>
              ) : (
                <>
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                    <Check className="h-8 w-8" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">Obra já existente</h3>
                  <p className="mt-2 text-slate-500">
                    Deseja cadastrar outra cópia deste livro?
                  </p>
                  <div className="mt-6 grid grid-cols-2 gap-3">
                    <button 
                      type="button"
                      onClick={async () => {
                        const barcode = barcodeRef.current?.value || isbnValue || '';
                        
                        if (!auth.currentUser) {
                          console.error('[Admin] Usuário não autenticado ao tentar duplicar.');
                          return;
                        }

                        setSubmitting(true);
                        try {
                          // 1. Verificação de segurança (FRESH) no momento do clique "SIM"
                          const q = query(
                            collection(db, 'books'), 
                            where('barcode', '==', barcode), 
                            where('createdByUserId', '==', auth.currentUser.uid),
                            where('active', '==', true)
                          );
                          const snapDuplicate = await getDocs(q);

                          if (!snapDuplicate.empty) {
                            console.log(`[Admin] Bloqueio via clique SIM: ISBN já cadastrado para este usuário.`);
                            setIsBlockingDuplicate(true);
                            setSubmitting(false);
                            return;
                          }

                          // 2. Não há duplicata do próprio usuário, prossegue com o cadastro
                          const title = titleRef.current?.value || '';
                          const authorInput = authorRef.current?.value || '';
                          const categoryInput = categoryRef.current?.value || '';
                          
                          // Restore original structure for arrays if mapped correctly
                          let authorValue: any = authorInput;
                          let categoryValue: any = categoryInput;
                          if (lastScannedBook) {
                            const originalAuthorString = Array.isArray(lastScannedBook.author) ? lastScannedBook.author.join(', ') : lastScannedBook.author;
                            if (authorInput === originalAuthorString) {
                              authorValue = Array.isArray(lastScannedBook.author) ? lastScannedBook.author : [lastScannedBook.author];
                            }
                            
                            const originalCategoryString = Array.isArray(lastScannedBook.category) ? lastScannedBook.category.join(', ') : lastScannedBook.category;
                            if (categoryInput === originalCategoryString) {
                              categoryValue = Array.isArray(lastScannedBook.category) ? lastScannedBook.category : [lastScannedBook.category];
                            }
                          }

                          // Get location from the visible select elements
                          const locationTypeSelect = document.getElementsByName('locationType')[0] as HTMLSelectElement;
                          const locationLabelSelect = document.getElementsByName('locationLabel')[0] as HTMLSelectElement;

                          const newBook = {
                            title,
                            author: authorValue,
                            category: categoryValue,
                            barcode,
                            coverUrl: capturedCoverUrl || (lastScannedBook?.coverUrl || ''),
                            backCoverUrl: '',
                            availableLocationType: locationTypeSelect?.value || 'HALL',
                            availableLocationLabel: locationLabelSelect?.value || '',
                            descricao: lastScannedBook?.description || (duplicateFound?.[0]?.descricao || ''),
                            status: 'AVAILABLE',
                            active: true,
                            createdAt: serverTimestamp(),
                            updatedAt: serverTimestamp(),
                            createdByUserId: auth.currentUser?.uid || null,
                            createdByUserEmail: auth.currentUser?.email || null
                          };

                          await addDoc(collection(db, 'books'), newBook);
                          setShowDuplicateModal(false);
                          closeAddForm();
                          loadData();
                        } catch (error) {
                          console.error('[Admin] Erro ao cadastrar duplicata:', error);
                          handleFirestoreError(error, OperationType.WRITE, 'books');
                        } finally {
                          setSubmitting(false);
                        }
                      }}
                      disabled={submitting}
                      className="rounded-xl bg-indigo-600 py-3 font-bold text-white transition-all hover:bg-indigo-700 shadow-md flex items-center justify-center gap-2"
                    >
                      {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                      SIM
                    </button>
                    <button 
                      type="button"
                      onClick={() => {
                        setShowDuplicateModal(false);
                        closeAddForm();
                      }}
                      className="rounded-xl border border-slate-200 bg-white py-3 font-bold text-slate-600 transition-all hover:bg-slate-50"
                    >
                      NÃO
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Not Found Modal */}
      <AnimatePresence>
        {showNotFound && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-2xl text-center"
            >
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-600">
                <Search className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Livro não localizado</h3>
              <p className="mt-2 text-slate-500">
                Não encontramos informações automáticas para este ISBN nas bases de dados integradas.
              </p>
              <button 
                onClick={() => setShowNotFound(false)}
                className="mt-6 w-full rounded-xl bg-slate-900 py-3 font-bold text-white transition-all hover:bg-slate-800"
              >
                Entendido, vou digitar
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {showScanner && (
        <BarcodeScanner 
          onScan={handleBarcodeScan} 
          onClose={() => setShowScanner(false)} 
        />
      )}

      <AnimatePresence>
        {showCamera && (
          <CameraCapture 
            onCapture={handleCaptureCover}
            onClose={() => setShowCamera(false)}
          />
        )}
      </AnimatePresence>

      {/* Book Candidate Selector Modal */}
      <AnimatePresence>
        {bookCandidates.length > 1 && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Múltiplos Resultados Encontrados</h3>
                  <p className="text-sm text-slate-500">Selecione a melhor opção de metadados para este livro.</p>
                </div>
                <button onClick={() => setBookCandidates([])} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                {bookCandidates.map((candidate, idx) => (
                  <button
                    key={idx}
                    onClick={() => applyBookInfo(candidate)}
                    className="flex w-full items-start gap-4 rounded-2xl border border-slate-100 p-4 text-left transition-all hover:border-indigo-200 hover:bg-indigo-50 group"
                  >
                    <div className="h-24 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-slate-100 shadow-sm">
                      {candidate.coverUrl ? (
                        <img src={candidate.coverUrl} alt={candidate.title} className="h-full w-full object-cover object-top" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-slate-300">
                           <ImageIcon className="h-8 w-8" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-bold text-slate-900 group-hover:text-indigo-700 truncate">{candidate.title}</h4>
                        {candidate.source && (
                          <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 font-bold uppercase tracking-wider group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors">
                            {candidate.source}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-600">
                        {Array.isArray(candidate.author) ? candidate.author.join(', ') : candidate.author}
                      </p>
                      {candidate.category && (
                        <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          {Array.isArray(candidate.category) ? candidate.category[0] : candidate.category}
                        </p>
                      )}
                      {candidate.description && (
                        <p className="mt-2 line-clamp-2 text-xs text-slate-500 leading-relaxed">
                          {candidate.description}
                        </p>
                      )}
                    </div>
                    <div className="mt-auto self-center">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                        <ChevronRight className="h-5 w-5" />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Painel Administrativo</h1>
          <p className="mt-1 text-slate-500">Gerencie os cadastros e a biblioteca do condomínio.</p>
        </div>
      </header>

      {/* Tabs Navigation */}
      <div className="relative">
        {/* Mobile Dropdown */}
        <div className="sm:hidden">
          <label htmlFor="admin-tabs" className="sr-only">Selecione a categoria</label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-indigo-600">
              {tabs.find(t => t.id === activeTab)?.icon && React.createElement(tabs.find(t => t.id === activeTab)!.icon, { className: "h-5 w-5" })}
            </div>
            <select
              id="admin-tabs"
              value={activeTab}
              onChange={(e) => {
                setActiveTab(e.target.value as any);
                setShowAddForm(false);
                setIsEditing(null);
              }}
              className="block w-full rounded-2xl border border-slate-200 bg-white py-4 pl-12 pr-10 text-base font-bold text-slate-900 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 appearance-none"
            >
              {tabs.map((tab) => (
                <option key={tab.id} value={tab.id}>
                  {tab.label}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400">
              <ChevronRight className="h-5 w-5 rotate-90" />
            </div>
          </div>
        </div>

        {/* Desktop Tabs */}
        <div className="hidden sm:flex items-center gap-2 border-b border-slate-200 pb-px overflow-x-auto no-scrollbar">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as any);
                setShowAddForm(false);
                setIsEditing(null);
              }}
              className={cn(
                "flex items-center gap-2 border-b-2 px-6 py-4 text-sm font-semibold transition-all whitespace-nowrap",
                activeTab === tab.id 
                  ? "border-indigo-600 text-indigo-600" 
                  : "border-transparent text-slate-500 hover:text-slate-900"
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-3xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 p-6">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-bold text-slate-900">Listagem de {tabs.find(t => t.id === activeTab)?.label}</h2>
              {(activeTab === 'BLOCKS' || activeTab === 'APARTMENTS') && data.length === 0 && (
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setShowSeedConfirm(true)}
                    disabled={seeding}
                    className="flex items-center gap-2 rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-600 hover:bg-indigo-100 disabled:opacity-50"
                  >
                    {seeding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
                    Massa (Blocos/Aptos)
                  </button>
                  {showSeedConfirm && (
                     <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-1 text-xs border border-amber-200">
                       <span className="font-medium text-amber-800">Gerar 450 aptos?</span>
                       <button onClick={handleSeedData} className="font-bold text-amber-900 underline">Sim</button>
                       <button onClick={() => setShowSeedConfirm(false)} className="text-amber-700">Não</button>
                     </div>
                  )}
                </div>
              )}
              {activeTab === 'USERS' && data.length <= 1 && (
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setShowUserSeedConfirm(true)}
                    disabled={seeding}
                    className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                  >
                    {seeding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Users className="h-3 w-3" />}
                    Gerar Usuários Teste
                  </button>
                  {showUserSeedConfirm && (
                     <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-1 text-xs border border-slate-200">
                       <span className="font-medium text-slate-800">Gerar 3 usuários?</span>
                       <button onClick={handleSeedUsers} className="font-bold text-slate-900 underline">Sim</button>
                       <button onClick={() => setShowUserSeedConfirm(false)} className="text-slate-700">Não</button>
                     </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-indigo-700 transition-all"
            >
              <Plus className="h-4 w-4" /> Adicionar
            </button>
          </div>
        </div>

        {showAddForm && (
          <form onSubmit={handleSubmit} className="border-b border-slate-100 bg-slate-50 p-6">
           <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-700">Novo Cadastro</h3>
              {activeTab === 'BOOKS' && (
                <button
                  type="button"
                  onClick={() => {
                    if (isbnValue) {
                      handleBarcodeScan(isbnValue);
                    } else {
                      setShowScanner(true);
                    }
                  }}
                  disabled={fetchingBook}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold transition-all",
                    isbnValue 
                      ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-md" 
                      : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                  )}
                >
                  {fetchingBook ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : isbnValue ? (
                    <Search className="h-4 w-4 text-white" />
                  ) : (
                    <ScanBarcode className="h-4 w-4" />
                  )}
                  {isbnValue ? 'Pesquisar ISBN' : 'Escanear ISBN'}
                </button>
              )}
           </div>
           
           <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {activeTab === 'BOOKS' && (
                  <>
                    <div className="relative">
                      <input ref={titleRef} name="title" placeholder="Título" required className="w-full rounded-lg border border-slate-200 p-2 text-sm bg-white" />
                      {fetchingBook && <Loader2 className="absolute right-2 top-2 h-4 w-4 animate-spin text-indigo-500" />}
                    </div>
                    <input ref={authorRef} name="author" placeholder="Autor" required className="rounded-lg border border-slate-200 p-2 text-sm bg-white" />
                    <input ref={categoryRef} name="category" placeholder="Categoria" className="rounded-lg border border-slate-200 p-2 text-sm bg-white" />
                    <input 
                      ref={barcodeRef} 
                      name="barcode" 
                      placeholder="Barcode / ISBN" 
                      className="rounded-lg border border-slate-200 p-2 text-sm bg-white"
                      value={isbnValue}
                      onChange={(e) => setIsbnValue(e.target.value)}
                    />
                    
                    <div className="relative flex gap-2">
                      <div className="relative flex-1">
                        <ImageIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                        <input 
                          name="coverUrl" 
                          placeholder="URL da Capa" 
                          className="w-full rounded-lg border border-slate-200 p-2 pl-9 text-sm bg-white"
                          value={capturedGSPath || capturedCoverUrl}
                          onChange={(e) => {
                            if (e.target.value.startsWith('gs://')) {
                              setCapturedGSPath(e.target.value);
                            } else {
                              setCapturedCoverUrl(e.target.value);
                              setCapturedGSPath('');
                            }
                          }}
                        />
                      </div>
                      <button 
                        type="button"
                        onClick={() => {
                          setIsCapturingBack(false);
                          setShowCamera(true);
                        }}
                        className="flex items-center justify-center rounded-lg bg-slate-100 p-2 text-slate-600 hover:bg-slate-200"
                        title="Tirar Foto da Capa"
                      >
                        <Camera className="h-5 w-5" />
                      </button>
                    </div>
                    <div className="relative">
                      <ImageIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400 opacity-50" />
                      <input name="backCoverUrl" placeholder="URL da Contracapa (Opcional)" className="w-full rounded-lg border border-slate-200 p-2 pl-9 text-sm bg-white" />
                    </div>

                    <select 
                      name="locationType" 
                      className="rounded-lg border border-slate-200 p-2 text-sm bg-white"
                      value={selectedLocationType}
                      onChange={(e) => setSelectedLocationType(e.target.value as 'HALL' | 'APARTMENT')}
                    >
                      <option value="HALL">Hall do Bloco</option>
                      <option value="APARTMENT">Apartamento</option>
                    </select>
                    <div className="flex flex-col gap-1">
                      <select name="locationLabel" required className="rounded-lg border border-slate-200 p-2 text-sm bg-white">
                        <option value="">Selecione o Local</option>
                        {selectedLocationType === 'HALL' ? (
                          // Deduplicate labels from both Blocks (as Halls) and Locations collection
                          Array.from(new Set([
                            ...blocks.map(block => `Hall ${block.name}`),
                            ...locations.filter(l => l.active).map(loc => loc.name)
                          ])).sort().map(label => (
                            <option key={label} value={label}>{label}</option>
                          ))
                        ) : (
                          apartments.map(apt => {
                            const block = blocks.find(b => b.id === apt.blockId);
                            const label = `Apto ${apt.number}${block ? ` - ${block.name}` : ''}`;
                            return <option key={apt.id} value={label}>{label}</option>;
                          })
                        )}
                      </select>
                      <p className="text-[10px] text-slate-400">Localização física do livro</p>
                    </div>
                  </>
                )}
                {activeTab === 'BLOCKS' && (
                  <input name="name" placeholder="Ex: Bloco A" required className="rounded-lg border border-slate-200 p-2 text-sm bg-white" />
                )}
                {activeTab === 'LOCATIONS' && (
                  <>
                    <input name="name" placeholder="Nome do Local (Ex: Hall)" required className="rounded-lg border border-slate-200 p-2 text-sm bg-white" />
                    <input name="description" placeholder="Descrição (Opcional)" className="rounded-lg border border-slate-200 p-2 text-sm bg-white" />
                  </>
                )}
                {activeTab === 'APARTMENTS' && (
                  <>
                    <input name="number" placeholder="Ex: 1203" required className="rounded-lg border border-slate-200 p-2 text-sm bg-white" />
                    <select name="blockId" required className="rounded-lg border border-slate-200 p-2 text-sm bg-white">
                      <option value="">Selecione o Bloco</option>
                      {blocks.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </>
                )}
                {activeTab === 'USERS' && (
                  <>
                    <input name="name" placeholder="Nome Completo" required className="rounded-lg border border-slate-200 p-2 text-sm bg-white" />
                    <input name="email" type="email" placeholder="E-mail" required className="rounded-lg border border-slate-200 p-2 text-sm bg-white" />
                    <select name="apartmentId" className="rounded-lg border border-slate-200 p-2 text-sm bg-white">
                      <option value="">Selecione o Apartamento (Opcional)</option>
                      {apartments.map(a => (
                        <option key={a.id} value={a.id}>Apto {a.number} ({blocks.find(b => b.id === a.blockId)?.name || '...'})</option>
                      ))}
                    </select>
                  </>
                )}
             </div>
             <div className="mt-4 flex gap-2">
                <button 
                  type="submit" 
                  disabled={submitting}
                  className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                >
                  {submitting && <Loader2 className="h-3 w-3 animate-spin" />}
                  Cadastrar {
                    activeTab === 'BOOKS' ? 'Livro' :
                    activeTab === 'USERS' ? 'Usuário' :
                    activeTab === 'APARTMENTS' ? 'Apartamento' :
                    activeTab === 'BLOCKS' ? 'Bloco' :
                    'Local'
                  }
                </button>
                <button type="button" onClick={closeAddForm} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold">Cancelar</button>
             </div>
          </form>
        )}

        {isEditing && (
          <form onSubmit={handleUpdate} className="border-b border-slate-100 bg-amber-50 p-6">
             <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-amber-600">Editando Registro</h3>
             <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {activeTab === 'BOOKS' && (
                  <>
                    <input name="title" defaultValue={isEditing.title} placeholder="Título" required className="rounded-lg border border-slate-200 p-2 text-sm bg-white" />
                    <input name="author" defaultValue={isEditing.author} placeholder="Autor" required className="rounded-lg border border-slate-200 p-2 text-sm bg-white" />
                    <input name="category" defaultValue={isEditing.category} placeholder="Categoria" className="rounded-lg border border-slate-200 p-2 text-sm bg-white" />
                    <input name="barcode" defaultValue={isEditing.barcode} placeholder="ISBN" className="rounded-lg border border-slate-200 p-2 text-sm bg-white" />
                    <div className="relative flex gap-2">
                       <div className="relative flex-1">
                         <ImageIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                         <input 
                           name="coverUrl" 
                           placeholder="URL da Capa" 
                           className="w-full rounded-lg border border-slate-200 p-2 pl-9 text-sm bg-white" 
                           value={capturedGSPath || capturedCoverUrl}
                           onChange={(e) => {
                             if (e.target.value.startsWith('gs://')) {
                               setCapturedGSPath(e.target.value);
                             } else {
                               setCapturedCoverUrl(e.target.value);
                               setCapturedGSPath('');
                             }
                           }}
                         />
                       </div>
                       <button 
                         type="button"
                         onClick={() => {
                           setIsCapturingBack(false);
                           setShowCamera(true);
                         }}
                         className="flex items-center justify-center rounded-lg bg-slate-100 p-2 text-slate-600 hover:bg-slate-200"
                         title="Tirar Foto da Capa"
                       >
                         <Camera className="h-5 w-5" />
                       </button>
                    </div>
                    <input name="backCoverUrl" defaultValue={isEditing.backCoverUrl} placeholder="URL da Contracapa" className="rounded-lg border border-slate-200 p-2 text-sm bg-white" />
                    
                    <select 
                      name="locationType" 
                      defaultValue={isEditing.availableLocationType || 'HALL'} 
                      className="rounded-lg border border-slate-200 p-2 text-sm bg-white"
                      onChange={(e) => setSelectedLocationType(e.target.value as 'HALL' | 'APARTMENT')}
                    >
                      <option value="HALL">Hall do Bloco</option>
                      <option value="APARTMENT">Apartamento</option>
                    </select>
                    <select name="locationLabel" defaultValue={isEditing.availableLocationLabel} required className="rounded-lg border border-slate-200 p-2 text-sm bg-white">
                      <option value="">Selecione o Local</option>
                      {selectedLocationType === 'HALL' ? (
                        Array.from(new Set([
                          ...blocks.map(block => `Hall ${block.name}`),
                          ...locations.filter(l => l.active).map(loc => loc.name)
                        ])).sort().map(label => (
                          <option key={label} value={label}>{label}</option>
                        ))
                      ) : (
                        apartments.map(apt => {
                          const block = blocks.find(b => b.id === apt.blockId);
                          const label = `Apto ${apt.number}${block ? ` - ${block.name}` : ''}`;
                          return <option key={apt.id} value={label}>{label}</option>;
                        })
                      )}
                      {!locations.find(l => l.name === isEditing.availableLocationLabel) && 
                       !blocks.find(b => `Hall ${b.name}` === isEditing.availableLocationLabel) &&
                       isEditing.availableLocationLabel && (
                        <option value={isEditing.availableLocationLabel}>{isEditing.availableLocationLabel}</option>
                      )}
                    </select>
                  </>
                )}
                {activeTab === 'BLOCKS' && (
                  <input name="name" defaultValue={isEditing.name} placeholder="Ex: Bloco A" required className="rounded-lg border border-slate-200 p-2 text-sm bg-white" />
                )}
                {activeTab === 'LOCATIONS' && (
                  <>
                    <input name="name" defaultValue={isEditing.name} placeholder="Nome do Local" required className="rounded-lg border border-slate-200 p-2 text-sm bg-white" />
                    <input name="description" defaultValue={isEditing.description} placeholder="Descrição" className="rounded-lg border border-slate-200 p-2 text-sm bg-white" />
                  </>
                )}
                {activeTab === 'APARTMENTS' && (
                  <>
                    <input name="number" defaultValue={isEditing.number} placeholder="Ex: 1203" required className="rounded-lg border border-slate-200 p-2 text-sm bg-white" />
                    <select name="blockId" defaultValue={isEditing.blockId} required className="rounded-lg border border-slate-200 p-2 text-sm bg-white">
                      {blocks.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </>
                )}
                {activeTab === 'USERS' && (
                  <>
                    <input name="name" defaultValue={isEditing.name} placeholder="Nome Completo" required className="rounded-lg border border-slate-200 p-2 text-sm bg-white" />
                    <div className="flex flex-col gap-1">
                      <select name="apartmentId" defaultValue={isEditing.apartmentId} className="rounded-lg border border-slate-200 p-2 text-sm bg-white">
                        <option value="">Vincular Apartamento Oficial</option>
                        {apartments.map(a => (
                          <option key={a.id} value={a.id}>Apto {a.number} ({blocks.find(b => b.id === a.blockId)?.name})</option>
                        ))}
                      </select>
                      {isEditing.residencyNote && (
                        <p className="text-[10px] text-amber-600 font-medium italic">Informado pelo usuário: {isEditing.residencyNote}</p>
                      )}
                    </div>
                  </>
                )}
             </div>
             <div className="mt-4 flex gap-2">
                <button 
                  type="submit" 
                  disabled={submitting}
                  className="flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                >
                  {submitting && <Loader2 className="h-3 w-3 animate-spin" />}
                  Atualizar
                </button>
                <button type="button" onClick={() => setIsEditing(null)} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600">Cancelar</button>
             </div>
          </form>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-6 py-4">Nome / Título</th>
                <th className="px-6 py-4">Detalhes</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                   <td colSpan={3} className="py-10 text-center text-slate-400">Carregando...</td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                   <td colSpan={3} className="py-10 text-center text-slate-400">Nenhum registro encontrado.</td>
                </tr>
              ) : data.map((item) => (
                <tr key={item.id} className="group hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <p className={cn("font-bold text-slate-900", isEditing?.id === item.id && "text-amber-600")}>
                      {item.title || item.name || `Apto ${item.number}`}
                    </p>
                    {activeTab === 'BOOKS' && <p className="text-xs text-slate-400">{item.author}</p>}
                    {activeTab === 'USERS' && (
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-slate-400">{item.email}</p>
                        {!item.active && (
                          <span className="flex items-center gap-1 rounded bg-red-100 px-1 py-0.5 text-[8px] font-bold text-red-600 uppercase">
                            <ShieldAlert className="h-2 w-2" /> Bloqueado
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {activeTab === 'BOOKS' && (
                       <div className="flex flex-col gap-1">
                        <span className={cn(
                            "inline-block rounded-full px-2 py-0.5 text-xs font-bold ring-1 ring-inset w-fit",
                            item.status === 'AVAILABLE' ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20" : "bg-amber-50 text-amber-700 ring-amber-600/20"
                        )}>
                          {item.status}
                        </span>
                        {item.status === 'AVAILABLE' && (
                          <span className="text-[10px] text-slate-500 italic">Em: {item.availableLocationLabel || 'Não informado'}</span>
                        )}
                       </div>
                    )}
                    {activeTab === 'USERS' && (
                      <div className="flex flex-col gap-1">
                        <span className="font-medium text-slate-700">
                          {item.apartmentId ? (
                            (() => {
                              const apto = apartments.find(a => a.id === item.apartmentId);
                              if (apto) {
                                const block = blocks.find(b => b.id === apto.blockId);
                                return `Apto ${apto.number} (${block?.name || '...'})`;
                              }
                              return `Apto ${item.apartmentId}`;
                            })()
                          ) : (
                            item.residencyNote 
                              ? <span className="text-amber-600 italic font-normal text-xs">{item.residencyNote}</span>
                              : <span className="text-red-400 italic font-normal text-xs">Sem Apto</span>
                          )}
                        </span>
                        <span className="text-[10px] text-slate-400 uppercase tracking-tighter font-bold">{item.role}</span>
                      </div>
                    )}
                    {activeTab === 'APARTMENTS' && (
                      <div className="flex flex-col">
                        <span className="font-medium text-slate-700">Número {item.number}</span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase">
                          {blocks.find(b => b.id === item.blockId)?.name || 'Bloco desconhecido'}
                        </span>
                      </div>
                    )}
                    {activeTab === 'BLOCKS' && (
                      <span className="text-xs font-mono text-slate-400 uppercase">{item.id.slice(0, 8)}</span>
                    )}
                    {activeTab === 'LOCATIONS' && (
                      <span className="text-xs text-slate-400">{item.description || 'Sem descrição'}</span>
                    )}
                  </td>
                   <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                       {activeTab === 'USERS' && (
                         <button
                           onClick={() => handleToggleActive(item)}
                           className={cn(
                             "rounded-lg p-1.5 transition-all",
                             item.active 
                               ? "text-slate-400 hover:bg-amber-50 hover:text-amber-600" 
                               : "text-red-600 bg-red-50 hover:bg-emerald-50 hover:text-emerald-600"
                           )}
                           title={item.active ? "Bloquear Morador" : "Desbloquear Morador"}
                         >
                           {item.active ? <ShieldAlert className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                         </button>
                       )}
                       <button 
                         onClick={() => {
                           setIsEditing(item);
                           setShowAddForm(false);
                           setSelectedLocationType(item.availableLocationType || 'HALL');
                           setCapturedCoverUrl(item.coverUrl || '');
                         }}
                         className="rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-indigo-600 group-hover:shadow-sm transition-all"
                       >
                          <Edit2 className="h-4 w-4" />
                       </button>
                       
                       {deleteConfirmId === item.id ? (
                         <div className="flex items-center gap-1 bg-red-50 rounded-lg p-1 border border-red-100 animate-in fade-in slide-in-from-right-1 duration-200">
                           <button 
                             onClick={async () => {
                               setDeleteConfirmId(null);
                               const collectionName = activeTab.toLowerCase();
                               try {
                                 if (activeTab === 'BOOKS') {
                                   await updateDoc(doc(db, collectionName, item.id), { 
                                     active: false,
                                     updatedAt: serverTimestamp(),
                                     deletedByUserId: auth.currentUser?.uid || null
                                   });
                                 } else {
                                   await deleteDoc(doc(db, collectionName, item.id));
                                 }
                                 await loadData();
                               } catch (err) {
                                 handleFirestoreError(err, OperationType.DELETE, `${collectionName}/${item.id}`);
                               }
                             }}
                             className="rounded px-2 py-0.5 text-[10px] font-bold bg-red-600 text-white hover:bg-red-700"
                           >
                             Excluir
                           </button>
                           <button 
                             onClick={() => setDeleteConfirmId(null)}
                             className="rounded px-2 py-0.5 text-[10px] font-bold text-slate-500 hover:text-slate-900"
                           >
                             Não
                           </button>
                         </div>
                       ) : (
                         <button 
                           type="button"
                           onClick={(e) => {
                             e.stopPropagation();
                             setDeleteConfirmId(item.id);
                           }}
                           className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-all cursor-pointer"
                           title="Excluir"
                         >
                            <Trash2 className="h-4 w-4" />
                         </button>
                       )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

