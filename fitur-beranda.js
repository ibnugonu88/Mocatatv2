// ============================================================
// MOCATAT - FITUR BERANDA & DASHBOARD (fitur-beranda.js)
// Mencakup: Dashboard, Slide 3 Fitur (Oli, Radar, Edukasi) & Notifikasi (Bisa Dihapus)
// ============================================================

import { db, doc, setDoc } from "./core.js";
import "./fitur-transaksi.js";
import "./fitur-admin.js";

// ==========================================
// 1. NAVIGASI TAB & NOTIFIKASI BERANDA (DENGAN FITUR HAPUS)
// ==========================================
window.switchTab = function(pageId, navIndex) {
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    if (navIndex !== null && navIndex !== undefined) { 
        document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active')); 
        const items = document.querySelectorAll('.nav-item'); 
        if (items[navIndex]) items[navIndex].classList.add('active'); 
    }
    const tgt = document.getElementById(pageId); 
    if (tgt) tgt.classList.add('active'); 
    if (pageId === 'page-akun' && typeof window.updateNotifStatusUI === 'function') {
        window.updateNotifStatusUI();
    }
    window.scrollTo(0, 0);
};

// Catat ID broadcast yang sudah pernah masuk agar tidak muncul lagi setelah dihapus user
window.markBroadcastIdsAsSeen = function(notifArray) {
    if (!window.currentUserId || !Array.isArray(notifArray)) return;
    const seenKey = "mocatat_seen_broadcasts_" + window.currentUserId;
    let seenIds = [];
    try {
        seenIds = JSON.parse(localStorage.getItem(seenKey) || "[]");
    } catch (e) {}

    let changed = false;
    notifArray.forEach(n => {
        if (n && n.id && !seenIds.includes(n.id)) {
            seenIds.push(n.id);
            changed = true;
        }
    });

    if (changed) {
        try { localStorage.setItem(seenKey, JSON.stringify(seenIds)); } catch (e) {}
    }
};

window.bukaNotifikasi = function() { 
    window.switchTab('page-notifikasi', null); 
    window.markBroadcastIdsAsSeen(window.notifications);

    let adaYangDiubah = false; 
    window.notifications.forEach(n => { 
        if (!n.read) { n.read = true; adaYangDiubah = true; } 
    }); 
    if (adaYangDiubah) { 
        window.renderNotifications(); 
        if (typeof window.saveDataToFirestoreSilently === 'function') {
            window.saveDataToFirestoreSilently(); 
        }
    } 
};

window.hapusNotifikasiUser = async function(notifId, fallbackIndex) {
    if (!Array.isArray(window.notifications)) return;

    // Pastikan ID tercatat sudah dilihat supaya tidak masuk ulang saat refresh
    window.markBroadcastIdsAsSeen(window.notifications);

    if (notifId && notifId !== 'undefined' && notifId !== '') {
        const idx = window.notifications.findIndex(n => String(n.id) === String(notifId));
        if (idx !== -1) {
            window.notifications.splice(idx, 1);
        } else if (fallbackIndex !== undefined && window.notifications[fallbackIndex]) {
            window.notifications.splice(fallbackIndex, 1);
        }
    } else if (fallbackIndex !== undefined && window.notifications[fallbackIndex]) {
        window.notifications.splice(fallbackIndex, 1);
    }

    window.renderNotifications();

    if (typeof window.saveDataToFirestoreSilently === 'function') {
        window.saveDataToFirestoreSilently();
    }
    if (window.currentUserId) {
        try {
            await setDoc(doc(db, "users", window.currentUserId), {
                notifications: window.notifications
            }, { merge: true });
        } catch (e) {}
    }
};

window.hapusSemuaNotifikasiUser = function() {
    if (!Array.isArray(window.notifications) || window.notifications.length === 0) return;

    window.customConfirm(
        "Bersihkan Notifikasi?",
        "Yakin ingin menghapus seluruh pesan notifikasi di daftar ini?",
        async () => {
            window.markBroadcastIdsAsSeen(window.notifications);
            window.notifications = [];
            window.renderNotifications();

            if (typeof window.saveDataToFirestoreSilently === 'function') {
                window.saveDataToFirestoreSilently();
            }
            if (window.currentUserId) {
                try {
                    await setDoc(doc(db, "users", window.currentUserId), {
                        notifications: []
                    }, { merge: true });
                } catch (e) {}
            }
        }
    );
};

