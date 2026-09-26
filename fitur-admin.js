// ============================================================
// MOCATAT - FITUR ADMIN, CMS EDUKASI, USER, BROADCAST & RESET PASSWORD
// Versi Final (Warna Asli MoCatat & Layout Anti-Menumpuk)
// ============================================================

import { auth, db, doc, getDoc, setDoc } from "./core.js";
import { onAuthStateChanged, signOut, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, getDocs, deleteDoc, deleteField, updateDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Email Resmi Admin (Autentikasi penuh ditangani oleh Firebase Auth)
const ADMIN_EMAIL = "admin@gmail.com";
export const CMS_STORAGE_KEY = "mocatat_cms_content_v1";

window.activeAdminTab = 'overview';
window.cmsBanners = [];
window.cmsEducations = [];
window.cmsBroadcasts = [];
window.adminUsersList = [];
window.cmsLoadedFromCloud = false;
window.cmsRealtimeUnsub = null;

// ==========================================
// 1. PAKET KONTEN BAWAAN (DEFAULT)
// ==========================================
export const DEFAULT_BANNERS = [
    {
        id: "bn-1",
        tag: "🌱 BELAJAR INVESTASI",
        title: "Uang Narik Jangan Cuma Ngendap!",
        subtitle: "Kenali Reksadana Pasar Uang: modal mulai Rp 10.000, bebas pajak & cair kapan saja.",
        theme: "theme-teal",
        action: "edukasi",
        imageUrl: "",
        isActive: true
    },
    {
        id: "bn-2",
        tag: "📈 EDUKASI SAHAM",
        title: "Pahami Cara Kerja Saham & Dividen",
        subtitle: "Beli saham artinya ikut punya perusahaan. Pelajari cara pilih saham yang sehat.",
        theme: "theme-indigo",
        action: "edukasi",
        imageUrl: "",
        isActive: true
    },
    {
        id: "bn-3",
        tag: "🎯 TARGET KEUANGAN",
        title: "Sisihkan 20% Cuan Harianmu!",
        subtitle: "Pantau tabungan dan nilai investasi reksadana/saham langsung di menu Target.",
        theme: "theme-emerald",
        action: "target.html",
        imageUrl: "",
        isActive: true
    }
];

export const DEFAULT_EDUCATIONS = [
    {
        id: "edu-1",
        category: "Reksadana",
        readTime: "2 Menit",
        title: "Apa Itu Reksadana Pasar Uang (RDPU)?",
        summary: "Pilihan investasi paling aman untuk pemula dan dana darurat, grafik selalu naik stabil.",
        content: "Reksadana Pasar Uang (RDPU) adalah wadah investasi di mana uang kamu dikelola oleh Manajer Investasi resmi (diawasi OJK) ke dalam deposito bank dan obligasi jangka pendek di bawah 1 tahun.\n\nKenapa cocok banget buat pekerja harian?\n1. Modal Sangat Kecil: Bisa mulai dari Rp 10.000 saja (misal lewat aplikasi Bibit, Bareksa, atau Superbank/OVO Nabung).\n2. Risiko Sangat Rendah: Nilainya hampir tidak pernah turun, grafiknya naik stabil sekitar 4% - 6% per tahun (lebih tinggi dari bunga tabungan bank biasa).\n3. Bebas Potongan Biaya Admin Bulanan: Kalau di bank biasa uangmu kepotong admin tiap bulan, di Reksadana tidak ada biaya admin bulanan.\n4. Mudah Dicairkan: Bisa dijual kapan saja tanpa penalti, uang cair ke rekening dalam 1-2 hari kerja.",
        tip: "Cocok untuk menyimpan Dana Darurat dan tabungan jangka pendek (3-12 bulan) seperti persiapan servis besar atau pajak kendaraan.",
        isActive: true
    },
    {
        id: "edu-2",
        category: "Reksadana",
        readTime: "3 Menit",
        title: "3 Jenis Reksadana: Pasar Uang, Pendapatan Tetap & Saham",
        summary: "Kenali perbedaan tingkat keuntungan dan risikonya sebelum memilih produk reksadana.",
        content: "Di aplikasi investasi seperti Bibit, kamu akan melihat 3 jenis Reksadana utama:\n\n1. Reksadana Pasar Uang (RDPU)\nIsinya 100% deposito dan surat utang pendek. Paling stabil, risiko paling rendah, imbal hasil kisaran 4%-6% per tahun. Cocok untuk target di bawah 1 tahun.\n\n2. Reksadana Pendapatan Tetap (RDPT)\nMinimal 80% uangnya dimasukkan ke Obligasi (Surat Utang Negara atau Perusahaan). Imbal hasilnya lebih tinggi (kisaran 6%-9% per tahun), bisa naik-turun tipis. Cocok untuk target 1 - 3 tahun.\n\n3. Reksadana Saham (RDS)\nMinimal 80% uangnya dibelikan saham-saham di Bursa Efek. Potensi untungnya besar untuk jangka panjang (>5 tahun), tapi nilainya bisa naik-turun tajam mengikuti pasar saham.",
        tip: "Kalau baru mulai, taruh 70% di Reksadana Pasar Uang dan 30% di Reksadana Pendapatan Tetap agar tetap tenang saat bekerja.",
        isActive: true
    },
    {
        id: "edu-3",
        category: "Saham",
        readTime: "3 Menit",
        title: "Cara Kerja Investasi Saham: Capital Gain & Dividen",
        summary: "Bagaimana investor saham mendapatkan keuntungan dari kenaikan harga dan bagi hasil laba.",
        content: "Membeli saham artinya kamu membeli sebagian kecil kepemilikan suatu perusahaan terbuka (Tbk) yang terdaftar di Bursa Efek Indonesia (BEI), misalnya BCA (BBCA), BRI (BBRI), atau Telkom (TLKM).\n\nAda 2 sumber keuntungan utama dari saham:\n\n1. Capital Gain (Selisih Harga Jual)\nMisalnya kamu membeli 1 lot (100 lembar) saham di harga Rp 4.000/lembar (modal Rp 400.000). Beberapa bulan kemudian harganya naik jadi Rp 4.500/lembar lalu kamu jual, maka kamu untung Rp 50.000.\n\n2. Dividen (Bagi Hasil Keuntungan Perusahaan)\nPerusahaan yang untung besar biasanya membagikan sebagian labanya kepada pemilik saham setiap tahun. Meskipun sahammu tidak dijual, uang dividen otomatis masuk ke saldo RDN kamu.",
        tip: "Untuk pemula, fokuslah pada saham 'Blue Chip' (perusahaan raksasa yang labanya rutin tumbuh dan rajin bagi dividen), hindari saham gorengan yang naik-turun ekstrem.",
        isActive: true
    },
    {
        id: "edu-4",
        category: "Saham",
        readTime: "3 Menit",
        title: "Pilih Mana: Reksadana atau Beli Saham Langsung?",
        summary: "Panduan memilih instrumen investasi sesuai waktu luang dan modal yang kamu miliki.",
        content: "Banyak yang bingung harus mulai dari Reksadana atau langsung beli Saham. Berikut perbandingan mudahnya:\n\nPilih REKSADANA jika:\n• Kamu sibuk bekerja di jalan dan tidak sempat memantau grafik harga tiap jam.\n• Modal tabungan harianmu bertahap (misal Rp 10.000 - Rp 50.000 per setor).\n• Kamu ingin tidur nyenyak karena uang dikelola langsung oleh Manajer Investasi profesional.\n\nPilih SAHAM LANGSUNG jika:\n• Kamu sudah punya Dana Darurat yang aman di Reksadana Pasar Uang.\n• Kamu mau belajar membaca laporan keuangan perusahaan dan siap menahan investasi untuk jangka panjang.\n• Kamu mengincar pendapatan pasif dari pembagian Dividen tahunan bank/perusahaan besar.",
        tip: "Gunakan fitur 'Target & Investasi' di MoCatat (pilih tipe Investasi) untuk mencatat modal awal dan memantau nilai terkini portofoliomu!",
        isActive: true
    },
    {
        id: "edu-5",
        category: "Tips Keuangan",
        readTime: "2 Menit",
        title: "Rumus 50-30-20 untuk Penghasilan Harian",
        summary: "Cara praktis membagi uang masuk kotor agar bensin, dapur, dan investasi tetap jalan.",
        content: "Pekerja dengan penghasilan harian sering merasa uang cepat habis karena uang operasional bercampur dengan uang pribadi. Gunakan rumus sederhana ini setiap malam:\n\n1. Pisahkan Dulu Biaya Operasional (Bensin, Kuota, & Cadangan Oli/Servis)\nJangan hitung uang bensin sebagai penghasilan bersih. Sisihkan uang oli Rp 2.000 - Rp 5.000 per hari.\n\n2. 50% untuk Kebutuhan Pokok & Anggaran Bulanan\nMakan, tagihan listrik/air, dan kebutuhan rumah tangga sesuai batas pengeluaran harian di menu Analitik.\n\n3. 20% Langsung Masuk Target Tabungan / Reksadana\nBegitu saldo dompet di atas Rp 50.000, segera amankan 20% ke Reksadana Pasar Uang sebelum sempat terpakai jajan.\n\n4. 30% untuk Fleksibel & Self-Reward\nSetelah kewajiban nabung beres, sisa uangnya bebas kamu nikmati tanpa rasa bersalah!",
        tip: "Disiplin menyisihkan Rp 20.000 saja setiap hari ke Reksadana akan terkumpul lebih dari Rp 7.300.000 plus imbal hasil dalam 1 tahun!",
        isActive: true
    }
];

// ==========================================
// 2. FITUR LUPA PASSWORD (USER LOGIN & PANEL ADMIN)
// ==========================================
window.setupForgotPasswordOnLogin = function() {
    const passInput = document.getElementById('auth-password') || document.querySelector('input[type="password"]');
    if (!passInput || document.getElementById('mocatat-forgot-pass-row')) return;

    const forgotWrap = document.createElement('div');
    forgotWrap.id = 'mocatat-forgot-pass-row';
    forgotWrap.style.cssText = 'display:flex; justify-content:flex-end; margin-top:6px; margin-bottom:12px;';
    forgotWrap.innerHTML = `
        <button type="button" onclick="window.bukaModalLupaPassword()" style="background:none; border:none; color:#249a95; font-size:12px; font-weight:800; cursor:pointer; padding:2px 0; font-family:inherit; display:inline-flex; align-items:center; gap:4px;">
            <span class="material-icons-round" style="font-size:14px;">lock_reset</span> Lupa Password?
        </button>
    `;

    const parentGroup = passInput.closest('.form-group') || passInput.parentNode;
    if (parentGroup && parentGroup.parentNode) {
        parentGroup.parentNode.insertBefore(forgotWrap, parentGroup.nextSibling);
    }

    if (!document.getElementById('modal-forgot-password')) {
        const modalEl = document.createElement('div');
        modalEl.id = 'modal-forgot-password';
        modalEl.className = 'modal-overlay';
        modalEl.style.zIndex = '10005';
        modalEl.innerHTML = `
            <div class="modal-box">
                <div class="modal-handle"></div>
                <div class="modal-header">
                    <h3>🔑 Reset Password Akun</h3>
                    <button class="btn-close" onclick="document.getElementById('modal-forgot-password').classList.remove('show')"><span class="material-icons-round">close</span></button>
                </div>
                <p style="font-size:12.5px; color:#64748b; line-height:1.5; margin-bottom:14px; font-weight:500;">
                    Masukkan alamat email akun MoCatat kamu. Sistem akan mengirimkan tautan (link) resmi untuk membuat password baru ke kotak masuk emailmu.
                </p>
                <div id="forgot-pass-error" class="error-msg" style="display:none;"></div>
                <div class="form-group">
                    <label class="form-label">Email Akun Terdaftar</label>
                    <input type="email" id="forgot-pass-email" class="form-input" placeholder="nama@email.com" autocomplete="email">
                </div>
                <button class="btn-submit" id="btn-submit-forgot" onclick="window.prosesKirimResetPassword()">Kirim Link Reset Password</button>
            </div>
        `;
        document.body.appendChild(modalEl);
    }
};

window.bukaModalLupaPassword = function() {
    window.setupForgotPasswordOnLogin();
    const loginEmailInput = document.getElementById('auth-email') || document.querySelector('input[type="email"]');
    const targetEmailInput = document.getElementById('forgot-pass-email');
    const errBox = document.getElementById('forgot-pass-error');

    if (errBox) errBox.style.display = 'none';
    if (targetEmailInput && loginEmailInput && loginEmailInput.value.trim() !== '') {
        targetEmailInput.value = loginEmailInput.value.trim();
    }

    const modal = document.getElementById('modal-forgot-password');
    if (modal) modal.classList.add('show');
    setTimeout(() => { if (targetEmailInput) targetEmailInput.focus(); }, 150);
};

window.prosesKirimResetPassword = async function() {
    const emailInput = document.getElementById('forgot-pass-email');
    const errBox = document.getElementById('forgot-pass-error');
    const btn = document.getElementById('btn-submit-forgot');
    const email = emailInput ? emailInput.value.trim() : '';

    if (!email || !email.includes('@')) {
        if (errBox) {
            errBox.innerText = "Masukkan alamat email yang valid terlebih dahulu!";
            errBox.style.display = 'block';
        }
        return;
    }

    if (btn) {
        btn.disabled = true;
        btn.innerText = "Mengirim Email Reset...";
    }

    try {
        await sendPasswordResetEmail(auth, email);
        const modal = document.getElementById('modal-forgot-password');
        if (modal) modal.classList.remove('show');
        window.customAlert(
            "Email Terkirim! 📩",
            `Tautan ganti password baru telah dikirim ke ${email}. Silakan buka kotak masuk (atau folder Spam) email Anda.`
        );
    } catch (error) {
        let pesanErr = "Gagal mengirim email reset. Pastikan email sudah terdaftar.";
        if (error.code === 'auth/user-not-found') pesanErr = "Email ini belum terdaftar di MoCatat.";
        else if (error.code === 'auth/invalid-email') pesanErr = "Format alamat email tidak valid.";
        else if (error.code === 'auth/too-many-requests') pesanErr = "Terlalu banyak percobaan. Tunggu beberapa menit lagi.";

        if (errBox) {
            errBox.innerText = pesanErr;
            errBox.style.display = 'block';
        }
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerText = "Kirim Link Reset Password";
        }
    }
};

