// ============================================================
// MOCATAT - FITUR BERANDA, TRANSAKSI & RIWAYAT (fitur-beranda.js)
// Mencakup: Modal Input Transaksi, Dashboard, Notifikasi & riwayat.html
// ============================================================

import { db, doc, writeBatch } from "./core.js";

// ==========================================
// 7. TRANSAKSI LOGIC
// ==========================================
window.selectTrxWallet = function(id, el) { 
    document.getElementById('input-wallet').value = id; 
    document.querySelectorAll('#input-wallet-chips .chip').forEach(c => c.classList.remove('active')); 
    el.classList.add('active'); 
};

window.selectTrxCategory = function(id, el) { 
    document.getElementById('input-category').value = id; 
    document.querySelectorAll('#input-category-chips .chip').forEach(c => c.classList.remove('active')); 
    el.classList.add('active'); 
};

window.selectTrxTargetWallet = function(id, el) { 
    document.getElementById('input-target-wallet').value = id; 
    document.querySelectorAll('#input-target-wallet-chips .chip').forEach(c => c.classList.remove('active')); 
    el.classList.add('active'); 
};

window.selectGrabService = function(service, el) {
    const hiddenInput = document.getElementById('input-grab-service'); 
    const noteInput = document.getElementById('input-note');
    if (hiddenInput.value === service) { 
        hiddenInput.value = ''; 
        el.classList.remove('grab-active'); 
        if (noteInput.value === service) noteInput.value = ''; 
    } else { 
        document.querySelectorAll('.grab-chip').forEach(c => c.classList.remove('grab-active')); 
        el.classList.add('grab-active'); 
        hiddenInput.value = service; 
        if (noteInput.value === '' || ['GrabBike', 'GrabBike Hemat', 'GrabCar', 'GrabFood', 'GrabExpress', 'GrabMart'].includes(noteInput.value)) { 
            noteInput.value = service; 
        } 
    }
};

window.pilihLokasiCepat = function(namaLokasi, el) {
    const locInput = document.getElementById('input-location');
    if (!locInput) return;
    locInput.value = namaLokasi;
    document.querySelectorAll('#location-quick-chips .chip').forEach(c => c.classList.remove('active'));
    if (el) el.classList.add('active');
};

