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

---

## 📌 Rencana Pengembangan Selanjutnya (Next Roadmap)
*   Melakukan pemantauan status penggunaan aplikasi setelah update OTA didistribusikan.
*   Menyesuaikan fitur ekspor Excel untuk laporan lainnya di sisi mobile jika dibutuhkan di masa mendatang.
