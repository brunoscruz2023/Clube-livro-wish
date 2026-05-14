/**
 * Serviço para buscar detalhes de livros via ISBN 
 * Utiliza Google Books API e OpenLibrary como fallback.
 */

import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError } from '../lib/firebase';
import { OperationType } from '../types';

export interface ExternalBookInfo {
  title: string;
  author: any;
  description?: string;
  coverUrl?: string;
  isbn: string;
  category?: any;
  pageCount?: number;
}

export async function fetchBookDetailsByISBN(isbn: string): Promise<ExternalBookInfo | null> {
  const cleanIsbn = isbn.replace(/[^0-9X]/gi, '');
  console.log(`[BookService] Buscando ISBN via proxy: ${cleanIsbn} (Original: ${isbn})`);
  
  const logAPI = async (apiName: string, rawResponse: any) => {
    try {
      await addDoc(collection(db, 'api_logs'), {
        isbn,
        apiName,
        rawResponse,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error(`[BookService] Erro ao gravar log para ${apiName}:`, error);
      try {
        handleFirestoreError(error, OperationType.WRITE, 'api_logs');
      } catch (e) {
        // Silently continue
      }
    }
  };

  try {
    const response = await fetch(`/api/books/${cleanIsbn}`);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
    const { source, data } = await response.json();

    // Log the raw response in the frontend for tracking, as before
    await logAPI(source === 'google' ? 'Google Books (Proxy)' : 'OpenLibrary (Proxy)', data);

    if (source === 'google' && data.totalItems > 0) {
      const item = data.items[0].volumeInfo;
      return {
        title: item.title,
        author: item.authors,
        description: item.description,
        coverUrl: item.imageLinks?.thumbnail,
        isbn: isbn,
        category: item.categories,
        pageCount: item.pageCount
      };
    }

    if (source === 'openlibrary') {
      const olKey = `ISBN:${cleanIsbn}`;
      if (data[olKey]) {
        const item = data[olKey];
        return {
          title: item.title,
          author: item.authors,
          coverUrl: item.cover?.large || item.cover?.medium,
          isbn: isbn,
          category: item.subjects
        };
      }
    }

    console.log(`[BookService] Nenhuma API retornou dados via proxy para este ISBN.`);
    return null;
  } catch (error) {
    console.error("[BookService] Erro fatal ao buscar detalhes via proxy:", error);
    return null;
  }
}