window.openModalTrans = function(type, trxId = null) {
    if(!document.getElementById('modal-input')) return;
    const isTransfer = type === 'transfer'; 
    document.getElementById('input-type').value = type; 
    document.getElementById('modal-title').innerText = isTransfer ? 'Transfer Antar Dompet' : (type === 'in' ? (trxId ? 'Edit Pemasukan' : 'Pemasukan Baru') : (trxId ? 'Edit Pengeluaran' : 'Pengeluaran Baru'));
    document.getElementById('error-msg').style.display = 'none'; 
    document.getElementById('input-trx-id').value = trxId || '';
    
    const catGroup = document.getElementById('category-group-container');
    const targetGroup = document.getElementById('target-wallet-group');
    if (isTransfer) { 
        catGroup.style.display = 'none'; 
        targetGroup.style.display = 'block'; 
    } else { 
        catGroup.style.display = 'block'; 
        targetGroup.style.display = 'none'; 
    }
    
    const grabGroup = document.getElementById('grab-service-group');
    if (type === 'in' && grabGroup) grabGroup.style.display = 'block'; 
    else if(grabGroup) grabGroup.style.display = 'none';
    
    if(document.getElementById('input-grab-service')) document.getElementById('input-grab-service').value = '';
    document.querySelectorAll('.grab-chip').forEach(c => c.classList.remove('grab-active'));

    // --- SUGGESTION LOKASI OTOMATIS (DARI ZONA MANUAL + RIWAYAT TRANSAKSI) ---
    const manualLocs = (window.zones || []).flatMap(z => z.locations || []);
    const historyLocs = window.transactions.map(t => t.location).filter(l => l && l.trim() !== '');
    const uniqueLocs = [...new Set([...manualLocs, ...historyLocs])];

    const dataList = document.getElementById('location-suggestions');
    if(dataList) {
        let opts = '';
        uniqueLocs.forEach(loc => { opts += `<option value="${window.escapeHTML(loc)}"></option>`; });
        dataList.innerHTML = opts;
    }

    const quickChips = document.getElementById('location-quick-chips');
    if (quickChips) {
        if (manualLocs.length > 0) {
            quickChips.style.display = 'flex';
            quickChips.innerHTML = manualLocs.map(loc => 
                `<div class="chip" style="padding: 6px 12px; font-size: 12px;" onclick="window.pilihLokasiCepat('${window.escapeHTML(loc).replace(/'/g, "\\'")}', this)"><span class="material-icons-round" style="font-size:14px;">place</span> ${window.escapeHTML(loc)}</div>`
            ).join('');
        } else {
            quickChips.style.display = 'none';
        }
    }
    // -------------------------------------------------------------------------

    let now = new Date(); 
    let defaultTime = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    
    const dompetAktif = window.wallets.filter(w => !w.isArchived);

    let defaultWalletId = dompetAktif.length > 0 ? dompetAktif[0].id : '', 
        targetWalletId = dompetAktif.length > 1 ? dompetAktif[1].id : defaultWalletId, 
        validCats = window.categories.filter(c => c.type === type && c.type !== 'sys'), 
        defaultCatId = validCats.length > 0 ? validCats[0].id : '', 
        amount = '', note = '', trxDate = window.getLocalDateString(), trxTime = defaultTime, grabServiceVal = '', locationVal = '';
        
    if (trxId) { 
        const trx = window.transactions.find(t => t.id === trxId); 
        if (trx) { 
            amount = window.formatNumberWithDot(trx.amount.toString()); 
            note = trx.note; 
            defaultWalletId = trx.walletId; 
            if(trx.type === 'transfer') targetWalletId = trx.targetWalletId; 
            else defaultCatId = trx.categoryId; 
            trxDate = trx.date || trxDate; 
            if (trx.time) trxTime = trx.time;
            if(trx.grabService) grabServiceVal = trx.grabService; 
            if(trx.location) locationVal = trx.location;
        } 
    }
    
    document.getElementById('input-amount').value = amount; 
    document.getElementById('input-note').value = note; 
    document.getElementById('input-date').value = trxDate; 
    if(document.getElementById('input-time')) document.getElementById('input-time').value = trxTime; 
    document.getElementById('input-wallet').value = defaultWalletId; 
    if(document.getElementById('input-location')) document.getElementById('input-location').value = locationVal;
    if(!isTransfer) document.getElementById('input-category').value = defaultCatId; 
    if(isTransfer) document.getElementById('input-target-wallet').value = targetWalletId;
    
    if (grabServiceVal && document.getElementById('input-grab-service')) {
        document.getElementById('input-grab-service').value = grabServiceVal;
        document.querySelectorAll('.grab-chip').forEach(c => { 
            if (c.innerText.includes(grabServiceVal)) c.classList.add('grab-active'); 
        });
    }

    const selectWallet = document.getElementById('input-wallet-chips'); 
    let wHTML = ''; 
    dompetAktif.forEach(w => { 
        wHTML += `<div class="chip ${w.id == defaultWalletId ? 'active' : ''}" onclick="window.selectTrxWallet('${w.id}', this)"><span class="material-icons-round" style="font-size:16px">${w.icon}</span> ${window.escapeHTML(w.name)}</div>`; 
    }); 
    selectWallet.innerHTML = wHTML;

    if (isTransfer) { 
        const selectTargetWallet = document.getElementById('input-target-wallet-chips'); 
        let tHTML = ''; 
        dompetAktif.forEach(w => { 
            tHTML += `<div class="chip ${w.id == targetWalletId ? 'active' : ''}" onclick="window.selectTrxTargetWallet('${w.id}', this)"><span class="material-icons-round" style="font-size:16px">${w.icon}</span> ${window.escapeHTML(w.name)}</div>`; 
        }); 
        selectTargetWallet.innerHTML = tHTML; 
    } else { 
        const selectCat = document.getElementById('input-category-chips'); 
        let cHTML = ''; 
        validCats.forEach(c => { 
            cHTML += `<div class="chip ${c.id == defaultCatId ? 'active' : ''}" onclick="window.selectTrxCategory('${c.id}', this)"><span class="material-icons-round" style="font-size:16px">${c.icon}</span> ${window.escapeHTML(c.name)}</div>`; 
        }); 
        selectCat.innerHTML = cHTML;
    }
    document.getElementById('modal-input').classList.add('show');
};

