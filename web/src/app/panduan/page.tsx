'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, BookOpen, Search } from 'lucide-react';

const CHAPTERS = [
  
  {
    id: 'ch_0',
    title: "BAB 1: Pendahuluan & Persiapan Awal",
    rawText: `BAB 1: Pendahuluan & Persiapan Awal  ### 1. Pendaftaran & Login 1. Buka aplikasi IKASIR PRO di perangkat Mobile atau akses tautan Web. 2. Di layar utama, Anda dapat memilih untuk masuk menggunakan **Akun Google** atau kombinasi **Email & Kata Sandi**. 3. Jika belum memiliki akun, silakan klik **Daftar Akun Baru**. Lengkapi informasi dasar seperti Nama, Email, Kata Sandi, dan Nama Toko.  ### 2. Konsep Multi-Toko (Multi-Tenant) Satu akun Pengguna (User) dapat tergabung dalam beberapa toko yang berbeda. - Jika Anda adalah pemilik sistem, Anda dapat membuat banyak cabang toko. - Jika Anda adalah kasir/admin, Anda hanya akan melihat toko tempat Anda didaftarkan. - **Cara Pindah Toko:** Pada menu **Pengaturan (Settings)**, klik menu **Toko**. Anda akan melihat daftar toko yang hak aksesnya Anda miliki. Klik salah satu toko untuk beralih.  --- `.toLowerCase(),
    content: (
      <div className="mb-10">
        <h2 className="text-xl font-bold mb-4 text-slate-900 dark:text-white border-b border-slate-200 dark:border-white/10 pb-2">BAB 1: Pendahuluan & Persiapan Awal</h2>
        <h3 className="text-lg font-bold mt-6 mb-3 text-teal-400">1. Pendaftaran & Login</h3>
<ul className="list-decimal pl-5 mb-4 space-y-2 text-slate-600 dark:text-slate-300">
  <li>Buka aplikasi IKASIR PRO di perangkat Mobile atau akses tautan Web.</li>
  <li>Di layar utama, Anda dapat memilih untuk masuk menggunakan <strong className="text-slate-800 dark:text-slate-200">Akun Google</strong> atau kombinasi <strong className="text-slate-800 dark:text-slate-200">Email & Kata Sandi</strong>.</li>
  <li>Jika belum memiliki akun, silakan klik <strong className="text-slate-800 dark:text-slate-200">Daftar Akun Baru</strong>. Lengkapi informasi dasar seperti Nama, Email, Kata Sandi, dan Nama Toko.</li>
</ul>
<h3 className="text-lg font-bold mt-6 mb-3 text-teal-400">2. Konsep Multi-Toko (Multi-Tenant)</h3>
<p className="mb-4 text-slate-600 dark:text-slate-300 leading-relaxed">Satu akun Pengguna (User) dapat tergabung dalam beberapa toko yang berbeda.</p>
<ul className="list-disc pl-5 mb-4 space-y-2 text-slate-600 dark:text-slate-300">
  <li>Jika Anda adalah pemilik sistem, Anda dapat membuat banyak cabang toko.</li>
  <li>Jika Anda adalah kasir/admin, Anda hanya akan melihat toko tempat Anda didaftarkan.</li>
  <li><strong className="text-slate-800 dark:text-slate-200">Cara Pindah Toko:</strong> Pada menu <strong className="text-slate-800 dark:text-slate-200">Pengaturan (Settings)</strong>, klik menu <strong className="text-slate-800 dark:text-slate-200">Toko</strong>. Anda akan melihat daftar toko yang hak aksesnya Anda miliki. Klik salah satu toko untuk beralih.</li>
</ul>
<hr className="my-8 border-slate-200 dark:border-white/10" />
      </div>
    )
  }
    ,
  {
    id: 'ch_1',
    title: "BAB 2: Manajemen Data Induk (Master Data)",
    rawText: `BAB 2: Manajemen Data Induk (Master Data)  > [!IMPORTANT] > Sangat disarankan untuk mengisi data pada **Master Data** secara berurutan: buat *Kategori* terlebih dahulu, barulah menambahkan *Produk*.  ### 1. Kelola Produk & Kategori Menu ini merupakan jantung operasional Anda untuk mencatat barang apa saja yang dijual. - **Membuat Kategori:** Buka menu **Produk** > tab **Kategori**. Klik ikon + lalu masukkan nama kategori (misalnya: *Minuman Dingin* atau *Pakaian Pria*). - **Menambah Produk Baru:**    1. Pada menu **Produk**, klik ikon + (Tambah).   2. Masukkan **Nama Produk**, **Harga Jual**, **Harga Modal** (opsional), **Stok**, dan unggah gambar agar kasir lebih mudah mengenali produk.   3. Hubungkan dengan Kategori yang sudah Anda buat.   4. (Khusus Web) Anda bisa menentukan jika produk menggunakan stok tanpa batas atau dihitung berdasarkan fisik.   5. Aktifkan saklar **Tampilkan di Marketplace** jika barang ini juga ingin Anda jual secara online (akan dibahas di Bab 5).  ### 2. Kelola Pelanggan (Kontak) Untuk toko yang melayani langganan atau butuh pencatatan piutang kasbon, data kontak sangatlah penting. - Masuk ke menu **Pelanggan**.  - Klik tambah pelanggan, isikan **Nama**, **Nomor HP/WhatsApp**, dan **Alamat**.  ### 3. Kelola Pengguna & Karyawan - Buka menu **Pengguna**. Anda akan melihat daftar karyawan yang saat ini memiliki akses ke toko Anda. - **Menambah Kasir:** Klik tombol tambah, isikan *email*, nama, serta tentukan level **Peran (Role)**:   - admin: Memiliki akses penuh termasuk melihat laporan laba-rugi, mengubah harga, dll.   - cashier: Hanya dapat mengakses menu transaksi (POS) tanpa akses ke laporan keuangan.  --- `.toLowerCase(),
    content: (
      <div className="mb-10">
        <h2 className="text-xl font-bold mb-4 text-slate-900 dark:text-white border-b border-slate-200 dark:border-white/10 pb-2">BAB 2: Manajemen Data Induk (Master Data)</h2>
        <div className="p-4 rounded-2xl border mb-6 bg-purple-500/10 border-purple-500/20">
  <div className="font-black text-xs mb-2 text-purple-500">PENTING</div>
  <div className="text-sm font-medium text-slate-400 dark:text-slate-500 dark:text-slate-400">
    <p className="mb-2">Sangat disarankan untuk mengisi data pada <strong className="text-slate-800 dark:text-slate-200">Master Data</strong> secara berurutan: buat <em className="text-slate-600 dark:text-slate-300">Kategori</em> terlebih dahulu, barulah menambahkan <em className="text-slate-600 dark:text-slate-300">Produk</em>.</p>
  </div>
</div>
<h3 className="text-lg font-bold mt-6 mb-3 text-teal-400">1. Kelola Produk & Kategori</h3>
<p className="mb-4 text-slate-600 dark:text-slate-300 leading-relaxed">Menu ini merupakan jantung operasional Anda untuk mencatat barang apa saja yang dijual.</p>
<ul className="list-disc pl-5 mb-4 space-y-2 text-slate-600 dark:text-slate-300">
  <li><strong className="text-slate-800 dark:text-slate-200">Membuat Kategori:</strong> Buka menu <strong className="text-slate-800 dark:text-slate-200">Produk</strong> &gt; tab <strong className="text-slate-800 dark:text-slate-200">Kategori</strong>. Klik ikon `+` lalu masukkan nama kategori (misalnya: <em className="text-slate-400 dark:text-slate-500 dark:text-slate-400">Minuman Dingin</em> atau <em className="text-slate-400 dark:text-slate-500 dark:text-slate-400">Pakaian Pria</em>).</li>
  <li><strong className="text-slate-800 dark:text-slate-200">Menambah Produk Baru:</strong></li>
  <li>Pada menu <strong className="text-slate-800 dark:text-slate-200">Produk</strong>, klik ikon `+` (Tambah).</li>
  <li>Masukkan <strong className="text-slate-800 dark:text-slate-200">Nama Produk</strong>, <strong className="text-slate-800 dark:text-slate-200">Harga Jual</strong>, <strong className="text-slate-800 dark:text-slate-200">Harga Modal</strong> (opsional), <strong className="text-slate-800 dark:text-slate-200">Stok</strong>, dan unggah gambar agar kasir lebih mudah mengenali produk.</li>
  <li>Hubungkan dengan Kategori yang sudah Anda buat.</li>
  <li>(Khusus Web) Anda bisa menentukan jika produk menggunakan stok tanpa batas atau dihitung berdasarkan fisik.</li>
  <li>Aktifkan saklar <strong className="text-slate-800 dark:text-slate-200">"Tampilkan di Marketplace"</strong> jika barang ini juga ingin Anda jual secara online (akan dibahas di Bab 5).</li>
</ul>
<h3 className="text-lg font-bold mt-6 mb-3 text-teal-400">2. Kelola Pelanggan (Kontak)</h3>
<p className="mb-4 text-slate-600 dark:text-slate-300 leading-relaxed">Untuk toko yang melayani langganan atau butuh pencatatan piutang kasbon, data kontak sangatlah penting.</p>
<ul className="list-disc pl-5 mb-4 space-y-2 text-slate-600 dark:text-slate-300">
  <li>Masuk ke menu <strong className="text-slate-800 dark:text-slate-200">Pelanggan</strong>.</li>
  <li>Klik tambah pelanggan, isikan <strong className="text-slate-800 dark:text-slate-200">Nama</strong>, <strong className="text-slate-800 dark:text-slate-200">Nomor HP/WhatsApp</strong>, dan <strong className="text-slate-800 dark:text-slate-200">Alamat</strong>.</li>
</ul>
<h3 className="text-lg font-bold mt-6 mb-3 text-teal-400">3. Kelola Pengguna & Karyawan</h3>
<ul className="list-disc pl-5 mb-4 space-y-2 text-slate-600 dark:text-slate-300">
  <li>Buka menu <strong className="text-slate-800 dark:text-slate-200">Pengguna</strong>. Anda akan melihat daftar karyawan yang saat ini memiliki akses ke toko Anda.</li>
  <li><strong className="text-slate-800 dark:text-slate-200">Menambah Kasir:</strong> Klik tombol tambah, isikan <em className="text-slate-400 dark:text-slate-500 dark:text-slate-400">email</em>, nama, serta tentukan level <strong className="text-slate-800 dark:text-slate-200">Peran (Role)</strong>:</li>
  <li>`admin`: Memiliki akses penuh termasuk melihat laporan laba-rugi, mengubah harga, dll.</li>
  <li>`cashier`: Hanya dapat mengakses menu transaksi (POS) tanpa akses ke laporan keuangan.</li>
</ul>
<hr className="my-8 border-slate-200 dark:border-white/10" />
      </div>
    )
  }
    ,
  {
    id: 'ch_2',
    title: "BAB 3: Operasional Kasir (Point of Sale / POS)",
    rawText: `BAB 3: Operasional Kasir (Point of Sale / POS)  ### 1. Proses Transaksi Kasir Dasar Menu **Kasir (POS)** dirancang untuk memproses antrean dengan sangat cepat. 1. Masuk ke halaman **Kasir (POS)**. 2. Anda akan melihat deretan gambar produk Anda. Anda bisa memfilter berdasarkan Kategori atau menggunakan kolom Pencarian. 3. Klik produk yang ingin dibeli pelanggan untuk memasukkannya ke dalam **Keranjang (Cart)**. 4. Klik tombol **Keranjang** di pojok bawah untuk beralih ke halaman pembayaran. 5. Anda dapat merubah kuantitas item (+ / -) atau menghapus item dari keranjang. 6. Klik tombol **Bayar (Checkout)**.  ### 2. Metode Pembayaran - Setelah Checkout, halaman struk total akan muncul. - Pilih jenis pembayaran: **Tunai**, **Non-Tunai** (Transfer Bank/Kartu), atau **QRIS**. - Untuk metode tunai, Anda bisa memasukkan nominal uang yang diterima pelanggan, dan sistem akan langsung menghitung nominal uang kembalian secara presisi.  > [!TIP] > **Struk Digital:** Setelah transaksi sukses, Anda bisa memilih untuk **Mencetak Struk** via *printer thermal bluetooth* (khusus mobile), atau membagikannya secara digital dalam wujud struk gambar langsung ke WhatsApp pelanggan!  --- `.toLowerCase(),
    content: (
      <div className="mb-10">
        <h2 className="text-xl font-bold mb-4 text-slate-900 dark:text-white border-b border-slate-200 dark:border-white/10 pb-2">BAB 3: Operasional Kasir (Point of Sale / POS)</h2>
        <h3 className="text-lg font-bold mt-6 mb-3 text-teal-400">1. Proses Transaksi Kasir Dasar</h3>
<p className="mb-4 text-slate-600 dark:text-slate-300 leading-relaxed">Menu <strong className="text-slate-800 dark:text-slate-200">Kasir (POS)</strong> dirancang untuk memproses antrean dengan sangat cepat.</p>
<ul className="list-decimal pl-5 mb-4 space-y-2 text-slate-600 dark:text-slate-300">
  <li>Masuk ke halaman <strong className="text-slate-800 dark:text-slate-200">Kasir (POS)</strong>.</li>
  <li>Anda akan melihat deretan gambar produk Anda. Anda bisa memfilter berdasarkan Kategori atau menggunakan kolom Pencarian.</li>
  <li>Klik produk yang ingin dibeli pelanggan untuk memasukkannya ke dalam <strong className="text-slate-800 dark:text-slate-200">Keranjang (Cart)</strong>.</li>
  <li>Klik tombol <strong className="text-slate-800 dark:text-slate-200">Keranjang</strong> di pojok bawah untuk beralih ke halaman pembayaran.</li>
  <li>Anda dapat merubah kuantitas item (+ / -) atau menghapus item dari keranjang.</li>
</ul>
<p className="mb-4 text-slate-600 dark:text-slate-300 leading-relaxed">6. Klik tombol <strong className="text-slate-800 dark:text-slate-200">Bayar (Checkout)</strong>.</p>
<h3 className="text-lg font-bold mt-6 mb-3 text-teal-400">2. Metode Pembayaran</h3>
<ul className="list-disc pl-5 mb-4 space-y-2 text-slate-600 dark:text-slate-300">
  <li>Setelah Checkout, halaman struk total akan muncul.</li>
  <li>Pilih jenis pembayaran: <strong className="text-slate-800 dark:text-slate-200">Tunai</strong>, <strong className="text-slate-800 dark:text-slate-200">Non-Tunai</strong> (Transfer Bank/Kartu), atau <strong className="text-slate-800 dark:text-slate-200">QRIS</strong>.</li>
  <li>Untuk metode tunai, Anda bisa memasukkan nominal uang yang diterima pelanggan, dan sistem akan langsung menghitung nominal uang kembalian secara presisi.</li>
<div className="p-4 rounded-2xl border mb-6 bg-emerald-500/10 border-emerald-500/20">
  <div className="font-black text-xs mb-2 text-emerald-500">TIPS</div>
  <div className="text-sm font-medium text-slate-400 dark:text-slate-500 dark:text-slate-400">
    <p className="mb-2"><strong className="text-slate-800 dark:text-slate-200">Struk Digital:</strong> Setelah transaksi sukses, Anda bisa memilih untuk <strong className="text-slate-800 dark:text-slate-200">Mencetak Struk</strong> via <em className="text-slate-600 dark:text-slate-300">printer thermal bluetooth</em> (khusus mobile), atau membagikannya secara digital dalam wujud struk gambar langsung ke WhatsApp pelanggan!</p>
  </div>
</div>
</ul>
<hr className="my-8 border-slate-200 dark:border-white/10" />
      </div>
    )
  }
    ,
  {
    id: 'ch_3',
    title: "BAB 4: Manajemen Transaksi Khusus",
    rawText: `BAB 4: Manajemen Transaksi Khusus  Selain kasir biasa, IKASIR PRO mendukung transaksi kompleks sesuai dinamika lapangan.  ### 1. Fitur Kasbon / Hutang Piutang (Debts) - Saat pembayaran *Checkout* kasir, Anda dapat memilih opsi pembayaran secara **Kasbon**. Anda wajib memilih nama Pelanggan yang telah didaftarkan. - Total belanja akan masuk ke menu **Hutang Pelanggan (Debts)**. - **Membayar Kasbon:** Masuk ke menu Debts, cari nama pelanggan, dan klik tombol Lunasi (Bisa dicicil dengan bayar sebagian).  ### 2. Shift Kasir (Shift Management) Berguna untuk memastikan uang di laci fisik sama dengan catatan di sistem. - Di aplikasi Web (atau fitur terkait di mobile), pengguna ber-role cashier wajib **Membuka Shift** dengan memasukkan nominal uang tunai modal (uang kasir awal). - Saat jam pulang, kasir **Menutup Shift**, sistem akan menanyakan sisa akhir uang fisik dan menghitung apabila terjadi selisih kekurangan/kelebihan.  ### 3. Estimasi / Penawaran Harga (PO) - Jika pelanggan Anda belum fix membeli namun meminta rincian total, simpan transaksi kasir tersebut sebagai **Estimasi**. - Anda dapat mencetak nota estimasi ini dan merubahnya menjadi Transaksi *Real* di kemudian hari.  ### 4. Pengiriman (Delivery) - Untuk barang yang tidak langsung dibawa pelanggan, catat transaksi pengiriman di menu **Delivery**. - Anda dapat mengelompokkannya ke dalam status: *Disiapkan*, *Dikirim*, dan *Selesai*.  --- `.toLowerCase(),
    content: (
      <div className="mb-10">
        <h2 className="text-xl font-bold mb-4 text-slate-900 dark:text-white border-b border-slate-200 dark:border-white/10 pb-2">BAB 4: Manajemen Transaksi Khusus</h2>
        <p className="mb-4 text-slate-600 dark:text-slate-300 leading-relaxed">Selain kasir biasa, IKASIR PRO mendukung transaksi kompleks sesuai dinamika lapangan.</p>
<h3 className="text-lg font-bold mt-6 mb-3 text-teal-400">1. Fitur Kasbon / Hutang Piutang (Debts)</h3>
<ul className="list-disc pl-5 mb-4 space-y-2 text-slate-600 dark:text-slate-300">
  <li>Saat pembayaran <em className="text-slate-400 dark:text-slate-500 dark:text-slate-400">Checkout</em> kasir, Anda dapat memilih opsi pembayaran secara <strong className="text-slate-800 dark:text-slate-200">Kasbon</strong>. Anda wajib memilih nama Pelanggan yang telah didaftarkan.</li>
  <li>Total belanja akan masuk ke menu <strong className="text-slate-800 dark:text-slate-200">Hutang Pelanggan (Debts)</strong>.</li>
  <li><strong className="text-slate-800 dark:text-slate-200">Membayar Kasbon:</strong> Masuk ke menu Debts, cari nama pelanggan, dan klik tombol "Lunasi" (Bisa dicicil dengan bayar sebagian).</li>
</ul>
<h3 className="text-lg font-bold mt-6 mb-3 text-teal-400">2. Shift Kasir (Shift Management)</h3>
<p className="mb-4 text-slate-600 dark:text-slate-300 leading-relaxed">Berguna untuk memastikan uang di laci fisik sama dengan catatan di sistem.</p>
<ul className="list-disc pl-5 mb-4 space-y-2 text-slate-600 dark:text-slate-300">
  <li>Di aplikasi Web (atau fitur terkait di mobile), pengguna ber-role `cashier` wajib <strong className="text-slate-800 dark:text-slate-200">Membuka Shift</strong> dengan memasukkan nominal uang tunai modal (uang kasir awal).</li>
  <li>Saat jam pulang, kasir <strong className="text-slate-800 dark:text-slate-200">Menutup Shift</strong>, sistem akan menanyakan sisa akhir uang fisik dan menghitung apabila terjadi selisih kekurangan/kelebihan.</li>
</ul>
<h3 className="text-lg font-bold mt-6 mb-3 text-teal-400">3. Estimasi / Penawaran Harga (PO)</h3>
<ul className="list-disc pl-5 mb-4 space-y-2 text-slate-600 dark:text-slate-300">
  <li>Jika pelanggan Anda belum fix membeli namun meminta rincian total, simpan transaksi kasir tersebut sebagai <strong className="text-slate-800 dark:text-slate-200">Estimasi</strong>.</li>
  <li>Anda dapat mencetak nota estimasi ini dan merubahnya menjadi Transaksi <em className="text-slate-400 dark:text-slate-500 dark:text-slate-400">Real</em> di kemudian hari.</li>
</ul>
<h3 className="text-lg font-bold mt-6 mb-3 text-teal-400">4. Pengiriman (Delivery)</h3>
<ul className="list-disc pl-5 mb-4 space-y-2 text-slate-600 dark:text-slate-300">
  <li>Untuk barang yang tidak langsung dibawa pelanggan, catat transaksi pengiriman di menu <strong className="text-slate-800 dark:text-slate-200">Delivery</strong>.</li>
  <li>Anda dapat mengelompokkannya ke dalam status: <em className="text-slate-400 dark:text-slate-500 dark:text-slate-400">Disiapkan</em>, <em className="text-slate-400 dark:text-slate-500 dark:text-slate-400">Dikirim</em>, dan <em className="text-slate-400 dark:text-slate-500 dark:text-slate-400">Selesai</em>.</li>
</ul>
<hr className="my-8 border-slate-200 dark:border-white/10" />
      </div>
    )
  }
    ,
  {
    id: 'ch_4',
    title: "BAB 5: Penjualan Online (Marketplace & Orders)",
    rawText: `BAB 5: Penjualan Online (Marketplace & Orders)  IKASIR PRO telah terintegrasi dengan etalase daring *(online storefront)* Anda sendiri!  ### 1. Mengaktifkan Katalog Online - Saat membuat atau mengedit produk di Master Data, pastikan Anda mencentang opsi **Tampilkan di Marketplace**. - Produk tersebut otomatis tampil di halaman *link* toko publik Anda.  ### 2. Membagikan Link Toko & Produk - Masuk ke menu **Marketplace**. Di halaman utama terdapat tombol *Share* untuk menyalin tautan khusus toko Anda (misal: app.kasirpro.com/marketplace?s=namatoko). - Sebarkan *link* tersebut di bio Instagram/WhatsApp Anda. Pelanggan dapat berbelanja layaknya di *e-commerce*.  ### 3. Memproses Pesanan Masuk (Orders) - Saat ada pesanan online baru dari *link*, Anda akan mendapat pemberitahuan (*notification*). - Masuk ke menu **Pesanan (Marketplace Orders)**. - Pesanan awalnya berstatus **Pending**. Anda dapat mengeklik pesanan tersebut, meninjau itemnya, lalu memilih **Proses** (jika pembayaran tervalidasi) atau **Batalkan**. - Setelah pesanan dikemas/dikirim, ubah status menjadi **Selesai**. Pendapatan otomatis tercatat ke laporan hari itu.  ### 4. Ulasan (Reviews) - Pelanggan yang telah membeli pesanan yang diselesaikan, dapat memberi ulasan produk bintang 1 hingga 5 yang akan tampil secara publik di halaman Marketplace Anda untuk menunjang kepercayaan toko.  --- `.toLowerCase(),
    content: (
      <div className="mb-10">
        <h2 className="text-xl font-bold mb-4 text-slate-900 dark:text-white border-b border-slate-200 dark:border-white/10 pb-2">BAB 5: Penjualan Online (Marketplace & Orders)</h2>
        <p className="mb-4 text-slate-600 dark:text-slate-300 leading-relaxed">IKASIR PRO telah terintegrasi dengan etalase daring <em className="text-slate-400 dark:text-slate-500 dark:text-slate-400">(online storefront)</em> Anda sendiri!</p>
<h3 className="text-lg font-bold mt-6 mb-3 text-teal-400">1. Mengaktifkan Katalog Online</h3>
<ul className="list-disc pl-5 mb-4 space-y-2 text-slate-600 dark:text-slate-300">
  <li>Saat membuat atau mengedit produk di Master Data, pastikan Anda mencentang opsi <strong className="text-slate-800 dark:text-slate-200">Tampilkan di Marketplace</strong>.</li>
  <li>Produk tersebut otomatis tampil di halaman <em className="text-slate-400 dark:text-slate-500 dark:text-slate-400">link</em> toko publik Anda.</li>
</ul>
<h3 className="text-lg font-bold mt-6 mb-3 text-teal-400">2. Membagikan Link Toko & Produk</h3>
<ul className="list-disc pl-5 mb-4 space-y-2 text-slate-600 dark:text-slate-300">
  <li>Masuk ke menu <strong className="text-slate-800 dark:text-slate-200">Marketplace</strong>. Di halaman utama terdapat tombol <em className="text-slate-400 dark:text-slate-500 dark:text-slate-400">Share</em> untuk menyalin tautan khusus toko Anda (misal: `app.kasirpro.com/marketplace?s=namatoko`).</li>
  <li>Sebarkan <em className="text-slate-400 dark:text-slate-500 dark:text-slate-400">link</em> tersebut di bio Instagram/WhatsApp Anda. Pelanggan dapat berbelanja layaknya di <em className="text-slate-400 dark:text-slate-500 dark:text-slate-400">e-commerce</em>.</li>
</ul>
<h3 className="text-lg font-bold mt-6 mb-3 text-teal-400">3. Memproses Pesanan Masuk (Orders)</h3>
<ul className="list-disc pl-5 mb-4 space-y-2 text-slate-600 dark:text-slate-300">
  <li>Saat ada pesanan online baru dari <em className="text-slate-400 dark:text-slate-500 dark:text-slate-400">link</em>, Anda akan mendapat pemberitahuan (<em className="text-slate-400 dark:text-slate-500 dark:text-slate-400">notification</em>).</li>
  <li>Masuk ke menu <strong className="text-slate-800 dark:text-slate-200">Pesanan (Marketplace Orders)</strong>.</li>
  <li>Pesanan awalnya berstatus <strong className="text-slate-800 dark:text-slate-200">Pending</strong>. Anda dapat mengeklik pesanan tersebut, meninjau itemnya, lalu memilih <strong className="text-slate-800 dark:text-slate-200">Proses</strong> (jika pembayaran tervalidasi) atau <strong className="text-slate-800 dark:text-slate-200">Batalkan</strong>.</li>
  <li>Setelah pesanan dikemas/dikirim, ubah status menjadi <strong className="text-slate-800 dark:text-slate-200">Selesai</strong>. Pendapatan otomatis tercatat ke laporan hari itu.</li>
</ul>
<h3 className="text-lg font-bold mt-6 mb-3 text-teal-400">4. Ulasan (Reviews)</h3>
<ul className="list-disc pl-5 mb-4 space-y-2 text-slate-600 dark:text-slate-300">
  <li>Pelanggan yang telah membeli pesanan yang diselesaikan, dapat memberi ulasan produk bintang 1 hingga 5 yang akan tampil secara publik di halaman Marketplace Anda untuk menunjang kepercayaan toko.</li>
</ul>
<hr className="my-8 border-slate-200 dark:border-white/10" />
      </div>
    )
  }
    ,
  {
    id: 'ch_5',
    title: "BAB 6: Pelaporan & Riwayat",
    rawText: `BAB 6: Pelaporan & Riwayat  ### 1. Riwayat Transaksi (Transactions) - Seluruh pergerakan uang yang telah selesai (*settled*) akan tampil di sini secara kronologis (waktu sebenarnya). - Anda dapat membuka struk lampau jika pelanggan meminta struk ulang. - **Refund/Pembatalan:** Transaksi dapat dibatalkan di sini jika terjadi kesalahan kasir. Uang akan dikurangi dari total laporan.  ### 2. Laporan Laba/Rugi (Reports) - Dapatkan data wawasan mendalam (berupa grafik atau angka *real-time*) harian, mingguan, hingga bulanan. - Menyajikan total modal terjual, total omzet kotor, hingga laba bersih dengan presisi tinggi.  --- `.toLowerCase(),
    content: (
      <div className="mb-10">
        <h2 className="text-xl font-bold mb-4 text-slate-900 dark:text-white border-b border-slate-200 dark:border-white/10 pb-2">BAB 6: Pelaporan & Riwayat</h2>
        <h3 className="text-lg font-bold mt-6 mb-3 text-teal-400">1. Riwayat Transaksi (Transactions)</h3>
<ul className="list-disc pl-5 mb-4 space-y-2 text-slate-600 dark:text-slate-300">
  <li>Seluruh pergerakan uang yang telah selesai (<em className="text-slate-400 dark:text-slate-500 dark:text-slate-400">settled</em>) akan tampil di sini secara kronologis (waktu sebenarnya).</li>
  <li>Anda dapat membuka struk lampau jika pelanggan meminta struk ulang.</li>
  <li><strong className="text-slate-800 dark:text-slate-200">Refund/Pembatalan:</strong> Transaksi dapat dibatalkan di sini jika terjadi kesalahan kasir. Uang akan dikurangi dari total laporan.</li>
</ul>
<h3 className="text-lg font-bold mt-6 mb-3 text-teal-400">2. Laporan Laba/Rugi (Reports)</h3>
<ul className="list-disc pl-5 mb-4 space-y-2 text-slate-600 dark:text-slate-300">
  <li>Dapatkan data wawasan mendalam (berupa grafik atau angka <em className="text-slate-400 dark:text-slate-500 dark:text-slate-400">real-time</em>) harian, mingguan, hingga bulanan.</li>
  <li>Menyajikan total modal terjual, total omzet kotor, hingga laba bersih dengan presisi tinggi.</li>
</ul>
<hr className="my-8 border-slate-200 dark:border-white/10" />
      </div>
    )
  }
    ,
  {
    id: 'ch_6',
    title: "BAB 7: Pengaturan Lanjutan",
    rawText: `BAB 7: Pengaturan Lanjutan  Menu ini dapat Anda temukan pada ikon gerigi roda (Pengaturan/Settings).  ### 1. Pengaturan Toko (Store Settings) - **Profil Toko:** Ubah logo, nama toko, dan nomor kontak yang tertera di struk. - **Biaya & Pajak:** Setel Pajak Pelayanan (misal: PB1 10%) yang akan otomatis dibebankan pada saat *checkout* kasir.  ### 2. Recycle Bin (Kotak Sampah Data) - Jika Anda atau staf *tidak sengaja menghapus* produk, transaksi, atau data pelanggan, tenang! Data tersebut masuk ke dalam fitur **Recycle Bin**. - Buka Recycle Bin, pilih datanya, lalu klik **Pulihkan (Restore)**.  --- `.toLowerCase(),
    content: (
      <div className="mb-10">
        <h2 className="text-xl font-bold mb-4 text-slate-900 dark:text-white border-b border-slate-200 dark:border-white/10 pb-2">BAB 7: Pengaturan Lanjutan</h2>
        <p className="mb-4 text-slate-600 dark:text-slate-300 leading-relaxed">Menu ini dapat Anda temukan pada ikon gerigi roda (Pengaturan/Settings).</p>
<h3 className="text-lg font-bold mt-6 mb-3 text-teal-400">1. Pengaturan Toko (Store Settings)</h3>
<ul className="list-disc pl-5 mb-4 space-y-2 text-slate-600 dark:text-slate-300">
  <li><strong className="text-slate-800 dark:text-slate-200">Profil Toko:</strong> Ubah logo, nama toko, dan nomor kontak yang tertera di struk.</li>
  <li><strong className="text-slate-800 dark:text-slate-200">Biaya & Pajak:</strong> Setel Pajak Pelayanan (misal: PB1 10%) yang akan otomatis dibebankan pada saat <em className="text-slate-400 dark:text-slate-500 dark:text-slate-400">checkout</em> kasir.</li>
</ul>
<h3 className="text-lg font-bold mt-6 mb-3 text-teal-400">2. Recycle Bin (Kotak Sampah Data)</h3>
<ul className="list-disc pl-5 mb-4 space-y-2 text-slate-600 dark:text-slate-300">
  <li>Jika Anda atau staf <em className="text-slate-400 dark:text-slate-500 dark:text-slate-400">tidak sengaja menghapus</em> produk, transaksi, atau data pelanggan, tenang! Data tersebut masuk ke dalam fitur <strong className="text-slate-800 dark:text-slate-200">Recycle Bin</strong>.</li>
  <li>Buka Recycle Bin, pilih datanya, lalu klik <strong className="text-slate-800 dark:text-slate-200">Pulihkan (Restore)</strong>.</li>
</ul>
<hr className="my-8 border-slate-200 dark:border-white/10" />
      </div>
    )
  }
    ,
  {
    id: 'ch_7',
    title: "BAB 8: Fitur Super Admin (Khusus Pengelola Aplikasi/Sistem)",
    rawText: `BAB 8: Fitur Super Admin (Khusus Pengelola Aplikasi/Sistem)  > [!WARNING] > Menu ini bersifat *Highly Restricted* dan hanya muncul jika akun Anda disetel sebagai Super Admin melalui izin internal database (Firebase). Menu ini bertindak mengontrol semua Toko yang terdaftar dalam aplikasi.  ### 1. Data Master Sistem (Data Pengguna & Daftar Toko) - Anda dapat mengelola, membekukan/memblokir, serta mencari setiap pengguna terdaftar dan toko yang berjalan di seluruh sistem IKASIR PRO. - **Filter Berdasarkan Database:** Anda dapat menyortir toko berdasarkan partisi *database* *(Database Project / Node Sharding)* yang menaunginya melalui *chip filters* bergaya minimalis di bagian atas pencarian. - Mengubah *Subscription* / Tenggang Waktu kedaluwarsa berlangganan tiap toko klien Anda.  ### 2. Pencadangan & Restorasi (Backup/Restore) - Anda dapat melakukan unduh file (*export*) keseluruhan data sebuah toko secara spesifik dan memulihkan (*import*) datanya kembali (*snapshot rollback*) untuk keperluan dukungan pelanggan *(customer support)*.  ### 3. Pengaturan Infrastruktur - Mengelola *Node/Shard* Firebase baru untuk pemisahan data besar agar aplikasi berjalan kencang tanpa memberatkan satu klaster database saja.  ---  *Manual book* ini dirancang untuk selalu selaras dengan pembaruan IKASIR PRO terkini. Apabila terdapat perubahan *user interface* (UI), fungsinya pada intinya tetaplah berpusat pada kesederhanaan dan kemudahan akses bagi seluruh pemilik usaha! `.toLowerCase(),
    content: (
      <div className="mb-10">
        <h2 className="text-xl font-bold mb-4 text-slate-900 dark:text-white border-b border-slate-200 dark:border-white/10 pb-2">BAB 8: Fitur Super Admin (Khusus Pengelola Aplikasi/Sistem)</h2>
        <div className="p-4 rounded-2xl border mb-6 bg-amber-500/10 border-amber-500/20">
  <div className="font-black text-xs mb-2 text-amber-500">PERHATIAN</div>
  <div className="text-sm font-medium text-slate-400 dark:text-slate-500 dark:text-slate-400">
    <p className="mb-2">Menu ini bersifat <em className="text-slate-600 dark:text-slate-300">Highly Restricted</em> dan hanya muncul jika akun Anda disetel sebagai "Super Admin" melalui izin internal database (Firebase). Menu ini bertindak mengontrol semua "Toko" yang terdaftar dalam aplikasi.</p>
  </div>
</div>
<h3 className="text-lg font-bold mt-6 mb-3 text-teal-400">1. Data Master Sistem (Data Pengguna & Daftar Toko)</h3>
<ul className="list-disc pl-5 mb-4 space-y-2 text-slate-600 dark:text-slate-300">
  <li>Anda dapat mengelola, membekukan/memblokir, serta mencari setiap pengguna terdaftar dan toko yang berjalan di seluruh sistem IKASIR PRO.</li>
  <li><strong className="text-slate-800 dark:text-slate-200">Filter Berdasarkan Database:</strong> Anda dapat menyortir toko berdasarkan partisi <em className="text-slate-400 dark:text-slate-500 dark:text-slate-400">database</em> <em className="text-slate-400 dark:text-slate-500 dark:text-slate-400">(Database Project / Node Sharding)</em> yang menaunginya melalui <em className="text-slate-400 dark:text-slate-500 dark:text-slate-400">chip filters</em> bergaya minimalis di bagian atas pencarian.</li>
  <li>Mengubah <em className="text-slate-400 dark:text-slate-500 dark:text-slate-400">Subscription</em> / Tenggang Waktu kedaluwarsa berlangganan tiap toko klien Anda.</li>
</ul>
<h3 className="text-lg font-bold mt-6 mb-3 text-teal-400">2. Pencadangan & Restorasi (Backup/Restore)</h3>
<ul className="list-disc pl-5 mb-4 space-y-2 text-slate-600 dark:text-slate-300">
  <li>Anda dapat melakukan unduh file (<em className="text-slate-400 dark:text-slate-500 dark:text-slate-400">export</em>) keseluruhan data sebuah toko secara spesifik dan memulihkan (<em className="text-slate-400 dark:text-slate-500 dark:text-slate-400">import</em>) datanya kembali (<em className="text-slate-400 dark:text-slate-500 dark:text-slate-400">snapshot rollback</em>) untuk keperluan dukungan pelanggan <em className="text-slate-400 dark:text-slate-500 dark:text-slate-400">(customer support)</em>.</li>
</ul>
<h3 className="text-lg font-bold mt-6 mb-3 text-teal-400">3. Pengaturan Infrastruktur</h3>
<ul className="list-disc pl-5 mb-4 space-y-2 text-slate-600 dark:text-slate-300">
  <li>Mengelola <em className="text-slate-400 dark:text-slate-500 dark:text-slate-400">Node/Shard</em> Firebase baru untuk pemisahan data besar agar aplikasi berjalan kencang tanpa memberatkan satu klaster database saja.</li>
</ul>
<hr className="my-8 border-slate-200 dark:border-white/10" />
<p className="mb-4 text-slate-600 dark:text-slate-300 leading-relaxed"><em className="text-slate-400 dark:text-slate-500 dark:text-slate-400">Manual book</em> ini dirancang untuk selalu selaras dengan pembaruan IKASIR PRO terkini. Apabila terdapat perubahan <em className="text-slate-400 dark:text-slate-500 dark:text-slate-400">user interface</em> (UI), fungsinya pada intinya tetaplah berpusat pada kesederhanaan dan kemudahan akses bagi seluruh pemilik usaha!</p>
      </div>
    )
  }
    
];

