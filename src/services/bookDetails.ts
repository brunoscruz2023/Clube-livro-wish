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
  source?: string;
}

export async function fetchBookDetailsByISBN(isbn: string): Promise<ExternalBookInfo[]> {
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
    
    const results = await response.json();
    const candidates: ExternalBookInfo[] = [];

    // Process Google results
    if (results.google && results.google.totalItems > 0) {
      await logAPI('Google Books (Proxy)', results.google);
      results.google.items.forEach((item: any) => {
        candidates.push({
          title: item.volumeInfo.title,
          author: item.volumeInfo.authors,
          description: item.volumeInfo.description,
          coverUrl: (item.volumeInfo.imageLinks?.thumbnail || item.volumeInfo.imageLinks?.smallThumbnail)?.replace('http://', 'https://'),
          isbn: isbn,
          category: item.volumeInfo.categories,
          pageCount: item.volumeInfo.pageCount,
          source: 'Google Books'
        });
      });
    }

    // Process OpenLibrary results
    const olKey = `ISBN:${cleanIsbn}`;
    if (results.openlibrary && results.openlibrary[olKey]) {
      await logAPI('OpenLibrary (Proxy)', results.openlibrary);
      const item = results.openlibrary[olKey];
      candidates.push({
        title: item.title,
        author: item.authors?.map((a: any) => a.name) || [],
        description: item.notes || item.subtitle,
        coverUrl: (item.cover?.large || item.cover?.medium || item.cover?.small)?.replace('http://', 'https://'),
        isbn: isbn,
        category: item.subjects?.map((s: any) => s.name) || [],
        source: 'OpenLibrary'
      });
    }

    console.log(`[BookService] Total de candidatos encontrados: ${candidates.length}`);
    return candidates;
  } catch (error) {
    console.error("[BookService] Erro fatal ao buscar detalhes via proxy:", error);
    return [];
  }
}