window.renderNotifications = function() {
    const container = document.getElementById('notif-page-container'); 
    const badge = document.getElementById('notif-badge');
    if (!container) return; 

    let unreadCount = 0; 
    if (!Array.isArray(window.notifications) || window.notifications.length === 0) { 
        container.innerHTML = `<div class="empty-state"><div class="icon-wrapper"><span class="material-icons-round">notifications_off</span></div><h4>Belum ada notifikasi</h4></div>`; 
        if (badge) badge.style.display = 'none'; 
        return; 
    }

    // Beri ID otomatis jika ada notifikasi lama yang belum punya ID
    window.notifications.forEach((n, idx) => {
        if (!n.id) n.id = 'notif-old-' + idx + '-' + Date.now();
        if (!n.read) unreadCount++;
    });

    const sorted = [...window.notifications].sort((a,b) => new Date(b.date||'1970-01-01') - new Date(a.date||'1970-01-01'));

    let html = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding: 0 2px;">
            <span style="font-size: 12px; font-weight: 700; color: #64748b;">${sorted.length} Pesan Notifikasi</span>
            <button onclick="window.hapusSemuaNotifikasiUser()" style="background: #fee2e2; color: #dc2626; border: none; padding: 6px 11px; border-radius: 8px; font-size: 11px; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; font-family: inherit;">
                <span class="material-icons-round" style="font-size: 14px;">delete_sweep</span> Bersihkan Semua
            </button>
        </div>
    `;

    sorted.forEach((notif, idx) => {
        const bg = notif.read ? 'white' : '#e0f2f1';
        const safeId = window.escapeHTML(String(notif.id || '')).replace(/'/g, "\\'");
        html += `
        <div style="background: ${bg}; padding: 15px 16px; border-radius: 16px; margin-bottom: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.025); border: 1px solid #f1f5f9;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin-bottom: 4px;">
                <div style="font-size: 14px; font-weight: 800; color: #1a1a1a; line-height: 1.35;">${window.escapeHTML(notif.title)}</div>
                <button onclick="window.hapusNotifikasiUser('${safeId}', ${idx})" title="Hapus Pesan" style="background: #fff1f2; color: #e11d48; border: none; width: 28px; height: 28px; border-radius: 8px; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0;">
                    <span class="material-icons-round" style="font-size: 16px;">delete_outline</span>
                </button>
            </div>
            <div style="font-size: 12.5px; color: #475569; margin-bottom: 8px; line-height: 1.5;">${window.escapeHTML(notif.body)}</div>
            <div style="font-size: 10.5px; color: #94a3b8; font-weight: 700;">🗓️ ${window.escapeHTML(notif.date)}</div>
        </div>`;
    });

    container.innerHTML = html; 
    if (badge) badge.style.display = unreadCount > 0 ? 'block' : 'none';
};

// ==========================================
// 2. SLIDE 3 FITUR (MONITOR OLI, RADAR, EDUKASI)
// ==========================================
window.ensureRedesignStyles = function() {
    if (!document.getElementById('beranda-redesign-styles')) {
        const st = document.createElement('style');
        st.id = 'beranda-redesign-styles';
        st.innerHTML = `
            .trio-slider-track {
                display: flex;
                gap: 12px;
                overflow-x: auto;
                scroll-snap-type: x mandatory;
                scrollbar-width: none;
                -ms-overflow-style: none;
                padding: 2px 2px 6px 2px;
            }
            .trio-slider-track::-webkit-scrollbar { display: none; }
            .trio-slide-card {
                flex: 0 0 88%;
                box-sizing: border-box;
                scroll-snap-align: center;
                background: white;
                border-radius: 18px;
                padding: 15px 16px;
                border: 1.5px solid #e2e8f0;
                box-shadow: 0 4px 14px rgba(0,0,0,0.035);
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                transition: transform 0.15s ease;
            }
            .trio-slide-card:active {
                transform: scale(0.985);
            }
            .trio-left {
                display: flex;
                align-items: center;
                gap: 13px;
                min-width: 0;
                flex: 1;
            }
            .trio-icon {
                width: 44px;
                height: 44px;
                border-radius: 13px;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
            }
            .trio-badge {
                font-size: 9.5px;
                font-weight: 800;
                padding: 2px 7px;
                border-radius: 6px;
                display: inline-block;
                margin-bottom: 3px;
                text-transform: uppercase;
                letter-spacing: 0.4px;
            }
            .trio-title {
                font-size: 13.5px;
                font-weight: 800;
                color: #1a1a1a;
                margin-bottom: 2px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .trio-desc {
                font-size: 11.5px;
                font-weight: 600;
                color: #64748b;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .trio-dots {
                display: flex;
                justify-content: center;
                align-items: center;
                gap: 6px;
                margin-top: 6px;
            }
            .trio-dot {
                width: 6px;
                height: 6px;
                border-radius: 50%;
                background: #cbd5e1;
                transition: all 0.25s ease;
                cursor: pointer;
            }
            .trio-dot.active {
                width: 18px;
                border-radius: 4px;
                background: #249a95;
            }
        `;
        document.head.appendChild(st);
    }
};

window.onTrioSlideScroll = function(el) {
    const cardWidth = el.querySelector('.trio-slide-card')?.offsetWidth || el.clientWidth;
    const idx = Math.min(2, Math.max(0, Math.round(el.scrollLeft / (cardWidth || 1))));
    const dots = document.querySelectorAll('#trio-slider-dots .trio-dot');
    dots.forEach((d, i) => d.classList.toggle('active', i === idx));
};

window.scrollToTrioSlide = function(index) {
    const track = document.getElementById('trio-slider-track');
    if (!track) return;
    const cards = track.querySelectorAll('.trio-slide-card');
    if (cards[index]) {
        cards[index].scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
};

window.setupRedesignedBerandaLayout = function() {
    window.ensureRedesignStyles();

    const pageDash = document.getElementById('page-dashboard');
    if (!pageDash) return;

    const oldLokasiInfo = document.getElementById('info-daerah-beranda');
    const oldLokasiCard = oldLokasiInfo ? oldLokasiInfo.closest('a[href*="lokasi"], [onclick*="lokasi"]') : null;

    let oldOliCard = null;
    const oliCandidates = pageDash.querySelectorAll('a[href*="kendaraan"], [onclick*="kendaraan"]');
    oliCandidates.forEach(el => {
        if (!el.classList.contains('menu-item') && !el.classList.contains('nav-item') && !el.closest('.menu-grid') && !el.closest('#mocatat-home-hub')) {
            oldOliCard = el;
        }
    });

    const anchorCard = oldOliCard || oldLokasiCard;

    let hubContainer = document.getElementById('mocatat-home-hub');
    if (!hubContainer) {
        hubContainer = document.createElement('div');
        hubContainer.id = 'mocatat-home-hub';

        if (anchorCard && anchorCard.parentNode) {
            const cs = window.getComputedStyle(anchorCard);
            hubContainer.style.marginLeft = cs.marginLeft || '0px';
            hubContainer.style.marginRight = cs.marginRight || '0px';
            hubContainer.style.marginTop = cs.marginTop || '0px';
            hubContainer.style.marginBottom = cs.marginBottom && cs.marginBottom !== '0px' ? cs.marginBottom : '18px';
            anchorCard.parentNode.insertBefore(hubContainer, anchorCard);
        } else {
            const trxContainer = document.getElementById('transaction-container');
            if (trxContainer && trxContainer.parentNode) {
                hubContainer.style.margin = '0 20px 18px 20px';
                trxContainer.parentNode.insertBefore(hubContainer, trxContainer);
            }
        }
    }

    if (oldLokasiCard) oldLokasiCard.style.display = 'none';
    if (oldOliCard) oldOliCard.style.display = 'none';

    if (!hubContainer) return;

    // Slide 1: Monitor Oli & KM
    const accKm = Number((window.vehicleSettings && window.vehicleSettings.accumulatedKmForOil) || 0);
    const activeTrip = window.vehicleSettings ? window.vehicleSettings.activeTrip : null;
    const kmFormatted = accKm.toFixed(1).replace('.', ',');
    let oliBadgeText = '🏍️ MOTOR AMAN';
    let oliBadgeBg = '#fff3e0';
    let oliBadgeColor = '#ef6c00';
    let oliDescText = `Jarak Oli: ${kmFormatted} / 2.000 KM`;

    if (activeTrip) {
        oliBadgeText = '🟢 TRIP AKTIF';
        oliBadgeBg = '#dcfce7';
        oliBadgeColor = '#15803d';
        oliDescText = `KM Awal: ${activeTrip.kmAwal} • Tap untuk selesai`;
    } else if (accKm >= 2000) {
        oliBadgeText = '⚠️ GANTI OLI!';
        oliBadgeBg = '#fee2e2';
        oliBadgeColor = '#b91c1c';
        oliDescText = `Sudah ${kmFormatted} KM (Waktunya ganti oli)`;
    } else {
        oliBadgeText = `⛽ ${Math.min(100, Math.round((accKm / 2000) * 100))}% UMUR OLI`;
    }

    // Slide 2: Radar & Lokasi Mangkal
    const totalDaerah = Array.isArray(window.zones) ? window.zones.length : 0;
    const totalTitik = Array.isArray(window.zones) ? window.zones.reduce((acc, z) => acc + (z.locations ? z.locations.length : 0), 0) : 0;
    const labelLokasi = totalDaerah > 0 ? `${totalDaerah} Daerah • ${totalTitik} Titik Mangkal aktif` : `Kelola daerah & cek titik gacor per jam`;

    // Slide 3: Edukasi & Simulasi Investasi
    const eduCount = typeof window.getEduCount === 'function' ? window.getEduCount() : 5;

    hubContainer.innerHTML = `
        <div class="trio-slider-track" id="trio-slider-track" onscroll="window.onTrioSlideScroll(this)">
            
            <!-- SLIDE 1: MONITOR OLI & KM MOTOR -->
            <div class="trio-slide-card" onclick="window.location.href='kendaraan.html'">
                <div class="trio-left">
                    <div class="trio-icon" style="background:${oliBadgeBg}; color:${oliBadgeColor};">
                        <span class="material-icons-round" style="font-size:22px;">two_wheeler</span>
                    </div>
                    <div style="min-width:0;">
                        <span class="trio-badge" style="background:${oliBadgeBg}; color:${oliBadgeColor};">${oliBadgeText}</span>
                        <div class="trio-title">Monitor Oli & KM Motor</div>
                        <div class="trio-desc">${window.escapeHTML(oliDescText)}</div>
                    </div>
                </div>
                <span class="material-icons-round" style="color:#cbd5e1; font-size:20px; flex-shrink:0;">chevron_right</span>
            </div>

            <!-- SLIDE 2: RADAR & LOKASI MANGKAL -->
            <div class="trio-slide-card" onclick="window.location.href='lokasi.html'">
                <div class="trio-left">
                    <div class="trio-icon" style="background:#e0f2f1; color:#249a95;">
                        <span class="material-icons-round" style="font-size:22px;">radar</span>
                    </div>
                    <div style="min-width:0;">
                        <span class="trio-badge" style="background:#e0f2f1; color:#0f766e;">📍 STRATEGI GACOR</span>
                        <div class="trio-title">Lokasi & Radar Mangkal</div>
                        <div class="trio-desc">${window.escapeHTML(labelLokasi)}</div>
                    </div>
                </div>
                <span class="material-icons-round" style="color:#cbd5e1; font-size:20px; flex-shrink:0;">chevron_right</span>
            </div>

            <!-- SLIDE 3: EDUKASI REKSADANA & SAHAM -->
            <div class="trio-slide-card" onclick="window.location.href='edukasi.html'">
                <div class="trio-left">
                    <div class="trio-icon" style="background:#ede9fe; color:#4338ca;">
                        <span class="material-icons-round" style="font-size:22px;">school</span>
                    </div>
                    <div style="min-width:0;">
                        <span class="trio-badge" style="background:#ede9fe; color:#4338ca;">📈 LITERASI CUAN</span>
                        <div class="trio-title">Edukasi & Simulasi Investasi</div>
                        <div class="trio-desc">${eduCount} Materi Reksadana, Saham & Kalkulator</div>
                    </div>
                </div>
                <span class="material-icons-round" style="color:#cbd5e1; font-size:20px; flex-shrink:0;">chevron_right</span>
            </div>

        </div>
        <div class="trio-dots" id="trio-slider-dots">
            <div class="trio-dot active" onclick="window.scrollToTrioSlide(0)"></div>
            <div class="trio-dot" onclick="window.scrollToTrioSlide(1)"></div>
            <div class="trio-dot" onclick="window.scrollToTrioSlide(2)"></div>
        </div>
    `;
};

// ==========================================
// 3. RENDER UTAMA BERANDA (DASHBOARD)
// ==========================================
window.renderDashboard = function() {
    const walletContainer = document.getElementById('wallet-container'); 
    if (!walletContainer) return;
    window.renderNotifications(); 
    if (typeof window.updateNotifStatusUI === 'function') window.updateNotifStatusUI();

    let totalSaldo = 0; 
    let wHTML = '';
    
    const dompetAktif = window.wallets.filter(w => !w.isArchived);
    dompetAktif.forEach(wallet => { 
        totalSaldo += Number(wallet.balance||0);
        wHTML += `<div class="wallet-card"><div class="wallet-name"><span class="material-icons-round ${wallet.colorClass}">${wallet.icon}</span> ${window.escapeHTML(wallet.name)}</div><div class="wallet-saldo">${window.formatRupiah(wallet.balance)}</div></div>`; 
    });
    walletContainer.innerHTML = wHTML; 
    
    let totalAset = 0;
    window.targets.forEach(t => {
        let val = t.tipe === 'investasi' ? Number(t.nilaiTerkini || t.currentAmount || 0) : Number(t.currentAmount || 0);
        totalAset += val;
    });

    let kekayaanBersih = totalSaldo + totalAset;
    
    if (document.getElementById('net-worth')) document.getElementById('net-worth').innerText = window.formatRupiah(kekayaanBersih);
    if (document.getElementById('total-balance')) document.getElementById('total-balance').innerText = window.formatRupiah(totalSaldo);
    if (document.getElementById('total-asset')) document.getElementById('total-asset').innerText = window.formatRupiah(totalAset);

    const allocationCard = document.getElementById('smart-allocation-card');
    if (allocationCard) {
        if (totalSaldo > 50000) { 
            allocationCard.style.display = 'block'; 
            const todayStr = window.getLocalDateString();
            const sudahNabung = window.transactions.some(t => t.date === todayStr && String(t.categoryId) === '999' && t.type === 'out' && t.categoryName === 'Alokasi Target');
            const btnTarget = document.getElementById('btn-masuk-target'); 
            const btnReward = document.getElementById('btn-self-reward'); 
            const teksSaran = document.getElementById('teks-saran-alokasi'); 
            const judulSaran = document.getElementById('judul-saran-alokasi');
            if (sudahNabung) {
                judulSaran.innerText = "Target Harian Selesai! 🎉"; 
                judulSaran.style.color = "#2e7d32"; 
                allocationCard.style.background = "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)"; 
                allocationCard.style.border = "1px solid #86efac"; 
                allocationCard.querySelector('.material-icons-round').parentNode.style.background = "#bbf7d0"; 
                allocationCard.querySelector('.material-icons-round').parentNode.style.color = "#16a34a"; 
                allocationCard.querySelector('.material-icons-round').innerText = "task_alt";
                teksSaran.innerHTML = `Kewajiban nabung hari ini sudah beres. Sisa uang cair <strong style="color: #16a34a;">${window.formatRupiah(totalSaldo)}</strong> bebas kamu pakai buat jajan!`;
                if (btnTarget) btnTarget.style.display = 'none'; 
                if (btnReward) { 
                    btnReward.style.background = '#16a34a'; 
                    btnReward.style.color = 'white'; 
                    btnReward.innerText = "Nikmati Self-Reward ☕"; 
                    btnReward.onclick = () => window.customAlert('Enjoy! 🎉', 'Silakan pakai uang sisanya buat santai hari ini!'); 
                }
            } else {
                judulSaran.innerText = "Saran Alokasi Sisa Uang"; 
                judulSaran.style.color = "#f57f17"; 
                allocationCard.style.background = "linear-gradient(135deg, #fffde7 0%, #fff9c4 100%)"; 
                allocationCard.style.border = "1px solid #ffee58"; 
                allocationCard.querySelector('.material-icons-round').parentNode.style.background = "#fff59d"; 
                allocationCard.querySelector('.material-icons-round').parentNode.style.color = "#f57f17"; 
                allocationCard.querySelector('.material-icons-round').innerText = "lightbulb";
                const saranNominal = Math.floor(totalSaldo * 0.2); 
                
                let activeTargets = window.targets.filter(t => {
                    if (t.isActive === false) return false;
                    const terkumpul = t.tipe === 'investasi' ? Number(t.nilaiTerkini || t.currentAmount || 0) : Number(t.currentAmount || 0);
                    return Number(t.targetAmount || 0) === 0 || terkumpul < Number(t.targetAmount || 0);
                }); 
                activeTargets.sort((a, b) => new Date(a.deadline||'2099-01-01') - new Date(a.deadline||'2099-01-01'));
                
                let saranTargetText = "";
                if (activeTargets.length > 0) { 
                    saranTargetText = `Amankan 20% (<strong>${window.formatRupiah(saranNominal)}</strong>) ke target <strong>${window.escapeHTML(activeTargets[0].name)}</strong>!`; 
                    if (btnTarget) btnTarget.innerText = "Setor Tabungan"; 
                } else { 
                    saranTargetText = `Amankan 20% (<strong>${window.formatRupiah(saranNominal)}</strong>) buat target impianmu!`; 
                    if (btnTarget) btnTarget.innerText = "Buat Target Baru"; 
                }
                teksSaran.innerHTML = `Kamu punya saldo cair <strong style="color: #1a1a1a;">${window.formatRupiah(totalSaldo)}</strong>. ${saranTargetText}`;
                if (btnTarget) { 
                    btnTarget.style.display = 'block'; 
                    btnTarget.style.background = 'white'; 
                    btnTarget.style.border = '1.5px solid #fbc02d'; 
                    btnTarget.style.color = '#f57f17'; 
                    btnTarget.onclick = function() { 
                        if (activeTargets.length > 0) { window.location.href = `target.html?action=setor&id=${activeTargets[0].id}`; } 
                        else { window.location.href = `target.html?action=baru`; } 
                    }; 
                }
                if (btnReward) { 
                    btnReward.style.background = '#ffe0b2'; 
                    btnReward.style.color = '#ef6c00'; 
                    btnReward.innerText = "Self Reward"; 
                    btnReward.onclick = () => window.customAlert('Akses Ditolak!', 'Nabung dulu sebelum jajan! 🛑', 'warning'); 
                }
            }
        } else { allocationCard.style.display = 'none'; }
    }

    const historyContainer = document.getElementById('transaction-container');
    if (window.transactions.length === 0) {
        historyContainer.innerHTML = `<div class="empty-state"><div class="icon-wrapper"><span class="material-icons-round">receipt_long</span></div><h4>Belum ada catatan</h4></div>`;
    } else {
        const sortedTrx = [...window.transactions].sort((a,b) => {
            const dtA = new Date((a.date||'1970-01-01') + 'T' + (a.time||'00:00')).getTime();
            const dtB = new Date((b.date||'1970-01-01') + 'T' + (b.time||'00:00')).getTime();
            return dtB - dtA;
        });
        let dashHTML = '', lastDateDash = '';
        sortedTrx.slice(0, 5).forEach(trx => {
            if (trx.date !== lastDateDash) { 
                dashHTML += `<div class="date-divider">${window.escapeHTML(trx.date)}</div>`; 
                lastDateDash = trx.date; 
            }
            dashHTML += window.generateTrxHTML(trx, false);
        }); 
        historyContainer.innerHTML = dashHTML;
    }

    // Pasang Slide 3 Sekawan & Sinkronisasi Konten Edukasi
    window.setupRedesignedBerandaLayout();
    if (typeof window.syncCMSFromFirestoreOnce === 'function') {
        window.syncCMSFromFirestoreOnce();
    }
};
