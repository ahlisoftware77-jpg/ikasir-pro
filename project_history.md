# Project History & Changelog - iKasir Pro

Dokumen ini mencatat riwayat pengembangan, perubahan kode (changelog), serta perintah penting yang dijalankan di dalam proyek iKasir Pro (Web & Mobile).

---

## 🛠️ Riwayat Perintah Penting (Command History)

Berikut adalah perintah-perintah penting yang sering digunakan untuk pengembangan, validasi, dan deployment proyek ini:

### 1. Validasi & Pemeriksaan Tipe (TypeScript)
*   **Web**:
    ```bash
    cd web
    npx tsc --noEmit
    ```
*   **Mobile**:
    ```bash
    cd mobile
    npx tsc --noEmit
    ```

### 2. Build Produksi (Web Next.js)
*   **Web**:
    ```bash
    cd web
    npm run build
    ```

### 3. Git Deployment (GitHub)
*   **Penyimpanan Perubahan**:
    ```bash
    git add .
    git commit -m "feat: implement staff permissions on mobile & superadmin disabled menu dimming"
    git push origin main
    ```

### 4. Expo OTA Update (Mobile Application)
*   **Melakukan Update ke Production Channel**:
    ```bash
    cd mobile
    npx eas-cli update --channel production --message "feat: staff permissions and superadmin menu dimming"
    ```

---

## 📝 Catatan Perubahan & Fitur (Changelog)

### [2026-06-14] - Fitur Deskripsi, Revert Mode Cloudinary, & Cetak Barcode Mobile
#### Perubahan / Penambahan Fitur:
1. **Fitur Deskripsi Produk Lengkap**:
   - Menambahkan kolom **Deskripsi** di tabel daftar produk admin web (`/products`) dengan batasan `line-clamp-2` dan HTML `title` tooltip.
   - Menambahkan pratinjau deskripsi di bawah nama produk pada mobile card (`mobile`).
   - Menampilkan deskripsi produk di halaman pesanan pelanggan (`/tr`) dengan toggle interaktif **Selengkapnya** / **Tutup**.
   - Menambahkan input field berbentuk `textarea` **Deskripsi Produk (Opsional)** pada modal tambah & edit produk di dashboard web (`/products`).
2. **Revert Cloudinary Overwrite ke Mode Unik (Option B)**:
   - Mengembalikan logic unggah gambar Cloudinary agar selalu menghasilkan public_id acak (unik) guna menghindari error preset unsigned uploads.
3. **Fitur Cetak Barcode di Aplikasi Mobile**:
   - Menambahkan mode seleksi produk (multi-select) dengan checkbox di aplikasi mobile (`ProductsScreen`).
   - Menambahkan modal dialog **Cetak Barcode** di mobile dengan pilihan ukuran kertas thermal (58x30 / 58x20) dan penyesuaian kuantitas per produk.
   - Integrasi generator barcode Code 128 SVG murni (beroperasi 100% offline).
   - Menambahkan dukungan cetak sistem (`expo-print`) serta ekspor/berbagi dokumen PDF label (`expo-sharing`).

