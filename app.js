// ============================================================
// MOCATAT - CENTRAL APP CONTROLLER (ULTIMATE AUDITED & FIXED)
// Firebase + Sub-Collection + Atomic Batch + UUID + Smart Analytics
// TERMASUK: Offline Persistence, Soft-Delete Dompet, Histori Ganti Oli, PWA, FCM
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

let app, auth, db, messaging;

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
window.wallets = []; window.categories = []; window.transactions = []; window.targets = []; window.notifications = [];
window.kmRecords = []; window.vehicleSettings = { accumulatedKmForOil: 0, activeTrip: null };
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
document.addEventListener('input', function(e) { if (e.target && e.target.classList.contains('format-rupiah')) e.target.value = window.formatNumberWithDot(e.target.value); });

window.sembunyikanLoading = () => { const loading = document.getElementById('loading-screen'); if (loading && !loading.classList.contains('hide')) loading.classList.add('hide'); };
window.closeModal = (modalId) => { const el = document.getElementById(modalId); if(el) el.classList.remove('show'); };

// ==========================================
// 3. DIALOGS & ALERTS
// ==========================================
window.customAlert = function(title, msg, type = 'info') {
    const overlay = document.getElementById('custom-dialog');
    if(!overlay) return alert(msg);
    document.getElementById('dialog-title').innerText = title; document.getElementById('dialog-msg').innerText = msg;
    const iconEl = document.getElementById('dialog-icon');
    if(iconEl) {
        if(type === 'warning' || type === 'error') { iconEl.className = 'custom-dialog-icon warning'; iconEl.innerHTML = '<span class="material-icons-round">warning_amber</span>'; } 
        else { iconEl.className = 'custom-dialog-icon'; iconEl.innerHTML = '<span class="material-icons-round">info</span>'; }
    }
    document.getElementById('dialog-actions').innerHTML = `<button class="btn-dialog primary" onclick="document.getElementById('custom-dialog').classList.remove('show')">Mengerti</button>`;
    overlay.classList.add('show');
};

window.customConfirm = function(title, msg, onConfirm) {
    const overlay = document.getElementById('custom-dialog');
    if(!overlay) { if(confirm(msg)) onConfirm(); return; }
    document.getElementById('dialog-title').innerText = title; document.getElementById('dialog-msg').innerText = msg;
    const iconEl = document.getElementById('dialog-icon'); 
    if(iconEl) { iconEl.className = 'custom-dialog-icon warning'; iconEl.innerHTML = '<span class="material-icons-round">help_outline</span>'; }
    document.getElementById('dialog-actions').innerHTML = `<button class="btn-dialog secondary" onclick="document.getElementById('custom-dialog').classList.remove('show')">Batal</button> <button class="btn-dialog danger" id="btn-dialog-confirm">Ya, Lanjutkan</button>`;
    document.getElementById('btn-dialog-confirm').onclick = function() { overlay.classList.remove('show'); onConfirm(); };
    overlay.classList.add('show');
};

// ==========================================
// 4. AUTHENTICATION LOGIC
// ==========================================
window.isLoginMode = true;
window.toggleAuthMode = function() {
    window.isLoginMode = !window.isLoginMode; document.getElementById('auth-error').style.display = 'none';
    document.getElementById('auth-name-group').style.display = window.isLoginMode ? 'none' : 'block';
    document.getElementById('auth-title').innerText = window.isLoginMode ? 'Masuk Akun' : 'Daftar Akun';
    document.getElementById('auth-desc').innerText = window.isLoginMode ? 'Kelola keuanganmu dari mana saja.' : 'Buat akun untuk memulai pencatatan.';
    document.getElementById('btn-auth').innerText = window.isLoginMode ? 'Masuk' : 'Daftar';
    document.getElementById('auth-toggle-text').innerHTML = window.isLoginMode ? 'Belum punya akun? <span onclick="window.toggleAuthMode()">Daftar di sini</span>' : 'Sudah punya akun? <span onclick="window.toggleAuthMode()">Masuk di sini</span>';
};

window.prosesAuth = async function() {
    const email = document.getElementById('auth-email').value, password = document.getElementById('auth-password').value, name = window.escapeHTML(document.getElementById('auth-name').value);
    const errBox = document.getElementById('auth-error');
    if(!email || !password) { errBox.innerText = "Email dan Password wajib diisi!"; errBox.style.display = 'block'; return; }
    try {
        document.getElementById('btn-auth').innerText = "Memproses...";
        if(window.isLoginMode) await signInWithEmailAndPassword(auth, email, password);
        else {
            if(!name) { errBox.innerText = "Nama wajib diisi!"; errBox.style.display = 'block'; return; }
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            await updateProfile(userCredential.user, { displayName: name }); window.location.reload();
        }
    } catch (error) { document.getElementById('btn-auth').innerText = window.isLoginMode ? 'Masuk' : 'Daftar'; errBox.innerText = "Gagal: Akun salah / belum terdaftar."; errBox.style.display = 'block'; }
};
window.logoutApp = function() { window.customConfirm("Keluar Akun", "Yakin ingin keluar dari akun ini?", () => { signOut(auth); }); };

// ==========================================
// 5. DATABASE LOAD & SAVE
// ==========================================
window.recalculateBalances = function() {
    let computedBalances = {}; window.wallets.forEach(w => computedBalances[w.id] = 0);
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
    if(!window.currentUserId) return; 
    try { 
        await setDoc(doc(db, "users", window.currentUserId), { 
            wallets: window.wallets, categories: window.categories, 
            targets: window.targets, notifications: window.notifications,
            kmRecords: window.kmRecords, vehicleSettings: window.vehicleSettings
        }, { merge: true }); 
        window.callPageRender(); 
    } catch (e) { throw e; }
};