window.openModalTransfer = function() { 
    const dompetAktif = window.wallets.filter(w => !w.isArchived);
    if (dompetAktif.length < 2) return window.customAlert("Perhatian", "Butuh minimal 2 dompet aktif untuk melakukan transfer.", "warning"); 
    window.openModalTrans('transfer'); 
};

window.simpanTransaksi = async function() {
    const submitBtn = document.querySelector('#modal-input .btn-submit');
    if(submitBtn && submitBtn.disabled) return; 
    
    const errTrans = document.getElementById('error-msg'), 
          trxId = document.getElementById('input-trx-id').value, 
          type = document.getElementById('input-type').value, 
          isTransfer = type === 'transfer', 
          walletId = document.getElementById('input-wallet').value, 
          catId = isTransfer ? null : document.getElementById('input-category').value, 
          targetWalletId = isTransfer ? document.getElementById('input-target-wallet').value : null, 
          amount = window.parseRupiah(document.getElementById('input-amount').value), 
          note = window.escapeHTML(document.getElementById('input-note').value.trim()), 
          trxDate = window.escapeHTML(document.getElementById('input-date').value) || window.getLocalDateString();
    const trxTime = document.getElementById('input-time') ? (document.getElementById('input-time').value || "12:00") : "12:00"; 
    const grabService = document.getElementById('input-grab-service') ? document.getElementById('input-grab-service').value : null;
    const locationVal = document.getElementById('input-location') ? window.escapeHTML(document.getElementById('input-location').value.trim()) : null; 

    if (!amount || amount <= 0 || !note || !walletId || (isTransfer && !targetWalletId) || (!isTransfer && !catId)) { 
        errTrans.innerText = "Data tidak valid."; 
        errTrans.style.display = 'block'; 
        return; 
    }
    if (isTransfer && walletId === targetWalletId) { 
        errTrans.innerText = "Dompet tidak boleh sama!"; 
        errTrans.style.display = 'block'; 
        return; 
    }
    
    const sourceWallet = window.wallets.find(w => String(w.id) === String(walletId)), 
          targetWallet = isTransfer ? window.wallets.find(w => String(w.id) === String(targetWalletId)) : null, 
          targetCat = isTransfer ? null : window.categories.find(c => String(c.id) === String(catId));
    
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

    if (trxId) { 
        const idx = window.transactions.findIndex(t => String(t.id) === String(trxId)); 
        if (idx !== -1) window.transactions.splice(idx, 1); 
    }
    
    const newTrxData = { 
        id: parsedTrxId, type, amount, note, walletId, 
        walletName: sourceWallet.name, categoryId: catId, 
        categoryName: targetCat ? targetCat.name : (isTransfer ? 'Transfer' : '-'), 
        targetWalletId: targetWalletId, targetWalletName: targetWallet ? targetWallet.name : null, 
        date: trxDate, time: trxTime, 
        grabService: type === 'in' && grabService ? grabService : null, 
        location: locationVal ? locationVal : null 
    };
    
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
            batch.set(userRef, window.getUserDocPayload(), { merge: true });
            
            await batch.commit();
        }
        window.closeModal('modal-input');
        window.callPageRender();
    } catch(e) {
        window.transactions = originalTransactions; 
        window.recalculateBalances();
        window.customAlert("Error", "Gagal menyimpan transaksi.", "error");
    } finally {
        if(submitBtn) { submitBtn.disabled = false; submitBtn.innerText = "Simpan Transaksi"; }
    }
};

