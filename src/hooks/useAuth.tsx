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
    let provisioningInProgress = false;

    // Handle the redirect result separately to ensure we don't miss it
    const handleRedirect = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result?.user) {
          console.log("[Auth] Redirect result found for:", result.user.email);
        }
      } catch (error: any) {
        console.error("[Auth] Redirect error:", error);
      }
    };
    handleRedirect();

    const unsubscribeAuth = onAuthStateChanged(auth, async (fUser) => {
      console.log("[Auth] onAuthStateChanged:", fUser?.email || "No user");
      setFirebaseUser(fUser);
      
      if (!fUser) {
        if (unsubscribeDoc) unsubscribeDoc();
        setUser(null);
        setLoading(false);
        return;
      }

      const userRef = doc(db, "users", fUser.uid);

      if (unsubscribeDoc) unsubscribeDoc();

      unsubscribeDoc = onSnapshot(userRef, async (userDoc) => {
        if (userDoc.exists()) {
          const data = userDoc.data() as User;
          
          // Check if we need to sync anything (Admin status, etc) in background
          const isAdminEmail = fUser.email === 'brunoscruz@gmail.com';
          if (isAdminEmail && (data.role !== 'ADMIN' || !data.active)) {
            updateDoc(userRef, { role: 'ADMIN', active: true }).catch(e => console.error("Admin sync failed", e));
          }

          const resolvedUser = { 
            id: userDoc.id, 
            ...data,
          } as User;

          setUser(resolvedUser);
          setLoading(false);
        } else {
          console.log("[Auth] User profile missing");
          const isGoogleUser = fUser.providerData.some(p => p.providerId === 'google.com');

          if (isGoogleUser && !provisioningInProgress) {
            provisioningInProgress = true;
            console.log("[Auth] Provisioning Google profile...");
            setLoading(true);
            try {
              await ensureUserProfile(fUser);
              // The snapshot will trigger again when doc is created
            } catch (e: any) {
              console.error("[Auth] Provisioning failed:", e);
              alert("Erro ao criar perfil de usuário: " + e.message);
              setUser(null);
              setLoading(false);
            } finally {
              provisioningInProgress = false;
            }
          } else if (!provisioningInProgress) {
            // Not a google user or already failed provisioning
            console.log("[Auth] Unauthorized profile state - logout");
            setUser(null);
            setLoading(false);
          }
        }
      }, (error) => {
        console.error("[Auth] Profile snapshot error:", error);
        setLoading(false);
      });
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeDoc) unsubscribeDoc();
    };
  }, []);

  const ensureUserProfile = async (fUser: FirebaseUser) => {
    const userRef = doc(db, 'users', fUser.uid);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
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
      console.log("[Auth] New user profile successfully created");
    }
  };

  const isMobile = () => {
    return /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent) || 
           (navigator.maxTouchPoints > 0);
  };

  const signIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      // Force account selection to avoid auto-login loops that might be stuck
      provider.setCustomParameters({ prompt: 'select_account' });
      
      // Use popup for everything first, fallback to redirect ONLY if specifically blocked
      try {
        const result = await signInWithPopup(auth, provider);
        if (result.user) {
          await ensureUserProfile(result.user);
        }
      } catch (error: any) {
        if (error.code === 'auth/popup-blocked') {
          console.log("Popup blocked, trying redirect as fallback");
          await signInWithRedirect(auth, provider);
        } else {
          throw error;
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