window.saveDataToFirestoreSilently = async function() { 
    if(!window.currentUserId) return; 
    try { 
        await setDoc(doc(db, "users", window.currentUserId), { 
            wallets: window.wallets, categories: window.categories, 
            targets: window.targets, notifications: window.notifications,
            kmRecords: window.kmRecords, vehicleSettings: window.vehicleSettings
        }, { merge: true }); 
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

if (auth) {
    onAuthStateChanged(auth, async (user) => {
        const navBottom = document.getElementById('bottom-navigation');
        if (user) {
            window.currentUserId = user.uid; const displayName = window.escapeHTML(user.displayName || "Pengguna");
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
                    window.wallets = data.wallets || []; 
                    window.categories = data.categories || []; 
                    window.targets = data.targets || [];
                    window.notifications = data.notifications || [{ id: window.generateUUID(), title: "Selamat Datang! 🎉", body: "Mulai catat keuanganmu hari ini.", date: window.getLocalDateString(), read: false }];
                    window.kmRecords = data.kmRecords || []; 
                    window.vehicleSettings = data.vehicleSettings || { accumulatedKmForOil: 0, activeTrip: null };

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
                    window.categories = [ { id: 1, type: 'out', name: "Makanan & Minuman", budget: 1500000, icon: "restaurant", color: "#ef6c00" }, { id: 2, type: 'in', name: "Pemasukan", budget: 0, icon: "payments", color: "#2e7d32" }, { id: 999, type: 'sys', name: "Penyesuaian Sistem", budget: 0, icon: "sync", color: "#78909c" } ];
                    window.targets = []; window.kmRecords = []; window.vehicleSettings = { accumulatedKmForOil: 0, activeTrip: null };
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

            } catch (error) { console.error("Data load failed:", error); window.sembunyikanLoading(); window.customAlert("Error", "Gagal memuat data", "error");}
        } else {
            window.currentUserId = null; window.wallets = []; window.categories = []; window.transactions = []; window.targets = []; window.notifications = [];
            if(navBottom) navBottom.classList.remove('show'); 
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            if(document.getElementById('page-login')) document.getElementById('page-login').classList.add('active');
            window.sembunyikanLoading();
        }
    });
}

// ==========================================
// 6. ROUTER MANAGER
// ==========================================
window.callPageRender = function() {
    window.sembunyikanLoading();
    const path = window.location.pathname.toLowerCase();
    
    if (path.includes('riwayat.html') && typeof window.renderHistoryPage === 'function') window.renderHistoryPage();
    else if (path.includes('analitik.html') && typeof window.renderStatistik === 'function') window.renderStatistik();
    else if (path.includes('dompet.html') && typeof window.renderWalletPage === 'function') window.renderWalletPage();
    else if (path.includes('kategori.html') && typeof window.renderCategoryPage === 'function') window.renderCategoryPage();
    else if (path.includes('kendaraan.html') && typeof window.renderVehiclePage === 'function') window.renderVehiclePage();
    else if (path.includes('target.html') && typeof window.renderTargetPage === 'function') window.renderTargetPage();
    else if (typeof window.renderDashboard === 'function') window.renderDashboard(); 
}

// ==========================================
// 7. TRANSAKSI LOGIC
// ==========================================
window.selectTrxWallet = function(id, el) { document.getElementById('input-wallet').value = id; document.querySelectorAll('#input-wallet-chips .chip').forEach(c => c.classList.remove('active')); el.classList.add('active'); };
window.selectTrxCategory = function(id, el) { document.getElementById('input-category').value = id; document.querySelectorAll('#input-category-chips .chip').forEach(c => c.classList.remove('active')); el.classList.add('active'); };
window.selectTrxTargetWallet = function(id, el) { document.getElementById('input-target-wallet').value = id; document.querySelectorAll('#input-target-wallet-chips .chip').forEach(c => c.classList.remove('active')); el.classList.add('active'); };

window.selectGrabService = function(service, el) {
    const hiddenInput = document.getElementById('input-grab-service'); const noteInput = document.getElementById('input-note');
    if (hiddenInput.value === service) { hiddenInput.value = ''; el.classList.remove('grab-active'); if (noteInput.value === service) noteInput.value = ''; } 
    else { document.querySelectorAll('.grab-chip').forEach(c => c.classList.remove('grab-active')); el.classList.add('grab-active'); hiddenInput.value = service; if (noteInput.value === '' || ['GrabBike', 'GrabBike Hemat', 'GrabCar', 'GrabFood', 'GrabExpress', 'GrabMart'].includes(noteInput.value)) { noteInput.value = service; } }
};

window.openModalTrans = function(type, trxId = null) {
    if(!document.getElementById('modal-input')) return;
    const isTransfer = type === 'transfer'; document.getElementById('input-type').value = type; document.getElementById('modal-title').innerText = isTransfer ? 'Transfer Antar Dompet' : (type === 'in' ? (trxId?'Edit Pemasukan':'Pemasukan Baru') : (trxId?'Edit Pengeluaran':'Pengeluaran Baru'));
    document.getElementById('error-msg').style.display = 'none'; document.getElementById('input-trx-id').value = trxId || '';
    const catGroup = document.getElementById('category-group-container'), targetGroup = document.getElementById('target-wallet-group');
    if (isTransfer) { catGroup.style.display = 'none'; targetGroup.style.display = 'block'; } else { catGroup.style.display = 'block'; targetGroup.style.display = 'none'; }
    
    const grabGroup = document.getElementById('grab-service-group');
    if (type === 'in' && grabGroup) grabGroup.style.display = 'block'; else if(grabGroup) grabGroup.style.display = 'none';
    if(document.getElementById('input-grab-service')) document.getElementById('input-grab-service').value = '';
    document.querySelectorAll('.grab-chip').forEach(c => c.classList.remove('grab-active'));

    // --- SUGGESTION LOKASI OTOMATIS ---
    const dataList = document.getElementById('location-suggestions');
    if(dataList) {
        const uniqueLocs = [...new Set(window.transactions.map(t => t.location).filter(l => l && l.trim() !== ''))];
        let opts = '';
        uniqueLocs.forEach(loc => { opts += `<option value="${window.escapeHTML(loc)}"></option>`; });
        dataList.innerHTML = opts;
    }
    // ----------------------------------

    let now = new Date(); let defaultTime = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    
    const dompetAktif = window.wallets.filter(w => !w.isArchived);

    let defaultWalletId = dompetAktif.length > 0 ? dompetAktif[0].id : '', 
        targetWalletId = dompetAktif.length > 1 ? dompetAktif[1].id : defaultWalletId, 
        validCats = window.categories.filter(c => c.type === type && c.type !== 'sys'), 
        defaultCatId = validCats.length > 0 ? validCats[0].id : '', amount = '', note = '', trxDate = window.getLocalDateString(), trxTime = defaultTime, grabServiceVal = '', locationVal = '';
        
    if (trxId) { 
        const trx = window.transactions.find(t => t.id === trxId); 
        if (trx) { 
            amount = window.formatNumberWithDot(trx.amount.toString()); note = trx.note; defaultWalletId = trx.walletId; 
            if(trx.type === 'transfer') targetWalletId = trx.targetWalletId; else defaultCatId = trx.categoryId; 
            trxDate = trx.date || trxDate; if (trx.time) trxTime = trx.time;
            if(trx.grabService) grabServiceVal = trx.grabService; if(trx.location) locationVal = trx.location;
        } 
    }
    
    document.getElementById('input-amount').value = amount; document.getElementById('input-note').value = note; document.getElementById('input-date').value = trxDate; if(document.getElementById('input-time')) document.getElementById('input-time').value = trxTime; document.getElementById('input-wallet').value = defaultWalletId; if(document.getElementById('input-location')) document.getElementById('input-location').value = locationVal;
    if(!isTransfer) document.getElementById('input-category').value = defaultCatId; if(isTransfer) document.getElementById('input-target-wallet').value = targetWalletId;
    
    if (grabServiceVal && document.getElementById('input-grab-service')) {
        document.getElementById('input-grab-service').value = grabServiceVal;
        document.querySelectorAll('.grab-chip').forEach(c => { if (c.innerText.includes(grabServiceVal)) c.classList.add('grab-active'); });
    }

    const selectWallet = document.getElementById('input-wallet-chips'); let wHTML = ''; dompetAktif.forEach(w => { wHTML += `<div class="chip ${w.id == defaultWalletId ? 'active' : ''}" onclick="window.selectTrxWallet('${w.id}', this)"><span class="material-icons-round" style="font-size:16px">${w.icon}</span> ${window.escapeHTML(w.name)}</div>`; }); selectWallet.innerHTML = wHTML;
    if (isTransfer) { const selectTargetWallet = document.getElementById('input-target-wallet-chips'); let tHTML = ''; dompetAktif.forEach(w => { tHTML += `<div class="chip ${w.id == targetWalletId ? 'active' : ''}" onclick="window.selectTrxTargetWallet('${w.id}', this)"><span class="material-icons-round" style="font-size:16px">${w.icon}</span> ${window.escapeHTML(w.name)}</div>`; }); selectTargetWallet.innerHTML = tHTML; }
    else { const selectCat = document.getElementById('input-category-chips'); let cHTML = ''; validCats.forEach(c => { cHTML += `<div class="chip ${c.id == defaultCatId ? 'active' : ''}" onclick="window.selectTrxCategory('${c.id}', this)"><span class="material-icons-round" style="font-size:16px">${c.icon}</span> ${window.escapeHTML(c.name)}</div>`; }); selectCat.innerHTML = cHTML;}
    document.getElementById('modal-input').classList.add('show');
}
window.openModalTransfer = function() { 
    const dompetAktif = window.wallets.filter(w => !w.isArchived);
    if (dompetAktif.length < 2) return window.customAlert("Perhatian", "Butuh minimal 2 dompet aktif untuk melakukan transfer.", "warning"); 
    window.openModalTrans('transfer'); 
};

window.simpanTransaksi = async function() {
    const submitBtn = document.querySelector('#modal-input .btn-submit');
    if(submitBtn && submitBtn.disabled) return; 
    
    const errTrans = document.getElementById('error-msg'), trxId = document.getElementById('input-trx-id').value, type = document.getElementById('input-type').value, isTransfer = type === 'transfer', walletId = document.getElementById('input-wallet').value, catId = isTransfer ? null : document.getElementById('input-category').value, targetWalletId = isTransfer ? document.getElementById('input-target-wallet').value : null, amount = window.parseRupiah(document.getElementById('input-amount').value), note = window.escapeHTML(document.getElementById('input-note').value.trim()), trxDate = window.escapeHTML(document.getElementById('input-date').value) || window.getLocalDateString();
    const trxTime = document.getElementById('input-time') ? (document.getElementById('input-time').value || "12:00") : "12:00"; 
    const grabService = document.getElementById('input-grab-service') ? document.getElementById('input-grab-service').value : null;
    const locationVal = document.getElementById('input-location') ? window.escapeHTML(document.getElementById('input-location').value.trim()) : null; 

    if (!amount || amount <= 0 || !note || !walletId || (isTransfer && !targetWalletId) || (!isTransfer && !catId)) { errTrans.innerText = "Data tidak valid."; errTrans.style.display = 'block'; return; }
    if (isTransfer && walletId === targetWalletId) { errTrans.innerText = "Dompet tidak boleh sama!"; errTrans.style.display = 'block'; return; }
    
    const sourceWallet = window.wallets.find(w => String(w.id) === String(walletId)), targetWallet = isTransfer ? window.wallets.find(w => String(w.id) === String(targetWalletId)) : null, targetCat = isTransfer ? null : window.categories.find(c => String(c.id) === String(catId));
    
    let saldoTersedia = Number(sourceWallet.balance || 0);
    if (trxId) {
        const trxLama = window.transactions.find(t => String(t.id) === String(trxId));
        if (trxLama && String(trxLama.walletId) === String(walletId)) {
            if (trxLama.type === 'out' || trxLama.type === 'transfer') {
                saldoTersedia += Number(trxLama.amount || 0);
            }
        }
    }

    if ((type === 'out' || isTransfer) && amount > saldoTersedia) { 
        errTrans.innerHTML = `Saldo tidak cukup! (Sisa aktual: ${window.formatRupiah(saldoTersedia)})`; 
        errTrans.style.display = 'block'; 
        return; 
    }
    
    if(submitBtn) { submitBtn.disabled = true; submitBtn.innerText = "Menyimpan..."; }

    const originalTransactions = JSON.parse(JSON.stringify(window.transactions));
    let parsedTrxId = trxId ? String(trxId) : window.generateUUID();

    if (trxId) { const idx = window.transactions.findIndex(t => String(t.id) === String(trxId)); if (idx !== -1) window.transactions.splice(idx, 1); }
    
    const newTrxData = { id: parsedTrxId, type, amount, note, walletId, walletName: sourceWallet.name, categoryId: catId, categoryName: targetCat ? targetCat.name : (isTransfer ? 'Transfer' : '-'), targetWalletId: targetWalletId, targetWalletName: targetWallet ? targetWallet.name : null, date: trxDate, time: trxTime, grabService: type === 'in' && grabService ? grabService : null, location: locationVal ? locationVal : null };
    
    window.transactions.push(newTrxData);
    window.recalculateBalances(); 

    try {
        if(window.currentUserId) {
            const batch = writeBatch(db);
            const trxRef = doc(db, "users", window.currentUserId, "transactions", parsedTrxId);
            batch.set(trxRef, newTrxData);
            if(trxId && String(trxId) !== parsedTrxId) {
                batch.delete(doc(db, "users", window.currentUserId, "transactions", String(trxId)));
            }
            const userRef = doc(db, "users", window.currentUserId);
            batch.set(userRef, { wallets: window.wallets, categories: window.categories, targets: window.targets, notifications: window.notifications, kmRecords: window.kmRecords, vehicleSettings: window.vehicleSettings }, { merge: true });
            
            await batch.commit();
        }
        window.closeModal('modal-input');
        window.callPageRender();
    } catch(e) {
        window.transactions = originalTransactions; window.recalculateBalances();
        window.customAlert("Error", "Gagal menyimpan transaksi.", "error");
    } finally {
        if(submitBtn) { submitBtn.disabled = false; submitBtn.innerText = "Simpan Transaksi"; }
    }
};

window.hapusTransaksi = function(id) { 
    window.customConfirm("Hapus Transaksi", "Yakin hapus transaksi ini?", async () => { 
        const trxIndex = window.transactions.findIndex(t => String(t.id) === String(id)); 
        if(trxIndex === -1) return; const trx = window.transactions[trxIndex]; 
        
        if(trx.targetId) { 
            const relatedTarget = window.targets.find(t => String(t.id) === String(trx.targetId)); 
            if(relatedTarget) { 
                if(trx.type === 'out') { relatedTarget.currentAmount -= Number(trx.amount||0); if(relatedTarget.tipe === 'investasi') relatedTarget.nilaiTerkini -= Number(trx.amount||0); if(relatedTarget.currentAmount < 0) relatedTarget.currentAmount = 0; if(relatedTarget.nilaiTerkini < 0) relatedTarget.nilaiTerkini = 0; } 
                else if (trx.type === 'in') { let modalKembali = trx.modalDeducted !== undefined ? Number(trx.modalDeducted||0) : Number(trx.amount||0); relatedTarget.currentAmount += modalKembali; if(relatedTarget.tipe === 'investasi') { relatedTarget.nilaiTerkini += Number(trx.amount||0); } }
            } 
        } 
        
        window.transactions.splice(trxIndex, 1); 
        window.recalculateBalances(); 
        
        if(window.currentUserId) {
            try {
                const batch = writeBatch(db);
                batch.delete(doc(db, "users", window.currentUserId, "transactions", String(id)));
                batch.set(doc(db, "users", window.currentUserId), { wallets: window.wallets, categories: window.categories, targets: window.targets, notifications: window.notifications, kmRecords: window.kmRecords, vehicleSettings: window.vehicleSettings }, { merge: true });
                await batch.commit();
                window.callPageRender();
            } catch(e) { window.customAlert("Error", "Gagal hapus data dari cloud.", "error"); }
        }
    }); 
};

// ==========================================
// 8. DASHBOARD LOGIC
// ==========================================
window.switchTab = function(pageId, navIndex) {
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    if(navIndex !== null && navIndex !== undefined) { document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active')); const items = document.querySelectorAll('.nav-item'); if(items[navIndex]) items[navIndex].classList.add('active'); }
    const tgt = document.getElementById(pageId); if(tgt) tgt.classList.add('active'); window.scrollTo(0, 0);
}

window.bukaNotifikasi = function() { window.switchTab('page-notifikasi', null); let adaYangDiubah = false; window.notifications.forEach(n => { if (!n.read) { n.read = true; adaYangDiubah = true; } }); if (adaYangDiubah) { window.renderNotifications(); window.saveDataToFirestoreSilently(); } };

window.renderNotifications = function() {
    const container = document.getElementById('notif-page-container'); const badge = document.getElementById('notif-badge');
    if(!container) return; let unreadCount = 0; let html = '';
    if (window.notifications.length === 0) { container.innerHTML = `<div class="empty-state"><div class="icon-wrapper"><span class="material-icons-round">notifications_off</span></div><h4>Belum ada notifikasi</h4></div>`; if(badge) badge.style.display = 'none'; return; }
    const sorted = [...window.notifications].sort((a,b) => new Date(b.date||'1970-01-01') - new Date(a.date||'1970-01-01'));
    sorted.forEach(notif => {
        if (!notif.read) unreadCount++; const bg = notif.read ? 'white' : '#e0f2f1';
        html += `<div style="background: ${bg}; padding: 16px; border-radius: 16px; margin-bottom: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.02);"><div style="font-size: 14px; font-weight: 800; margin-bottom: 4px;">${window.escapeHTML(notif.title)}</div><div style="font-size: 12.5px; color: #555; margin-bottom: 8px;">${window.escapeHTML(notif.body)}</div><div style="font-size: 10.5px; color: #94a3b8; font-weight: 700;">${window.escapeHTML(notif.date)}</div></div>`;
    });
    container.innerHTML = html; if(badge) badge.style.display = unreadCount > 0 ? 'block' : 'none';
};

window.renderDashboard = function() {
    const walletContainer = document.getElementById('wallet-container'); if(!walletContainer) return;
    window.renderNotifications(); 
    let totalSaldo = 0; let wHTML = '';
    
    window.wallets.forEach(wallet => { totalSaldo += Number(wallet.balance||0); });
    
    let totalAset = 0;
    window.targets.forEach(t => {
        let val = t.tipe === 'investasi' ? Number(t.nilaiTerkini || t.currentAmount || 0) : Number(t.currentAmount || 0);
        totalAset += val;
    });

    let kekayaanBersih = totalSaldo + totalAset;
    
    const dompetAktif = window.wallets.filter(w => !w.isArchived);
    dompetAktif.forEach(wallet => { wHTML += `<div class="wallet-card"><div class="wallet-name"><span class="material-icons-round ${wallet.colorClass}">${wallet.icon}</span> ${window.escapeHTML(wallet.name)}</div><div class="wallet-saldo">${window.formatRupiah(wallet.balance)}</div></div>`; });
    walletContainer.innerHTML = wHTML; 
    
    if(document.getElementById('net-worth')) document.getElementById('net-worth').innerText = window.formatRupiah(kekayaanBersih);
    if(document.getElementById('total-balance')) document.getElementById('total-balance').innerText = window.formatRupiah(totalSaldo);
    if(document.getElementById('total-asset')) document.getElementById('total-asset').innerText = window.formatRupiah(totalAset);

    const allocationCard = document.getElementById('smart-allocation-card');
    if (allocationCard) {
        if (totalSaldo > 50000) { 
            allocationCard.style.display = 'block'; const todayStr = window.getLocalDateString();
            const sudahNabung = window.transactions.some(t => t.date === todayStr && String(t.categoryId) === '999' && t.type === 'out' && t.categoryName === 'Alokasi Target');
            const btnTarget = document.getElementById('btn-masuk-target'); const btnReward = document.getElementById('btn-self-reward'); const teksSaran = document.getElementById('teks-saran-alokasi'); const judulSaran = document.getElementById('judul-saran-alokasi');
            if (sudahNabung) {
                judulSaran.innerText = "Target Harian Selesai! 🎉"; judulSaran.style.color = "#2e7d32"; allocationCard.style.background = "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)"; allocationCard.style.border = "1px solid #86efac"; allocationCard.querySelector('.material-icons-round').parentNode.style.background = "#bbf7d0"; allocationCard.querySelector('.material-icons-round').parentNode.style.color = "#16a34a"; allocationCard.querySelector('.material-icons-round').innerText = "task_alt";
                teksSaran.innerHTML = `Kewajiban nabung hari ini sudah beres. Sisa uang cair <strong style="color: #16a34a;">${window.formatRupiah(totalSaldo)}</strong> bebas kamu pakai buat jajan!`;
                if(btnTarget) btnTarget.style.display = 'none'; if(btnReward) { btnReward.style.background = '#16a34a'; btnReward.style.color = 'white'; btnReward.innerText = "Nikmati Self-Reward ☕"; btnReward.onclick = () => window.customAlert('Enjoy! 🎉', 'Silakan pakai uang sisanya buat santai hari ini!'); }
            } else {
                judulSaran.innerText = "Saran Alokasi Sisa Uang"; judulSaran.style.color = "#f57f17"; allocationCard.style.background = "linear-gradient(135deg, #fffde7 0%, #fff9c4 100%)"; allocationCard.style.border = "1px solid #ffee58"; allocationCard.querySelector('.material-icons-round').parentNode.style.background = "#fff59d"; allocationCard.querySelector('.material-icons-round').parentNode.style.color = "#f57f17"; allocationCard.querySelector('.material-icons-round').innerText = "lightbulb";
                const saranNominal = Math.floor(totalSaldo * 0.2); let activeTargets = window.targets.filter(t => Number(t.currentAmount||0) < Number(t.targetAmount||0)); activeTargets.sort((a, b) => new Date(a.deadline||'2099-01-01') - new Date(b.deadline||'2099-01-01'));
                let saranTargetText = "";
                if (activeTargets.length > 0) { saranTargetText = `Amankan 20% (<strong>${window.formatRupiah(saranNominal)}</strong>) ke target <strong>${window.escapeHTML(activeTargets[0].name)}</strong>!`; if(btnTarget) btnTarget.innerText = "Setor Tabungan"; } else { saranTargetText = `Amankan 20% (<strong>${window.formatRupiah(saranNominal)}</strong>) buat target impianmu!`; if(btnTarget) btnTarget.innerText = "Buat Target Baru"; }
                teksSaran.innerHTML = `Kamu punya saldo cair <strong style="color: #1a1a1a;">${window.formatRupiah(totalSaldo)}</strong>. ${saranTargetText}`;
                if(btnTarget) { btnTarget.style.display = 'block'; btnTarget.style.background = 'white'; btnTarget.style.border = '1.5px solid #fbc02d'; btnTarget.style.color = '#f57f17'; btnTarget.onclick = function() { if (activeTargets.length > 0) { window.location.href = `target.html?action=setor&id=${activeTargets[0].id}`; } else { window.location.href = `target.html?action=baru`; } }; }
                if(btnReward) { btnReward.style.background = '#ffe0b2'; btnReward.style.color = '#ef6c00'; btnReward.innerText = "Self Reward"; btnReward.onclick = () => window.customAlert('Akses Ditolak!', 'Nabung dulu sebelum jajan! 🛑', 'warning'); }
            }
        } else { allocationCard.style.display = 'none'; }
    }

    const historyContainer = document.getElementById('transaction-container');
    if (window.transactions.length === 0) historyContainer.innerHTML = `<div class="empty-state"><div class="icon-wrapper"><span class="material-icons-round">receipt_long</span></div><h4>Belum ada catatan</h4></div>`;
    else {
        const sortedTrx = [...window.transactions].sort((a,b) => {
            const dtA = new Date((a.date||'1970-01-01') + 'T' + (a.time||'00:00')).getTime();
            const dtB = new Date((b.date||'1970-01-01') + 'T' + (b.time||'00:00')).getTime();
            return dtB - dtA;
        });
        let dashHTML = '', lastDateDash = '';
        sortedTrx.slice(0, 5).forEach(trx => {
            if(trx.date !== lastDateDash) { dashHTML += `<div class="date-divider">${window.escapeHTML(trx.date)}</div>`; lastDateDash = trx.date; }
            dashHTML += generateTrxHTML(trx, false);
        }); historyContainer.innerHTML = dashHTML;
    }
}

function generateTrxHTML(trx, showActions = false) {
    const isIncome = trx.type === 'in', isTransfer = trx.type === 'transfer';
    const amountClass = isIncome ? 'amount-in' : (isTransfer ? 'amount-transfer' : 'amount-out'); const sign = isIncome ? '+' : (isTransfer ? '' : '-');
    const safeNote = window.escapeHTML(trx.note); const timeDisplay = trx.time ? ` • ${trx.time}` : '';
    const desc = isTransfer ? `${window.escapeHTML(trx.walletName)} ➔ ${window.escapeHTML(trx.targetWalletName)}${timeDisplay}` : `${window.escapeHTML(trx.walletName)} • ${window.escapeHTML(trx.categoryName || 'Transfer')}${timeDisplay}`;
    let grabBadge = trx.grabService ? `<span style="font-size: 10px; background: #00B14F; color: white; padding: 2px 6px; border-radius: 4px; margin-left: 6px; display:inline-block; white-space:nowrap;">${window.escapeHTML(trx.grabService)}</span>` : '';
    let locBadge = trx.location ? `<span style="font-size: 10px; background: #f1f5f9; color: #64748b; padding: 2px 6px; border-radius: 4px; margin-left: 6px; display:inline-block; white-space:nowrap;"><span class="material-icons-round" style="font-size: 10px; vertical-align: middle;">place</span> ${window.escapeHTML(trx.location)}</span>` : '';
    let actionHTML = (showActions && String(trx.categoryId) !== '999' && !isTransfer) ? `<div class="list-actions" style="margin-left: 15px;"><button class="btn-icon" style="padding:4px;" onclick="window.openModalTrans('${trx.type}', '${trx.id}')"><span class="material-icons-round" style="font-size:18px;">edit</span></button><button class="btn-icon delete" style="padding:4px;" onclick="window.hapusTransaksi('${trx.id}')"><span class="material-icons-round" style="font-size:18px;">delete</span></button></div>` : (showActions && isTransfer ? `<div class="list-actions" style="margin-left: 15px;"><button class="btn-icon delete" style="padding:4px;" onclick="window.hapusTransaksi('${trx.id}')"><span class="material-icons-round" style="font-size:18px;">delete</span></button></div>` : (showActions && String(trx.categoryId) === '999' ? `<div class="list-actions" style="margin-left: 15px;"><button class="btn-icon delete" style="padding:4px;" onclick="window.hapusTransaksi('${trx.id}')" title="Batalkan Setoran"><span class="material-icons-round" style="font-size:18px;">delete</span></button></div>` : ''));
    return `<div class="trx-item"><div class="trx-content"><div class="trx-info"><span class="trx-title" style="display:flex; align-items:center; flex-wrap:wrap;">${safeNote} ${grabBadge} ${locBadge}</span><span class="trx-date">${desc}</span></div><div class="trx-amount ${amountClass}">${sign}${window.formatRupiah(trx.amount)}</div></div>${actionHTML}</div>`;
}

// ==========================================
// 9. RIWAYAT LOGIC (riwayat.html)
// ==========================================
window.renderHistoryPage = function() {
    const container = document.getElementById('all-transaction-container'); if(!container) return;
    const filterPeriod = document.getElementById('filter-period').value; const filterType = document.getElementById('filter-type').value;
    
    let filtered = [...window.transactions].sort((a,b) => {
        const dtA = new Date((a.date||'1970-01-01') + 'T' + (a.time||'00:00')).getTime();
        const dtB = new Date((b.date||'1970-01-01') + 'T' + (b.time||'00:00')).getTime();
        return dtB - dtA;
    });

    if (filterType) filtered = filtered.filter(t => t.type === filterType);
    if (filterPeriod && filterPeriod !== 'all') {
        const now = new Date(), todayStr = window.getLocalDateString(), currentMonthStr = window.getLocalMonthString();
        if (filterPeriod === 'today') { filtered = filtered.filter(t => t.date === todayStr); } 
        else if (filterPeriod === 'week') { const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1)); startOfWeek.setHours(0,0,0,0); const endOfWeek = new Date(startOfWeek); endOfWeek.setDate(startOfWeek.getDate() + 6); endOfWeek.setHours(23,59,59,999); filtered = filtered.filter(t => { if (!t.date) return false; const tDate = new Date(t.date + 'T12:00:00'); return tDate >= startOfWeek && tDate <= endOfWeek; }); } 
        else if (filterPeriod === 'month') { filtered = filtered.filter(t => t.date && t.date.startsWith(currentMonthStr)); }
    }
    let totIn = 0, totOut = 0;
    filtered.forEach(trx => { if(String(trx.categoryId) !== '999') { if(trx.type === 'in') totIn += Number(trx.amount||0); if(trx.type === 'out') totOut += Number(trx.amount||0); } });
    if(document.getElementById('summary-in')) document.getElementById('summary-in').innerText = window.formatRupiah(totIn);
    if(document.getElementById('summary-out')) document.getElementById('summary-out').innerText = window.formatRupiah(totOut);

    if (filtered.length === 0) { container.innerHTML = `<div class="empty-state"><div class="icon-wrapper"><span class="material-icons-round">receipt_long</span></div><h4>Tidak ada transaksi</h4></div>`; } 
    else {
        let fullHTML = '', lastDateFull = '';
        filtered.forEach(trx => { if(trx.date !== lastDateFull) { fullHTML += `<div class="date-divider">${window.escapeHTML(trx.date)}</div>`; lastDateFull = trx.date; } fullHTML += generateTrxHTML(trx, true); }); 
        container.innerHTML = fullHTML;
    }
};

