import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
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

    const unsubscribeAuth = onAuthStateChanged(auth, async (fUser) => {
      setFirebaseUser(fUser);
      
      if (unsubscribeDoc) {
        unsubscribeDoc();
        unsubscribeDoc = null;
      }

      if (fUser) {
        const isAdminEmail = fUser.email === 'brunoscruz@gmail.com';
        const userRef = doc(db, 'users', fUser.uid);
        
        unsubscribeDoc = onSnapshot(userRef, async (userDoc) => {
          if (userDoc.exists()) {
            const data = userDoc.data() as User;
            
            // Critical fix: If we have a displayName but Firestore still has 'Morador', sync it.
            // This handles the transition from Google login or slow email signups.
            if (data.name === 'Morador' && fUser.displayName && fUser.displayName !== 'Morador') {
              await updateDoc(userRef, { name: fUser.displayName });
            }

            if (isAdminEmail && data.role !== 'ADMIN') {
              await updateDoc(userRef, { role: 'ADMIN' });
            }

            // Resolve full residency information
            let resolvedApto = data.apartmentId || undefined;
            let resolvedBlock = undefined;

            if (data.apartmentId) {
              try {
                // Try to find the apartment document to get names/numbers
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

            // Ensure basic user info is available even if doc resolution fails
            const basicUser = { 
              id: userDoc.id, 
              ...data, 
              apartmentNumber: resolvedApto, 
              apartmentBlock: resolvedBlock 
            } as User;

            setUser(basicUser);
          } else {
            // Document does not exist - DO NOT auto-register anymore.
            // This prevents deleted users from being re-created.
            setUser(null);
          }
          setLoading(false);
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

  const signIn = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
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
