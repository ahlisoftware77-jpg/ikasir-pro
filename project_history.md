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
2.  **Optimalisasi UI Form Edit SuperAdmin (Mobile)**
    *   Mengubah modal popup melayang untuk "Edit User" dan "Kelola Toko" di `SuperAdminScreen.tsx` menjadi render halaman penuh (full screen) dengan header navigasi tombol Kembali yang lebih intuitif dan nyaman.
3.  **Pesan WhatsApp Pusat Bantuan Profesional**
    *   Memperbarui tautan WhatsApp Pusat Bantuan di mobile (`SettingsScreen.tsx`) dengan pesan pembuka profesional yang terenkode.

#### Berkas yang Dimodifikasi:
*   **Web**:
    *   [page.tsx](file:///e:/yadiapp-project/KASIR/web/src/app/super-admin/page.tsx) - Menambahkan antarmuka checklist branding global expired menu.
*   **Mobile**:
    *   [SuperAdminScreen.tsx](file:///e:/yadiapp-project/KASIR/mobile/src/screens/SuperAdminScreen.tsx) - Mengubah popup modal edit menjadi inline full screen form, menambahkan checklist branding global expired menu.
    *   [App.tsx](file:///e:/yadiapp-project/KASIR/mobile/App.tsx) - Sinkronisasi status `expiredDisabledMenus` global ke store.
    *   [authStore.ts](file:///e:/yadiapp-project/KASIR/mobile/src/store/authStore.ts) - Menambahkan state store `expiredDisabledMenus`.
    *   [SettingsScreen.tsx](file:///e:/yadiapp-project/KASIR/mobile/src/screens/SettingsScreen.tsx) - Mengintegrasikan penegakan pemblokiran menu secara dinamis dan memperbarui URL WhatsApp Pusat Bantuan.

#### Catatan Deployment & Perintah yang Dijalankan:
1.  **Git Commit & Push**:
    *   *Perintah*: `git add .` dan `git commit -m "feat: implement global expired disabled menus checklist and full-screen mobile forms"`
    *   *Hasil*: Commit `92244e9e` berhasil dipush ke repositori GitHub `ahlisoftware77-jpg/ikasir-pro` (cabang `main`).
2.  **Expo OTA Update**:
    *   *Perintah*: `npx eas-cli update --channel production --message "feat: global expired disabled menus and full screen mobile forms" --non-interactive`
    *   *Hasil*: Update OTA sukses dipublikasikan ke channel `production`.
        *   **Runtime Version**: `1.0.0`
        *   **Update Group ID**: `a80adfd5-1dae-4a93-874e-2cb6b5000cc7`
        *   **Android Update ID**: `019ebcd2-55b3-70f4-a4ee-fc89b84a96f2`
        *   **iOS Update ID**: `019ebcd2-55b3-7dd2-81a8-241c54eb8d64`
        *   **Tautan EAS Dashboard**: [Expo Dev Update](https://expo.dev/accounts/ahlisoftware77/projects/mobile/updates/a80adfd5-1dae-4a93-874e-2cb6b5000cc7)

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