// ==========================================
// 10. ANALITIK LOGIC (analitik.html)
// ==========================================
window.renderStatistik = function() {
    const statContainer = document.getElementById('statistik-container'); if(!statContainer) return;
    const filterPeriod = document.getElementById('filter-stat-period') ? document.getElementById('filter-stat-period').value : 'month';
    const now = new Date(), todayStr = window.getLocalDateString(), currentMonthStr = window.getLocalMonthString();
    let startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1)); startOfWeek.setHours(0,0,0,0);
    let endOfWeek = new Date(startOfWeek); endOfWeek.setDate(startOfWeek.getDate() + 6); endOfWeek.setHours(23,59,59,999);
    let periodText = filterPeriod === 'today' ? 'Hari Ini' : (filterPeriod === 'week' ? 'Minggu Ini' : (filterPeriod === 'all' ? 'Semua Waktu' : 'Bulan Ini'));

    let totalIn = 0, totalOut = 0; let totalOrders = 0; let grabStats = {}; let locationStats = {}; let timeStats = { pagi: 0, siang: 0, sore: 0, malam: 0 }; 
    let expenseByCategoryObj = {}; 
    let serviceExpenses = 0; let serviceCount = 0;
    
    let minDateMs = null;
    let daysInPeriod = 1;
    if (filterPeriod === 'week') daysInPeriod = 7; 
    else if (filterPeriod === 'month') daysInPeriod = now.getDate(); 

    let totalKeluarBulanIni = 0; let totalMasukBulanIni = 0;
    
    if (filterPeriod === 'all' && window.transactions.length > 0) {
        window.transactions.forEach(t => { if(t.date) { const d = new Date(t.date).getTime(); if(!minDateMs || d < minDateMs) minDateMs = d; } });
        if(minDateMs) { const diff = now.getTime() - minDateMs; daysInPeriod = Math.max(1, Math.ceil(diff / (1000 * 3600 * 24))); }
    } else if (filterPeriod === 'today') { daysInPeriod = 1; }

    window.transactions.filter(trx => {
        if (String(trx.categoryId) === '999') return false; 
        if (trx.date && trx.date.startsWith(currentMonthStr)) { if (trx.type === 'out') totalKeluarBulanIni += Number(trx.amount||0); if (trx.type === 'in') totalMasukBulanIni += Number(trx.amount||0); }

        let isMatch = false;
        if (filterPeriod === 'all') isMatch = true; else if (filterPeriod === 'today') isMatch = trx.date === todayStr; else if (filterPeriod === 'week') { if (!trx.date) return false; const tDate = new Date(trx.date + 'T12:00:00'); isMatch = tDate >= startOfWeek && tDate <= endOfWeek; } else if (filterPeriod === 'month') isMatch = trx.date && trx.date.startsWith(currentMonthStr);
        if (isMatch) { 
            if (trx.type === 'out') {
                totalOut += Number(trx.amount||0); 
                let catKey = trx.categoryId ? String(trx.categoryId) : (trx.categoryName || 'Lainnya');
                expenseByCategoryObj[catKey] = (expenseByCategoryObj[catKey] || 0) + Number(trx.amount||0);
                
                let noteLower = trx.note ? trx.note.toLowerCase() : ''; let catLower = (trx.categoryName||'').toLowerCase();
                if (catLower.includes('servis') || catLower.includes('motor') || catLower.includes('kendaraan') || noteLower.includes('oli')) { serviceExpenses += Number(trx.amount||0); serviceCount++; }
            } 
            if (trx.type === 'in') {
                totalIn += Number(trx.amount||0); let timeStr = trx.time || "12:00"; let hour = parseInt(timeStr.split(':')[0]);
                if (hour >= 5 && hour <= 11) timeStats.pagi += Number(trx.amount||0); else if (hour >= 12 && hour <= 14) timeStats.siang += Number(trx.amount||0); else if (hour >= 15 && hour <= 18) timeStats.sore += Number(trx.amount||0); else timeStats.malam += Number(trx.amount||0);
                if (trx.grabService) { totalOrders++; grabStats[trx.grabService] = (grabStats[trx.grabService] || 0) + Number(trx.amount||0); }
                if (trx.location) { locationStats[trx.location] = (locationStats[trx.location] || 0) + Number(trx.amount||0); }
            }
        } 
        return isMatch;
    });

    const sisaHariBulanIni = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate() + 1;
    let totalAnggaranKeluar = 0; window.categories.forEach(c => { if(c.type === 'out') totalAnggaranKeluar += Number(c.budget||0); });
    let totalSaranNabungHarian = 0;
    window.targets.forEach(t => {
        let uangDihitung = t.tipe === 'investasi' ? Number(t.nilaiTerkini||0) : Number(t.currentAmount||0); let sisaUang = Number(t.targetAmount||0) - uangDihitung;
        if(Number(t.targetAmount||0) > 0 && sisaUang > 0 && t.deadline) { const today = new Date(); today.setHours(0, 0, 0, 0); const deadlineDate = new Date(t.deadline); deadlineDate.setHours(0, 0, 0, 0); const diffDays = Math.ceil((deadlineDate - today) / (1000 * 60 * 60 * 24)); if(diffDays > 0) { totalSaranNabungHarian += Math.ceil(sisaUang / diffDays); } }
    });
    let sisaAnggaran = totalAnggaranKeluar - totalKeluarBulanIni; if (sisaAnggaran < 0) sisaAnggaran = 0;
    const saranPengeluaranHarian = sisaHariBulanIni > 0 ? Math.floor(sisaAnggaran / sisaHariBulanIni) : 0;
    const saranPendapatanHarian = saranPengeluaranHarian + totalSaranNabungHarian;

    let saldoBersih = totalIn - totalOut; let avgPerDay = daysInPeriod > 0 ? Math.floor(totalIn / daysInPeriod) : totalIn; let avgPerOrder = totalOrders > 0 ? Math.floor(totalIn / totalOrders) : 0;
    let maxBar = totalIn + totalOut > 0 ? totalIn + totalOut : 1; let pctIn = (totalIn / maxBar) * 100; let pctOut = (totalOut / maxBar) * 100;

    let htmlContent = `<div class="stat-card" style="background: linear-gradient(135deg, #249a95 0%, #1e8580 100%); color: white; padding: 24px; position: relative; overflow: hidden; margin-bottom: 25px;"><div style="font-size: 11px; font-weight: 800; opacity: 0.9; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px;">Saldo Bersih · ${periodText}</div><div style="font-size: 36px; font-weight: 800; letter-spacing: -1px; margin-bottom: 12px; text-shadow: 0 4px 10px rgba(0,0,0,0.1);">${window.formatRupiah(saldoBersih)}</div><div style="display: inline-flex; align-items: center; gap: 6px; background: rgba(255,255,255,0.2); padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; margin-bottom: 20px;"><span class="material-icons-round" style="font-size: 14px;">receipt_long</span> ${totalOrders} Order Grab</div><div style="margin-bottom: 12px;"><div style="display: flex; height: 8px; border-radius: 4px; overflow: hidden; background: rgba(0,0,0,0.2);"><div style="width: ${pctIn}%; background: #6ee7b7;"></div><div style="width: ${pctOut}%; background: #fca5a5;"></div></div></div><div style="display: flex; flex-direction: column; gap: 8px;"><div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 600;"><span style="display: flex; align-items: center; gap: 6px;"><span style="width: 8px; height: 8px; background: #6ee7b7; border-radius: 50%;"></span> Uang masuk (kotor)</span><span style="font-weight: 800;">${window.formatRupiah(totalIn)}</span></div><div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 600;"><span style="display: flex; align-items: center; gap: 6px;"><span style="width: 8px; height: 8px; background: #fca5a5; border-radius: 50%;"></span> Keluar (pengeluaran)</span><span style="font-weight: 800;">${window.formatRupiah(totalOut)}</span></div></div></div>`;
    htmlContent += `<div class="section-title" style="display: flex; align-items: center; gap: 8px; color: #f59e0b; margin-left: 0;"><span class="material-icons-round" style="font-size: 18px;">track_changes</span> TARGET HARIANMU</div><div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 25px;"><div class="stat-card" style="padding: 15px; margin: 0; border: 1.5px solid #bbf7d0; background: #f0fdf4;"><div style="font-size: 11px; color: #16a34a; font-weight: 800; margin-bottom: 4px;">🎯 Kejar Pemasukan</div><div style="font-size: 16px; font-weight: 800; color: #15803d; margin-bottom: 2px;">${window.formatRupiah(saranPendapatanHarian)}</div><div style="font-size: 10px; color: #16a34a; font-weight: 600;">/hari ini</div></div><div class="stat-card" style="padding: 15px; margin: 0; border: 1.5px solid #fed7aa; background: #fff7ed;"><div style="font-size: 11px; color: #ea580c; font-weight: 800; margin-bottom: 4px;">🛑 Batas Pengeluaran</div><div style="font-size: 16px; font-weight: 800; color: #c2410c; margin-bottom: 2px;">${window.formatRupiah(saranPengeluaranHarian)}</div><div style="font-size: 10px; color: #ea580c; font-weight: 600;">/hari ini</div></div></div>`;
    htmlContent += `<div class="section-title" style="display: flex; align-items: center; gap: 8px; color: #249a95; margin-left: 0;"><span class="material-icons-round" style="font-size: 18px;">trending_up</span> PEMASUKAN</div><div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 15px;"><div class="stat-card" style="padding: 15px; margin: 0; display: flex; flex-direction: column; justify-content: center;"><div style="font-size: 11px; color: #777; font-weight: 700; margin-bottom: 4px;">Order</div><div style="font-size: 16px; font-weight: 800; color: #1a1a1a;">${totalOrders}</div><div style="font-size: 10px; color: #94a3b8; font-weight: 600;">Selesai</div></div><div class="stat-card" style="padding: 15px; margin: 0; display: flex; flex-direction: column; justify-content: center;"><div style="font-size: 11px; color: #777; font-weight: 700; margin-bottom: 4px;">/hari</div><div style="font-size: 16px; font-weight: 800; color: #1a1a1a;">${window.formatRupiah(avgPerDay)}</div><div style="font-size: 10px; color: #94a3b8; font-weight: 600;">Rata-rata</div></div><div class="stat-card" style="padding: 15px; margin: 0; display: flex; flex-direction: column; justify-content: center;"><div style="font-size: 11px; color: #777; font-weight: 700; margin-bottom: 4px;">/order</div><div style="font-size: 16px; font-weight: 800; color: #1a1a1a;">${window.formatRupiah(avgPerOrder)}</div><div style="font-size: 10px; color: #94a3b8; font-weight: 600;">Rata-rata</div></div></div>`;
    htmlContent += `<div class="stat-card" style="padding: 16px; margin-bottom: 25px;"><div style="font-size: 13px; font-weight: 800; color: #1a1a1a; margin-bottom: 15px; display: flex; justify-content: space-between;"><span>Jam tercuan</span><span style="font-size:11px; color:#94a3b8;">Makin penuh, makin cuan</span></div>`;
    const timeOrdered = ['pagi', 'siang', 'sore', 'malam']; const timeNames = { pagi: 'Pagi', siang: 'Siang', sore: 'Sore', malam: 'Malam' }; let maxIncomeTime = Math.max(...Object.values(timeStats)); if (maxIncomeTime === 0) maxIncomeTime = 1; 
    timeOrdered.forEach(t => { let val = timeStats[t]; let pctTime = (val / maxIncomeTime) * 100; let barColor = pctTime === 100 ? '#00B14F' : '#6ee7b7'; if(val === 0) { pctTime = 0; barColor = '#e2e8f0'; } htmlContent += `<div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;"><div style="font-size: 12px; font-weight: 700; color: #475569; width: 50px;">${timeNames[t]}</div><div style="flex-grow: 1; margin: 0 12px; height: 8px; background: #f1f5f9; border-radius: 4px; overflow: hidden;"><div style="width: ${pctTime}%; height: 100%; background: ${barColor}; border-radius: 4px;"></div></div><div style="font-size: 12px; font-weight: 800; color: #1a1a1a; width: 75px; text-align: right;">${window.formatRupiah(val)}</div></div>`; });
    htmlContent += `</div>`;
    htmlContent += `<div class="stat-card" style="padding: 16px; margin-bottom: 25px;"><div style="font-size: 13px; font-weight: 800; color: #1a1a1a; margin-bottom: 15px; display: flex; justify-content: space-between;"><span>Per layanan Grab</span><span style="font-size:11px; color:#94a3b8;">uang masuk</span></div>`;
    if (Object.keys(grabStats).length > 0) { const sortedGrab = Object.entries(grabStats).sort((a, b) => b - a); for (const [service, amount] of sortedGrab) { htmlContent += `<div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #f1f5f9;"><div style="font-size: 13px; font-weight: 700; color: #333; display: flex; align-items:center; gap:6px;"><span class="material-icons-round" style="font-size:14px; color:#00B14F;">check_circle</span> ${window.escapeHTML(service)}</div><div style="font-size: 13px; font-weight: 800; color: #2e7d32;">${window.formatRupiah(amount)}</div></div>`; } } else { htmlContent += `<div style="font-size: 12px; color: #94a3b8; text-align: center; padding: 10px;">Belum ada order</div>`; }
    htmlContent += `</div>`;
    if (Object.keys(locationStats).length > 0) { htmlContent += `<div class="stat-card" style="padding: 16px; margin-bottom: 25px;"><div style="font-size: 13px; font-weight: 800; color: #1a1a1a; margin-bottom: 15px; display: flex; justify-content: space-between;"><span>Per area/lokasi</span><span style="font-size:11px; color:#94a3b8;">uang masuk</span></div>`; const sortedLocs = Object.entries(locationStats).sort((a, b) => b - a); for (const [loc, amount] of sortedLocs) { htmlContent += `<div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #f1f5f9;"><div style="font-size: 13px; font-weight: 700; color: #333; display: flex; align-items: center; gap:6px;"><span class="material-icons-round" style="font-size:14px; color:#1976d2;">place</span> ${window.escapeHTML(loc)}</div><div style="font-size: 13px; font-weight: 800; color: #1976d2;">${window.formatRupiah(amount)}</div></div>`; } htmlContent += `</div>`; }
    htmlContent += `<div class="section-title" style="display: flex; align-items: center; gap: 8px; color: #ef6c00; margin-left: 0;"><span class="material-icons-round" style="font-size: 18px;">money_off</span> PENGELUARAN & ANGGARAN</div><div class="stat-card" style="padding: 16px; margin-bottom: 15px;"><div style="font-size: 13px; font-weight: 800; color: #1a1a1a; margin-bottom: 15px; display: flex; justify-content: space-between;"><span>Total Keluar</span><span style="color:#c62828;">${window.formatRupiah(totalOut)}</span></div></div><div class="stat-card" style="padding: 16px; margin-bottom: 25px;"><div style="font-size: 13px; font-weight: 800; color: #1a1a1a; margin-bottom: 15px; display: flex; justify-content: space-between;"><span>Rincian pengeluaran</span><span style="font-size:11px; color:#94a3b8;">${periodText}</span></div>`;
    let adaKategoriPengeluaran = false;
    window.categories.forEach(c => {
        if(c.type === 'out' && String(c.id) !== '999') {
            adaKategoriPengeluaran = true; 
            let terpakaiPeriod = expenseByCategoryObj[String(c.id)] || expenseByCategoryObj[c.name] || 0; 
            let persenTerpakai = Number(c.budget||0) > 0 ? Math.min((terpakaiPeriod / Number(c.budget||1)) * 100, 100) : 0; 
            let progressColor = persenTerpakai >= 100 ? "#c62828" : (persenTerpakai > 75 ? "#ef6c00" : "#249a95"); 
            let sisa = Number(c.budget||0) - terpakaiPeriod, labelSisa = sisa < 0 ? "Overbudget:" : "Sisa:", nilaiSisaTampil = sisa < 0 ? window.formatRupiah(Math.abs(sisa)) : (Number(c.budget||0) > 0 ? window.formatRupiah(sisa) : "Tanpa Batas");
            htmlContent += `<div style="padding: 10px 0; border-bottom: 1px solid #f1f5f9;"><div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;"><div style="font-size: 13px; font-weight: 700; color: #333;">${window.escapeHTML(c.name)}</div><div style="font-size: 13px; font-weight: 800; color: #c62828;">${window.formatRupiah(terpakaiPeriod)}</div></div>`;
            if(Number(c.budget||0) > 0) { htmlContent += `<div style="display: flex; justify-content: space-between; font-size: 10px; color: #666; margin-bottom: 6px;"><span>Anggaran: <span style="font-weight: 700;">${window.formatRupiah(c.budget)}</span></span><span style="color: ${sisa < 0 ? '#c62828' : '#2e7d32'}; font-weight:700;">${labelSisa} ${nilaiSisaTampil}</span></div><div style="width: 100%; height: 6px; background: #f0f0f0; border-radius: 4px; overflow: hidden;"><div style="height: 100%; width: ${persenTerpakai}%; background: ${progressColor}; border-radius: 4px;"></div></div>`; } else { htmlContent += `<div style="font-size: 10px; color: #94a3b8;">Tanpa batas anggaran</div>`; }
            htmlContent += `</div>`;
        }
    });
    if(!adaKategoriPengeluaran) { htmlContent += `<div style="font-size: 12px; color: #94a3b8; text-align: center; padding: 10px;">Belum ada pengeluaran</div>`; } htmlContent += `</div>`;
    htmlContent += `<div class="section-title" style="display: flex; align-items: center; gap: 8px; color: #4338ca; margin-left: 0;"><span class="material-icons-round" style="font-size: 18px;">build</span> SERVIS MOTOR</div><div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px;"><div class="stat-card" style="padding: 15px; margin: 0;"><div style="font-size: 11px; color: #777; font-weight: 700; margin-bottom: 4px;">Total servis</div><div style="font-size: 16px; font-weight: 800; color: #1a1a1a; margin-bottom: 2px;">${window.formatRupiah(serviceExpenses)}</div><div style="font-size: 10px; color: #94a3b8; font-weight: 600;">Periode ini</div></div><div class="stat-card" style="padding: 15px; margin: 0;"><div style="font-size: 11px; color: #777; font-weight: 700; margin-bottom: 4px;">Jumlah</div><div style="font-size: 16px; font-weight: 800; color: #1a1a1a; margin-bottom: 2px;">${serviceCount}x</div><div style="font-size: 10px; color: #94a3b8; font-weight: 600;">Catatan servis</div></div></div>`;
    statContainer.innerHTML = htmlContent;
}

