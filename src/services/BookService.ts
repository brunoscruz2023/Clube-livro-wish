import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp,
  orderBy,
  limit,
  Timestamp,
  increment,
  runTransaction
} from 'firebase/firestore';
import { db, handleFirestoreError } from '../lib/firebase';
import { Book, BookLoan, OperationType, BookStatus, LoanStatus, LocationType } from '../types';
import { addDays } from 'date-fns';

export const BookService = {
  async listBooks() {
    const path = 'books';
    try {
      const q = query(collection(db, path), where('active', '==', true), orderBy('title'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Book));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  },

  async createLoan(bookId: string, apartmentId: string, userId: string) {
    const loanPath = 'book_loans';
    const bookDocRef = doc(db, 'books', bookId);

    try {
      // 1. Fetch apartment and block info first to have a nice label
      let aptoLabel = apartmentId;
      try {
        const aptoSnap = await getDocs(query(collection(db, 'apartments'), where('__name__', '==', apartmentId)));
        let aptoData = !aptoSnap.empty ? aptoSnap.docs[0].data() : null;
        
        if (!aptoData) {
          // Try getting by number field
          const aptoDoc = await getDocs(query(collection(db, 'apartments'), where('number', '==', apartmentId)));
          if (!aptoDoc.empty) {
            aptoData = aptoDoc.docs[0].data();
            apartmentId = aptoDoc.docs[0].id;
          }
        }

        if (aptoData) {
          aptoLabel = `Apto ${aptoData.number}`;
          if (aptoData.blockId) {
             const blockSnap = await getDocs(query(collection(db, 'blocks'), where('__name__', '==', aptoData.blockId)));
             if (!blockSnap.empty) {
               aptoLabel += ` - ${blockSnap.docs[0].data().name}`;
             }
          }
        }
      } catch (e) {
        console.error("Error building apto label:", e);
      }

      // 2. Check apartment limit (max 3) - outside transaction
      const q = query(
        collection(db, loanPath), 
        where('apartmentId', '==', apartmentId), 
        where('status', '==', 'ACTIVE')
      );
      const activeLoansSnapshot = await getDocs(q);
      if (activeLoansSnapshot.size >= 3) {
        throw new Error('Você já possui 3 livros emprestados (limite máximo).');
      }

      await runTransaction(db, async (transaction) => {
        const bookDoc = await transaction.get(bookDocRef);
        if (!bookDoc.exists()) throw new Error('Livro não encontrado');
        if (bookDoc.data().status !== 'AVAILABLE') throw new Error('Livro não disponível');

        const now = new Date();
        const dueAt = addDays(now, 14);

        const loanData: any = {
          bookId,
          apartmentId,
          borrowerUserId: userId,
          loanedAt: serverTimestamp(),
          dueAt: Timestamp.fromDate(dueAt),
          renewalCount: 0,
          status: 'ACTIVE',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        const newLoanRef = doc(collection(db, loanPath));
        transaction.set(newLoanRef, loanData);
        transaction.update(bookDocRef, {
          status: 'LOANED',
          availableLocationType: 'APARTMENT',
          availableLocationLabel: aptoLabel,
          availableLocationBlockId: null,
          loanedToApartmentId: apartmentId,
          loanedToApartmentLabel: aptoLabel,
          updatedAt: serverTimestamp()
        });
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, loanPath);
    }
  },

  async renewLoan(loanId: string) {
    const loanRef = doc(db, 'book_loans', loanId);
    try {
      await runTransaction(db, async (transaction) => {
        const loanDoc = await transaction.get(loanRef);
        if (!loanDoc.exists()) throw new Error('Empréstimo não encontrado');
        const data = loanDoc.data() as BookLoan;
        
        if (data.status !== 'ACTIVE') throw new Error('Empréstimo não está ativo');
        if (data.renewalCount >= 3) throw new Error('Limite de renovações atingido');

        const currentDueAt = data.dueAt instanceof Timestamp ? data.dueAt.toDate() : new Date(data.dueAt);
        const newDueAt = addDays(currentDueAt, 14);

        transaction.update(loanRef, {
          renewalCount: increment(1),
          dueAt: Timestamp.fromDate(newDueAt),
          lastRenewedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'book_loans');
    }
  },

  async returnLoan(loanId: string, bookId: string, location: { type: LocationType, label?: string, blockId?: string }) {
    const loanRef = doc(db, 'book_loans', loanId);
    const bookRef = doc(db, 'books', bookId);

    try {
      await runTransaction(db, async (transaction) => {
        transaction.update(loanRef, {
          status: 'RETURNED',
          returnedAt: serverTimestamp(),
          returnLocationType: location.type,
          returnLocationLabel: location.label || null,
          returnLocationBlockId: location.blockId || null,
          updatedAt: serverTimestamp()
        });

        transaction.update(bookRef, {
          status: 'AVAILABLE',
          availableLocationType: location.type,
          availableLocationLabel: location.label || null,
          availableLocationBlockId: location.blockId || null,
          loanedToApartmentId: null,
          loanedToApartmentLabel: null,
          updatedAt: serverTimestamp()
        });
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'book_loans');
    }
  }
};
