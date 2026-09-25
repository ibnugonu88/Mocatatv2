// ============================================================
// MOCATAT - MAIN ROUTER & ENTRY POINT (app.js)
// Menghubungkan: core.js, fitur-beranda.js, fitur-analitik.js, fitur-kelola.js
// ============================================================

import { initAuthListener } from "./core.js";
import "./fitur-beranda.js";
import "./fitur-analitik.js";
import "./fitur-kelola.js";

// ==========================================
// ROUTER MANAGER (Pencocokan Halaman Otomatis)
// ==========================================
window.callPageRender = function() {
    window.sembunyikanLoading();
    const path = window.location.pathname.toLowerCase();
    
    if (path.includes('riwayat.html') && typeof window.renderHistoryPage === 'function') {
        window.renderHistoryPage();
    } else if (path.includes('analitik.html') && typeof window.renderStatistik === 'function') {
        window.renderStatistik();
    } else if (path.includes('dompet.html') && typeof window.renderWalletPage === 'function') {
        window.renderWalletPage();
    } else if (path.includes('kategori.html') && typeof window.renderCategoryPage === 'function') {
        window.renderCategoryPage();
    } else if (path.includes('kendaraan.html') && typeof window.renderVehiclePage === 'function') {
        window.renderVehiclePage();
    } else if (path.includes('target.html') && typeof window.renderTargetPage === 'function') {
        window.renderTargetPage();
    } else if (path.includes('lokasi.html') && typeof window.renderLocationPage === 'function') {
        window.renderLocationPage();
    } else if (typeof window.renderDashboard === 'function') {
        window.renderDashboard(); 
    }
};

// Jalankan pengecekan login & muat data dari Firebase Firestore
initAuthListener();