// ==========================================
// 11. DOMPET LOGIC (dompet.html)
// ==========================================
window.renderWalletPage = function() {
    const container = document.getElementById('wallet-page-container'); if(!container) return;
    let html = '';
    
    const dompetAktif = window.wallets.filter(w => !w.isArchived);
    const dompetArsip = window.wallets.filter(w => w.isArchived);

    dompetAktif.forEach(wallet => {
        html += `<div class="list-item"><div class="list-info"><div class="list-icon ${wallet.colorClass}"><span class="material-icons-round">${wallet.icon}</span></div><div><div class="list-title">${window.escapeHTML(wallet.name)}</div><div class="list-desc">Saldo Aktual: <strong style="color:#249a95;">${window.formatRupiah(wallet.balance)}</strong></div></div></div><div class="list-actions"><button class="btn-icon" onclick="window.openDompetModal('${wallet.id}')"><span class="material-icons-round" style="font-size:18px;">edit</span></button><button class="btn-icon delete" onclick="window.hapusDompet('${wallet.id}')"><span class="material-icons-round" style="font-size:18px;">delete</span></button></div></div>`;
    });

    if (dompetArsip.length > 0) {
        html += `<div class="section-title" style="margin-top:20px;">Dompet Diarsipkan</div>`;
        dompetArsip.forEach(wallet => {
            html += `<div class="list-item" style="opacity: 0.6;"><div class="list-info"><div class="list-icon bg-grey"><span class="material-icons-round">${wallet.icon}</span></div><div><div class="list-title">${window.escapeHTML(wallet.name)}</div><div class="list-desc">Status: Diarsipkan (Saldo: ${window.formatRupiah(wallet.balance)})</div></div></div><div class="list-actions"><button class="btn-icon" onclick="window.pulihkanDompet('${wallet.id}')" title="Pulihkan Dompet"><span class="material-icons-round" style="font-size:18px;">restore</span></button></div></div>`;
        });
    }

    container.innerHTML = html;
};

