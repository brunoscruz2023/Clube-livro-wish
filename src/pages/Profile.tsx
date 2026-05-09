import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { db } from '../lib/firebase';
import { collection, getDocs, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import { Apartment, Block } from '../types';
import { Building, MapPin, User, Check, Loader2, Wand2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';
import { writeBatch, serverTimestamp as firestoreTimestamp } from 'firebase/firestore';

import { ResidencyInfo } from '../components/ResidencyInfo';

export function Profile() {
  const { user, firebaseUser } = useAuth();
  const navigate = useNavigate();
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [name, setName] = useState('');
  const [selectedBlock, setSelectedBlock] = useState('');
  const [selectedApto, setSelectedApto] = useState('');
  const [showSeedConfirm, setShowSeedConfirm] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Use the same logic as header for consistency
  const displayedName = name || (user?.name === 'Morador' ? '' : user?.name) || '';

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (user && isInitialLoad) {
      if (user.name && user.name !== 'Morador') {
        setName(user.name);
      } else if (user.name === 'Morador' && name === '') {
        setName('');
      }
    }
  }, [user, isInitialLoad]);

  useEffect(() => {
    if (user?.apartmentId && apartments.length > 0 && isInitialLoad) {
      const currentApto = apartments.find(a => a.id === user.apartmentId);
      if (currentApto) {
        setSelectedApto(currentApto.id);
        setSelectedBlock(currentApto.blockId);
      }
    }
  }, [user, apartments, isInitialLoad]);

  useEffect(() => {
    if (isInitialLoad && user && apartments.length > 0) {
      const hasAptoInList = !user.apartmentId || apartments.some(a => a.id === user.apartmentId);
      if (hasAptoInList) {
        setIsInitialLoad(false);
      }
    }
  }, [user, apartments, isInitialLoad]);

  async function loadData() {
    setLoading(true);
    try {
      const blocksSnap = await getDocs(query(collection(db, 'blocks'), orderBy('name')));
      const blocksData = blocksSnap.docs.map(d => ({ id: d.id, ...d.data() } as Block));
      setBlocks(blocksData);

      const aptosSnap = await getDocs(query(collection(db, 'apartments'), orderBy('number')));
      const aptosData = aptosSnap.docs.map(d => ({ id: d.id, ...d.data() } as Apartment));
      setApartments(aptosData);
    } catch (error) {
       console.error(error);
    }
    setLoading(false);
  }

  const filteredApartments = apartments.filter(a => !selectedBlock || a.blockId === selectedBlock);

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
          createdAt: firestoreTimestamp(),
          updatedAt: firestoreTimestamp()
        });

        for (let floor = 1; floor <= 15; floor++) {
          for (let unit = 1; unit <= 15; unit++) {
            const unitNumber = `${blockName}${floor}${unit.toString().padStart(2, '0')}`;
            const aptoRef = doc(collection(db, 'apartments'));
            batch.set(aptoRef, {
              blockId: blockRef.id,
              number: unitNumber,
              active: true,
              createdAt: firestoreTimestamp(),
              updatedAt: firestoreTimestamp()
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

  const handleSave = async () => {
    if (!user || !selectedApto) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.id), {
        name: name,
        apartmentId: selectedApto,
        updatedAt: firestoreTimestamp()
      });
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setIsInitialLoad(true);
      }, 3000);
    } catch (error: any) {
      console.error('Error updating profile:', error);
      alert('Erro ao salvar: ' + (error.message || 'Verifique suas permissões.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      {showSuccess && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed top-20 left-1/2 -translate-x-1/2 z-50 rounded-2xl bg-emerald-600 px-6 py-3 font-bold text-white shadow-xl shadow-emerald-200"
        >
          Perfil atualizado com sucesso!
        </motion.div>
      )}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Seu Perfil</h1>
          <p className="mt-1 text-slate-500">Configure suas informações para utilizar o sistema.</p>
        </div>
        {user?.role === 'ADMIN' && apartments.length === 0 && (
          <div className="flex flex-col items-end gap-2">
            <button 
              onClick={() => setShowSeedConfirm(true)}
              disabled={seeding}
              className="flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-2 text-sm font-bold text-amber-700 border border-amber-200"
            >
              {seeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              Gerar Dados Iniciais
            </button>
            {showSeedConfirm && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 p-2 text-xs border border-red-100">
                <span className="font-bold text-red-700">Confirmar geração de 450 aptos?</span>
                <button onClick={handleSeedData} className="bg-red-600 text-white px-2 py-0.5 rounded font-bold">Sim</button>
                <button onClick={() => setShowSeedConfirm(false)} className="text-slate-500">Não</button>
              </div>
            )}
          </div>
        )}
      </header>

      <div className="rounded-3xl bg-white border border-slate-200 p-8 shadow-sm space-y-8">
        <div className="flex items-center gap-6">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
             {firebaseUser?.photoURL ? (
               <img src={firebaseUser.photoURL} alt="Avatar" className="h-full w-full rounded-2xl object-cover" />
             ) : (
               <User className="h-10 w-10" />
             )}
          </div>
          <div>
            <div className="flex flex-col">
              <h2 className="text-xl font-bold text-slate-900">
                {user?.name === 'Morador' ? 'Configurar Nome' : user?.name}
              </h2>
              <ResidencyInfo 
                apartmentNumber={user?.apartmentNumber}
                apartmentBlock={user?.apartmentBlock}
                residencyNote={user?.residencyNote}
                className="text-sm text-slate-500 mt-0.5 font-medium"
              />
            </div>
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-600 uppercase">
              {user?.role === 'ADMIN' ? 'Administrador' : 'Morador'}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-bold text-slate-700">Seu Nome</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white p-3 text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              placeholder="Digite seu nome completo"
            />
          </div>
        </div>

        <div className="space-y-4">
          <label className="block text-sm font-bold text-slate-700">Escolha seu Apartamento</label>
          
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">Bloco / Torre</label>
              <select
                value={selectedBlock}
                onChange={(e) => {
                  setSelectedBlock(e.target.value);
                  setSelectedApto('');
                }}
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">Selecione o Bloco...</option>
                {blocks.map((block) => (
                  <option key={block.id} value={block.id}>
                    {block.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">Número do Apto</label>
              <select
                value={selectedApto}
                onChange={(e) => setSelectedApto(e.target.value)}
                disabled={!selectedBlock}
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
              >
                <option value="">Selecione...</option>
                {filteredApartments.map((apto) => (
                  <option key={apto.id} value={apto.id}>
                    Apto {apto.number}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <p className="text-xs text-slate-500">O número do seu apartamento será visível para outros moradores nos seus empréstimos ativos.</p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving || !selectedApto || !name || (() => {
            const currentAptoObj = apartments.find(a => a.id === user?.apartmentId) || apartments.find(a => a.number === user?.apartmentId);
            const isAptoUnchanged = selectedApto === currentAptoObj?.id;
            const isNameUnchanged = name === user?.name;
            return isAptoUnchanged && isNameUnchanged;
          })()}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-4 font-bold text-white shadow-lg shadow-indigo-100 transition-all hover:bg-indigo-700 active:scale-95 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
          Salvar Alterações
        </button>
      </div>
    </div>
  );
}