window.kirimResetPasswordAdmin = function(email, displayName) {
    if (!email || !email.includes('@')) {
        window.customAlert(
            "Email Belum Tercatat",
            "Akun lama ini belum membuka aplikasi kembali sehingga alamat emailnya belum tercatat di Firestore. Anda dapat melihat emailnya lewat menu Authentication di Firebase Console.",
            "warning"
        );
        return;
    }

    window.customConfirm(
        "Kirim Link Reset Password?",
        `Kirimkan email berisi tautan ganti password baru ke "${displayName}" (${email})?`,
        async () => {
            try {
                await sendPasswordResetEmail(auth, email);
                window.customAlert("Berhasil Terkirim! 🔑", `Email reset password telah dikirim ke ${email}.`);
            } catch (e) {
                window.customAlert("Gagal Mengirim", "Pastikan email user valid dan terdaftar di Firebase Authentication.", "error");
            }
        }
    );
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.setupForgotPasswordOnLogin());
} else {
    window.setupForgotPasswordOnLogin();
}

// ==========================================
// 3. HELPER NOTIFIKASI BAWAAN PONSEL & REALTIME LISTENER
// ==========================================
window.getCMSContent = function() {
    let banners = DEFAULT_BANNERS;
    let educations = DEFAULT_EDUCATIONS;
    try {
        const raw = localStorage.getItem(CMS_STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed.banners) && parsed.banners.length > 0) banners = parsed.banners;
            if (Array.isArray(parsed.educations) && parsed.educations.length > 0) educations = parsed.educations;
        }
    } catch (e) {}
    return {
        banners: banners.filter(b => b.isActive !== false),
        educations: educations.filter(ed => ed.isActive !== false)
    };
};

window.getEduCount = function() {
    return window.getCMSContent().educations.length;
};

