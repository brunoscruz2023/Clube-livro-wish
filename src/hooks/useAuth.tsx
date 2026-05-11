import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider, 
  signOut, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  User as FirebaseUser 
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, updateDoc, onSnapshot } from 'firebase/firestore';
import { auth, db, handleFirestoreError } from '../lib/firebase';
import { User, OperationType } from '../types';

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string, name: string, residencyNote: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeDoc: (() => void) | null = null;
    let isProvisioning = false;

    const checkRedirectResult = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result?.user) {
          console.log("Redirect sign-in successful", result.user.email);
          isProvisioning = true;
          await ensureUserProfile(result.user);
          isProvisioning = false;
        }
      } catch (error: any) {
        console.error("Redirect sign-in error:", error);
        isProvisioning = false;
        if (error.code !== 'auth/redirect-cancelled-by-user') {
          setTimeout(() => {
            alert("Erro ao retornar do login Google: " + error.message);
          }, 500);
        }
      }
    };

    checkRedirectResult();

    const unsubscribeAuth = onAuthStateChanged(auth, async (fUser) => {
      setFirebaseUser(fUser);
      
      if (unsubscribeDoc) {
        unsubscribeDoc();
        unsubscribeDoc = null;
      }

      if (fUser) {
        const userRef = doc(db, 'users', fUser.uid);
        
        // Redundancy: Check if profile exists and provision if Google user
        const userDocSync = await getDoc(userRef);
        const isGoogleUser = fUser.providerData.some(p => p.providerId === 'google.com');

        if (!userDocSync.exists() && isGoogleUser) {
          console.log("Provisioning profile for authenticated Google user...");
          setLoading(true);
          await ensureUserProfile(fUser);
        }

        unsubscribeDoc = onSnapshot(userRef, async (userDoc) => {
          if (userDoc.exists()) {
            const data = userDoc.data() as User;
            const isAdminEmail = fUser.email === 'brunoscruz@gmail.com';
            
            if (data.name === 'Morador' && fUser.displayName && fUser.displayName !== 'Morador') {
              await updateDoc(userRef, { name: fUser.displayName });
            }

            if (isAdminEmail && data.role !== 'ADMIN') {
              await updateDoc(userRef, { role: 'ADMIN' });
            }

            let resolvedApto = data.apartmentId || undefined;
            let resolvedBlock = undefined;

            if (data.apartmentId) {
              try {
                const aptoDoc = await getDoc(doc(db, 'apartments', data.apartmentId));
                if (aptoDoc.exists()) {
                  const aptoData = aptoDoc.data();
                  resolvedApto = aptoData.number;
                  if (aptoData.blockId) {
                    const blockDoc = await getDoc(doc(db, 'blocks', aptoData.blockId));
                    if (blockDoc.exists()) {
                      resolvedBlock = blockDoc.data().name;
                    }
                  }
                }
              } catch (e) {
                console.error("Error resolving residency info:", e);
              }
            }

            const basicUser = { 
              id: userDoc.id, 
              ...data, 
              apartmentNumber: resolvedApto, 
              apartmentBlock: resolvedBlock 
            } as User;

            setUser(basicUser);
            setLoading(false);
          } else {
            // Only set null if we are NOT in the middle of a redirect provision
            if (!isProvisioning) {
              setUser(null);
              setLoading(false);
            }
          }
        }, (error) => {
          console.error("User snapshot error:", error);
          setLoading(false);
        });
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeDoc) unsubscribeDoc();
    };
  }, []);

  const ensureUserProfile = async (fUser: FirebaseUser) => {
    const userRef = doc(db, 'users', fUser.uid);
    try {
      const userDoc = await getDoc(userRef);
      if (!userDoc.exists()) {
        const isAdminEmail = fUser.email === 'brunoscruz@gmail.com';
        await setDoc(userRef, {
          name: fUser.displayName || 'Morador',
          email: fUser.email,
          role: isAdminEmail ? 'ADMIN' : 'RESIDENT',
          active: isAdminEmail ? true : false,
          apartmentId: null,
          residencyNote: 'Aguardando informações (Login via Google)',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        console.log("New user profile created for:", fUser.email);
      }
    } catch (error) {
      console.error("Error ensuring user profile:", error);
    }
  };

  const isMobile = () => {
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  };

  const signIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      
      if (isMobile()) {
        console.log("Mobile detected, using redirect flow");
        await signInWithRedirect(auth, provider);
      } else {
        const result = await signInWithPopup(auth, provider);
        if (result.user) {
          await ensureUserProfile(result.user);
        }
      }
    } catch (error: any) {
      console.error("Google Sign-In Error:", error);
      
      // Handle the specific "missing initial state" or "popup blocked" errors on mobile
      if (
        error.code === 'auth/internal-error' || 
        error.code === 'auth/popup-blocked' ||
        error.code === 'auth/cancelled-popup-request' ||
        error.message?.includes('initial state')
      ) {
        alert(
          "O login do Google falhou devido a restrições do seu navegador móvel.\n\n" +
          "Solução: Use a opção 'Entrar com Email e Senha' ou abra este link diretamente no Chrome/Safari."
        );
      } else {
        alert("Erro ao entrar com Google: " + error.message);
      }
    }
  };

  const signInWithEmail = async (email: string, pass: string) => {
    await signInWithEmailAndPassword(auth, email, pass);
  };

  const signUpWithEmail = async (email: string, pass: string, name: string, residencyNote: string) => {
    try {
      const { user: fUser } = await createUserWithEmailAndPassword(auth, email, pass);
      await updateProfile(fUser, { displayName: name });
      
      // Create the Firestore document immediately with all info
      const userRef = doc(db, 'users', fUser.uid);
      const isAdminEmail = email === 'brunoscruz@gmail.com';

      await setDoc(userRef, {
        name: name,
        email: email,
        role: isAdminEmail ? 'ADMIN' : 'RESIDENT',
        active: isAdminEmail ? true : false, // Default to blocked for security
        apartmentId: null,
        residencyNote: residencyNote,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error: any) {
      // If document creation fails but auth was created, this is a bad state
      handleFirestoreError(error, OperationType.WRITE, `users/${auth.currentUser?.uid}`);
      throw error;
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, firebaseUser, loading, signIn, signInWithEmail, signUpWithEmail, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