#### Berkas yang Dimodifikasi:
* **Web**:
  - [products/page.tsx](file:///e:/yadiapp-project/KASIR/web/src/app/products/page.tsx) - Menambahkan kolom deskripsi di tabel merchant, pratinjau mobile card merchant, dan input textarea pada form tambah/edit modal.
  - [tr/page.tsx](file:///e:/yadiapp-project/KASIR/web/src/app/tr/page.tsx) - Menampilkan deskripsi produk di halaman pemesanan pelanggan dengan toggle expand.
* **Mobile**:
  - [ProductFormScreen.tsx](file:///e:/yadiapp-project/KASIR/mobile/src/screens/ProductFormScreen.tsx) - Mengembalikan path Cloudinary ke mode unik (Option B).
  - [FeatureScreen.tsx](file:///e:/yadiapp-project/KASIR/mobile/src/screens/FeatureScreen.tsx) - Mengembalikan upload bukti transfer ke mode unik (Option B).
  - [ProductsScreen.tsx](file:///e:/yadiapp-project/KASIR/mobile/src/screens/ProductsScreen.tsx) - Mengimplementasikan layout seleksi barcode, generator barcode offline, modal cetak & share PDF.

#### Catatan Deployment & Perintah yang Dijalankan:
1. **Git Commit & Push**:
   - Pushed commit `f454068e` ke branch `main`.
2. **Expo OTA Update**:
   - *Perintah*: `npx eas-cli update --channel production --message "feat: barcode printing and sharing from mobile" --non-interactive`
   - *Hasil*: Update OTA sukses dipublikasikan ke channel `production`.
     - **Update Group ID**: `0ca09570-1049-43f1-8c10-7d68f271b729`
     - **Android Update ID**: `019ec64e-4ddb-7a93-95e8-bf3921bb88fa`
     - **iOS Update ID**: `019ec64e-4ddb-781c-9176-aac1abb11016`
     - **Tautan EAS Dashboard**: [Expo Dev Update](https://expo.dev/accounts/ahlisoftware77/projects/mobile/updates/0ca09570-1049-43f1-8c10-7d68f271b729)

---

### [2026-06-13] - Penambahan Tombol Buat Akun Baru di SuperAdmin (Web & Mobile)
#### Perubahan / Penambahan Fitur:
1. **Fitur Buat Akun Baru di SuperAdmin (Web & Mobile)**
   - Menambahkan tombol "BUAT AKUN" di UI navigasi Data User SuperAdmin Web dan tombol "+" di mobile.
   - Menggunakan *secondary Firebase App instance* temporer di client-side untuk pendaftaran agar tidak memutus sesi login SuperAdmin.
   - Menyimpan user ke Firestore `users` dengan detail nama, email, role (CASHIER/ADMIN/SUPER-ADMIN), storeId, validUntil (30 hari), dan permission default sesuai role.
   - Menyediakan form modal lengkap dengan pilihan outlet toko aktif.

#### Berkas yang Dimodifikasi:
* **Web**:
  - [page.tsx](file:///e:/yadiapp-project/KASIR/web/src/app/super-admin/page.tsx) - Menambahkan state pendukung, tombol buat akun, logika secondary app, dan modal form registrasi.
* **Mobile**:
  - [SuperAdminScreen.tsx](file:///e:/yadiapp-project/KASIR/mobile/src/screens/SuperAdminScreen.tsx) - Menambahkan state pendukung, tombol +, logika secondary app (dengan dynamic imports), dan modal overlay form.

#### Catatan Deployment & Perintah yang Dijalankan:
1. **Git Commit & Push**:
   - *Perintah*: `git add .` dan `git commit -m "feat: add create account button in superadmin panel"` dan `git push origin main`
   - *Hasil*: Commit `2226786e` berhasil dipush ke repositori GitHub `ahlisoftware77-jpg/ikasir-pro` (cabang `main`).
2. **Expo OTA Update**:
   - *Perintah*: `npx eas-cli update --channel production --message "feat: add create account button in superadmin panel" --non-interactive`
   - *Hasil*: Update OTA sukses dipublikasikan ke channel `production`.
     - **Runtime Version**: `1.0.0`
     - **Update Group ID**: `07315652-1433-4af1-a47e-01a53648a412`
     - **Android Update ID**: `019ec0fb-aa29-75ce-9d1a-60e3ae114a72`
     - **iOS Update ID**: `019ec0fb-aa29-7eb0-a36b-169238b5f926`
     - **Tautan EAS Dashboard**: [Expo Dev Update](https://expo.dev/accounts/ahlisoftware77/projects/mobile/updates/07315652-1433-4af1-a47e-01a53648a412)

---

### [2026-06-13] - Kontrol Menu Kedaluwarsa Global & Optimalisasi UI Mobile
#### Perubahan / Penambahan Fitur:
1.  **Checklist Menu Kedaluwarsa Global (expiredDisabledMenus)**
    *   Menambahkan pengaturan checklist global di tab Branding SuperAdmin (Web & Mobile).
    *   Menyimpan daftar menu yang dinonaktifkan ketika masa aktif akun pengguna habis ke Firestore `system_settings/branding`.
    *   Mengimplementasikan penegakan dinamis di Mobile Tab Navigator (`App.tsx`) dan Menu Lainnya (`SettingsScreen.tsx`) berdasarkan data global tersebut.
    *   **Perbaikan Web Sidebar Dropdown**: Memperbaiki bug pada [Sidebar.tsx](file:///e:/yadiapp-project/KASIR/web/src/components/Sidebar.tsx) di mana menu bertipe dropdown/subItems (seperti *Manajemen Produk* dan *Laporan*) lolos dari pemblokiran masa aktif habis. Menu-menu tersebut kini ikut disamarkan (opasitas 40%) dan menampilkan toast error ketika diklik.
    *   **Perbaikan Web AuthProvider**: Memperbaiki bug pada [AuthProvider.tsx](file:///e:/yadiapp-project/KASIR/web/src/components/AuthProvider.tsx) di mana data checklist kedaluwarsa global (`expiredDisabledMenus`) tidak disinkronkan ke client Web, sehingga pemblokiran jatuh kembali (fallback) ke nilai default. Pilihan custom checklist kini tersinkronisasi secara real-time dan efektif di sisi Web client.
2.  **Optimalisasi UI Form Edit SuperAdmin & Migrasi Lengkap (Mobile)**
    *   Mengubah modal popup melayang untuk "Edit User" dan "Kelola Toko" di `SuperAdminScreen.tsx` menjadi render halaman penuh (full screen) dengan header navigasi tombol Kembali yang lebih intuitif dan nyaman.
    *   **Perbaikan Tombol Migrasi Database Toko**: Memperbaiki hilangnya opsi database proyek eksternal pada modal migrasi toko di `SuperAdminScreen.tsx`. Hal ini disebabkan oleh tidak adanya snapshot listener untuk `database_projects/list` ketika membuka fitur `superAdminStores` (Kelola Toko). Pilihan target database kini tampil lengkap seperti di web.
3.  **Pesan WhatsApp Pusat Bantuan Profesional**
    *   Memperbarui tautan WhatsApp Pusat Bantuan di mobile (`SettingsScreen.tsx`) dengan pesan pembuka profesional yang terenkode.
4.  **Penghapusan Pemblokiran Bawaan / Default (Fail-safe Fallback)**
    *   Menghapus sepenuhnya daftar menu bawaan default (`['/pos', '/estimations', '/debts', '/users']`) ketika masa aktif habis di seluruh aplikasi.
    *   Pemblokiran menu kedaluwarsa kini 100% didasarkan pada pengaturan checklist global branding SuperAdmin.

#### Berkas yang Dimodifikasi:
*   **Web**:
    *   [page.tsx](file:///e:/yadiapp-project/KASIR/web/src/app/super-admin/page.tsx) - Menambahkan antarmuka checklist branding global expired menu.
    *   [Sidebar.tsx](file:///e:/yadiapp-project/KASIR/web/src/components/Sidebar.tsx) - Menambahkan pengecekan pemblokiran kedaluwarsa pada menu dropdown/subItems dan menghapus fallback bawaan.
    *   [MobileBottomNav.tsx](file:///e:/yadiapp-project/KASIR/web/src/components/MobileBottomNav.tsx) - Menghapus list menu default dan menggunakan config dynamic.
    *   [LayoutWrapper.tsx](file:///e:/yadiapp-project/KASIR/web/src/components/LayoutWrapper.tsx) - Menghapus fallback list dari routing guard dan menggunakan dynamic `expiredDisabledMenus`.
    *   [AuthProvider.tsx](file:///e:/yadiapp-project/KASIR/web/src/components/AuthProvider.tsx) - Menambahkan real-time snapshot listener untuk branding global dan sinkronisasi `expiredDisabledMenus`.
*   **Mobile**:
    *   [SuperAdminScreen.tsx](file:///e:/yadiapp-project/KASIR/mobile/src/screens/SuperAdminScreen.tsx) - Mengubah popup modal edit menjadi inline full screen form, menambahkan checklist branding global expired menu, memuat daftar projects database target saat mengelola toko.
    *   [App.tsx](file:///e:/yadiapp-project/KASIR/mobile/App.tsx) - Sinkronisasi status `expiredDisabledMenus` global ke store, menghapus fallback expired menu bawaan, dan mengubah tombol popup expired tab menjadi Ok & Langganan.
    *   [authStore.ts](file:///e:/yadiapp-project/KASIR/mobile/src/store/authStore.ts) - Menambahkan state store `expiredDisabledMenus`.
    *   [SettingsScreen.tsx](file:///e:/yadiapp-project/KASIR/mobile/src/screens/SettingsScreen.tsx) - Mengintegrasikan penegakan pemblokiran menu secara dinamis, menghapus fallback bawaan, memperbarui URL WhatsApp Pusat Bantuan, dan mengubah tombol popup expired menu menjadi Ok & Langganan.
    *   [POSScreen.tsx](file:///e:/yadiapp-project/KASIR/mobile/src/screens/POSScreen.tsx) - Mengubah overlay akses terkunci kasir agar berbasis pengaturan branding global (bukan hardcoded) dan memperbarui tombol perpanjangan langganan.
    *   [DashboardScreen.tsx](file:///e:/yadiapp-project/KASIR/mobile/src/screens/DashboardScreen.tsx) - Mengubah tombol popup Alert masa aktif habis menjadi Ok & Langganan.

#### Catatan Deployment & Perintah yang Dijalankan:
1.  **Git Commit & Push**:
    *   *Perintah*: `git add .` dan `git commit -m "fix: make POSScreen overlay check global settings and update expired alerts with Ok and Langganan buttons"`
    *   *Hasil*: Commit `cd7be67a` berhasil dipush ke repositori GitHub `ahlisoftware77-jpg/ikasir-pro` (cabang `main`).
2.  **Expo OTA Update**:
    *   *Perintah*: `npx eas-cli update --channel production --message "fix: POSScreen expired check based on branding & custom Ok/Langganan alert buttons" --non-interactive`
    *   *Hasil*: Update OTA sukses dipublikasikan ke channel `production`.
        *   **Runtime Version**: `1.0.0`
        *   **Update Group ID**: `1cad89c5-14b7-4d0f-9301-14381af328a3`
        *   **Android Update ID**: `019ebd0c-97b5-7daa-aabe-173010add672`
        *   **iOS Update ID**: `019ebd0c-97b5-7d3a-95dc-3ba7a36df40a`
        *   **Tautan EAS Dashboard**: [Expo Dev Update](https://expo.dev/accounts/ahlisoftware77/projects/mobile/updates/1cad89c5-14b7-4d0f-9301-14381af328a3)

---

### [2026-06-12] - Peningkatan Logika Menu & Hak Akses Staf
#### Perubahan / Penambahan Fitur:
1.  **Online Store Visibility Toggle (Visibilitas Toko Online)**
    *   Menambahkan toggle status keaktifan toko online pada pengaturan toko merchant.
    *   Jika dinonaktifkan, halaman pelanggan/customer ordering akan memunculkan overlay layar penuh berisi pesan penonaktifan.
2.  **Excel Export with Bold Totals (Web)**
    *   Menambahkan kolom/baris total di bagian akhir file hasil ekspor Excel dengan format huruf tebal (bold).
3.  **SuperAdmin Menu Disabling (Pemblokiran Menu Samar)**
    *   Mengubah perilaku pemblokiran menu oleh SuperAdmin (`disabledMenus`): Menu tidak lagi disembunyikan, tetapi dirender secara samar (`opacity: 0.4` atau `opacity-40`) dan tidak dapat diklik.
    *   Mengklik menu yang diblokir akan memicu Alert (Mobile) atau Toast error (Web): *"Akses Terkunci. Fitur dinonaktifkan oleh administrator."*
4.  **Penegakan Hak Akses Staf (Mobile Staff Permissions)**
    *   Aplikasi mobile sekarang membaca properti `permissions` dari akun kasir/staf.
    *   Menyembunyikan menu/tab navigasi sepenuhnya jika akun kasir tidak memiliki izin akses untuk fitur tersebut.

#### Berkas yang Dimodifikasi:
*   **Web**:
    *   [Sidebar.tsx](file:///e:/yadiapp-project/KASIR/web/src/components/Sidebar.tsx) - Menampilkan menu diblokir SuperAdmin secara samar dan unclickable (memicu Toast).
    *   [MobileBottomNav.tsx](file:///e:/yadiapp-project/KASIR/web/src/components/MobileBottomNav.tsx) - Menampilkan tab/menu diblokir secara samar dan memicu Toast.
*   **Mobile**:
    *   [authStore.ts](file:///e:/yadiapp-project/KASIR/mobile/src/store/authStore.ts) - Menambahkan penanganan state hak akses staf (`permissions`).
    *   [App.tsx](file:///e:/yadiapp-project/KASIR/mobile/App.tsx) - Sinkronisasi data hak akses dari Firestore, filter visibilitas Bottom Tab berdasarkan izin staf, dan menyamarkan tab yang diblokir SuperAdmin.
    *   [SettingsScreen.tsx](file:///e:/yadiapp-project/KASIR/mobile/src/screens/SettingsScreen.tsx) - Menyembunyikan menu berdasarkan izin staf dan menyamarkan menu yang diblokir SuperAdmin.

#### Catatan Deployment & Perintah yang Dijalankan:
1.  **Git Commit & Push**:
    *   *Perintah*: `git add .` dan `git commit -m "feat: implement staff permissions on mobile & superadmin disabled menu dimming"`
    *   *Hasil*: Commit `d088f0e6` berhasil dipush ke repositori GitHub `ahlisoftware77-jpg/ikasir-pro` (cabang `main`).
2.  **Expo OTA Update**:
    *   *Perintah*: `npx eas-cli update --channel production --message "feat: staff permissions and superadmin menu dimming" --non-interactive`
    *   *Hasil*: Update OTA sukses dipublikasikan ke channel `production`.
        *   **Runtime Version**: `1.0.0`
        *   **Update Group ID**: `c56854ba-c744-472f-b8b2-6c1cdaa1a53d`
        *   **Android Update ID**: `019ebc69-5ece-79ba-ae07-e4f7332ab6c4`
        *   **iOS Update ID**: `019ebc69-5ece-7b63-9415-7136958a0afb`
        *   **Tautan EAS Dashboard**: [Expo Dev Update](https://expo.dev/accounts/ahlisoftware77/projects/mobile/updates/c56854ba-c744-472f-b8b2-6c1cdaa1a53d)

---

## 📌 Rencana Pengembangan Selanjutnya (Next Roadmap)
*   Melakukan pemantauan status penggunaan aplikasi setelah update OTA didistribusikan.
*   Menyesuaikan fitur ekspor Excel untuk laporan lainnya di sisi mobile jika dibutuhkan di masa mendatang.