window.munculkanNotifBawaanPonsel = async function(judul, pesan, tagId) {
    if (!('Notification' in window)) return;

    if (Notification.permission === 'default') {
        try {
            await Notification.requestPermission();
        } catch (e) {}
    }

    if (Notification.permission !== 'granted') return;

    const notifOptions = {
        body: pesan,
        icon: './icon-192.png',
        badge: './icon-192.png',
        vibrate: [200, 100, 200],
        tag: tagId || ('mocatat-bc-' + Date.now()),
        renotify: true,
        data: { url: './index.html?open=notifikasi' }
    };

    try {
        if ('serviceWorker' in navigator) {
            const reg = await navigator.serviceWorker.ready;
            if (reg && typeof reg.showNotification === 'function') {
                await reg.showNotification(judul, notifOptions);
                return;
            }
        }
        new Notification(judul, notifOptions);
    } catch (err) {
        try { new Notification(judul, notifOptions); } catch (e2) {}
    }
};

window.recordUserHeartbeat = async function(user) {
    if (!user || !user.uid) return;
    const email = (user.email || '').trim().toLowerCase();
    if (email === ADMIN_EMAIL) return;

    const nowISO = new Date().toISOString();
    const displayName = user.displayName || (email ? email.split('@')[0] : 'Pengguna MoCatat');
    const walletCount = Array.isArray(window.wallets) ? window.wallets.filter(w => !w.isArchived).length : 0;
    const targetCount = Array.isArray(window.targets) ? window.targets.length : 0;

    const userMeta = {
        uid: user.uid,
        email: user.email || '-',
        displayName: displayName,
        lastActive: nowISO,
        walletCount: walletCount,
        targetCount: targetCount
    };

    try {
        await setDoc(doc(db, "users", user.uid), {
            email: userMeta.email,
            displayName: userMeta.displayName,
            lastActive: nowISO
        }, { merge: true });
    } catch (e) {}

    try {
        await setDoc(doc(db, "app_settings", "user_registry"), {
            [user.uid]: userMeta
        }, { merge: true });
    } catch (e) {}
};

window.processIncomingPublicContent = function(gData) {
    if (!gData) return;
    const foundBanners = Array.isArray(gData.banners) ? gData.banners : null;
    const foundEducations = Array.isArray(gData.educations) ? gData.educations : null;
    const foundBroadcasts = Array.isArray(gData.broadcasts) ? gData.broadcasts : null;

    if (foundBanners || foundEducations || foundBroadcasts) {
        const existingRaw = localStorage.getItem(CMS_STORAGE_KEY);
        const existingObj = existingRaw ? JSON.parse(existingRaw) : {};
        localStorage.setItem(CMS_STORAGE_KEY, JSON.stringify({
            banners: foundBanners || existingObj.banners || DEFAULT_BANNERS,
            educations: foundEducations || existingObj.educations || DEFAULT_EDUCATIONS,
            broadcasts: foundBroadcasts || existingObj.broadcasts || []
        }));
        if (typeof window.setupRedesignedBerandaLayout === 'function') {
            window.setupRedesignedBerandaLayout();
        }
        if (typeof window.renderEdukasiPage === 'function') {
            window.renderEdukasiPage();
        }
    }

    if (Array.isArray(foundBroadcasts) && foundBroadcasts.length > 0 && window.currentUserId) {
        if (!Array.isArray(window.notifications)) window.notifications = [];

        const seenKey = "mocatat_seen_broadcasts_" + window.currentUserId;
        const phoneNotifKey = "mocatat_pushed_phone_" + window.currentUserId;
        let seenIds = [];
        let pushedIds = [];
        try { seenIds = JSON.parse(localStorage.getItem(seenKey) || "[]"); } catch (e) {}
        try { pushedIds = JSON.parse(localStorage.getItem(phoneNotifKey) || "[]"); } catch (e) {}

        let adaBroadcastBaru = false;
        let newestUnpushed = null;

        foundBroadcasts.forEach((bc, index) => {
            if (!bc || !bc.id) return;
            const sudahAdaDiNotif = window.notifications.some(n => String(n.id) === String(bc.id));
            const sudahPernahDilihat = seenIds.includes(bc.id);

            if (!sudahAdaDiNotif && !sudahPernahDilihat) {
                window.notifications.unshift({
                    id: bc.id,
                    title: bc.title,
                    body: bc.body,
                    date: bc.date || window.getLocalDateString(),
                    read: false
                });
                seenIds.push(bc.id);
                adaBroadcastBaru = true;
            }

            if (!pushedIds.includes(bc.id)) {
                pushedIds.push(bc.id);
                if (index === 0) newestUnpushed = bc;
            }
        });

        try { localStorage.setItem(phoneNotifKey, JSON.stringify(pushedIds)); } catch (e) {}

        if (newestUnpushed) {
            window.munculkanNotifBawaanPonsel(newestUnpushed.title || 'Info MoCatat', newestUnpushed.body || '', newestUnpushed.id);
        }

        if (adaBroadcastBaru) {
            try { localStorage.setItem(seenKey, JSON.stringify(seenIds)); } catch (e) {}
            if (typeof window.renderNotifications === 'function') window.renderNotifications();
            if (typeof window.saveDataToFirestoreSilently === 'function') window.saveDataToFirestoreSilently();
        }
    }
};

window.syncCMSFromFirestoreOnce = async function() {
    if (window.cmsLoadedFromCloud || !window.currentUserId) return;
    window.cmsLoadedFromCloud = true;

    if (auth.currentUser) {
        window.recordUserHeartbeat(auth.currentUser);
    }

    if (window.location.search.includes('open=notifikasi') && typeof window.bukaNotifikasi === 'function') {
        setTimeout(() => window.bukaNotifikasi(), 400);
    }

    try {
        if (window.cmsRealtimeUnsub) window.cmsRealtimeUnsub();
        window.cmsRealtimeUnsub = onSnapshot(doc(db, "app_settings", "public_content"), (snap) => {
            if (snap.exists()) {
                window.processIncomingPublicContent(snap.data());
            }
        }, async () => {
            try {
                const globalSnap = await getDoc(doc(db, "app_settings", "public_content"));
                if (globalSnap.exists()) window.processIncomingPublicContent(globalSnap.data());
            } catch (e) {}
        });
    } catch (e) {}
};

// ==========================================
// 4. DETEKSI LOGIN ADMIN & INISIALISASI DASHBOARD
// ==========================================
window.initSurfaceAdminHeader = function() {
    const dateEl = document.getElementById('surface-date-display');
    if (dateEl) {
        const hari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        const bulan = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
        const d = new Date();
        dateEl.innerText = `${hari[d.getDay()]}, ${d.getDate()} ${bulan[d.getMonth()]} ${d.getFullYear()}`;
    }
};

onAuthStateChanged(auth, (user) => {
    window.setupForgotPasswordOnLogin();
    const isPageAdmin = window.location.pathname.includes('admin.html') || !!document.getElementById('admin-banner-container');

    if (user) {
        const userEmail = (user.email || '').trim().toLowerCase();
        const isAdmin = (userEmail === ADMIN_EMAIL);

        if (isAdmin && !isPageAdmin) {
            window.location.replace("admin.html");
            return;
        }

        if (!isAdmin && isPageAdmin) {
            window.location.replace("index.html");
            return;
        }

        if (isAdmin && isPageAdmin) {
            window.currentUserId = user.uid;
            window.initSurfaceAdminHeader();
            window.pilihMenuSurface('overview');
            window.loadAdminCMSData();
            window.loadAdminUsersData();
        } else if (!isAdmin) {
            window.recordUserHeartbeat(user);
        }
    } else if (isPageAdmin) {
        window.location.replace("index.html");
    }
});

window.keluarAdmin = function() {
    window.customConfirm(
        "Keluar dari Admin?",
        "Anda akan keluar dari sesi Admin dan kembali ke halaman login utama.",
        async () => {
            try {
                await signOut(auth);
                window.location.replace("index.html");
            } catch (e) {
                window.customAlert("Error", "Gagal keluar dari sesi Admin.", "error");
            }
        }
    );
};