window.selectDompetType = function(type) { 
    document.getElementById('dompet-type').value = type; 
    const btns = document.querySelectorAll('#dompet-type-segment .segmented-btn'); 
    if (btns.length >= 3) {
        btns[0].classList.toggle('active', type === 'cash'); 
        btns[1].classList.toggle('active', type === 'bank'); 
        btns[2].classList.toggle('active', type === 'ewallet'); 
    }
};

window.openDompetModal = function(id = null) {
    const err = document.getElementById('dompet-error-msg'); if(err) err.style.display = 'none';
    if (id) { 
        const wallet = window.wallets.find(w => String(w.id) === String(id)); document.getElementById('dompet-modal-title').innerText = 'Edit Dompet'; document.getElementById('dompet-id').value = wallet.id; document.getElementById('dompet-name').value = wallet.name; document.getElementById('dompet-balance').value = Number(wallet.balance||0) === 0 ? '' : window.formatNumberWithDot(wallet.balance.toString()); window.selectDompetType(wallet.type || 'cash'); 
    } else { 
        document.getElementById('dompet-modal-title').innerText = 'Tambah Dompet'; document.getElementById('dompet-id').value = ''; document.getElementById('dompet-name').value = ''; document.getElementById('dompet-balance').value = ''; window.selectDompetType('cash'); 
    }
    document.getElementById('modal-dompet').classList.add('show');
};

window.simpanDompet = async function() {
    const id = document.getElementById('dompet-id').value, name = window.escapeHTML(document.getElementById('dompet-name').value.trim()), type = document.getElementById('dompet-type').value, newBalance = window.parseRupiah(document.getElementById('dompet-balance').value), errBox = document.getElementById('dompet-error-msg');
    if (!name) { errBox.innerText = "Nama dompet wajib diisi!"; errBox.style.display = 'block'; return; }
    let icon = type === 'bank' ? "account_balance" : (type === 'ewallet' ? "account_balance_wallet" : "payments"), colorClass = type === 'bank' ? "icon-bank" : (type === 'ewallet' ? "icon-ewallet" : "icon-cash"), todayStr = window.getLocalDateString();
    
    // Waktu dicatat agar selisih dompet tidak nyangkut di paling bawah riwayat
    let timeStr = String(new Date().getHours()).padStart(2, '0') + ':' + String(new Date().getMinutes()).padStart(2, '0');
    
    try {
        if (id) {
            const idx = window.wallets.findIndex(w => String(w.id) == String(id)); const oldBalance = Number(window.wallets[idx].balance||0); const selisih = newBalance - oldBalance;
            window.wallets[idx].name = name; window.wallets[idx].type = type; window.wallets[idx].icon = icon; window.wallets[idx].colorClass = colorClass;
            if (selisih !== 0) { 
                const newTrx = { id: window.generateUUID(), type: selisih > 0 ? 'in' : 'out', amount: Math.abs(selisih), note: selisih > 0 ? 'Penyesuaian Saldo (Lebih)' : 'Penyesuaian Saldo (Kurang)', walletId: window.wallets[idx].id, walletName: name, categoryId: 999, categoryName: 'Penyesuaian Sistem', date: todayStr, time: timeStr }; 
                window.transactions.push(newTrx); 
                await window.saveTransactionToDB(newTrx); 
            }
        } else {
            const newWalletId = window.generateUUID(); window.wallets.push({ id: newWalletId, name, type, balance: 0, icon, colorClass, isArchived: false }); 
            if (newBalance > 0) { 
                const newTrx = { id: window.generateUUID(), type: 'in', amount: newBalance, note: 'Saldo Awal Dompet', walletId: newWalletId, walletName: name, categoryId: 999, categoryName: 'Penyesuaian Sistem', date: todayStr, time: timeStr }; 
                window.transactions.push(newTrx); 
                await window.saveTransactionToDB(newTrx); 
            }
        }
        window.recalculateBalances(); 
        window.closeModal('modal-dompet'); 
        await window.saveDataToFirestore();
    } catch (error) {
        console.error("Gagal menyimpan data:", error);
        window.customAlert("Error", "Terjadi kesalahan saat menyimpan dompet. Silakan coba kembali.", "error");
    }
};

