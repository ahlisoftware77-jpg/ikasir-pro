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

### [2026-06-13] - Kontrol Menu Kedaluwarsa Global & Optimalisasi UI Mobile
#### Perubahan / Penambahan Fitur:
1.  **Checklist Menu Kedaluwarsa Global (expiredDisabledMenus)**
    *   Menambahkan pengaturan checklist global di tab Branding SuperAdmin (Web & Mobile).
    *   Menyimpan daftar menu yang dinonaktifkan ketika masa aktif akun pengguna habis ke Firestore `system_settings/branding`.
    *   Mengimplementasikan penegakan dinamis di Mobile Tab Navigator (`App.tsx`) dan Menu Lainnya (`SettingsScreen.tsx`) berdasarkan data global tersebut.
    *   **Perbaikan Web Sidebar Dropdown**: Memperbaiki bug pada [Sidebar.tsx](file:///e:/yadiapp-project/KASIR/web/src/components/Sidebar.tsx) di mana menu bertipe dropdown/subItems (seperti *Manajemen Produk* dan *Laporan*) lolos dari pemblokiran masa aktif habis. Menu-menu tersebut kini ikut disamarkan (opasitas 40%) dan menampilkan toast error ketika diklik.
2.  **Optimalisasi UI Form Edit SuperAdmin & Migrasi Lengkap (Mobile)**
    *   Mengubah modal popup melayang untuk "Edit User" dan "Kelola Toko" di `SuperAdminScreen.tsx` menjadi render halaman penuh (full screen) dengan header navigasi tombol Kembali yang lebih intuitif dan nyaman.
    *   **Perbaikan Tombol Migrasi Database Toko**: Memperbaiki hilangnya opsi database proyek eksternal pada modal migrasi toko di `SuperAdminScreen.tsx`. Hal ini disebabkan oleh tidak adanya snapshot listener untuk `database_projects/list` ketika membuka fitur `superAdminStores` (Kelola Toko). Pilihan target database kini tampil lengkap seperti di web.
3.  **Pesan WhatsApp Pusat Bantuan Profesional**
    *   Memperbarui tautan WhatsApp Pusat Bantuan di mobile (`SettingsScreen.tsx`) dengan pesan pembuka profesional yang terenkode.

#### Berkas yang Dimodifikasi:
*   **Web**:
    *   [page.tsx](file:///e:/yadiapp-project/KASIR/web/src/app/super-admin/page.tsx) - Menambahkan antarmuka checklist branding global expired menu.
    *   [Sidebar.tsx](file:///e:/yadiapp-project/KASIR/web/src/components/Sidebar.tsx) - Menambahkan pengecekan pemblokiran kedaluwarsa pada menu dropdown/subItems.
*   **Mobile**:
    *   [SuperAdminScreen.tsx](file:///e:/yadiapp-project/KASIR/mobile/src/screens/SuperAdminScreen.tsx) - Mengubah popup modal edit menjadi inline full screen form, menambahkan checklist branding global expired menu, memuat daftar projects database target saat mengelola toko.
    *   [App.tsx](file:///e:/yadiapp-project/KASIR/mobile/App.tsx) - Sinkronisasi status `expiredDisabledMenus` global ke store.
    *   [authStore.ts](file:///e:/yadiapp-project/KASIR/mobile/src/store/authStore.ts) - Menambahkan state store `expiredDisabledMenus`.
    *   [SettingsScreen.tsx](file:///e:/yadiapp-project/KASIR/mobile/src/screens/SettingsScreen.tsx) - Mengintegrasikan penegakan pemblokiran menu secara dinamis dan memperbarui URL WhatsApp Pusat Bantuan.

#### Catatan Deployment & Perintah yang Dijalankan:
1.  **Git Commit & Push**:
    *   *Perintah*: `git add .` dan `git commit -m "fix: restore dynamic locking for dropdown sub-menus on web and complete store db migration projects on mobile"`
    *   *Hasil*: Commit `b2e9a1a3` berhasil dipush ke repositori GitHub `ahlisoftware77-jpg/ikasir-pro` (cabang `main`).
2.  **Expo OTA Update**:
    *   *Perintah*: `npx eas-cli update --channel production --message "fix: restore dynamic locking for dropdown sub-menus on web and complete store db migration projects on mobile" --non-interactive`
    *   *Hasil*: Update OTA sukses dipublikasikan ke channel `production`.
        *   **Runtime Version**: `1.0.0`
        *   **Update Group ID**: `65163152-6a6c-4861-a83a-4f51bc7291fa`
        *   **Android Update ID**: `019ebcd4-dd78-79e5-b108-9df8df3c08f4`
        *   **iOS Update ID**: `019ebcd4-dd78-7b96-b072-bcad66d4db7a`
        *   **Tautan EAS Dashboard**: [Expo Dev Update](https://expo.dev/accounts/ahlisoftware77/projects/mobile/updates/65163152-6a6c-4861-a83a-4f51bc7291fa)

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