// ==========================================
// 5. NAVIGASI HAMBURGER DRAWER & ROUTING MENU
// ==========================================
window.toggleHamburgerMenu = function(show) {
    const drawer = document.getElementById('surface-drawer');
    const backdrop = document.getElementById('drawer-backdrop');
    if (drawer) drawer.classList.toggle('show', !!show);
    if (backdrop) backdrop.classList.toggle('show', !!show);
};

window.pilihMenuSurface = function(menu) {
    window.toggleHamburgerMenu(false);
    window.activeAdminTab = menu;

    ['overview', 'banner', 'edukasi', 'users', 'broadcast'].forEach(k => {
        const dItem = document.getElementById('dnav-' + k);
        if (dItem) dItem.classList.toggle('active', k === menu);
    });

    const viewOverview = document.getElementById('surface-view-overview');
    const viewManage = document.getElementById('surface-view-manage');
    const bcLabel = document.getElementById('surface-breadcrumb-label');
    const heroTitle = document.getElementById('surface-hero-title');
    const heroSub = document.getElementById('surface-hero-sub');
    const manageTitle = document.getElementById('manage-section-title');
    const fabBtn = document.getElementById('fab-admin-add');
    const fabText = document.getElementById('fab-admin-text');

    const panelBanner = document.getElementById('panel-admin-banner');
    const panelEdukasi = document.getElementById('panel-admin-edukasi');
    const panelUsers = document.getElementById('panel-admin-users');
    const panelBroadcast = document.getElementById('panel-admin-broadcast');

    if (menu === 'overview') {
        if (viewOverview) viewOverview.style.display = 'block';
        if (viewManage) viewManage.style.display = 'none';
        if (fabBtn) fabBtn.style.display = 'none';

        if (bcLabel) bcLabel.innerText = 'Overview Dashboard';
        if (heroTitle) heroTitle.innerHTML = 'Halo, <strong>Admin MoCatat</strong>';
        if (heroSub) heroSub.innerText = 'Ringkasan aktivitas pengguna aplikasi, pertumbuhan dompet, dan materi literasi investasi MoCatat.';
        window.renderAdminPage();
    } else {
        if (viewOverview) viewOverview.style.display = 'none';
        if (viewManage) viewManage.style.display = 'block';

        if (panelBanner) panelBanner.style.display = (menu === 'banner') ? 'flex' : 'none';
        if (panelEdukasi) panelEdukasi.style.display = (menu === 'edukasi') ? 'flex' : 'none';
        if (panelUsers) panelUsers.style.display = (menu === 'users') ? 'flex' : 'none';
        if (panelBroadcast) panelBroadcast.style.display = (menu === 'broadcast') ? 'flex' : 'none';

        if (menu === 'banner') {
            if (bcLabel) bcLabel.innerText = 'Kelola Banner';
            if (heroTitle) heroTitle.innerHTML = 'Manajemen <strong>Banner</strong>';
            if (heroSub) heroSub.innerText = 'Atur tayangan slide banner promosi dan informasi di halaman Edukasi.';
            if (manageTitle) manageTitle.innerText = '🎨 Daftar Banner Informasi';
            if (fabBtn) fabBtn.style.display = 'flex';
            if (fabText) fabText.innerText = 'Tambah Banner Baru';
            window.renderAdminBanners();
        } else if (menu === 'edukasi') {
            if (bcLabel) bcLabel.innerText = 'Materi Edukasi';
            if (heroTitle) heroTitle.innerHTML = 'Katalog <strong>Edukasi</strong>';
            if (heroSub) heroSub.innerText = 'Kelola artikel pembelajaran Reksadana, Saham, dan Tips Keuangan Harian.';
            if (manageTitle) manageTitle.innerText = '📚 Daftar Artikel Edukasi';
            if (fabBtn) fabBtn.style.display = 'flex';
            if (fabText) fabText.innerText = 'Tambah Materi Edukasi';
            window.renderAdminEducations();
        } else if (menu === 'users') {
            if (bcLabel) bcLabel.innerText = 'Daftar Pengguna';
            if (heroTitle) heroTitle.innerHTML = 'Direktori <strong>Pengguna</strong>';
            if (heroSub) heroSub.innerText = 'Pantau status online pengguna, kirim bantuan reset password, serta kelola data akun.';
            if (manageTitle) manageTitle.innerText = '👥 Daftar Pengguna Aplikasi';
            if (fabBtn) fabBtn.style.display = 'none';
            window.loadAdminUsersData();
        } else if (menu === 'broadcast') {
            if (bcLabel) bcLabel.innerText = 'Broadcast Notifikasi';
            if (heroTitle) heroTitle.innerHTML = 'Broadcast <strong>Pengumuman</strong>';
            if (heroSub) heroSub.innerText = 'Kirim pesan notifikasi massal langsung ke lonceng Beranda & Notifikasi HP seluruh pengguna.';
            if (manageTitle) manageTitle.innerText = '📢 Riwayat Pengumuman Massal';
            if (fabBtn) fabBtn.style.display = 'flex';
            if (fabText) fabText.innerText = 'Kirim Broadcast Baru';
            window.renderAdminBroadcasts();
        }
    }

    window.scrollTo(0, 0);
};

window.switchAdminTab = function(tab) {
    window.pilihMenuSurface(tab);
};

window.pilihBatangKapsul = function(colEl, monthName, valDompet, valTarget) {
    const stage = document.getElementById('capsule-bars-stage');
    const tooltip = document.getElementById('capsule-active-tooltip');
    if (!stage || !colEl) return;

    stage.querySelectorAll('.capsule-col').forEach(c => c.classList.remove('active'));
    colEl.classList.add('active');

    if (tooltip) {
        tooltip.innerHTML = `
            <div style="color:#b2dfdb; font-weight:700; font-size:9px;">Bulan (${window.escapeHTML(monthName)})</div>
            <div>● Dompet: <strong>${window.escapeHTML(valDompet)}</strong></div>
            <div>◐ Target: <strong>${window.escapeHTML(valTarget)}</strong></div>
        `;
        colEl.insertBefore(tooltip, colEl.firstChild);
    }
};

// ==========================================
// 6. LOGIKA PANTAU, RESET PASSWORD & HAPUS USER (ANTI-MENUMPUK)
// ==========================================
window.loadAdminUsersData = async function() {
    const usersMap = {};

    try {
        const regSnap = await getDoc(doc(db, "app_settings", "user_registry"));
        if (regSnap.exists()) {
            const regData = regSnap.data();
            Object.entries(regData).forEach(([uid, info]) => {
                if (info && typeof info === 'object' && (info.email || '').toLowerCase() !== ADMIN_EMAIL) {
                    usersMap[uid] = {
                        uid: uid,
                        email: info.email || '-',
                        displayName: info.displayName || (info.email ? info.email.split('@')[0] : 'User'),
                        lastActive: info.lastActive || null,
                        walletCount: Number(info.walletCount || 0),
                        targetCount: Number(info.targetCount || 0)
                    };
                }
            });
        }
    } catch (e) {}

    try {
        const querySnap = await getDocs(collection(db, "users"));
        querySnap.forEach(docSnap => {
            const uid = docSnap.id;
            const d = docSnap.data() || {};
            const email = (d.email || (usersMap[uid] && usersMap[uid].email) || '').toLowerCase();
            if (email === ADMIN_EMAIL) return;

            const wCount = Array.isArray(d.wallets) ? d.wallets.filter(w => !w.isArchived).length : (usersMap[uid]?.walletCount || 0);
            const tCount = Array.isArray(d.targets) ? d.targets.length : (usersMap[uid]?.targetCount || 0);
            const lastAct = d.lastActive || d.updatedAt || (usersMap[uid] ? usersMap[uid].lastActive : null);
            const dispName = d.displayName || d.name || (usersMap[uid] ? usersMap[uid].displayName : null) || (d.email ? d.email.split('@')[0] : `User-${uid.substring(0, 5)}`);

            usersMap[uid] = {
                uid: uid,
                email: d.email || (usersMap[uid] ? usersMap[uid].email : 'Email belum tercatat'),
                displayName: dispName,
                lastActive: lastAct,
                walletCount: wCount,
                targetCount: tCount
            };
        });
    } catch (e) {}

    window.adminUsersList = Object.values(usersMap).sort((a, b) => {
        const tA = a.lastActive ? new Date(a.lastActive).getTime() : 0;
        const tB = b.lastActive ? new Date(b.lastActive).getTime() : 0;
        return tB - tA;
    });

    window.renderAdminPage();
};