window.hapusTransaksi = function(id) { 
    window.customConfirm("Hapus Transaksi", "Yakin hapus transaksi ini?", async () => { 
        const trxIndex = window.transactions.findIndex(t => String(t.id) === String(id)); 
        if(trxIndex === -1) return; 
        const trx = window.transactions[trxIndex]; 
        
        if(trx.targetId) { 
            const relatedTarget = window.targets.find(t => String(t.id) === String(trx.targetId)); 
            if(relatedTarget) { 
                if(trx.type === 'out') { 
                    relatedTarget.currentAmount -= Number(trx.amount||0); 
                    if(relatedTarget.tipe === 'investasi') relatedTarget.nilaiTerkini -= Number(trx.amount||0); 
                    if(relatedTarget.currentAmount < 0) relatedTarget.currentAmount = 0; 
                    if(relatedTarget.nilaiTerkini < 0) relatedTarget.nilaiTerkini = 0; 
                } else if (trx.type === 'in') { 
                    let modalKembali = trx.modalDeducted !== undefined ? Number(trx.modalDeducted||0) : Number(trx.amount||0); 
                    relatedTarget.currentAmount += modalKembali; 
                    if(relatedTarget.tipe === 'investasi') { relatedTarget.nilaiTerkini += Number(trx.amount||0); } 
                }
            } 
        } 
        
        window.transactions.splice(trxIndex, 1); 
        window.recalculateBalances(); 
        
        if(window.currentUserId) {
            try {
                const batch = writeBatch(db);
                batch.delete(doc(db, "users", window.currentUserId, "transactions", String(id)));
                batch.set(doc(db, "users", window.currentUserId), window.getUserDocPayload(), { merge: true });
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
    if(navIndex !== null && navIndex !== undefined) { 
        document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active')); 
        const items = document.querySelectorAll('.nav-item'); 
        if(items[navIndex]) items[navIndex].classList.add('active'); 
    }
    const tgt = document.getElementById(pageId); 
    if(tgt) tgt.classList.add('active'); 
    window.scrollTo(0, 0);
};

window.bukaNotifikasi = function() { 
    window.switchTab('page-notifikasi', null); 
    let adaYangDiubah = false; 
    window.notifications.forEach(n => { if (!n.read) { n.read = true; adaYangDiubah = true; } }); 
    if (adaYangDiubah) { 
        window.renderNotifications(); 
        window.saveDataToFirestoreSilently(); 
    } 
};

window.renderNotifications = function() {
    const container = document.getElementById('notif-page-container'); 
    const badge = document.getElementById('notif-badge');
    if(!container) return; 
    let unreadCount = 0; 
    let html = '';
    if (window.notifications.length === 0) { 
        container.innerHTML = `<div class="empty-state"><div class="icon-wrapper"><span class="material-icons-round">notifications_off</span></div><h4>Belum ada notifikasi</h4></div>`; 
        if(badge) badge.style.display = 'none'; 
        return; 
    }
    const sorted = [...window.notifications].sort((a,b) => new Date(b.date||'1970-01-01') - new Date(a.date||'1970-01-01'));
    sorted.forEach(notif => {
        if (!notif.read) unreadCount++; 
        const bg = notif.read ? 'white' : '#e0f2f1';
        html += `<div style="background: ${bg}; padding: 16px; border-radius: 16px; margin-bottom: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.02);"><div style="font-size: 14px; font-weight: 800; margin-bottom: 4px;">${window.escapeHTML(notif.title)}</div><div style="font-size: 12.5px; color: #555; margin-bottom: 8px;">${window.escapeHTML(notif.body)}</div><div style="font-size: 10.5px; color: #94a3b8; font-weight: 700;">${window.escapeHTML(notif.date)}</div></div>`;
    });
    container.innerHTML = html; 
    if(badge) badge.style.display = unreadCount > 0 ? 'block' : 'none';
};

window.renderDashboard = function() {
    const walletContainer = document.getElementById('wallet-container'); 
    if(!walletContainer) return;
    window.renderNotifications(); 
    let totalSaldo = 0; 
    let wHTML = '';
    
    window.wallets.forEach(wallet => { totalSaldo += Number(wallet.balance||0); });
    
    let totalAset = 0;
    window.targets.forEach(t => {
        let val = t.tipe === 'investasi' ? Number(t.nilaiTerkini || t.currentAmount || 0) : Number(t.currentAmount || 0);
        totalAset += val;
    });

    let kekayaanBersih = totalSaldo + totalAset;
    
    const dompetAktif = window.wallets.filter(w => !w.isArchived);
    dompetAktif.forEach(wallet => { 
        wHTML += `<div class="wallet-card"><div class="wallet-name"><span class="material-icons-round ${wallet.colorClass}">${wallet.icon}</span> ${window.escapeHTML(wallet.name)}</div><div class="wallet-saldo">${window.formatRupiah(wallet.balance)}</div></div>`; 
    });
    walletContainer.innerHTML = wHTML; 
    
    if(document.getElementById('net-worth')) document.getElementById('net-worth').innerText = window.formatRupiah(kekayaanBersih);
    if(document.getElementById('total-balance')) document.getElementById('total-balance').innerText = window.formatRupiah(totalSaldo);
    if(document.getElementById('total-asset')) document.getElementById('total-asset').innerText = window.formatRupiah(totalAset);

    // Update ringkasan kartu Lokasi & Strategi Mangkal di Beranda
    const infoDaerahEl = document.getElementById('info-daerah-beranda');
    if (infoDaerahEl && Array.isArray(window.zones) && window.zones.length > 0) {
        const totalTitik = window.zones.reduce((acc, z) => acc + (z.locations ? z.locations.length : 0), 0);
        infoDaerahEl.innerText = `${window.zones.length} Daerah • ${totalTitik} Titik Mangkal aktif`;
    }

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
                if(btnTarget) btnTarget.style.display = 'none'; 
                if(btnReward) { 
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
                let activeTargets = window.targets.filter(t => Number(t.currentAmount||0) < Number(t.targetAmount||0)); 
                activeTargets.sort((a, b) => new Date(a.deadline||'2099-01-01') - new Date(b.deadline||'2099-01-01'));
                let saranTargetText = "";
                if (activeTargets.length > 0) { 
                    saranTargetText = `Amankan 20% (<strong>${window.formatRupiah(saranNominal)}</strong>) ke target <strong>${window.escapeHTML(activeTargets[0].name)}</strong>!`; 
                    if(btnTarget) btnTarget.innerText = "Setor Tabungan"; 
                } else { 
                    saranTargetText = `Amankan 20% (<strong>${window.formatRupiah(saranNominal)}</strong>) buat target impianmu!`; 
                    if(btnTarget) btnTarget.innerText = "Buat Target Baru"; 
                }
                teksSaran.innerHTML = `Kamu punya saldo cair <strong style="color: #1a1a1a;">${window.formatRupiah(totalSaldo)}</strong>. ${saranTargetText}`;
                if(btnTarget) { 
                    btnTarget.style.display = 'block'; 
                    btnTarget.style.background = 'white'; 
                    btnTarget.style.border = '1.5px solid #fbc02d'; 
                    btnTarget.style.color = '#f57f17'; 
                    btnTarget.onclick = function() { 
                        if (activeTargets.length > 0) { window.location.href = `target.html?action=setor&id=${activeTargets[0].id}`; } 
                        else { window.location.href = `target.html?action=baru`; } 
                    }; 
                }
                if(btnReward) { 
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
            if(trx.date !== lastDateDash) { 
                dashHTML += `<div class="date-divider">${window.escapeHTML(trx.date)}</div>`; 
                lastDateDash = trx.date; 
            }
            dashHTML += window.generateTrxHTML(trx, false);
        }); 
        historyContainer.innerHTML = dashHTML;
    }
};

window.generateTrxHTML = function(trx, showActions = false) {
    const isIncome = trx.type === 'in', isTransfer = trx.type === 'transfer';
    const amountClass = isIncome ? 'amount-in' : (isTransfer ? 'amount-transfer' : 'amount-out'); 
    const sign = isIncome ? '+' : (isTransfer ? '' : '-');
    const safeNote = window.escapeHTML(trx.note); 
    const timeDisplay = trx.time ? ` • ${trx.time}` : '';
    const desc = isTransfer ? `${window.escapeHTML(trx.walletName)} ➔ ${window.escapeHTML(trx.targetWalletName)}${timeDisplay}` : `${window.escapeHTML(trx.walletName)} • ${window.escapeHTML(trx.categoryName || 'Transfer')}${timeDisplay}`;
    let grabBadge = trx.grabService ? `<span style="font-size: 10px; background: #00B14F; color: white; padding: 2px 6px; border-radius: 4px; margin-left: 6px; display:inline-block; white-space:nowrap;">${window.escapeHTML(trx.grabService)}</span>` : '';
    let locBadge = trx.location ? `<span style="font-size: 10px; background: #f1f5f9; color: #64748b; padding: 2px 6px; border-radius: 4px; margin-left: 6px; display:inline-block; white-space:nowrap;"><span class="material-icons-round" style="font-size: 10px; vertical-align: middle;">place</span> ${window.escapeHTML(trx.location)}</span>` : '';
    let actionHTML = (showActions && String(trx.categoryId) !== '999' && !isTransfer) 
        ? `<div class="list-actions" style="margin-left: 15px;"><button class="btn-icon" style="padding:4px;" onclick="window.openModalTrans('${trx.type}', '${trx.id}')"><span class="material-icons-round" style="font-size:18px;">edit</span></button><button class="btn-icon delete" style="padding:4px;" onclick="window.hapusTransaksi('${trx.id}')"><span class="material-icons-round" style="font-size:18px;">delete</span></button></div>` 
        : (showActions && isTransfer 
            ? `<div class="list-actions" style="margin-left: 15px;"><button class="btn-icon delete" style="padding:4px;" onclick="window.hapusTransaksi('${trx.id}')"><span class="material-icons-round" style="font-size:18px;">delete</span></button></div>` 
            : (showActions && String(trx.categoryId) === '999' 
                ? `<div class="list-actions" style="margin-left: 15px;"><button class="btn-icon delete" style="padding:4px;" onclick="window.hapusTransaksi('${trx.id}')" title="Batalkan Setoran"><span class="material-icons-round" style="font-size:18px;">delete</span></button></div>` 
                : ''));
    return `<div class="trx-item"><div class="trx-content"><div class="trx-info"><span class="trx-title" style="display:flex; align-items:center; flex-wrap:wrap;">${safeNote} ${grabBadge} ${locBadge}</span><span class="trx-date">${desc}</span></div><div class="trx-amount ${amountClass}">${sign}${window.formatRupiah(trx.amount)}</div></div>${actionHTML}</div>`;
};

// ==========================================
// 9. RIWAYAT LOGIC (riwayat.html)
// ==========================================
window.renderHistoryPage = function() {
    const container = document.getElementById('all-transaction-container'); 
    if(!container) return;
    const filterPeriod = document.getElementById('filter-period').value; 
    const filterType = document.getElementById('filter-type').value;
    
    let filtered = [...window.transactions].sort((a,b) => {
        const dtA = new Date((a.date||'1970-01-01') + 'T' + (a.time||'00:00')).getTime();
        const dtB = new Date((b.date||'1970-01-01') + 'T' + (b.time||'00:00')).getTime();
        return dtB - dtA;
    });

    if (filterType) filtered = filtered.filter(t => t.type === filterType);
    if (filterPeriod && filterPeriod !== 'all') {
        const now = new Date(), todayStr = window.getLocalDateString(), currentMonthStr = window.getLocalMonthString();
        if (filterPeriod === 'today') { 
            filtered = filtered.filter(t => t.date === todayStr); 
        } else if (filterPeriod === 'week') { 
            const startOfWeek = new Date(now); 
            startOfWeek.setDate(now.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1)); 
            startOfWeek.setHours(0,0,0,0); 
            const endOfWeek = new Date(startOfWeek); 
            endOfWeek.setDate(startOfWeek.getDate() + 6); 
            endOfWeek.setHours(23,59,59,999); 
            filtered = filtered.filter(t => { 
                if (!t.date) return false; 
                const tDate = new Date(t.date + 'T12:00:00'); 
                return tDate >= startOfWeek && tDate <= endOfWeek; 
            }); 
        } else if (filterPeriod === 'month') { 
            filtered = filtered.filter(t => t.date && t.date.startsWith(currentMonthStr)); 
        }
    }
    let totIn = 0, totOut = 0;
    filtered.forEach(trx => { 
        if(String(trx.categoryId) !== '999') { 
            if(trx.type === 'in') totIn += Number(trx.amount||0); 
            if(trx.type === 'out') totOut += Number(trx.amount||0); 
        } 
    });
    if(document.getElementById('summary-in')) document.getElementById('summary-in').innerText = window.formatRupiah(totIn);
    if(document.getElementById('summary-out')) document.getElementById('summary-out').innerText = window.formatRupiah(totOut);

    if (filtered.length === 0) { 
        container.innerHTML = `<div class="empty-state"><div class="icon-wrapper"><span class="material-icons-round">receipt_long</span></div><h4>Tidak ada transaksi</h4></div>`; 
    } else {
        let fullHTML = '', lastDateFull = '';
        filtered.forEach(trx => { 
            if(trx.date !== lastDateFull) { 
                fullHTML += `<div class="date-divider">${window.escapeHTML(trx.date)}</div>`; 
                lastDateFull = trx.date; 
            } 
            fullHTML += window.generateTrxHTML(trx, true); 
        }); 
        container.innerHTML = fullHTML;
    }
};
