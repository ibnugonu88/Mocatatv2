// ============================================================
// MOCATAT - CORE MODULE (core.js)
// Firebase Config, Global State, Utilities, Auth, DB, PWA & Backup
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

    // Mengaktifkan Offline Persistence Firestore
    enableIndexedDbPersistence(db).catch((err) => {
        if (err.code == 'failed-precondition') {
            console.warn("Multiple tabs open, offline persistence can only be enabled in one tab at a time.");
        } else if (err.code == 'unimplemented') {
            console.warn("The current browser does not support all of the features required to enable persistence.");
        }
    });
    
    isSupported().then((supported) => {
        if (supported) {
            messaging = getMessaging(app);
            onMessage(messaging, (payload) => {
                const title = window.escapeHTML(payload?.notification?.title || "MoCatat");
                const body = window.escapeHTML(payload?.notification?.body || "Pesan baru");
                window.notifications.push({ id: crypto.randomUUID(), title, body, date: window.getLocalDateString(), read: false });
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
window.wallets = []; 
window.categories = []; 
window.transactions = []; 
window.targets = []; 
window.notifications = [];
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
// 5. DATABASE LOAD & SAVE
// ==========================================
window.getUserDocPayload = function() {
    return {
        wallets: window.wallets,
        categories: window.categories,
        targets: window.targets,
        notifications: window.notifications,
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

window.saveDataToFirestore = async function() { 
    // Langsung render tampilan di layar HP tanpa menunggu internet selesai
    window.callPageRender(); 
    if(!window.currentUserId) return; 
    try { 
        await setDoc(doc(db, "users", window.currentUserId), window.getUserDocPayload(), { merge: true }); 
    } catch (e) { 
        console.warn("Save to cloud delayed/failed:", e); 
    }
};

window.saveDataToFirestoreSilently = async function() { 
    if(!window.currentUserId) return; 
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
    if (!auth) return;
    onAuthStateChanged(auth, async (user) => {
        const navBottom = document.getElementById('bottom-navigation');
        if (user) {
            window.currentUserId = user.uid; 
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

                let localZones = [];
                try { localZones = JSON.parse(localStorage.getItem("mocatat_daerah_manual_v1")) || []; } catch(e) {}

                if (docSnap.exists()) {
                    isNewUser = false;
                    const data = docSnap.data();
                    window.wallets = data.wallets || []; 
                    window.categories = data.categories || []; 
                    window.targets = data.targets || [];
                    window.notifications = data.notifications || [{ id: window.generateUUID(), title: "Selamat Datang! 🎉", body: "Mulai catat keuanganmu hari ini.", date: window.getLocalDateString(), read: false }];
                    window.kmRecords = data.kmRecords || []; 
                    window.vehicleSettings = data.vehicleSettings || { accumulatedKmForOil: 0, activeTrip: null };
                    window.zones = (Array.isArray(data.zones) && data.zones.length > 0) ? data.zones : localZones;
                    try { localStorage.setItem("mocatat_daerah_manual_v1", JSON.stringify(window.zones)); } catch(e) {}

                    if (data.transactions && Array.isArray(data.transactions) && data.transactions.length > 0) {
                        const allOldTrx = data.transactions;
                        const CHUNK_SIZE = 450;
                        for (let i = 0; i < allOldTrx.length; i += CHUNK_SIZE) {
                            const chunk = allOldTrx.slice(i, i + CHUNK_SIZE);
                            const batch = writeBatch(db);
                            chunk.forEach(trx => {
                                const trxRef = doc(db, "users", window.currentUserId, "transactions", trx.id.toString());
                                batch.set(trxRef, trx);
                            });
                            await batch.commit();
                        }
                        await setDoc(docRef, { transactions: deleteField() }, { merge: true });
                    }
                } 
                
                if(isNewUser) {
                    window.wallets = [{ id: window.generateUUID(), name: "Uang Tunai", type: "cash", balance: 0, icon: "payments", colorClass: "icon-cash", isArchived: false }];
                    window.categories = [ 
                        { id: 1, type: 'out', name: "Makanan & Minuman", budget: 1500000, icon: "restaurant", color: "#ef6c00" }, 
                        { id: 2, type: 'in', name: "Pemasukan", budget: 0, icon: "payments", color: "#2e7d32" }, 
                        { id: 999, type: 'sys', name: "Penyesuaian Sistem", budget: 0, icon: "sync", color: "#78909c" } 
                    ];
                    window.targets = []; 
                    window.kmRecords = []; 
                    window.vehicleSettings = { accumulatedKmForOil: 0, activeTrip: null };
                    window.zones = localZones;
                    window.notifications = [{ id: window.generateUUID(), title: "Selamat Datang! 🎉", body: "Mulai catat keuanganmu hari ini.", date: window.getLocalDateString(), read: false }];
                    await window.saveDataToFirestore(); 
                }

                window.callPageRender(); 
                
                if (urlParams.get('action') === 'baru' && window.openTargetModal) { setTimeout(window.openTargetModal, 500); }
                else if (urlParams.get('action') === 'setor' && urlParams.get('id') && window.openActionModal) { setTimeout(() => window.openActionModal(urlParams.get('id'), 'setor'), 500); }

                getDocs(collection(db, "users", window.currentUserId, "transactions"))
                    .then((trxSnapshot) => {
                        window.transactions = [];
                        trxSnapshot.forEach((docTrx) => {
                            window.transactions.push(docTrx.data());
                        });
                        
                        window.recalculateBalances(); 
                        window.callPageRender(); 
                    })
                    .catch((err) => console.error("Gagal muat transaksi:", err));

            } catch (error) { 
                console.error("Data load failed:", error); 
                window.sembunyikanLoading(); 
                window.customAlert("Error", "Gagal memuat data", "error");
            }
        } else {
            window.currentUserId = null; 
            window.wallets = []; window.categories = []; window.transactions = []; window.targets = []; window.notifications = []; window.zones = [];
            if(navBottom) navBottom.classList.remove('show'); 
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            if(document.getElementById('page-login')) document.getElementById('page-login').classList.add('active');
            window.sembunyikanLoading();
        }
    });
}

// ==========================================
// 6. REGISTRASI SERVICE WORKER (PWA & FCM)
// ==========================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(registration => {
                console.log('[PWA] Service Worker terdaftar dengan scope:', registration.scope);
                
                if (messaging) {
                    getToken(messaging, { 
                        vapidKey: "MASUKKAN_VAPID_KEY_FIREBASE_KAMU_DI_SINI",
                        serviceWorkerRegistration: registration 
                    }).then(async (currentToken) => {
                        if (currentToken && window.currentUserId) {
                            console.log("Token FCM Siap, menyimpannya ke database...");
                            await setDoc(doc(db, "users", window.currentUserId), { fcmToken: currentToken }, { merge: true });
                        }
                    }).catch((err) => {
                        console.warn('Gagal mendapatkan token FCM:', err);
                    });
                }
            })
            .catch(err => {
                console.error('[PWA] Pendaftaran Service Worker gagal:', err);
            });
    });
}

// ==========================================
// 7. FITUR EKSPOR DATA JSON BACKUP
// ==========================================
window.exportDataJSON = function() {
    if (!window.currentUserId) {
        return window.customAlert("Gagal", "Anda harus masuk ke akun terlebih dahulu untuk mengekspor data.", "error");
    }
    
    const dataBackup = {
        wallets: window.wallets,
        categories: window.categories,
        transactions: window.transactions,
        targets: window.targets,
        kmRecords: window.kmRecords,
        vehicleSettings: window.vehicleSettings,
        zones: window.zones,
        exportDate: new Date().toISOString()
    };
    
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(dataBackup, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "MoCatat_Backup_" + window.getLocalDateString() + ".json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    
    window.customAlert("Berhasil!", "Seluruh data Anda berhasil diekspor dan diunduh dalam format JSON.");
};