window.hapusDataUserAdmin = function(uid, displayName) {
    window.customConfirm(
        "Hapus Data User Ini?",
        `Yakin ingin menghapus data "${displayName}" dari daftar Firestore? (Gunakan untuk membersihkan akun tes yang tidak terpakai)`,
        async () => {
            try {
                await deleteDoc(doc(db, "users", uid));
            } catch (e) {}
            try {
                await updateDoc(doc(db, "app_settings", "user_registry"), {
                    [uid]: deleteField()
                });
            } catch (e) {}

            window.adminUsersList = (window.adminUsersList || []).filter(u => u.uid !== uid);
            window.renderAdminPage();
        }
    );
};

window.formatWaktuAktif = function(isoStr) {
    if (!isoStr) return { label: "Belum tercatat", status: "offline", badgeText: "Offline" };
    const dt = new Date(isoStr);
    if (isNaN(dt.getTime())) return { label: "Belum tercatat", status: "offline", badgeText: "Offline" };

    const now = new Date();
    const diffMs = now.getTime() - dt.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMin / 60);

    const isSameDay = dt.toDateString() === now.toDateString();
    const timeStr = `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
    const dateStr = `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`;

    if (diffMin < 15) {
        return {
            label: diffMin <= 1 ? "Baru saja membuka aplikasi" : `${diffMin} menit yang lalu`,
            status: "online",
            badgeText: "🟢 Online"
        };
    } else if (isSameDay) {
        return {
            label: `Hari ini pukul ${timeStr}`,
            status: "today",
            badgeText: `🔵 Aktif (${diffHours > 0 ? diffHours + ' jam lalu' : diffMin + ' mnt lalu'})`
        };
    } else {
        return {
            label: `${dateStr} • ${timeStr}`,
            status: "offline",
            badgeText: "⚪ Offline"
        };
    }
};

window.renderAdminUsers = function() {
    const container = document.getElementById('admin-users-container');
    if (!container) return;

    const searchInput = document.getElementById('admin-search-user');
    const keyword = searchInput ? searchInput.value.trim().toLowerCase() : '';

    let filtered = window.adminUsersList || [];
    if (keyword !== '') {
        filtered = filtered.filter(u =>
            (u.displayName || '').toLowerCase().includes(keyword) ||
            (u.email || '').toLowerCase().includes(keyword) ||
            (u.uid || '').toLowerCase().includes(keyword)
        );
    }

    if (filtered.length === 0) {
        container.innerHTML = `
        <div class="empty-state">
            <div class="icon-wrapper"><span class="material-icons-round">group_off</span></div>
            <h4>Belum Ada User Terdeteksi</h4>
            <p>Daftar pengguna akan otomatis muncul di sini saat pengguna membuka aplikasi MoCatat.</p>
        </div>`;
        return;
    }

    let html = '';
    filtered.forEach(u => {
        const info = window.formatWaktuAktif(u.lastActive);
        const badgeStyle = info.status === 'online'
            ? 'background:#dcfce7; color:#15803d; border:1px solid #bbf7d0;'
            : (info.status === 'today' ? 'background:#e0f2f1; color:#0f766e; border:1px solid #b2dfdb;' : 'background:#f1f5f9; color:#64748b; border:1px solid #e2e8f0;');

        const avatarBg = info.status === 'online' ? '#dcfce7' : (info.status === 'today' ? '#e0f2f1' : '#f1f5f9');
        const avatarColor = info.status === 'online' ? '#15803d' : (info.status === 'today' ? '#0f766e' : '#64748b');
        const initial = (u.displayName || u.email || 'U').trim().charAt(0).toUpperCase();
        const safeNameJS = window.escapeHTML(u.displayName || 'User').replace(/'/g, "\\'");
        const safeEmailJS = window.escapeHTML(u.email || '').replace(/'/g, "\\'");

        html += `
        <div class="admin-card" style="padding:16px; margin-bottom:12px;">
            <!-- Baris 1: Avatar + Nama & Email Utuh + Badge Status -->
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px; margin-bottom:12px;">
                <div style="display:flex; align-items:center; gap:12px; min-width:0; flex:1;">
                    <div style="width:44px; height:44px; border-radius:13px; background:${avatarBg}; color:${avatarColor}; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:17px; flex-shrink:0;">
                        ${window.escapeHTML(initial)}
                    </div>
                    <div style="min-width:0; flex:1;">
                        <div style="font-size:14.5px; font-weight:800; color:#1a1a1a; line-height:1.3; word-break:break-word;">
                            ${window.escapeHTML(u.displayName)}
                        </div>
                        <div style="font-size:12px; color:#64748b; font-weight:600; margin-top:2px; word-break:break-all;">
                            ${window.escapeHTML(u.email)}
                        </div>
                    </div>
                </div>
                <span style="font-size:10.5px; font-weight:800; padding:4px 10px; border-radius:20px; white-space:nowrap; flex-shrink:0; ${badgeStyle}">
                    ${info.badgeText}
                </span>
            </div>

            <!-- Baris 2: Kotak Info Terakhir Aktif & Jumlah Dompet/Target (Tidak Bertumpuk) -->
            <div style="background:#f8fafc; border:1px solid #edf2f7; border-radius:12px; padding:10px 12px; display:flex; flex-direction:column; gap:6px; margin-bottom:12px; font-size:11.5px; color:#475569; font-weight:600;">
                <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap;">
                    <span style="color:#64748b;">🕒 Terakhir aktif:</span>
                    <strong style="color:#0f766e;">${window.escapeHTML(info.label)}</strong>
                </div>
                <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; padding-top:6px; border-top:1px dashed #e2e8f0;">
                    <span style="color:#64748b;">📊 Data Tersimpan:</span>
                    <span style="color:#1a1a1a; font-weight:800;">👛 ${u.walletCount} Dompet &nbsp;•&nbsp; 🎯 ${u.targetCount} Target</span>
                </div>
            </div>

            <!-- Baris 3: Tombol Aksi (Reset Password & Hapus User) -->
            <div style="display:flex; gap:8px;">
                <button onclick="window.kirimResetPasswordAdmin('${safeEmailJS}', '${safeNameJS}')" style="flex:1; background:#e0f2f1; color:#0f766e; border:none; padding:9px 12px; border-radius:10px; font-size:11.5px; font-weight:800; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; gap:6px; font-family:inherit;">
                    <span class="material-icons-round" style="font-size:16px;">lock_reset</span> Reset Password
                </button>
                <button onclick="window.hapusDataUserAdmin('${window.escapeHTML(u.uid)}', '${safeNameJS}')" style="background:#fff1f2; color:#e11d48; border:1px solid #fecdd3; padding:9px 13px; border-radius:10px; font-size:11.5px; font-weight:800; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; gap:5px; font-family:inherit;">
                    <span class="material-icons-round" style="font-size:16px;">delete_outline</span> Hapus
                </button>
            </div>
        </div>`;
    });

    container.innerHTML = html;
};

// ==========================================
// 7. LOGIKA BROADCAST NOTIFIKASI MASSAL
// ==========================================
window.renderAdminBroadcasts = function() {
    const container = document.getElementById('admin-broadcast-container');
    if (!container) return;

    if (!window.cmsBroadcasts || window.cmsBroadcasts.length === 0) {
        container.innerHTML = `
        <div class="empty-state">
            <div class="icon-wrapper"><span class="material-icons-round">campaign</span></div>
            <h4>Belum Ada Pengumuman Terkirim</h4>
            <p>Klik tombol <b>"Kirim Broadcast Baru"</b> di bawah untuk mengirim pesan ke lonceng & notifikasi HP seluruh user.</p>
        </div>`;
        return;
    }

    let html = '';
    window.cmsBroadcasts.forEach(bc => {
        html += `
        <div class="admin-card" style="padding:15px 16px; margin-bottom:12px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px; margin-bottom:8px;">
                <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                    <span class="edu-cat-badge" style="background:#e0f2f1; color:#0f766e;">
                        <span class="material-icons-round" style="font-size:13px;">notifications_active</span> Terkirim ke User
                    </span>
                    <span style="font-size:11px; color:#94a3b8; font-weight:700;">🗓️ ${window.escapeHTML(bc.date || '-')}</span>
                </div>
                <button class="btn-icon delete" style="padding:4px;" onclick="window.hapusBroadcastAdmin('${window.escapeHTML(bc.id)}')" title="Hapus Riwayat Broadcast">
                    <span class="material-icons-round" style="font-size:18px;">delete</span>
                </button>
            </div>
            <div style="font-size:14.5px; font-weight:800; color:#1a1a1a; margin-bottom:4px;">${window.escapeHTML(bc.title)}</div>
            <div style="font-size:12.5px; color:#475569; line-height:1.5; font-weight:500;">${window.escapeHTML(bc.body)}</div>
        </div>`;
    });

    container.innerHTML = html;
};

window.openBroadcastModal = function() {
    const errBox = document.getElementById('broadcast-error-msg');
    if (errBox) errBox.style.display = 'none';
    if (document.getElementById('broadcast-title')) document.getElementById('broadcast-title').value = '';
    if (document.getElementById('broadcast-body')) document.getElementById('broadcast-body').value = '';
    const modal = document.getElementById('modal-admin-broadcast');
    if (modal) modal.classList.add('show');
};

window.pilihTemplateBroadcast = function(judul, isi) {
    if (document.getElementById('broadcast-title')) document.getElementById('broadcast-title').value = judul;
    if (document.getElementById('broadcast-body')) document.getElementById('broadcast-body').value = isi;
};

window.kirimBroadcastAdmin = async function() {
    const titleEl = document.getElementById('broadcast-title');
    const bodyEl = document.getElementById('broadcast-body');
    const errBox = document.getElementById('broadcast-error-msg');
    const btnSend = document.getElementById('btn-send-broadcast');

    const title = titleEl ? titleEl.value.trim() : '';
    const body = bodyEl ? bodyEl.value.trim() : '';

    if (!title || !body) {
        if (errBox) {
            errBox.innerText = "Judul dan Isi Pesan Pengumuman wajib diisi!";
            errBox.style.display = 'block';
        }
        return;
    }

    if (btnSend) {
        btnSend.disabled = true;
        btnSend.innerText = "Mengirim ke seluruh user...";
    }

    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const newBc = {
        id: "bc-" + Date.now(),
        title: title,
        body: body,
        date: dateStr,
        read: false
    };

    window.cmsBroadcasts.unshift(newBc);
    await window.saveAdminCMSData();

    let terkirimCount = 0;
    try {
        const querySnap = await getDocs(collection(db, "users"));
        const promises = [];
        querySnap.forEach(docSnap => {
            const uid = docSnap.id;
            const uData = docSnap.data() || {};
            if ((uData.email || '').toLowerCase() === ADMIN_EMAIL) return;

            const existingNotifs = Array.isArray(uData.notifications) ? uData.notifications : [];
            if (!existingNotifs.some(n => String(n.id) === String(newBc.id))) {
                existingNotifs.unshift(newBc);
                promises.push(setDoc(doc(db, "users", uid), { notifications: existingNotifs }, { merge: true }));
                terkirimCount++;
            }
        });
        await Promise.all(promises);
    } catch (e) {}

    window.munculkanNotifBawaanPonsel(title, body, newBc.id);

    if (btnSend) {
        btnSend.disabled = false;
        btnSend.innerText = "Kirim Pengumuman Sekarang";
    }

    window.closeModal('modal-admin-broadcast');
    window.renderAdminPage();
    window.customAlert("Broadcast Terkirim! 📢", `Pengumuman berhasil dikirim ke lonceng & notifikasi ponsel ${terkirimCount > 0 ? terkirimCount + ' user terdaftar' : 'seluruh pengguna'}.`);
};

window.hapusBroadcastAdmin = function(id) {
    window.customConfirm("Hapus Pengumuman?", "Yakin ingin menghapus pengumuman ini dari daftar riwayat?", async () => {
        window.cmsBroadcasts = (window.cmsBroadcasts || []).filter(x => String(x.id) !== String(id));
        await window.saveAdminCMSData();
    });
};

// ==========================================
// 8. LOGIKA KELOLA KONTEN & UPDATE KPI / GRAFIK
// ==========================================
window.loadAdminCMSData = async function() {
    try {
        const localRaw = localStorage.getItem(CMS_STORAGE_KEY);
        if (localRaw) {
            const parsed = JSON.parse(localRaw);
            window.cmsBanners = Array.isArray(parsed.banners) ? parsed.banners : [];
            window.cmsEducations = Array.isArray(parsed.educations) ? parsed.educations : [];
            window.cmsBroadcasts = Array.isArray(parsed.broadcasts) ? parsed.broadcasts : [];
        }
    } catch (e) {}

    try {
        const globalSnap = await getDoc(doc(db, "app_settings", "public_content"));
        if (globalSnap.exists()) {
            const gData = globalSnap.data();
            if (Array.isArray(gData.banners)) window.cmsBanners = gData.banners;
            if (Array.isArray(gData.educations)) window.cmsEducations = gData.educations;
            if (Array.isArray(gData.broadcasts)) window.cmsBroadcasts = gData.broadcasts;
        } else if (window.currentUserId) {
            const userSnap = await getDoc(doc(db, "users", window.currentUserId));
            if (userSnap.exists()) {
                const uData = userSnap.data();
                if (Array.isArray(uData.cmsBanners)) window.cmsBanners = uData.cmsBanners;
                if (Array.isArray(uData.cmsEducations)) window.cmsEducations = uData.cmsEducations;
                if (Array.isArray(uData.cmsBroadcasts)) window.cmsBroadcasts = uData.cmsBroadcasts;
            }
        }
    } catch (e) {
        if (window.currentUserId) {
            try {
                const userSnap = await getDoc(doc(db, "users", window.currentUserId));
                if (userSnap.exists()) {
                    const uData = userSnap.data();
                    if (Array.isArray(uData.cmsBanners)) window.cmsBanners = uData.cmsBanners;
                    if (Array.isArray(uData.cmsEducations)) window.cmsEducations = uData.cmsEducations;
                    if (Array.isArray(uData.cmsBroadcasts)) window.cmsBroadcasts = uData.cmsBroadcasts;
                }
            } catch (err2) {}
        }
    }

    if (window.cmsBanners.length === 0 && window.cmsEducations.length === 0 && !localStorage.getItem(CMS_STORAGE_KEY + "_initialized")) {
        window.cmsBanners = JSON.parse(JSON.stringify(DEFAULT_BANNERS));
        window.cmsEducations = JSON.parse(JSON.stringify(DEFAULT_EDUCATIONS));
        localStorage.setItem(CMS_STORAGE_KEY + "_initialized", "true");
        await window.saveAdminCMSData();
    }

    window.renderAdminPage();
    if (typeof window.sembunyikanLoading === 'function') window.sembunyikanLoading();
};

window.saveAdminCMSData = async function() {
    const payload = {
        banners: window.cmsBanners || [],
        educations: window.cmsEducations || [],
        broadcasts: window.cmsBroadcasts || [],
        updatedAt: new Date().toISOString()
    };

    try {
        localStorage.setItem(CMS_STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {}

    window.renderAdminPage();

    if (window.currentUserId) {
        try {
            await setDoc(doc(db, "users", window.currentUserId), {
                cmsBanners: window.cmsBanners,
                cmsEducations: window.cmsEducations,
                cmsBroadcasts: window.cmsBroadcasts
            }, { merge: true });
        } catch (e) {}
        try {
            await setDoc(doc(db, "app_settings", "public_content"), payload, { merge: true });
        } catch (e) {}
    }
};

window.renderAdminPage = function() {
    if (!document.getElementById('admin-banner-container')) return;

    const allBannersCount = (window.cmsBanners || []).length;
    const activeBannersCount = (window.cmsBanners || []).filter(b => b.isActive !== false).length;
    const allEduCount = (window.cmsEducations || []).length;
    const activeEduCount = (window.cmsEducations || []).filter(e => e.isActive !== false).length;
    const allBroadcastCount = (window.cmsBroadcasts || []).length;
    const totalUsersCount = (window.adminUsersList || []).length;
    const activeTodayCount = (window.adminUsersList || []).filter(u => {
        const st = window.formatWaktuAktif(u.lastActive).status;
        return st === 'online' || st === 'today';
    }).length;

    const totalWalletsAllUsers = (window.adminUsersList || []).reduce((acc, u) => acc + Number(u.walletCount || 0), 0);
    const totalTargetsAllUsers = (window.adminUsersList || []).reduce((acc, u) => acc + Number(u.targetCount || 0), 0);

    if (document.getElementById('tot-user-terdaftar')) {
        document.getElementById('tot-user-terdaftar').innerText = `${totalUsersCount} User`;
    }
    if (document.getElementById('kpi-online-val')) {
        document.getElementById('kpi-online-val').innerText = `${activeTodayCount} Aktif`;
    }
    if (document.getElementById('tot-banner-aktif')) {
        document.getElementById('tot-banner-aktif').innerText = `${activeBannersCount} Banner`;
    }
    if (document.getElementById('tot-edukasi-aktif')) {
        document.getElementById('tot-edukasi-aktif').innerText = `${activeEduCount} Artikel`;
    }
    if (document.getElementById('kpi-sub-dompet')) {
        document.getElementById('kpi-sub-dompet').innerText = `+${totalWalletsAllUsers} dompet`;
    }
    if (document.getElementById('kpi-sub-target')) {
        document.getElementById('kpi-sub-target').innerText = `+${totalTargetsAllUsers} target`;
    }

    if (document.getElementById('dbadge-banner')) document.getElementById('dbadge-banner').innerText = allBannersCount;
    if (document.getElementById('dbadge-edukasi')) document.getElementById('dbadge-edukasi').innerText = allEduCount;
    if (document.getElementById('dbadge-users')) document.getElementById('dbadge-users').innerText = totalUsersCount;
    if (document.getElementById('dbadge-broadcast')) document.getElementById('dbadge-broadcast').innerText = allBroadcastCount;

    if (document.getElementById('rt-avg-dompet')) document.getElementById('rt-avg-dompet').innerText = `${totalWalletsAllUsers} Dompet`;
    if (document.getElementById('rt-avg-target')) document.getElementById('rt-avg-target').innerText = `${totalTargetsAllUsers} Target`;
    if (document.getElementById('svg-tip-dompet')) document.getElementById('svg-tip-dompet').innerText = `Dompet: ${totalWalletsAllUsers}`;
    if (document.getElementById('svg-tip-target')) document.getElementById('svg-tip-target').innerText = `Target: ${totalTargetsAllUsers}`;

    window.renderAdminBanners();
    window.renderAdminEducations();
    window.renderAdminUsers();
    window.renderAdminBroadcasts();
};

window.renderAdminBanners = function() {
    const container = document.getElementById('admin-banner-container');
    if (!container) return;

    if (!window.cmsBanners || window.cmsBanners.length === 0) {
        container.innerHTML = `
        <div class="empty-state">
            <div class="icon-wrapper"><span class="material-icons-round">view_carousel</span></div>
            <h4>Belum Ada Banner</h4>
            <p>Buka menu Hamburger di kiri atas lalu klik <b>"Muat Paket Konten Default"</b> atau klik tombol tambah di bawah.</p>
        </div>`;
        return;
    }

    let html = '';
    window.cmsBanners.forEach(b => {
        const isActive = b.isActive !== false;
        const bgStyle = b.imageUrl ? `background-image: linear-gradient(135deg, rgba(15,23,42,0.82) 0%, rgba(15,23,42,0.55) 100%), url('${window.escapeHTML(b.imageUrl)}');` : '';
        const actionLabel = b.action === 'edukasi' ? 'Buka Pojok Edukasi' : `Buka ${b.action}`;

        html += `
        <div class="admin-card" style="${!isActive ? 'opacity:0.75;' : ''}">
            <div class="banner-preview-box ${window.escapeHTML(b.theme || 'theme-teal')}" style="${bgStyle}">
                <div style="font-size:10px; font-weight:800; letter-spacing:0.8px; text-transform:uppercase; background:rgba(255,255,255,0.2); display:inline-block; padding:3px 8px; border-radius:8px; margin-bottom:6px;">
                    ${window.escapeHTML(b.tag || 'INFO MOCATAT')}
                </div>
                <div style="font-size:16px; font-weight:800; margin-bottom:4px; line-height:1.25;">${window.escapeHTML(b.title)}</div>
                <div style="font-size:12px; opacity:0.92; font-weight:500; line-height:1.4;">${window.escapeHTML(b.subtitle)}</div>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div style="display:flex; align-items:center; gap:8px;">
                    <span class="badge-status ${isActive ? 'badge-on' : 'badge-off'}" onclick="window.toggleBannerStatus('${b.id}')">
                        <span class="material-icons-round" style="font-size:13px;">${isActive ? 'check_circle' : 'pause_circle'}</span>
                        ${isActive ? 'Aktif' : 'Nonaktif'}
                    </span>
                    <span style="font-size:11px; color:#64748b; font-weight:600;">➔ ${window.escapeHTML(actionLabel)}</span>
                </div>
                <div class="list-actions">
                    <button class="btn-icon" onclick="window.openBannerModal('${b.id}')" title="Edit Banner"><span class="material-icons-round" style="font-size:18px;">edit</span></button>
                    <button class="btn-icon delete" onclick="window.hapusBannerAdmin('${b.id}')" title="Hapus Banner"><span class="material-icons-round" style="font-size:18px;">delete</span></button>
                </div>
            </div>
        </div>`;
    });
    container.innerHTML = html;
};

window.renderAdminEducations = function() {
    const container = document.getElementById('admin-edukasi-container');
    if (!container) return;

    if (!window.cmsEducations || window.cmsEducations.length === 0) {
        container.innerHTML = `
        <div class="empty-state">
            <div class="icon-wrapper"><span class="material-icons-round">menu_book</span></div>
            <h4>Belum Ada Materi Edukasi</h4>
            <p>Buka menu Hamburger di kiri atas lalu klik <b>"Muat Paket Konten Default"</b> atau klik tombol tambah di bawah.</p>
        </div>`;
        return;
    }

    let html = '';
    window.cmsEducations.forEach(ed => {
        const isActive = ed.isActive !== false;
        const catClass = ed.category === 'Saham' ? 'cat-saham' : (ed.category === 'Tips Keuangan' ? 'cat-tips' : 'cat-reksadana');
        const catIcon = ed.category === 'Saham' ? 'trending_up' : (ed.category === 'Tips Keuangan' ? 'lightbulb' : 'savings');

        html += `
        <div class="admin-card" style="${!isActive ? 'opacity:0.75;' : ''}">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px; margin-bottom:8px;">
                <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                    <span class="edu-cat-badge ${catClass}">
                        <span class="material-icons-round" style="font-size:13px;">${catIcon}</span> ${window.escapeHTML(ed.category)}
                    </span>
                    <span style="font-size:11px; color:#94a3b8; font-weight:700;">• ⏱️ ${window.escapeHTML(ed.readTime || '3 Menit')}</span>
                </div>
                <span class="badge-status ${isActive ? 'badge-on' : 'badge-off'}" onclick="window.toggleEdukasiStatus('${ed.id}')">
                    <span class="material-icons-round" style="font-size:13px;">${isActive ? 'check_circle' : 'pause_circle'}</span>
                    ${isActive ? 'Aktif' : 'Nonaktif'}
                </span>
            </div>
            <div style="font-size:14.5px; font-weight:800; color:#1a1a1a; margin-bottom:4px; line-height:1.3;">${window.escapeHTML(ed.title)}</div>
            <div style="font-size:12px; color:#64748b; font-weight:500; line-height:1.45; margin-bottom:12px;">${window.escapeHTML(ed.summary)}</div>
            <div style="display:flex; justify-content:space-between; align-items:center; padding-top:10px; border-top:1px dashed #e2e8f0;">
                <div style="font-size:11px; color:#249a95; font-weight:700;">💡 Tips: ${window.escapeHTML((ed.tip || '-').substring(0, 45))}...</div>
                <div class="list-actions">
                    <button class="btn-icon" onclick="window.openEdukasiModal('${ed.id}')" title="Edit Materi"><span class="material-icons-round" style="font-size:18px;">edit</span></button>
                    <button class="btn-icon delete" onclick="window.hapusEdukasiAdmin('${ed.id}')" title="Hapus Materi"><span class="material-icons-round" style="font-size:18px;">delete</span></button>
                </div>
            </div>
        </div>`;
    });
    container.innerHTML = html;
};

window.openAdminModal = function() {
    if (window.activeAdminTab === 'edukasi') {
        window.openEdukasiModal();
    } else if (window.activeAdminTab === 'broadcast') {
        window.openBroadcastModal();
    } else {
        window.openBannerModal();
    }
};

window.openBannerModal = function(id = null) {
    document.getElementById('banner-error-msg').style.display = 'none';
    if (id) {
        const b = window.cmsBanners.find(x => String(x.id) === String(id));
        if (!b) return;
        document.getElementById('banner-modal-title').innerText = 'Edit Banner';
        document.getElementById('banner-id').value = b.id;
        document.getElementById('banner-tag').value = b.tag || '';
        document.getElementById('banner-title').value = b.title || '';
        document.getElementById('banner-subtitle').value = b.subtitle || '';
        document.getElementById('banner-theme').value = b.theme || 'theme-teal';
        document.getElementById('banner-action').value = b.action || 'edukasi';
        document.getElementById('banner-img').value = b.imageUrl || '';
    } else {
        document.getElementById('banner-modal-title').innerText = 'Tambah Banner Baru';
        document.getElementById('banner-id').value = '';
        document.getElementById('banner-tag').value = '💡 INFO & EDUKASI';
        document.getElementById('banner-title').value = '';
        document.getElementById('banner-subtitle').value = '';
        document.getElementById('banner-theme').value = 'theme-teal';
        document.getElementById('banner-action').value = 'edukasi';
        document.getElementById('banner-img').value = '';
    }
    document.getElementById('modal-admin-banner').classList.add('show');
};

window.simpanBannerAdmin = async function() {
    const id = document.getElementById('banner-id').value;
    const tag = document.getElementById('banner-tag').value.trim() || 'INFO MOCATAT';
    const title = document.getElementById('banner-title').value.trim();
    const subtitle = document.getElementById('banner-subtitle').value.trim();
    const theme = document.getElementById('banner-theme').value;
    const action = document.getElementById('banner-action').value;
    const imageUrl = document.getElementById('banner-img').value.trim();
    const errBox = document.getElementById('banner-error-msg');

    if (!title || !subtitle) {
        errBox.innerText = "Judul dan Sub-teks banner wajib diisi!";
        errBox.style.display = 'block';
        return;
    }

    if (id) {
        const idx = window.cmsBanners.findIndex(x => String(x.id) === String(id));
        if (idx !== -1) {
            window.cmsBanners[idx] = { ...window.cmsBanners[idx], tag, title, subtitle, theme, action, imageUrl };
        }
    } else {
        window.cmsBanners.unshift({
            id: window.generateUUID(),
            tag, title, subtitle, theme, action, imageUrl,
            isActive: true
        });
    }

    window.closeModal('modal-admin-banner');
    await window.saveAdminCMSData();
};

window.toggleBannerStatus = async function(id) {
    const idx = window.cmsBanners.findIndex(x => String(x.id) === String(id));
    if (idx === -1) return;
    window.cmsBanners[idx].isActive = !(window.cmsBanners[idx].isActive !== false);
    await window.saveAdminCMSData();
};

window.hapusBannerAdmin = function(id) {
    window.customConfirm("Hapus Banner?", "Yakin ingin menghapus banner ini dari daftar?", async () => {
        window.cmsBanners = window.cmsBanners.filter(x => String(x.id) !== String(id));
        await window.saveAdminCMSData();
    });
};

window.openEdukasiModal = function(id = null) {
    document.getElementById('edukasi-error-msg').style.display = 'none';
    if (id) {
        const ed = window.cmsEducations.find(x => String(x.id) === String(id));
        if (!ed) return;
        document.getElementById('edukasi-modal-title').innerText = 'Edit Materi Edukasi';
        document.getElementById('edukasi-id').value = ed.id;
        document.getElementById('edukasi-category').value = ed.category || 'Reksadana';
        document.getElementById('edukasi-readtime').value = ed.readTime || '3 Menit';
        document.getElementById('edukasi-title').value = ed.title || '';
        document.getElementById('edukasi-summary').value = ed.summary || '';
        document.getElementById('edukasi-content').value = ed.content || '';
        document.getElementById('edukasi-tip').value = ed.tip || '';
    } else {
        document.getElementById('edukasi-modal-title').innerText = 'Tambah Materi Edukasi';
        document.getElementById('edukasi-id').value = '';
        document.getElementById('edukasi-category').value = 'Reksadana';
        document.getElementById('edukasi-readtime').value = '3 Menit';
        document.getElementById('edukasi-title').value = '';
        document.getElementById('edukasi-summary').value = '';
        document.getElementById('edukasi-content').value = '';
        document.getElementById('edukasi-tip').value = '';
    }
    document.getElementById('modal-admin-edukasi').classList.add('show');
};

window.simpanEdukasiAdmin = async function() {
    const id = document.getElementById('edukasi-id').value;
    const category = document.getElementById('edukasi-category').value;
    const readTime = document.getElementById('edukasi-readtime').value.trim() || '3 Menit';
    const title = document.getElementById('edukasi-title').value.trim();
    const summary = document.getElementById('edukasi-summary').value.trim();
    const content = document.getElementById('edukasi-content').value.trim();
    const tip = document.getElementById('edukasi-tip').value.trim() || 'Disiplin menyisihkan sebagian penghasilan harian adalah kunci sukses investasi.';
    const errBox = document.getElementById('edukasi-error-msg');

    if (!title || !summary || !content) {
        errBox.innerText = "Judul, Ringkasan, dan Isi Pembahasan wajib diisi!";
        errBox.style.display = 'block';
        return;
    }

    if (id) {
        const idx = window.cmsEducations.findIndex(x => String(x.id) === String(id));
        if (idx !== -1) {
            window.cmsEducations[idx] = { ...window.cmsEducations[idx], category, readTime, title, summary, content, tip };
        }
    } else {
        window.cmsEducations.unshift({
            id: window.generateUUID(),
            category, readTime, title, summary, content, tip,
            isActive: true
        });
    }

    window.closeModal('modal-admin-edukasi');
    await window.saveAdminCMSData();
};

window.toggleEdukasiStatus = async function(id) {
    const idx = window.cmsEducations.findIndex(x => String(x.id) === String(id));
    if (idx === -1) return;
    window.cmsEducations[idx].isActive = !(window.cmsEducations[idx].isActive !== false);
    await window.saveAdminCMSData();
};

window.hapusEdukasiAdmin = function(id) {
    window.customConfirm("Hapus Materi?", "Yakin ingin menghapus materi edukasi ini?", async () => {
        window.cmsEducations = window.cmsEducations.filter(x => String(x.id) !== String(id));
        await window.saveAdminCMSData();
    });
};

window.muatKontenBawaan = function() {
    window.customConfirm(
        "Muat Paket Materi & Banner Bawaan?",
        "Sistem akan menambahkan 3 Banner dan 5 Materi Edukasi (Reksadana, Saham & Tips Keuangan) ke dalam aplikasi Anda. Lanjutkan?",
        async () => {
            window.cmsBanners = JSON.parse(JSON.stringify(DEFAULT_BANNERS));
            window.cmsEducations = JSON.parse(JSON.stringify(DEFAULT_EDUCATIONS));
            await window.saveAdminCMSData();
            window.customAlert("Berhasil! 🎉", "3 Banner dan 5 Materi Edukasi Investasi siap ditampilkan.");
        }
    );
};
