// ============================================================
// MOCATAT - CORE MODULE (core.js)
// Versi Turbo (Instan & Ringan) + 100% Cloud Sync & Auto-Recovery
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, deleteDoc, writeBatch, deleteField, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getMessaging, getToken, onMessage, isSupported } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging.js";

const firebaseConfig = {
    apiKey: "AIzaSyBtIGiFFIdIVlPqEOUivEbgpJvg0nGyNWs",
    authDomain: "mojamyapps.firebaseapp.com",
    projectId: "mojamyapps",
    storageBucket: "mojamyapps.firebasestorage.app",
    messagingSenderId: "681534222590",
    appId: "1:681534222590:web:a18243c1c136195ef875af"
};

export let app, auth, db, messaging;
export { doc, getDoc, setDoc, collection, getDocs, deleteDoc, writeBatch, deleteField };

try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);

    // Akselerasi Resmi Firebase Firestore agar pindah halaman instan 0.1 detik
    enableIndexedDbPersistence(db).catch(() => {});
    
    isSupported().then((supported) => {
        if (supported) {
            messaging = getMessaging(app);
            onMessage(messaging, (payload) => {
                const title = window.escapeHTML(payload?.notification?.title || "MoCatat");
                const body = window.escapeHTML(payload?.notification?.body || "Pesan baru");
                window.notifications.push({ id: window.generateUUID(), title, body, date: window.getLocalDateString(), read: false });
                window.saveDataToFirestoreSilently().then(() => { if(window.renderNotifications) window.renderNotifications(); });
                window.customAlert("Pesan Baru: " + title, body);
            });
        }
    });
} catch (error) { console.error("Firebase init failed:", error); }

// ==========================================
// 1. GLOBAL STATE VARIABLES
// ==========================================
window.currentUserId = null;
window.isUserDataLoaded = false;
window.wallets = []; 
window.categories = []; 
window.transactions = []; 
window.targets = []; 
window.notifications = [];
window.seenBroadcastIds = [];
window.pushedBroadcastIds = [];
window.calcPortfolio = [];
window.calcHistory = [];
window.kmRecords = []; 
window.vehicleSettings = { accumulatedKmForOil: 0, activeTrip: null };
window.zones = [];
window.activeKatTab = 'out';

