# Security Spec - Clube do Livro

## 1. Data Invariants
- A `BookLoan` cannot exist without a valid `bookId` and `apartmentId`.
- A `BookLoan` can only be created if the book's `status` is `AVAILABLE`.
- A user can only manage loans for their own `apartmentId` (unless they are `ADMIN`).
- An `ADMIN` can manage all books, users, apartments, and blocks.
- `RESIDENT` users can only read `User` profiles and `Apartment` info within their own context or limited public view (just apartment number for active loans).
- `Book` status must be updated to `LOANED` when a loan is created and back to `AVAILABLE` when returned.

## 2. The "Dirty Dozen" Payloads (Deny list)
1.  **Identity Spoofing**: Resident user attempting to create a loan for another apartment.
2.  **Role Escalation**: Resident user attempting to update their own `role` to `ADMIN`.
3.  **Illegal Book Update**: Resident user attempting to change a book's `status` to `INACTIVE`.
4.  **Immutability Breach**: Attempting to change `loanedAt` date on an existing loan.
5.  **Exceeding Renewal Limit**: Attempting to set `renewalCount` to 4.
6.  **Admin Field Manipulation**: Attempting to change `active` status of a block or apartment as a resident.
7.  **Shadow Update**: Adding a field `isVerified: true` to a book document.
8.  **Orphaned Loan**: Creating a loan for a `bookId` that doesn't exist.
9.  **Concurrent Loan**: Creating a loan for a book that is already `LOANED`.
10. **PII Leak**: A resident user attempting to read the full `User` document of another resident (including email).
11. **ID Poisoning**: Using a 2KB string as a document ID for a book.
12. **Ghost Return**: Updating a loan to `status: 'RETURNED'` without being the borrower or an admin.

## 3. Test Runner (Placeholder for firestore.rules.test.ts)
(Tests would be implemented here using the Firebase Rules Unit Testing library if available in the environment).
In this environment, I will ensure the logic handles these cases.
