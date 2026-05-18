# **Technical Implementation Report: Book Club Synchronization**

This report details the necessary changes to synchronize the application's code with the required business rules and technical specifications for ISBN verification, Resident access, and Cloud Storage.

---

### **Point 1: ISBN Verification & `capturedGSPath` in `Admin.tsx`**

*   **How?**
    Implement a "Verification Gate" state. The UI will prevent recording a book if an ISBN is provided but has not been "Verified" via the search button (which triggers the duplicity check). It also adds a reactive state to sync the cloud storage path (GS Path) to the final database record.
*   **What codes will be changed?**
    `src/pages/Admin.tsx`
*   **What changes will be done for each code?**
    1.  **Add States (around Line 60):**
        ```typescript
        const [isVerified, setIsVerified] = useState(false);
        const [capturedGSPath, setCapturedGSPath] = useState('');
        ```
    2.  **Search Logic (Line 256):** Inside `handleBarcodeScan`, call `setIsVerified(true)` at the end of the success flow.
    3.  **ISBN Field (Line 535):** In the ISBN input `onChange` handler, add `setIsVerified(false)`.
        *Technical Why:* If the user types a new number, the current verification becomes invalid and must be re-run.
    4.  **Save Button (Line 580):** Add the condition: `disabled={submitting || (isbnValue.length > 0 && !isVerified)}`.
    5.  **Submit Logic (Line 371):** In `handleSubmit`, add the `gsPath: capturedGSPath` field to the `newBook` object during the `addDoc` call.

---

### **Point 2: Resident Permissions & Navigation Accessibility**

*   **How?**
    Lower the security barrier in the database and adjust the frontend routing and menu logic to allow non-admin users to reach and use the recording form.
*   **What codes will be changed?**
    `firestore.rules` and `src/App.tsx`
*   **What changes will be done for each code?**
    1.  **Security Rules (Line 107 of `firestore.rules`):** Change the `books` collection rule from `allow create: if isAdmin();` to `allow create: if isSignedIn();`.
    2.  **Navigation (Line 83 of `src/App.tsx`):** Update the `navItems` array to include the `/admin` path for residents, using the label "Adicionar Livro".
        *Change:* `...(user?.active ? [{ label: user.role === 'ADMIN' ? 'Admin' : 'Adicionar Livro', path: '/admin', icon: Plus }] : [])`.
    3.  **Route Protection (Line 420 of `src/App.tsx`):** Remove the `adminOnly` prop from the `/admin` route to allow Residents to enter.

---

### **Point 3: Specification for `CameraCapture.tsx`**

*   **How?**
    Create a new component that manages the camera stream and uses a hidden `canvas` to perform a mathematical "Center Crop" to a 2:3 ratio before uploading.
*   **What codes will be changed?**
    A new file: `src/components/CameraCapture.tsx`.
*   **What changes will be done for each code?**
    1.  **Guide UI:** Implement a CSS overlay with a centered rectangular frame (2:3 ratio).
    2.  **Crop Function:** Use `canvas.getContext('2d').drawImage()` passing 9 parameters. Set the source coordinates (`sx`, `sy`) to the center of the video frame and the destination `width/height` to 800x1200.
    3.  **Output:** Use `canvas.toBlob` with `image/jpeg` at 0.85 quality. *Technical Why:* Ensures consistent aspect ratio for all library covers.

---

### **Point 4: `storageService.ts` & Firebase Storage Initialization**

*   **How?**
    Initialize the Firebase Storage SDK and create a service layer that manages the file upload and returns both the public URL and the canonical GS Path.
*   **What codes will be changed?**
    `src/lib/firebase.ts` and a new file `src/services/storageService.ts`.
*   **What changes will be done for each code?**
    1.  **Init (Line 9 of `firebase.ts`):**
        ```typescript
        import { getStorage } from 'firebase/storage';
        export const storage = getStorage(app, "gs://gen-lang-client-0243519410.firebasestorage.app");
        ```
    2.  **Service Logic:** Implement `uploadBookCover(file: Blob)`. It must call `uploadBytes` and `getDownloadURL`.
    3.  **Return Data:** The function must return an object: `{ downloadURL, gsPath: "gs://gen-lang-client-0243519410.firebasestorage.app/" + fileRef.fullPath }`.
        *Technical Why:* The `gsPath` is the permanent cloud identifier used for internal audit and cross-environment sync.

---

### **Point 5: Resident Book Management & "Soft Delete" Logic**

*   **How?**
    Allow all active users to contribute to the library by exposing the recording interface to Residents. Implement "Soft Delete" so that when a Resident "removes" a book, it simply becomes `active: false`, keeping the record intact for Administrative history and audit.
*   **What codes will be changed?**
    `src/App.tsx`, `src/pages/Admin.tsx`, and `firestore.rules`
*   **What changes will be done for each code?**
    1.  **Menu & Navigation (`src/App.tsx` Line 83):**
        Add "Adicionar Livro" to the navigation for all active users. Residents should be directed to the `/admin` path but with a filtered view.
    2.  **Row-Level Filtering (`src/pages/Admin.tsx` Line 135):**
        In `loadData()`, if the user is a `RESIDENT`, add a filter to the query: `where('createdByUserId', '==', auth.currentUser.uid)`.
        *Technical Why:* Ensures residents only see and manage books they personally recorded.
    3.  **Soft Delete Implementation (`src/pages/Admin.tsx` Line 1294):**
        Change the delete action for Residents. Instead of calling `deleteDoc`, it must call `updateDoc(doc(db, 'books', item.id), { active: false })`.
        *Technical Why:* This satisfies the "don't delete history" requirement. The book disappears from the Catalog and the Resident's list but remains in the database for Admin review.
    4.  **Security Enforcement (`firestore.rules` Line 106):**
        Update `update` and `delete` rules for the `books` collection:
        ```javascript
        allow update, delete: if isAdmin() || (isSignedIn() && resource.data.createdByUserId == request.auth.uid);
        ```
        *Technical Why:* Prevents a resident from accidentally or maliciously editing or removing a book that belongs to another user.