// ==========================================
// 2. GLOBAL UTILITIES
// ==========================================
window.generateUUID = () => { return crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9); };
window.escapeHTML = (str) => { return str === null || str === undefined ? '' : str.toString().replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)); };
window.getLocalDateString = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; };
window.getLocalMonthString = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`; };
window.formatRupiah = (angka) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(angka || 0);
window.formatNumberWithDot = (value) => { if (!value) return ''; let n = value.toString().replace(/[^\d]/g, ''); if (!n) return ''; n = parseInt(n, 10).toString(); let sisa = n.length % 3; let rupiah = n.substr(0, sisa); let ribuan = n.substr(sisa).match(/\d{3}/gi); if(ribuan) { let separator = sisa ? '.' : ''; rupiah += separator + ribuan.join('.'); } return rupiah; };
window.parseRupiah = (value) => { return parseInt(value.toString().replace(/\./g, ''), 10) || 0; };

document.addEventListener('input', function(e) { 
    if (e.target && e.target.classList.contains('format-rupiah')) {
        e.target.value = window.formatNumberWithDot(e.target.value); 
    }
});

window.sembunyikanLoading = () => { const loading = document.getElementById('loading-screen'); if (loading && !loading.classList.contains('hide')) loading.classList.add('hide'); };
window.closeModal = (modalId) => { const el = document.getElementById(modalId); if(el) el.classList.remove('show'); };

// ==========================================
// 3. DIALOGS & ALERTS
// ==========================================
window.customAlert = function(title, msg, type = 'info') {
    const overlay = document.getElementById('custom-dialog');
    if(!overlay) return alert(msg);
    document.getElementById('dialog-title').innerText = title; 
    document.getElementById('dialog-msg').innerText = msg;
    const iconEl = document.getElementById('dialog-icon');
    if(iconEl) {
        if(type === 'warning' || type === 'error') { 
            iconEl.className = 'custom-dialog-icon warning'; 
            iconEl.innerHTML = '<span class="material-icons-round">warning_amber</span>'; 
        } else { 
            iconEl.className = 'custom-dialog-icon'; 
            iconEl.innerHTML = '<span class="material-icons-round">info</span>'; 
        }
    }
    document.getElementById('dialog-actions').innerHTML = `<button class="btn-dialog primary" onclick="document.getElementById('custom-dialog').classList.remove('show')">Mengerti</button>`;
    overlay.classList.add('show');
};

window.customConfirm = function(title, msg, onConfirm) {
    const overlay = document.getElementById('custom-dialog');
    if(!overlay) { if(confirm(msg)) onConfirm(); return; }
    document.getElementById('dialog-title').innerText = title; 
    document.getElementById('dialog-msg').innerText = msg;
    const iconEl = document.getElementById('dialog-icon'); 
    if(iconEl) { 
        iconEl.className = 'custom-dialog-icon warning'; 
        iconEl.innerHTML = '<span class="material-icons-round">help_outline</span>'; 
    }
    document.getElementById('dialog-actions').innerHTML = `<button class="btn-dialog secondary" onclick="document.getElementById('custom-dialog').classList.remove('show')">Batal</button> <button class="btn-dialog danger" id="btn-dialog-confirm">Ya, Lanjutkan</button>`;
    document.getElementById('btn-dialog-confirm').onclick = function() { 
        overlay.classList.remove('show'); 
        onConfirm(); 
    };
    overlay.classList.add('show');
};

// ==========================================
// 4. AUTHENTICATION LOGIC
// ==========================================
window.isLoginMode = true;
window.toggleAuthMode = function() {
    window.isLoginMode = !window.isLoginMode; 
    document.getElementById('auth-error').style.display = 'none';
    document.getElementById('auth-name-group').style.display = window.isLoginMode ? 'none' : 'block';
    document.getElementById('auth-title').innerText = window.isLoginMode ? 'Masuk Akun' : 'Daftar Akun';
    document.getElementById('auth-desc').innerText = window.isLoginMode ? 'Kelola keuanganmu dari mana saja.' : 'Buat akun untuk memulai pencatatan.';
    document.getElementById('btn-auth').innerText = window.isLoginMode ? 'Masuk' : 'Daftar';
    document.getElementById('auth-toggle-text').innerHTML = window.isLoginMode ? 'Belum punya akun? <span onclick="window.toggleAuthMode()">Daftar di sini</span>' : 'Sudah punya akun? <span onclick="window.toggleAuthMode()">Masuk di sini</span>';
};

window.prosesAuth = async function() {
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    const name = window.escapeHTML(document.getElementById('auth-name').value);
    const errBox = document.getElementById('auth-error');
    if(!email || !password) { errBox.innerText = "Email dan Password wajib diisi!"; errBox.style.display = 'block'; return; }
    try {
        document.getElementById('btn-auth').innerText = "Memproses...";
        if(window.isLoginMode) {
            await signInWithEmailAndPassword(auth, email, password);
        } else {
            if(!name) { errBox.innerText = "Nama wajib diisi!"; errBox.style.display = 'block'; return; }
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            await updateProfile(userCredential.user, { displayName: name }); 
            window.location.reload();
        }
    } catch (error) { 
        document.getElementById('btn-auth').innerText = window.isLoginMode ? 'Masuk' : 'Daftar'; 
        errBox.innerText = "Gagal: Akun salah / belum terdaftar."; 
        errBox.style.display = 'block'; 
    }
};

window.logoutApp = function() { 
    window.customConfirm("Keluar Akun", "Yakin ingin keluar dari akun ini?", () => { signOut(auth); }); 
};

// ==========================================
// 5. DATABASE LOAD, SAVE & AUTO-RECOVERY
// ==========================================
window.getUserDocPayload = function() {
    return {
        wallets: window.wallets,
        categories: window.categories,
        targets: window.targets,
        notifications: window.notifications,
        seenBroadcastIds: window.seenBroadcastIds,
        pushedBroadcastIds: window.pushedBroadcastIds,
        calcPortfolio: window.calcPortfolio,
        calcHistory: window.calcHistory,
        kmRecords: window.kmRecords,
        vehicleSettings: window.vehicleSettings,
        zones: window.zones
    };
};

window.recalculateBalances = function() {
    let computedBalances = {}; 
    window.wallets.forEach(w => computedBalances[w.id] = 0);
    window.transactions.forEach(trx => {
        if (trx.type === 'in' && computedBalances[trx.walletId] !== undefined) computedBalances[trx.walletId] += Number(trx.amount || 0);
        else if (trx.type === 'out' && computedBalances[trx.walletId] !== undefined) computedBalances[trx.walletId] -= Number(trx.amount || 0);
        else if (trx.type === 'transfer') {
            if (computedBalances[trx.walletId] !== undefined) computedBalances[trx.walletId] -= Number(trx.amount || 0);
            if (trx.targetWalletId && computedBalances[trx.targetWalletId] !== undefined) computedBalances[trx.targetWalletId] += Number(trx.amount || 0);
        }
    });
    window.wallets.forEach(w => w.balance = computedBalances[w.id] !== undefined ? computedBalances[w.id] : 0);
};

// Hanya berjalan otomatis jika ada dompet/kategori yang hilang
window.recoverDataFromTransactions = function() {
    if (!Array.isArray(window.transactions) || window.transactions.length === 0) return false;
    let adaYangDipulihkan = false;

    const existingWalletIds = new Set(window.wallets.map(w => String(w.id)));
    const usedWalletIds = new Set();
    const missingWalletsMap = new Map();

    window.transactions.forEach(trx => {
        if (trx.walletId) {
            const wId = String(trx.walletId);
            usedWalletIds.add(wId);
            if (!existingWalletIds.has(wId) && trx.walletName && !missingWalletsMap.has(wId)) {
                missingWalletsMap.set(wId, trx.walletName);
            }
        }
        if (trx.targetWalletId) {
            const twId = String(trx.targetWalletId);
            usedWalletIds.add(twId);
            if (!existingWalletIds.has(twId) && trx.targetWalletName && !missingWalletsMap.has(twId)) {
                missingWalletsMap.set(twId, trx.targetWalletName);
            }
        }
    });

    missingWalletsMap.forEach((wName, wId) => {
        const unusedSameNameIdx = window.wallets.findIndex(
            w => (w.name || '').trim().toLowerCase() === (wName || '').trim().toLowerCase() && !usedWalletIds.has(String(w.id))
        );

        if (unusedSameNameIdx !== -1) {
            window.wallets[unusedSameNameIdx].id = wId;
            usedWalletIds.add(wId);
            existingWalletIds.add(wId);
            adaYangDipulihkan = true;
        } else {
            const lower = (wName || '').toLowerCase();
            let type = 'cash';
            if (lower.includes('bank') || lower.includes('bca') || lower.includes('bri') || lower.includes('mandiri') || lower.includes('bni') || lower.includes('bsi') || lower.includes('seabank') || lower.includes('jago')) {
                type = 'bank';
            } else if (lower.includes('gopay') || lower.includes('ovo') || lower.includes('dana') || lower.includes('shopee') || lower.includes('grab') || lower.includes('dompet') || lower.includes('linkaja')) {
                type = 'ewallet';
            }
            const icon = type === 'bank' ? "account_balance" : (type === 'ewallet' ? "account_balance_wallet" : "payments");
            const colorClass = type === 'bank' ? "icon-bank" : (type === 'ewallet' ? "icon-ewallet" : "icon-cash");

            window.wallets.push({
                id: wId,
                name: wName || "Dompet",
                type: type,
                balance: 0,
                icon: icon,
                colorClass: colorClass,
                isArchived: false
            });
            usedWalletIds.add(wId);
            existingWalletIds.add(wId);
            adaYangDipulihkan = true;
        }
    });

    const existingCatIds = new Set(window.categories.map(c => String(c.id)));
    window.transactions.forEach(trx => {
        if (!trx.categoryId || String(trx.categoryId) === '999' || trx.type === 'transfer') return;
        const cId = String(trx.categoryId);
        if (!existingCatIds.has(cId)) {
            const cName = trx.categoryName || (trx.type === 'in' ? 'Pemasukan' : 'Pengeluaran');
            const cType = trx.type === 'in' ? 'in' : 'out';
            const lowerC = cName.toLowerCase();
            let icon = cType === 'in' ? 'payments' : 'category';
            let color = cType === 'in' ? '#2e7d32' : '#ef6c00';
            if (lowerC.includes('makan') || lowerC.includes('minum') || lowerC.includes('kopi')) { icon = 'restaurant'; color = '#ef6c00'; }
            else if (lowerC.includes('bensin') || lowerC.includes('bbm')) { icon = 'local_gas_station'; color = '#e11d48'; }
            else if (lowerC.includes('servis') || lowerC.includes('oli') || lowerC.includes('motor')) { icon = 'build'; color = '#4338ca'; }

            window.categories.push({ id: trx.categoryId, type: cType, name: cName, budget: 0, icon, color });
            existingCatIds.add(cId);
            adaYangDipulihkan = true;
        }
    });

    if (!existingCatIds.has('999')) {
        window.categories.push({ id: 999, type: 'sys', name: "Penyesuaian Sistem", budget: 0, icon: "sync", color: "#78909c" });
        adaYangDipulihkan = true;
    }

    const existingTargetIds = new Set(window.targets.map(t => String(t.id)));
    const targetGroup = {};
    window.transactions.forEach(trx => {
        if (!trx.targetId || existingTargetIds.has(String(trx.targetId))) return;
        const tId = String(trx.targetId);
        if (!targetGroup[tId]) {
            targetGroup[tId] = { id: trx.targetId, name: "Target Tabungan", tipe: "biasa", currentAmount: 0, nilaiTerkini: 0 };
        }
        if (trx.note) {
            const cleanedName = trx.note.replace(/^(Setor\/Top Up:|Jual\/Tarik:|Tarik Tabungan:)\s*/i, '').trim();
            if (cleanedName) targetGroup[tId].name = cleanedName;
        }
        const nLower = (targetGroup[tId].name || '').toLowerCase();
        if (trx.categoryName === 'Pencairan Investasi' || (trx.note && trx.note.includes('Top Up')) || nLower.includes('reksadana') || nLower.includes('saham') || nLower.includes('bibit') || nLower.includes('invest') || nLower.includes('kripto') || nLower.includes('emas')) {
            targetGroup[tId].tipe = 'investasi';
        }
        const amt = Number(trx.amount || 0);
        if (trx.type === 'out') {
            targetGroup[tId].currentAmount += amt;
            targetGroup[tId].nilaiTerkini += amt;
        } else if (trx.type === 'in') {
            const deduct = trx.modalDeducted !== undefined ? Number(trx.modalDeducted || 0) : amt;
            targetGroup[tId].currentAmount = Math.max(0, targetGroup[tId].currentAmount - deduct);
            targetGroup[tId].nilaiTerkini = Math.max(0, targetGroup[tId].nilaiTerkini - amt);
        }
    });

    Object.values(targetGroup).forEach(recT => {
        if (recT.currentAmount > 0 || recT.nilaiTerkini > 0) {
            window.targets.push({
                id: recT.id,
                tipe: recT.tipe,
                name: recT.name,
                targetAmount: 0,
                currentAmount: recT.currentAmount,
                nilaiTerkini: recT.nilaiTerkini,
                deadline: '',
                isActive: true
            });
            adaYangDipulihkan = true;
        }
    });

    return adaYangDipulihkan;
};

window.saveDataToFirestore = async function() { 
    window.callPageRender(); 
    if (!window.currentUserId || !window.isUserDataLoaded) return; 
    try { 
        await setDoc(doc(db, "users", window.currentUserId), window.getUserDocPayload(), { merge: true }); 
    } catch (e) { 
        console.warn("Save to cloud failed:", e); 
    }
};

window.saveDataToFirestoreSilently = async function() { 
    if (!window.currentUserId || !window.isUserDataLoaded) return; 
    try { 
        await setDoc(doc(db, "users", window.currentUserId), window.getUserDocPayload(), { merge: true }); 
    } catch (e) { console.warn("Silent save failed:", e.message); } 
};

window.saveTransactionToDB = async function(trxData) {
    if(!window.currentUserId) throw new Error("No user ID");
    await setDoc(doc(db, "users", window.currentUserId, "transactions", trxData.id.toString()), trxData);
};

window.deleteTransactionFromDB = async function(trxId) {
    if(!window.currentUserId) throw new Error("No user ID");
    await deleteDoc(doc(db, "users", window.currentUserId, "transactions", trxId.toString()));
};

export function initAuthListener() {
    window.injectImportButtonUI();
    window.updateNotifStatusUI();
    if (!auth) return;
    onAuthStateChanged(auth, async (user) => {
        const navBottom = document.getElementById('bottom-navigation');
        if (user) {
            window.currentUserId = user.uid; 
            window.isUserDataLoaded = false;

            const displayName = window.escapeHTML(user.displayName || "Pengguna");
            if(document.getElementById('user-name')) document.getElementById('user-name').innerText = displayName; 
            if(document.getElementById('profile-name-text')) document.getElementById('profile-name-text').innerText = displayName;
            if(document.getElementById('profile-email-text')) document.getElementById('profile-email-text').innerText = window.escapeHTML(user.email); 
            if(navBottom) navBottom.classList.add('show'); 
            
            const urlParams = new URLSearchParams(window.location.search);
            const activeTab = urlParams.get('tab');
            if (activeTab === 'akun' && window.switchTab) window.switchTab('page-akun', 3);
            else if (window.switchTab && document.getElementById('page-dashboard')) window.switchTab('page-dashboard', 0);
            
            try { 
                const docRef = doc(db, "users", window.currentUserId); 
                const docSnap = await getDoc(docRef);
                let isNewUser = true;

                if (docSnap.exists()) {
                    isNewUser = false;
                    const data = docSnap.data();
                    window.wallets = Array.isArray(data.wallets) ? data.wallets : []; 
                    window.categories = Array.isArray(data.categories) ? data.categories : []; 
                    window.targets = Array.isArray(data.targets) ? data.targets : [];
                    window.notifications = Array.isArray(data.notifications) ? data.notifications : [{ id: window.generateUUID(), title: "Selamat Datang!", body: "Mulai catat keuanganmu hari ini.", date: window.getLocalDateString(), read: false }];
                    window.seenBroadcastIds = Array.isArray(data.seenBroadcastIds) ? data.seenBroadcastIds : [];
                    window.pushedBroadcastIds = Array.isArray(data.pushedBroadcastIds) ? data.pushedBroadcastIds : [];
                    window.calcPortfolio = Array.isArray(data.calcPortfolio) ? data.calcPortfolio : [];
                    window.calcHistory = Array.isArray(data.calcHistory) ? data.calcHistory : [];
                    window.kmRecords = Array.isArray(data.kmRecords) ? data.kmRecords : []; 
                    window.vehicleSettings = data.vehicleSettings || { accumulatedKmForOil: 0, activeTrip: null };
                    window.zones = Array.isArray(data.zones) ? data.zones : [];
                } 
                
                // Buka halaman SECARA INSTAN tanpa menunggu ratusan transaksi selesai diunduh
                window.callPageRender(); 
                
                if (urlParams.get('action') === 'baru' && window.openTargetModal) { setTimeout(window.openTargetModal, 400); }
                else if (urlParams.get('action') === 'setor' && urlParams.get('id') && window.openActionModal) { setTimeout(() => window.openActionModal(urlParams.get('id'), 'setor'), 400); }

                // Muat transaksi secara paralel di latar belakang (Non-Blocking)
                getDocs(collection(db, "users", window.currentUserId, "transactions"))
                    .then(async (trxSnapshot) => {
                        window.transactions = [];
                        trxSnapshot.forEach((docTrx) => {
                            window.transactions.push(docTrx.data());
                        });

                        const recovered = window.recoverDataFromTransactions();
                        let needInitialSave = recovered || isNewUser;

                        if (!window.wallets || window.wallets.length === 0) {
                            window.wallets = [{ id: window.generateUUID(), name: "Uang Tunai", type: "cash", balance: 0, icon: "payments", colorClass: "icon-cash", isArchived: false }];
                            needInitialSave = true;
                        }
                        if (!window.categories || window.categories.length === 0) {
                            window.categories = [ 
                                { id: 1, type: 'out', name: "Makanan & Minuman", budget: 1500000, icon: "restaurant", color: "#ef6c00" }, 
                                { id: 2, type: 'in', name: "Pemasukan", budget: 0, icon: "payments", color: "#2e7d32" }, 
                                { id: 999, type: 'sys', name: "Penyesuaian Sistem", budget: 0, icon: "sync", color: "#78909c" } 
                            ];
                            needInitialSave = true;
                        }

                        window.recalculateBalances(); 
                        window.isUserDataLoaded = true;

                        if (needInitialSave) {
                            await window.saveDataToFirestore();
                        } else {
                            window.callPageRender();
                        }
                    })
                    .catch((err) => console.error("Gagal muat transaksi:", err));

            } catch (error) { 
                console.error("Data load failed:", error); 
                window.sembunyikanLoading(); 
                window.customAlert("Error", "Gagal memuat data", "error");
            }
        } else {
            window.currentUserId = null; 
            window.isUserDataLoaded = false;
            window.wallets = []; window.categories = []; window.transactions = []; window.targets = []; window.notifications = []; window.zones = [];
            window.seenBroadcastIds = []; window.pushedBroadcastIds = []; window.calcPortfolio = []; window.calcHistory = [];
            if(navBottom) navBottom.classList.remove('show'); 
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            if(document.getElementById('page-login')) document.getElementById('page-login').classList.add('active');
            window.sembunyikanLoading();
        }
    });
}

// ==========================================
// 6. REGISTRASI SERVICE WORKER & NOTIFIKASI FIREBASE
// ==========================================
window.swRegistration = null;

window.updateNotifStatusUI = function() {
    const statusText = document.getElementById('notif-status-text');
    const chevron = document.getElementById('notif-chevron');
    if (!statusText || !chevron) return;

    if (!('Notification' in window)) {
        statusText.innerText = "Notifikasi Tidak Didukung";
        chevron.innerText = "block";
        chevron.style.color = "#94a3b8";
        return;
    }

    if (Notification.permission === 'granted') {
        statusText.innerText = "Notifikasi Firebase Aktif";
        chevron.innerText = "toggle_on";
        chevron.style.color = "#249a95";
        chevron.style.fontSize = "28px";
    } else if (Notification.permission === 'denied') {
        statusText.innerText = "Notifikasi Diblokir Browser";
        chevron.innerText = "toggle_off";
        chevron.style.color = "#c62828";
        chevron.style.fontSize = "26px";
    } else {
        statusText.innerText = "Izinkan Notifikasi Firebase";
        chevron.innerText = "toggle_off";
        chevron.style.color = "#b0bec5";
        chevron.style.fontSize = "26px";
    }
};

window.toggleFirebaseNotification = async function() {
    if (!('Notification' in window)) {
        return window.customAlert("Tidak Didukung", "Browser di perangkat Anda tidak mendukung fitur notifikasi.", "warning");
    }

    if (Notification.permission === 'granted') {
        window.updateNotifStatusUI();
        return window.customAlert("Sudah Aktif", "Notifikasi Firebase sudah aktif di perangkat ini.");
    }

    if (Notification.permission === 'denied') {
        return window.customAlert("Izin Diblokir", "Izin notifikasi sebelumnya ditolak. Silakan aktifkan kembali melalui Pengaturan Situs.", "warning");
    }

    try {
        const permission = await Notification.requestPermission();
        window.updateNotifStatusUI();
        if (permission === 'granted') {
            if (messaging && window.swRegistration) {
                try {
                    const currentToken = await getToken(messaging, {
                        vapidKey: "MASUKKAN_VAPID_KEY_FIREBASE_KAMU_DI_SINI",
                        serviceWorkerRegistration: window.swRegistration
                    });
                    if (currentToken && window.currentUserId) {
                        await setDoc(doc(db, "users", window.currentUserId), { fcmToken: currentToken }, { merge: true });
                    }
                } catch (tokenErr) {
                    console.warn("Info token FCM:", tokenErr);
                }
            }
            window.customAlert("Berhasil Diaktifkan!", "Notifikasi Firebase sekarang sudah aktif untuk akun Anda.");
        } else {
            window.customAlert("Tidak Diizinkan", "Anda belum mengizinkan akses notifikasi.", "warning");
        }
    } catch (e) {
        console.error("Gagal meminta izin notifikasi:", e);
        window.customAlert("Error", "Terjadi kesalahan saat mengaktifkan notifikasi.", "error");
    }
};

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(registration => {
                window.swRegistration = registration;
                window.updateNotifStatusUI();
            })
            .catch(err => {
                console.error('[PWA] Pendaftaran Service Worker gagal:', err);
            });
    });
}

// ==========================================
// 7. FITUR EKSPOR & IMPOR DATA JSON BACKUP
// ==========================================
window.injectImportButtonUI = function() {
    const exportItem = document.querySelector('.settings-item[onclick*="exportDataJSON"]');
    if (!exportItem || document.getElementById('item-import-json')) return;

    const importItem = document.createElement('div');
    importItem.className = 'settings-item';
    importItem.id = 'item-import-json';
    importItem.onclick = () => window.triggerImportJSON();
    importItem.innerHTML = `
        <div class="settings-icon" style="background:#e3f2fd; color:#1976d2;">
            <span class="material-icons-round">upload_file</span>
        </div>
        <div class="settings-text">Impor Data (Restore JSON)</div>
        <span class="material-icons-round settings-chevron">chevron_right</span>
    `;
    exportItem.insertAdjacentElement('afterend', importItem);

    if (!document.getElementById('input-file-import-json')) {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.id = 'input-file-import-json';
        fileInput.accept = '.json,application/json';
        fileInput.style.display = 'none';
        fileInput.onchange = (e) => window.handleImportFileChange(e);
        document.body.appendChild(fileInput);
    }
};

window.exportDataJSON = function() {
    if (!window.currentUserId) {
        return window.customAlert("Gagal", "Anda harus masuk ke akun terlebih dahulu untuk mengekspor data.", "error");
    }
    
    const dataBackup = {
        wallets: window.wallets || [],
        categories: window.categories || [],
        transactions: window.transactions || [],
        targets: window.targets || [],
        notifications: window.notifications || [],
        calcPortfolio: window.calcPortfolio || [],
        calcHistory: window.calcHistory || [],
        kmRecords: window.kmRecords || [],
        vehicleSettings: window.vehicleSettings || { accumulatedKmForOil: 0, activeTrip: null },
        zones: window.zones || [],
        exportDate: new Date().toISOString()
    };
    
    try {
        const jsonString = JSON.stringify(dataBackup, null, 2);
        const blob = new Blob([jsonString], { type: "application/json;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", url);
        downloadAnchorNode.setAttribute("download", "MoCatat_Backup_" + window.getLocalDateString() + ".json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        
        window.customAlert("Berhasil!", "Seluruh data Anda berhasil diekspor dan diunduh dalam format JSON.");
    } catch (err) {
        console.error("Export error:", err);
        window.customAlert("Gagal", "Terjadi kesalahan saat mengekspor file backup.", "error");
    }
};

window.triggerImportJSON = function() {
    if (!window.currentUserId) {
        return window.customAlert("Gagal", "Anda harus masuk ke akun terlebih dahulu untuk mengimpor data.", "error");
    }
    let fileInput = document.getElementById('input-file-import-json');
    if (!fileInput) {
        window.injectImportButtonUI();
        fileInput = document.getElementById('input-file-import-json');
    }
    if (fileInput) {
        fileInput.value = '';
        fileInput.click();
    }
};

window.handleImportFileChange = function(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const parsed = JSON.parse(e.target.result);
            if (!parsed || typeof parsed !== 'object' || (!Array.isArray(parsed.wallets) && !Array.isArray(parsed.transactions))) {
                return window.customAlert("File Tidak Valid", "Format file JSON tidak sesuai dengan struktur backup MoCatat.", "error");
            }

            const jmlTrx = Array.isArray(parsed.transactions) ? parsed.transactions.length : 0;
            const jmlDompet = Array.isArray(parsed.wallets) ? parsed.wallets.length : 0;

            window.customConfirm(
                "Pulihkan Data Backup?",
                `Ditemukan ${jmlDompet} Dompet dan ${jmlTrx} Transaksi. Data saat ini akan digantikan oleh data dari file backup. Lanjutkan?`,
                async () => {
                    await window.prosesRestoreDataJSON(parsed);
                }
            );
        } catch (err) {
            console.error("Gagal membaca JSON:", err);
            window.customAlert("Error", "File JSON rusak atau tidak dapat dibaca.", "error");
        }
    };
    reader.readAsText(file);
};

window.prosesRestoreDataJSON = async function(parsed) {
    if (!window.currentUserId) return;
    const loading = document.getElementById('loading-screen');
    if (loading) loading.classList.remove('hide');

    try {
        const existingSnap = await getDocs(collection(db, "users", window.currentUserId, "transactions"));
        const oldDocs = [];
        existingSnap.forEach(d => oldDocs.push(d.ref));

        const CHUNK_SIZE = 400;
        for (let i = 0; i < oldDocs.length; i += CHUNK_SIZE) {
            const chunk = oldDocs.slice(i, i + CHUNK_SIZE);
            const batch = writeBatch(db);
            chunk.forEach(ref => batch.delete(ref));
            await batch.commit();
        }

        window.wallets = Array.isArray(parsed.wallets) ? parsed.wallets : [];
        window.categories = Array.isArray(parsed.categories) ? parsed.categories : [];
        window.transactions = Array.isArray(parsed.transactions) ? parsed.transactions : [];
        window.targets = Array.isArray(parsed.targets) ? parsed.targets : [];
        window.notifications = Array.isArray(parsed.notifications) ? parsed.notifications : [];
        window.calcPortfolio = Array.isArray(parsed.calcPortfolio) ? parsed.calcPortfolio : [];
        window.calcHistory = Array.isArray(parsed.calcHistory) ? parsed.calcHistory : [];
        window.kmRecords = Array.isArray(parsed.kmRecords) ? parsed.kmRecords : [];
        window.vehicleSettings = parsed.vehicleSettings || { accumulatedKmForOil: 0, activeTrip: null };
        window.zones = Array.isArray(parsed.zones) ? parsed.zones : [];

        window.recoverDataFromTransactions();
        window.recalculateBalances();
        window.isUserDataLoaded = true;

        await setDoc(doc(db, "users", window.currentUserId), window.getUserDocPayload());

        for (let i = 0; i < window.transactions.length; i += CHUNK_SIZE) {
            const chunk = window.transactions.slice(i, i + CHUNK_SIZE);
            const batch = writeBatch(db);
            chunk.forEach(trx => {
                if (!trx.id) trx.id = window.generateUUID();
                const trxRef = doc(db, "users", window.currentUserId, "transactions", String(trx.id));
                batch.set(trxRef, trx);
            });
            await batch.commit();
        }

        window.callPageRender();
        window.customAlert("Berhasil Dipulihkan!", "Seluruh data backup JSON berhasil diimpor dan disinkronkan ke akun Cloud Anda.");
    } catch (err) {
        console.error("Restore failed:", err);
        window.sembunyikanLoading();
        window.customAlert("Gagal Impor", "Terjadi kesalahan saat menyimpan data backup ke database.", "error");
    }
};