export default function ManualBookPage() {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredChapters = CHAPTERS.filter(ch => 
    ch.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    ch.rawText.includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B0F19] pb-20">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-slate-50/80 dark:bg-[#0B0F19]/80 backdrop-blur-xl border-b border-slate-200 dark:border-white/5">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center gap-4">
          <Link href="/" className="w-10 h-10 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-white/10 transition-colors">
            <ArrowLeft size={20} className="text-slate-600 dark:text-slate-300" />
          </Link>
          <div className="flex-1">
            <h1 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <BookOpen size={18} className="text-teal-500" />
              Pusat Bantuan & Panduan
            </h1>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 mt-8">
        
        {/* Search Bar */}
        <div className="mb-6 relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search size={18} className="text-slate-400 dark:text-slate-500" />
          </div>
          <input
            type="text"
            className="w-full bg-white dark:bg-[#111827] border border-slate-200 dark:border-white/10 rounded-2xl py-4 pl-12 pr-4 text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
            placeholder="Cari panduan... (contoh: Kasir, Produk, Laporan)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-white/5 rounded-3xl p-6 sm:p-10 shadow-2xl">
          {searchQuery === '' && (
            <div className="mb-8">
              <h1 className="text-2xl font-black mb-6 text-slate-900 dark:text-white">Buku Panduan Resmi IKASIR PRO (Web & Mobile)</h1>
<p className="mb-4 text-slate-600 dark:text-slate-300 leading-relaxed">Selamat datang di IKASIR PRO, sistem aplikasi kasir pintar <em className="text-slate-400 dark:text-slate-500 dark:text-slate-400">(Point of Sale)</em> berbasis <em className="text-slate-400 dark:text-slate-500 dark:text-slate-400">cloud</em> yang terintegrasi secara mulus antara aplikasi Mobile dan platform Web. Panduan ini akan memandu Anda mulai dari pendaftaran awal hingga sukses memproses transaksi dan melihat laporan penjualan.</p>
<div className="p-4 rounded-2xl border mb-6 bg-blue-500/10 border-blue-500/20">
  <div className="font-black text-xs mb-2 text-blue-500">CATATAN</div>
  <div className="text-sm font-medium text-slate-400 dark:text-slate-500 dark:text-slate-400">
    <p className="mb-2"><strong className="text-slate-800 dark:text-slate-200">Integrasi Web & Mobile:</strong> Hampir seluruh fitur yang dijelaskan dalam buku panduan ini tersedia di Aplikasi Web maupun Mobile Anda. Setiap perubahan data pada satu platform akan secara otomatis tersinkronisasi (<em className="text-slate-600 dark:text-slate-300">real-time</em>) dengan platform lainnya selama terhubung ke internet.</p>
  </div>
</div>
<hr className="my-8 border-slate-200 dark:border-white/10" />
              <hr className="my-8 border-slate-200 dark:border-white/10" />
            </div>
          )}
          
          {filteredChapters.length > 0 ? (
            filteredChapters.map(ch => (
              <React.Fragment key={ch.id}>
                {ch.content}
              </React.Fragment>
            ))
          ) : (
            <div className="py-12 text-center flex flex-col items-center opacity-50">
              <Search size={48} className="text-slate-400 dark:text-slate-500 mb-4" />
              <p className="text-slate-600 dark:text-slate-300 font-medium">Tidak ada hasil panduan yang cocok dengan pencarian Anda.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