window.hapusDompet = function(id) {
    const dompetAktif = window.wallets.filter(w => !w.isArchived);
    if(dompetAktif.length === 1 && String(dompetAktif[0].id) === String(id)) { return window.customAlert("Gagal Menghapus", "Anda harus memiliki minimal 1 dompet aktif!"); }
    
    window.customConfirm("Hapus Dompet", "Jika dompet ini memiliki histori transaksi, dompet hanya akan disembunyikan (diarsipkan) agar data lama tidak rusak. Lanjutkan?", async () => { 
        const dompetIndex = window.wallets.findIndex(w => String(w.id) === String(id));
        if (dompetIndex !== -1) {
            const adaTransaksi = window.transactions.some(t => String(t.walletId) === String(id) || String(t.targetWalletId) === String(id));
            if (adaTransaksi) {
                window.wallets[dompetIndex].isArchived = true;
            } else {
                window.wallets.splice(dompetIndex, 1);
            }
            window.recalculateBalances(); 
            await window.saveDataToFirestore(); 
            window.callPageRender();
        }
    });
};

window.pulihkanDompet = async function(id) {
    const dompetIndex = window.wallets.findIndex(w => String(w.id) === String(id));
    if (dompetIndex !== -1) {
        window.wallets[dompetIndex].isArchived = false;
        await window.saveDataToFirestore();
        window.callPageRender();
    }
}

// ==========================================
// 12. KATEGORI LOGIC (kategori.html)
// ==========================================
window.switchMainTab = function(type) {
    window.activeKatTab = type; document.getElementById('tab-out').classList.toggle('active', type === 'out'); document.getElementById('tab-in').classList.toggle('active', type === 'in');
    window.renderCategoryPage();
};

window.renderCategoryPage = function() {
    const container = document.getElementById('kategori-container'); if(!container) return;
    const currentMonthStr = window.getLocalMonthString(); const txBulanIni = window.transactions.filter(t => t.date && t.date.startsWith(currentMonthStr) && String(t.categoryId) !== '999');
    let totIn = 0; let totOut = 0;
    txBulanIni.forEach(t => { if(t.type === 'in') totIn += Number(t.amount||0); if(t.type === 'out') totOut += Number(t.amount||0); });
    if(document.getElementById('tot-masuk')) document.getElementById('tot-masuk').innerText = window.formatRupiah(totIn);
    if(document.getElementById('tot-keluar')) document.getElementById('tot-keluar').innerText = window.formatRupiah(totOut);

    const catsToRender = window.categories.filter(c => c.type === window.activeKatTab && String(c.type) !== 'sys');
    if (catsToRender.length === 0) { container.innerHTML = `<div class="empty-state"><div class="icon-wrapper"><span class="material-icons-round">category</span></div><h4 style="font-size:14px; color:#1a1a1a; margin-bottom:6px; font-weight:800;">Belum ada kategori</h4><p style="font-size:12px; color:#94a3b8; font-weight:600;">Tambahkan kategori baru untuk mulai mengatur keuangan.</p></div>`; return; }

    let html = '';
    catsToRender.forEach(cat => {
        let realisasi = 0; txBulanIni.forEach(t => { if(String(t.categoryId) === String(cat.id) && t.type === cat.type) realisasi += Number(t.amount||0); });
        let progressHtml = '';
        let bud = Number(cat.budget||0);
        
        if(bud > 0) {
            let pct = Math.min((realisasi / bud) * 100, 100); let pgColor = (window.activeKatTab === 'out' && pct >= 100) ? '#c62828' : ((window.activeKatTab === 'out' && pct > 75) ? '#ef6c00' : '#249a95'); if (window.activeKatTab === 'in') pgColor = pct >= 100 ? '#2e7d32' : '#249a95'; 
            let sisaTxt = ''; if (window.activeKatTab === 'out') { sisaTxt = realisasi > bud ? `<span style="color:#c62828;">Overbudget ${window.formatRupiah(realisasi - bud)}</span>` : `<span style="color:#94a3b8;">Sisa ${window.formatRupiah(bud - realisasi)}</span>`; } else { sisaTxt = realisasi >= bud ? `<span style="color:#2e7d32;">Target Tercapai!</span>` : `<span style="color:#94a3b8;">Kurang ${window.formatRupiah(bud - realisasi)}</span>`; }
            
            progressHtml = `<div class="progress-wrapper"><div class="progress-text-row" style="display:flex; justify-content:space-between; margin-bottom:8px;"><span>Realisasi: <span style="color: ${pgColor}; font-weight: 800;">${window.formatRupiah(realisasi)}</span></span><span>${sisaTxt}</span></div><div class="progress-bg"><div class="progress-fill" style="width: ${pct}%; background: ${pgColor};"></div></div></div>`;
        } else { 
            progressHtml = `<div style="font-size: 11px; font-weight: 700; color: #1a1a1a; margin-top: 4px;">Realisasi: <span style="color:#249a95;">${window.formatRupiah(realisasi)}</span></div>`; 
        }

        html += `<div class="cat-card"><div class="cat-top" style="display:flex; justify-content:space-between; align-items:center; gap:10px;"><div class="cat-info-wrap" style="display:flex; align-items:center; gap:12px; flex:1; min-width:0;"><div class="cat-icon" style="background: ${cat.color}15; color: ${cat.color}; flex-shrink:0;"><span class="material-icons-round">${cat.icon}</span></div><div style="flex:1; min-width:0;"><div class="cat-title" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${window.escapeHTML(cat.name)}</div><div class="cat-subtitle" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${bud > 0 ? (window.activeKatTab==='out'?'Anggaran: ':'Target: ') + window.formatRupiah(bud) : 'Tanpa Batas'}</div></div></div><div class="list-actions" style="flex-shrink:0;"><button class="cat-action-btn" onclick="window.openKategoriModal('${cat.id}')"><span class="material-icons-round">edit</span></button><button class="cat-action-btn danger" onclick="window.hapusKategori('${cat.id}')"><span class="material-icons-round">delete_outline</span></button></div></div>${progressHtml}</div>`;
    });
    
    html += `<div style="height: 60px;"></div>`; 
    
    container.innerHTML = html;
};

window.selectKatType = function(type) { 
    document.getElementById('kat-type').value = type; 
    const btns = document.querySelectorAll('#kat-type-segment .segmented-btn'); 
    if(btns.length >= 2) {
        btns[0].classList.toggle('active', type === 'out'); 
        btns[1].classList.toggle('active', type === 'in'); 
    }
};

window.openKategoriModal = function(id = null) {
    document.getElementById('kat-error-msg').style.display = 'none';
    if (id) { const cat = window.categories.find(c => String(c.id) === String(id)); document.getElementById('kat-modal-title').innerText = 'Edit Kategori'; document.getElementById('kat-id').value = cat.id; document.getElementById('kat-name').value = cat.name; document.getElementById('kat-budget').value = Number(cat.budget||0) === 0 ? '' : window.formatNumberWithDot(cat.budget.toString()); window.selectKatType(cat.type); 
    } else { document.getElementById('kat-modal-title').innerText = 'Tambah Kategori'; document.getElementById('kat-id').value = ''; document.getElementById('kat-name').value = ''; document.getElementById('kat-budget').value = ''; window.selectKatType(window.activeKatTab); }
    document.getElementById('modal-kategori').classList.add('show');
};

window.simpanKategori = async function() {
    const id = document.getElementById('kat-id').value, type = document.getElementById('kat-type').value, name = window.escapeHTML(document.getElementById('kat-name').value.trim()), budget = window.parseRupiah(document.getElementById('kat-budget').value), errBox = document.getElementById('kat-error-msg');
    if (!name) { errBox.innerText = "Nama kategori wajib diisi!"; errBox.style.display = 'block'; return; }
    if (id) { const idx = window.categories.findIndex(c => String(c.id) == String(id)); window.categories[idx] = { ...window.categories[idx], type, name, budget }; } 
    else { window.categories.push({ id: window.generateUUID(), type, name, budget, icon: type === 'in' ? "payments" : "category", color: type === 'in' ? "#2e7d32" : "#78909c" }); }
    window.closeModal('modal-kategori'); await window.saveDataToFirestore();
};

window.hapusKategori = function(id) { 
    if(window.transactions.some(t => String(t.categoryId) === String(id))) { return window.customAlert("Sedang Digunakan", "Kategori ini sudah pernah dipakai di riwayat transaksi. Silakan edit saja namanya."); }
    window.customConfirm("Hapus Kategori", "Yakin ingin menghapus kategori ini secara permanen?", async () => { window.categories = window.categories.filter(c => String(c.id) !== String(id)); await window.saveDataToFirestore(); }); 
};

// ==========================================
// 13. KENDARAAN LOGIC (Kendaraan.html)
// ==========================================
window.renderVehiclePage = function() {
    const accKm = Number(window.vehicleSettings.accumulatedKmForOil||0);
    if(document.getElementById('text-km-terkumpul')) document.getElementById('text-km-terkumpul').innerText = accKm.toFixed(1).replace('.', ',');
    const persentase = Math.min((accKm / 2000) * 100, 100);
    const barOli = document.getElementById('bar-oli'); if(barOli) barOli.style.width = persentase + '%';
    const alertBox = document.getElementById('oil-alert-box');

    if(barOli && alertBox) {
        if (accKm >= 2000) { barOli.style.backgroundColor = '#c62828'; alertBox.style.display = 'flex'; } 
        else if (accKm >= 1500) { barOli.style.backgroundColor = '#ef6c00'; alertBox.style.display = 'none'; } 
        else { barOli.style.backgroundColor = '#249a95'; alertBox.style.display = 'none'; }
    }

    const tripContainer = document.getElementById('trip-control-container');
    if(tripContainer) {
        if(window.vehicleSettings.activeTrip) {
            tripContainer.innerHTML = `<div class="trip-active-banner"><div class="trip-info-text"><span class="material-icons-round">navigation</span> Perjalanan Aktif</div><div style="font-size: 13px; color: #475569; margin-top: 6px; font-weight:700;">KM Awal Pagi: <b style="color: #1a1a1a;">${window.vehicleSettings.activeTrip.kmAwal}</b></div></div><div class="form-group"><label class="form-label">KM Akhir (Saat selesai)</label><input type="text" id="trip-km-akhir" class="form-input" placeholder="Cth: 57450.5" inputmode="decimal"></div><button class="btn-submit" style="background: #4338ca;" onclick="window.selesaiTripMalam()">Simpan Perjalanan <span class="material-icons-round">done_all</span></button>`;
        } else {
            let defaultKm = 0; if(window.kmRecords.length > 0) { const sorted = [...window.kmRecords].sort((a,b) => b.id - a.id); defaultKm = sorted[0].kmAkhir; }
            let prefillKm = (defaultKm && typeof defaultKm === 'number') ? defaultKm : '';
            tripContainer.innerHTML = `<p style="font-size: 13px; color: #64748b; margin-bottom: 15px; font-weight:600; line-height:1.5;">Catat KM awal motor Anda sebelum mulai beraktivitas.</p><div class="form-group"><label class="form-label">KM Awal (Pagi)</label><input type="text" id="trip-km-awal" class="form-input" value="${prefillKm}" placeholder="Cth: 57378.1" inputmode="decimal"></div><button class="btn-submit" onclick="window.mulaiTripPagi()">Mulai Perjalanan <span class="material-icons-round">play_arrow</span></button>`;
        }
    }

    const container = document.getElementById('km-list-container'); 
    if(container) {
        container.innerHTML = '';
        if (window.kmRecords.length === 0) { container.innerHTML = `<div class="empty-state"><span class="material-icons-round" style="font-size: 40px; color:#cbd5e1;">history</span><p>Belum ada riwayat jarak tempuh.</p></div>`; return; }

        const sortedRecords = [...window.kmRecords].sort((a,b) => b.id - a.id);
        sortedRecords.forEach(k => {
            const dateObj = new Date(k.tanggal); const dateStr = `${String(dateObj.getDate()).padStart(2, '0')}/${String(dateObj.getMonth()+1).padStart(2, '0')}/${dateObj.getFullYear()}`;
            if (k.kmAkhir === 'Ganti Oli') {
                 container.innerHTML += `<div class="history-item" style="background:#f0fdf4; border:1px solid #bbf7d0;"><div class="history-icon" style="background:#22c55e;"><span class="material-icons-round" style="color:white;">settings</span></div><div class="history-details"><div class="history-title" style="color:#15803d;">Oli Diganti Baru</div><div class="history-date">${dateStr}</div></div><div class="history-amount" style="color:#15803d;">0 KM</div><button class="btn-icon delete" onclick="window.hapusKM('${k.id}')" title="Hapus"><span class="material-icons-round" style="font-size: 18px;">delete</span></button></div>`;
            } else {
                 container.innerHTML += `<div class="history-item"><div class="history-icon"><span class="material-icons-round">add_road</span></div><div class="history-details"><div class="history-title">Trip ${dateStr}</div><div class="history-date">Awal: ${k.kmAwal} &rarr; Akhir: ${k.kmAkhir}</div></div><div class="history-amount">+ ${k.jarak} KM</div><button class="btn-icon delete" onclick="window.hapusKM('${k.id}')" title="Hapus"><span class="material-icons-round" style="font-size: 18px;">delete</span></button></div>`;
            }
        });
    }
};

