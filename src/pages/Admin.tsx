import React, { useState, useEffect } from 'react';
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
  orderBy,
  writeBatch
} from 'firebase/firestore';
import { db, handleFirestoreError } from '../lib/firebase';
import { 
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
  ShieldCheck
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';
import { Location } from '../types';

export function Admin() {
  const [activeTab, setActiveTab] = useState<'BOOKS' | 'USERS' | 'APARTMENTS' | 'BLOCKS' | 'LOCATIONS'>('BOOKS');
  const [data, setData] = useState<any[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState<any | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showSeedConfirm, setShowSeedConfirm] = useState(false);
  const [showUserSeedConfirm, setShowUserSeedConfirm] = useState(false);

  useEffect(() => {
    loadData();
    if (activeTab === 'APARTMENTS') {
      loadBlocks();
    }
    if (activeTab === 'USERS') {
      loadApartments();
    }
    if (activeTab === 'BOOKS') {
      loadLocations();
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
      // Remove all orderBy for now to avoid potential missing index issues
      // as the user is reporting that data is not appearing.
      const q = query(collection(db, path));
      const snapshot = await getDocs(q);
      const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      
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
      handleFirestoreError(error, OperationType.GET, path);
      setData([]);
    }
    setLoading(false);
  }

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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;
    
    setSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const collectionName = activeTab.toLowerCase();
    
    try {
      if (activeTab === 'BOOKS') {
        const newBook = {
          title: formData.get('title') as string,
          author: formData.get('author') as string,
          category: formData.get('category') as string,
          barcode: formData.get('barcode') as string,
          availableLocationType: formData.get('locationType') as string || 'FIXED_POINT',
          availableLocationLabel: formData.get('locationLabel') as string || '',
          status: 'AVAILABLE',
          active: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
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

      setShowAddForm(false);
      loadData();
    } catch (error) {
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
        updatedAt: serverTimestamp()
      };
      
      if (activeTab === 'BOOKS') {
        updates.title = formData.get('title') as string;
        updates.author = formData.get('author') as string;
        updates.category = formData.get('category') as string;
        updates.barcode = formData.get('barcode') as string;
        updates.availableLocationType = formData.get('locationType') as string;
        updates.availableLocationLabel = formData.get('locationLabel') as string;
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
    } catch (error) {
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
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Painel Administrativo</h1>
          <p className="mt-1 text-slate-500">Gerencie os cadastros e a biblioteca do condomínio.</p>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-px">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id as any);
              setShowAddForm(false);
              setIsEditing(null);
            }}
            className={cn(
              "flex items-center gap-2 border-b-2 px-6 py-4 text-sm font-semibold transition-all",
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
          <button 
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-indigo-700 transition-all"
          >
            <Plus className="h-4 w-4" /> Adicionar
          </button>
        </div>

        {showAddForm && (
          <form onSubmit={handleSubmit} className="border-b border-slate-100 bg-slate-50 p-6">
             <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {activeTab === 'BOOKS' && (
                  <>
                    <input name="title" placeholder="Título" required className="rounded-lg border border-slate-200 p-2 text-sm bg-white" />
                    <input name="author" placeholder="Autor" required className="rounded-lg border border-slate-200 p-2 text-sm bg-white" />
                    <input name="category" placeholder="Categoria" className="rounded-lg border border-slate-200 p-2 text-sm bg-white" />
                    <select name="locationType" className="rounded-lg border border-slate-200 p-2 text-sm bg-white">
                      <option value="FIXED_POINT">Local Fixo (Hall/Shelf)</option>
                      <option value="APARTMENT">Apartamento</option>
                    </select>
                    <div className="flex flex-col gap-1">
                      <select name="locationLabel" className="rounded-lg border border-slate-200 p-2 text-sm bg-white">
                        <option value="">Selecione o Local</option>
                        {locations.map(loc => (
                          <option key={loc.id} value={loc.name}>{loc.name}</option>
                        ))}
                        <option value="Hall do Bloco A">Hall do Bloco A (Exemplo)</option>
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
                        <option key={a.id} value={a.id}>Apto {a.number}</option>
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
                  Salvar
                </button>
                <button type="button" onClick={() => setShowAddForm(false)} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold">Cancelar</button>
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
                    <select name="locationType" defaultValue={isEditing.availableLocationType || 'FIXED_POINT'} className="rounded-lg border border-slate-200 p-2 text-sm bg-white">
                      <option value="FIXED_POINT">Local Fixo (Hall/Shelf)</option>
                      <option value="APARTMENT">Apartamento</option>
                    </select>
                    <select name="locationLabel" defaultValue={isEditing.availableLocationLabel} className="rounded-lg border border-slate-200 p-2 text-sm bg-white">
                      <option value="">Selecione o Local</option>
                      {locations.map(loc => (
                        <option key={loc.id} value={loc.name}>{loc.name}</option>
                      ))}
                      {!locations.find(l => l.name === isEditing.availableLocationLabel) && isEditing.availableLocationLabel && (
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
                            apartments.find(a => a.id === item.apartmentId)?.number 
                            ? `Apto ${apartments.find(a => a.id === item.apartmentId)?.number}` 
                            : `Apto ${item.apartmentId}`
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
                                 await deleteDoc(doc(db, collectionName, item.id));
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