window.mulaiTripPagi = async function() {
    const kmAwalInput = document.getElementById('trip-km-awal').value.trim(); const kmAwal = parseFloat(kmAwalInput.replace(',', '.'));
    if(isNaN(kmAwal) || kmAwal < 0) { window.customAlert("Peringatan", "Masukkan KM Awal motor yang valid (contoh: 57378.1)"); return; }
    window.vehicleSettings.activeTrip = { tanggal: window.getLocalDateString(), kmAwal: kmAwal }; await window.saveDataToFirestore();
};

window.selesaiTripMalam = async function() {
    const kmAkhirInput = document.getElementById('trip-km-akhir').value.trim(); const kmAkhir = parseFloat(kmAkhirInput.replace(',', '.'));
    if(isNaN(kmAkhir) || kmAkhir < Number(window.vehicleSettings.activeTrip.kmAwal||0)) { window.customAlert("Peringatan", "KM Akhir tidak boleh lebih kecil dari KM Awal (" + window.vehicleSettings.activeTrip.kmAwal + ")"); return; }
    const jarakTempuh = parseFloat((kmAkhir - Number(window.vehicleSettings.activeTrip.kmAwal||0)).toFixed(1));
    const recordBaru = { id: window.generateUUID(), tanggal: window.vehicleSettings.activeTrip.tanggal, kmAwal: window.vehicleSettings.activeTrip.kmAwal, kmAkhir: kmAkhir, jarak: jarakTempuh };
    window.kmRecords.push(recordBaru); window.vehicleSettings.accumulatedKmForOil = Number(window.vehicleSettings.accumulatedKmForOil||0) + jarakTempuh; window.vehicleSettings.activeTrip = null; 
    await window.saveDataToFirestore();
};

window.hapusKM = function(id) {
    window.customConfirm("Hapus Riwayat", "Yakin ingin menghapus catatan KM ini? Total jarak oli akan disesuaikan otomatis.", async () => {
        const record = window.kmRecords.find(k => String(k.id) === String(id));
        if(record) { 
            if (record.kmAkhir !== 'Ganti Oli') {
                window.vehicleSettings.accumulatedKmForOil = Math.max(0, Number(window.vehicleSettings.accumulatedKmForOil||0) - Number(record.jarak||0)); 
            }
            window.kmRecords = window.kmRecords.filter(k => String(k.id) !== String(id)); 
            await window.saveDataToFirestore(); 
        }
    });
};

window.resetOli = function() { 
    window.customConfirm("Ganti Oli Baru?", "Apakah oli motor sudah diganti baru? Perhitungan jarak oli akan di-reset menjadi 0 KM.", async () => { 
        const recordGantiOli = { id: window.generateUUID(), tanggal: window.getLocalDateString(), kmAwal: "-", kmAkhir: "Ganti Oli", jarak: 0 };
        window.kmRecords.push(recordGantiOli);
        window.vehicleSettings.accumulatedKmForOil = 0; 
        await window.saveDataToFirestore(); 
    }); 
};

// ==========================================
// 14. TARGET & INVESTASI LOGIC (target.html)
// ==========================================
window.renderTargetPage = function() {
    const container = document.getElementById('target-container'); if(!container) return;
    if (window.targets.length === 0) { container.innerHTML = `<div class="empty-state"><div class="icon-wrapper"><span class="material-icons-round">flag</span></div><h4 style="font-size:16px; color:#1a1a1a; margin-bottom:6px; font-weight:800;">Belum ada target</h4><p style="font-size:14px; color:#94a3b8; font-weight:600; line-height: 1.4;">Buat tabungan atau pantau investasi pertamamu di sini.</p></div>`; return; }

    let html = '';
    window.targets.sort((a,b) => b.id - a.id).forEach(t => {
        const isInvest = t.tipe === 'investasi'; let badgeHtml = isInvest ? `<span class="badge badge-invest">Aktif</span>` : `<span class="badge badge-tabungan">Aktif</span>`; let fillClass = isInvest ? `fill-invest` : `fill-tabungan`;
        let saranHtml = ''; let sisaUangText = 'Rp 0'; let pct = 0;

        let targetAmt = Number(t.targetAmount||0);
        let currAmt = Number(t.currentAmount||0);
        let valTerkini = Number(t.nilaiTerkini !== undefined ? t.nilaiTerkini : currAmt);

        if (targetAmt > 0) {
            let uangDihitung = isInvest ? valTerkini : currAmt; let sisaUang = targetAmt - uangDihitung; if(sisaUang < 0) sisaUang = 0;
            sisaUangText = window.formatRupiah(sisaUang); pct = Math.min((uangDihitung / targetAmt) * 100, 100);

            if (t.deadline) {
                const today = new Date(); today.setHours(0, 0, 0, 0); const deadlineDate = new Date(t.deadline); deadlineDate.setHours(0, 0, 0, 0);
                if (sisaUang <= 0) { saranHtml = `<div class="pill-box" style="border-color: #bbf7d0; background: #f0fdf4; justify-content: center;"><div style="font-size: 13.5px; color: #16a34a; font-weight: 800; display: flex; align-items: center; gap: 8px;"><span class="material-icons-round" style="font-size: 20px;">task_alt</span> Target Tercapai! 🎉</div></div>`; } 
                else {
                    const diffTime = deadlineDate - today; const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    if (diffDays > 0) { const saranHarian = Math.ceil(sisaUang / diffDays); saranHtml = `<div class="pill-box"><div class="pill-left"><span class="material-icons-round" style="font-size: 18px;">calendar_today</span> Sisa ${diffDays} Hari</div><div class="pill-right">Nabung: <span>${window.formatRupiah(saranHarian)}</span> <span style="font-size: 11px;">/hari</span></div></div>`; } 
                    else { saranHtml = `<div class="pill-box" style="border-color: #fecaca; background: #fff1f2;"><div class="pill-left" style="color: #e11d48;"><span class="material-icons-round" style="font-size: 18px;">error_outline</span> Terlambat ${Math.abs(diffDays)} Hari</div><div class="pill-right" style="color: #e11d48;">Kurang: <span>${window.formatRupiah(sisaUang)}</span></div></div>`; }
                }
            }
        }

        let cardContent = '';
        if (isInvest) {
            let retur = valTerkini - currAmt;
            let returnColor = retur > 0 ? '#10b981' : (retur < 0 ? '#e11d48' : '#64748b'); let returnText = retur > 0 ? '+ ' + window.formatRupiah(retur) : (retur < 0 ? '- ' + window.formatRupiah(Math.abs(retur)) : window.formatRupiah(0));
            cardContent = `<div class="stat-row" style="margin-bottom: 14px;"><div>Terkumpul: <span style="color: #4338ca; font-size: 14px;">${window.formatRupiah(valTerkini)}</span></div><div>Target: <span style="color: #1a1a1a; font-size: 14px;">${targetAmt > 0 ? window.formatRupiah(targetAmt) : 'Tanpa Batas'}</span></div></div><div class="progress-bg"><div class="progress-fill ${fillClass}" style="width: ${pct}%;"></div></div><div class="stat-row"><div>Progress: <span style="color: #1a1a1a;">${pct.toFixed(0)}%</span></div><div>Kekurangan: <span style="color: #d97706;">${targetAmt > 0 ? sisaUangText : 'Rp 0'}</span></div></div>${saranHtml}<div style="display:flex; justify-content:space-between; align-items:center; background:#f8fafc; padding:12px 16px; border-radius:14px; margin-top:18px; border:1px solid #e2e8f0;"><div style="font-size:12.5px; color:#64748b; font-weight:700;">Modal: <span style="color:#1a1a1a; font-weight:800; font-size: 13.5px;">${window.formatRupiah(currAmt)}</span></div><div style="font-size:12.5px; color:#64748b; font-weight:700;">Return: <span style="color:${returnColor}; font-weight:800; font-size: 13.5px;">${returnText}</span></div></div><div class="btn-grid two"><button class="btn-action btn-setor-invest" onclick="window.openActionModal('${t.id}', 'setor')"><span class="material-icons-round" style="font-size:18px;">add</span> Top Up</button><button class="btn-action btn-tarik" onclick="window.openActionModal('${t.id}', 'tarik')"><span class="material-icons-round" style="font-size:18px;">remove</span> Jual/Tarik</button></div><button class="btn-action btn-update" style="margin-top:12px; width:100%;" onclick="window.openActionModal('${t.id}', 'update')"><span class="material-icons-round" style="font-size:18px;">sync</span> Update Nilai Terkini</button>`;
        } else {
            cardContent = `<div class="stat-row" style="margin-bottom: 14px;"><div>Terkumpul: <span style="color: #249a95; font-size: 14px;">${window.formatRupiah(currAmt)}</span></div><div>Target: <span style="color: #1a1a1a; font-size: 14px;">${targetAmt > 0 ? window.formatRupiah(targetAmt) : 'Tanpa Batas'}</span></div></div><div class="progress-bg"><div class="progress-fill ${fillClass}" style="width: ${pct}%;"></div></div><div class="stat-row"><div>Progress: <span style="color: #1a1a1a;">${pct.toFixed(0)}%</span></div><div>Kekurangan: <span style="color: #d97706;">${targetAmt > 0 ? sisaUangText : 'Rp 0'}</span></div></div>${saranHtml}<div class="btn-grid"><button class="btn-action btn-setor" onclick="window.openActionModal('${t.id}', 'setor')"><span class="material-icons-round" style="font-size:18px;">savings</span> Setor Tabungan</button></div>`;
        }

        html += `<div class="target-card"><div class="target-top"><div class="target-info-wrap"><div class="target-title">${window.escapeHTML(t.name)}</div></div><div style="display: flex; align-items: center; gap: 10px;">${badgeHtml}<div class="list-actions"><button class="cat-action-btn" onclick="window.openTargetModal('${t.id}')"><span class="material-icons-round" style="font-size:18px;">edit</span></button><button class="cat-action-btn danger" onclick="window.hapusTarget('${t.id}')"><span class="material-icons-round">delete_outline</span></button></div></div></div>${cardContent}</div>`;
    });
    container.innerHTML = html;
};

window.selectTargetType = function(type) { 
    document.getElementById('target-type').value = type;

    const btns = document.querySelectorAll(
        '#target-type-segment .segmented-btn'
    );

    btns.forEach((btn, index) => {
        btn.classList.toggle(
            'active',
            (index === 0 && type === 'biasa') ||
            (index === 1 && type === 'investasi')
        );
    });

    if(type === 'investasi') { 
        document.getElementById('label-name').innerText = "Nama Investasi (Aset)"; 
        document.getElementById('label-amount').innerText = "Target Modal (Opsional)"; 
        document.getElementById('label-current-amount').innerText = "Modal Awal yang Sudah Ada (Rp)"; 
    } 
    else { 
        document.getElementById('label-name').innerText = "Nama Tabungan / Tujuan"; 
        document.getElementById('label-amount').innerText = "Target Uang (Rp)"; 
        document.getElementById('label-current-amount').innerText = "Saldo Tabungan Saat Ini (Rp)"; 
    }
};

window.openTargetModal = function(id = null) {
    document.getElementById('target-error-msg').style.display = 'none';
    if (id) { 
        const t = window.targets.find(x => String(x.id) === String(id)); document.getElementById('target-modal-title').innerText = 'Edit Data'; document.getElementById('target-id').value = t.id; document.getElementById('target-name').value = t.name; document.getElementById('target-amount').value = Number(t.targetAmount||0) === 0 ? '' : window.formatNumberWithDot(t.targetAmount.toString()); document.getElementById('target-current-amount').value = Number(t.currentAmount||0) === 0 ? '' : window.formatNumberWithDot(t.currentAmount.toString()); document.getElementById('target-deadline').value = t.deadline || ''; window.selectTargetType(t.tipe || 'biasa'); 
    } else { 
        document.getElementById('target-modal-title').innerText = 'Buat Baru'; document.getElementById('target-id').value = ''; document.getElementById('target-name').value = ''; document.getElementById('target-amount').value = ''; document.getElementById('target-current-amount').value = ''; document.getElementById('target-deadline').value = ''; window.selectTargetType('biasa');
    }
    document.getElementById('modal-target').classList.add('show');
};

window.simpanTarget = async function() {
    const id = document.getElementById('target-id').value; const tipe = document.getElementById('target-type').value; const name = window.escapeHTML(document.getElementById('target-name').value.trim()); const targetAmount = window.parseRupiah(document.getElementById('target-amount').value) || 0; const currentAmount = window.parseRupiah(document.getElementById('target-current-amount').value) || 0; const deadline = document.getElementById('target-deadline').value; const errBox = document.getElementById('target-error-msg');
    if (!name) { errBox.innerText = "Nama wajib diisi!"; errBox.style.display = 'block'; return; }
    
    if (id) { 
        const idx = window.targets.findIndex(t => String(t.id) == String(id)); const selisihModal = currentAmount - Number(window.targets[idx].currentAmount||0);
        window.targets[idx].name = name; window.targets[idx].tipe = tipe; window.targets[idx].targetAmount = targetAmount; window.targets[idx].currentAmount = currentAmount; window.targets[idx].deadline = deadline;
        if (tipe === 'biasa') { window.targets[idx].nilaiTerkini = currentAmount; } else if (tipe === 'investasi') { window.targets[idx].nilaiTerkini = Number(window.targets[idx].nilaiTerkini||0) + selisihModal; if(window.targets[idx].nilaiTerkini < 0) window.targets[idx].nilaiTerkini = 0; }
    } else { window.targets.push({ id: window.generateUUID(), tipe, name, targetAmount, currentAmount: currentAmount, nilaiTerkini: currentAmount, deadline: deadline }); }
    window.closeModal('modal-target'); await window.saveDataToFirestore();
};

window.hapusTarget = function(id) {
    window.customConfirm("Hapus Target?", "Menghapus target ini akan mengembalikan semua saldo setoran ke dompet asal serta menghapus riwayat transaksinya. Lanjutkan?", async () => {
        
        const trxTerkait = window.transactions.filter(t => String(t.targetId) === String(id));
        window.transactions = window.transactions.filter(t => String(t.targetId) !== String(id));
        window.targets = window.targets.filter(x => String(x.id) !== String(id));
        window.recalculateBalances(); 
        
        if (window.currentUserId) {
            try {
                const batch = writeBatch(db);
                trxTerkait.forEach(trx => {
                    batch.delete(doc(db, "users", window.currentUserId, "transactions", String(trx.id)));
                });
                batch.set(doc(db, "users", window.currentUserId), { 
                    wallets: window.wallets, targets: window.targets, categories: window.categories, notifications: window.notifications, kmRecords: window.kmRecords, vehicleSettings: window.vehicleSettings 
                }, { merge: true });
                
                await batch.commit();
                window.callPageRender();
            } catch (e) {
                console.error(e);
                window.customAlert("Error", "Gagal menghapus target di database.", "error");
            }
        }
    });
};

window.selectActionWallet = function(id, el) { document.getElementById('action-wallet').value = id; document.querySelectorAll('#action-wallet-chips .chip').forEach(c => c.classList.remove('active')); el.classList.add('active'); };

window.openActionModal = function(id, type) {
    const t = window.targets.find(x => String(x.id) === String(id)); if(!t) return;
    document.getElementById('action-error-msg').style.display = 'none'; document.getElementById('action-target-id').value = t.id; document.getElementById('action-type').value = type; document.getElementById('action-amount').value = ''; 
    let valTerkini = Number(t.nilaiTerkini !== undefined ? t.nilaiTerkini : t.currentAmount||0);
    document.getElementById('update-amount').value = valTerkini > 0 ? window.formatNumberWithDot(valTerkini.toString()) : '';
    
    const areaTrx = document.getElementById('area-transaksi'); const areaUpdate = document.getElementById('area-update-nilai'); const title = document.getElementById('action-modal-title'); const btnSubmit = document.getElementById('btn-action-submit'); const walletLabel = document.getElementById('action-wallet-label');

    if (type === 'update') {
        title.innerText = `Update Nilai Terkini`; areaTrx.style.display = 'none'; areaUpdate.style.display = 'block'; btnSubmit.innerText = "Simpan Nilai Pasar"; btnSubmit.style.background = "#16a34a";
    } else {
        areaTrx.style.display = 'block'; areaUpdate.style.display = 'none';
        if(type === 'setor') { title.innerText = t.tipe === 'investasi' ? `Top Up` : `Setor Tabungan`; walletLabel.innerText = "Sumber Dana (Dari dompet mana?)"; btnSubmit.innerText = "Simpan Setoran"; btnSubmit.style.background = "linear-gradient(135deg, #249a95 0%, #1e8580 100%)"; } 
        else if(type === 'tarik') { title.innerText = `Jual / Tarik Dana`; walletLabel.innerText = "Tujuan Dana (Masuk ke dompet mana?)"; btnSubmit.innerText = "Simpan Penarikan"; btnSubmit.style.background = "#e11d48"; }

        const chipContainer = document.getElementById('action-wallet-chips');
        const dompetAktif = window.wallets.filter(w => !w.isArchived);

        if(dompetAktif.length === 0) { chipContainer.innerHTML = `<span style="font-size:12px; color:#e11d48;">Anda belum punya dompet.</span>`; document.getElementById('action-wallet').value = ''; } 
        else { let wHTML = ''; let defaultWallet = dompetAktif[0].id; dompetAktif.forEach(w => { wHTML += `<div class="chip ${w.id == defaultWallet ? 'active' : ''}" onclick="window.selectActionWallet('${w.id}', this)"><span class="material-icons-round" style="font-size:16px">${w.icon}</span> ${window.escapeHTML(w.name)}</div>`; }); chipContainer.innerHTML = wHTML; document.getElementById('action-wallet').value = defaultWallet; }
    }
    document.getElementById('modal-action').classList.add('show');
};

window.prosesAksiTarget = async function() {
    const submitBtn = document.getElementById('btn-action-submit');
    if(submitBtn && submitBtn.disabled) return;
    
    const id = document.getElementById('action-target-id').value; const type = document.getElementById('action-type').value; const errBox = document.getElementById('action-error-msg');
    const targetIndex = window.targets.findIndex(t => String(t.id) === String(id)); if(targetIndex === -1) return; const t = window.targets[targetIndex];

    if (type === 'update') { 
        const newNilai = window.parseRupiah(document.getElementById('update-amount').value) || 0; 
        window.targets[targetIndex].nilaiTerkini = newNilai; 
        window.closeModal('modal-action'); await window.saveDataToFirestore(); 
        return; 
    }

    const walletId = document.getElementById('action-wallet').value; const amount = window.parseRupiah(document.getElementById('action-amount').value);
    if (!amount || amount <= 0 || !walletId) { errBox.innerText = "Nominal atau dompet tidak valid."; errBox.style.display = 'block'; return; }
    const wallet = window.wallets.find(w => String(w.id) === String(walletId));
    
    if(submitBtn) { submitBtn.disabled = true; submitBtn.innerText = "Memproses..."; }
    const originalTransactions = JSON.parse(JSON.stringify(window.transactions));

    try {
        if (type === 'setor') {
            if(amount > Number(wallet.balance||0)) { errBox.innerText = `Saldo dompet tidak cukup! Sisa: ${window.formatRupiah(wallet.balance)}`; errBox.style.display = 'block'; return; }
            wallet.balance = Number(wallet.balance||0) - amount;
            const newTrx = { id: window.generateUUID(), type: 'out', amount: amount, note: `Setor/Top Up: ${t.name}`, walletId: wallet.id, walletName: wallet.name, categoryId: 999, categoryName: 'Alokasi Target', date: window.getLocalDateString(), targetId: t.id };
            window.transactions.push(newTrx);
            window.targets[targetIndex].currentAmount = Number(t.currentAmount||0) + amount; 
            if(t.tipe === 'investasi') window.targets[targetIndex].nilaiTerkini = Number(t.nilaiTerkini||t.currentAmount||0) + amount; 
            
            await window.saveTransactionToDB(newTrx);
        } else if (type === 'tarik') {
            const maxTarik = t.tipe === 'investasi' ? Number(t.nilaiTerkini||t.currentAmount||0) : Number(t.currentAmount||0);
            if(amount > maxTarik) { errBox.innerText = `Maksimal penarikan: ${window.formatRupiah(maxTarik)}`; errBox.style.display = 'block'; return; }

            wallet.balance = Number(wallet.balance||0) + amount;

            if(t.tipe === 'investasi') {
                let currAmt = Number(t.currentAmount||0);
                let valTerkini = Number(t.nilaiTerkini||currAmt);
                let persentaseDitarik = valTerkini > 0 ? (amount / valTerkini) : 0; 
                if (persentaseDitarik > 1) persentaseDitarik = 1; 
                let potonganModal = currAmt * persentaseDitarik;
                
                const newTrx = { id: window.generateUUID(), type: 'in', amount: amount, note: `Jual/Tarik: ${t.name}`, walletId: wallet.id, walletName: wallet.name, categoryId: 999, categoryName: 'Pencairan Investasi', date: window.getLocalDateString(), targetId: t.id, modalDeducted: potonganModal };
                window.transactions.push(newTrx);
                window.targets[targetIndex].nilaiTerkini = Math.max(0, valTerkini - amount);
                window.targets[targetIndex].currentAmount = Math.max(0, currAmt - potonganModal);
                await window.saveTransactionToDB(newTrx);
            } else {
                const newTrx = { id: window.generateUUID(), type: 'in', amount: amount, note: `Jual/Tarik: ${t.name}`, walletId: wallet.id, walletName: wallet.name, categoryId: 999, categoryName: 'Pencairan Investasi', date: window.getLocalDateString(), targetId: t.id };
                window.transactions.push(newTrx);
                window.targets[targetIndex].currentAmount = Math.max(0, Number(t.currentAmount||0) - amount);
                await window.saveTransactionToDB(newTrx);
            }
        }

        window.recalculateBalances(); 
        await window.saveDataToFirestore();
        window.closeModal('modal-action');
    } catch(e) {
        window.transactions = originalTransactions; window.recalculateBalances();
        window.customAlert("Error", "Gagal memproses aksi.", "error");
    } finally {
        if(submitBtn) { submitBtn.disabled = false; submitBtn.innerText = "Simpan"; }
    }
};

// ==========================================
// 15. REGISTRASI SERVICE WORKER (PWA & FCM)
// ==========================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(registration => {
                console.log('[PWA] Service Worker terdaftar dengan scope:', registration.scope);
                
                if (messaging) {
                    getToken(messaging, { 
                        vapidKey: "MASUKKAN_VAPID_KEY_FIREBASE_KAMU_DI_SINI", // <-- TETAP MASUKKAN KODEMU DI SINI
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
// 16. FITUR EKSPOR DATA JSON BACKUP
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
