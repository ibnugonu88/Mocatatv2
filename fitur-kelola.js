// ============================================================
// MOCATAT - FITUR KELOLA (fitur-kelola.js)
// Mencakup: dompet.html, kategori.html, kendaraan.html & target.html
// ============================================================

import { db, doc, writeBatch } from "./core.js";

// ==========================================
// 11. DOMPET LOGIC (dompet.html)
// ==========================================
window.renderWalletPage = function() {
    const container = document.getElementById('wallet-page-container'); 
    if(!container) return;
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
    const err = document.getElementById('dompet-error-msg'); 
    if(err) err.style.display = 'none';
    if (id) { 
        const wallet = window.wallets.find(w => String(w.id) === String(id)); 
        document.getElementById('dompet-modal-title').innerText = 'Edit Dompet'; 
        document.getElementById('dompet-id').value = wallet.id; 
        document.getElementById('dompet-name').value = wallet.name; 
        document.getElementById('dompet-balance').value = Number(wallet.balance||0) === 0 ? '' : window.formatNumberWithDot(wallet.balance.toString()); 
        window.selectDompetType(wallet.type || 'cash'); 
    } else { 
        document.getElementById('dompet-modal-title').innerText = 'Tambah Dompet'; 
        document.getElementById('dompet-id').value = ''; 
        document.getElementById('dompet-name').value = ''; 
        document.getElementById('dompet-balance').value = ''; 
        window.selectDompetType('cash'); 
    }
    document.getElementById('modal-dompet').classList.add('show');
};

window.simpanDompet = async function() {
    const id = document.getElementById('dompet-id').value, 
          name = window.escapeHTML(document.getElementById('dompet-name').value.trim()), 
          type = document.getElementById('dompet-type').value, 
          newBalance = window.parseRupiah(document.getElementById('dompet-balance').value), 
          errBox = document.getElementById('dompet-error-msg');
    if (!name) { 
        errBox.innerText = "Nama dompet wajib diisi!"; 
        errBox.style.display = 'block'; 
        return; 
    }
    let icon = type === 'bank' ? "account_balance" : (type === 'ewallet' ? "account_balance_wallet" : "payments"), 
        colorClass = type === 'bank' ? "icon-bank" : (type === 'ewallet' ? "icon-ewallet" : "icon-cash"), 
        todayStr = window.getLocalDateString();
    
    let timeStr = String(new Date().getHours()).padStart(2, '0') + ':' + String(new Date().getMinutes()).padStart(2, '0');
    
    try {
        if (id) {
            const idx = window.wallets.findIndex(w => String(w.id) == String(id)); 
            const oldBalance = Number(window.wallets[idx].balance||0); 
            const selisih = newBalance - oldBalance;
            window.wallets[idx].name = name; 
            window.wallets[idx].type = type; 
            window.wallets[idx].icon = icon; 
            window.wallets[idx].colorClass = colorClass;
            if (selisih !== 0) { 
                const newTrx = { 
                    id: window.generateUUID(), 
                    type: selisih > 0 ? 'in' : 'out', 
                    amount: Math.abs(selisih), 
                    note: selisih > 0 ? 'Penyesuaian Saldo (Lebih)' : 'Penyesuaian Saldo (Kurang)', 
                    walletId: window.wallets[idx].id, 
                    walletName: name, 
                    categoryId: 999, 
                    categoryName: 'Penyesuaian Sistem', 
                    date: todayStr, 
                    time: timeStr 
                }; 
                window.transactions.push(newTrx); 
                await window.saveTransactionToDB(newTrx); 
            }
        } else {
            const newWalletId = window.generateUUID(); 
            window.wallets.push({ id: newWalletId, name, type, balance: 0, icon, colorClass, isArchived: false }); 
            if (newBalance > 0) { 
                const newTrx = { 
                    id: window.generateUUID(), 
                    type: 'in', 
                    amount: newBalance, 
                    note: 'Saldo Awal Dompet', 
                    walletId: newWalletId, 
                    walletName: name, 
                    categoryId: 999, 
                    categoryName: 'Penyesuaian Sistem', 
                    date: todayStr, 
                    time: timeStr 
                }; 
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
    if(dompetAktif.length === 1 && String(dompetAktif[0].id) === String(id)) { 
        return window.customAlert("Gagal Menghapus", "Anda harus memiliki minimal 1 dompet aktif!"); 
    }
    
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
        }
    });
};

window.pulihkanDompet = async function(id) {
    const dompetIndex = window.wallets.findIndex(w => String(w.id) === String(id));
    if (dompetIndex !== -1) {
        window.wallets[dompetIndex].isArchived = false;
        await window.saveDataToFirestore();
    }
};

// ==========================================
// 12. KATEGORI LOGIC (kategori.html)
// ==========================================
window.switchMainTab = function(type) {
    window.activeKatTab = type; 
    document.getElementById('tab-out').classList.toggle('active', type === 'out'); 
    document.getElementById('tab-in').classList.toggle('active', type === 'in');
    window.renderCategoryPage();
};

window.renderCategoryPage = function() {
    const container = document.getElementById('kategori-container'); 
    if(!container) return;
    const currentMonthStr = window.getLocalMonthString(); 
    const txBulanIni = window.transactions.filter(t => t.date && t.date.startsWith(currentMonthStr) && String(t.categoryId) !== '999');
    let totIn = 0; 
    let totOut = 0;
    txBulanIni.forEach(t => { 
        if(t.type === 'in') totIn += Number(t.amount||0); 
        if(t.type === 'out') totOut += Number(t.amount||0); 
    });
    if(document.getElementById('tot-masuk')) document.getElementById('tot-masuk').innerText = window.formatRupiah(totIn);
    if(document.getElementById('tot-keluar')) document.getElementById('tot-keluar').innerText = window.formatRupiah(totOut);

    const catsToRender = window.categories.filter(c => c.type === window.activeKatTab && String(c.type) !== 'sys');
    if (catsToRender.length === 0) { 
        container.innerHTML = `<div class="empty-state"><div class="icon-wrapper"><span class="material-icons-round">category</span></div><h4 style="font-size:14px; color:#1a1a1a; margin-bottom:6px; font-weight:800;">Belum ada kategori</h4><p style="font-size:12px; color:#94a3b8; font-weight:600;">Tambahkan kategori baru untuk mulai mengatur keuangan.</p></div>`; 
        return; 
    }

    let html = '';
    catsToRender.forEach(cat => {
        let realisasi = 0; 
        txBulanIni.forEach(t => { 
            if(String(t.categoryId) === String(cat.id) && t.type === cat.type) realisasi += Number(t.amount||0); 
        });
        let progressHtml = '';
        let bud = Number(cat.budget||0);
        
        if(bud > 0) {
            let pct = Math.min((realisasi / bud) * 100, 100); 
            let pgColor = (window.activeKatTab === 'out' && pct >= 100) ? '#c62828' : ((window.activeKatTab === 'out' && pct > 75) ? '#ef6c00' : '#249a95'); 
            if (window.activeKatTab === 'in') pgColor = pct >= 100 ? '#2e7d32' : '#249a95'; 
            let sisaTxt = ''; 
            if (window.activeKatTab === 'out') { 
                sisaTxt = realisasi > bud ? `<span style="color:#c62828;">Overbudget ${window.formatRupiah(realisasi - bud)}</span>` : `<span style="color:#94a3b8;">Sisa ${window.formatRupiah(bud - realisasi)}</span>`; 
            } else { 
                sisaTxt = realisasi >= bud ? `<span style="color:#2e7d32;">Target Tercapai!</span>` : `<span style="color:#94a3b8;">Kurang ${window.formatRupiah(bud - realisasi)}</span>`; 
            }
            
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
    if (id) { 
        const cat = window.categories.find(c => String(c.id) === String(id)); 
        document.getElementById('kat-modal-title').innerText = 'Edit Kategori'; 
        document.getElementById('kat-id').value = cat.id; 
        document.getElementById('kat-name').value = cat.name; 
        document.getElementById('kat-budget').value = Number(cat.budget||0) === 0 ? '' : window.formatNumberWithDot(cat.budget.toString()); 
        window.selectKatType(cat.type); 
    } else { 
        document.getElementById('kat-modal-title').innerText = 'Tambah Kategori'; 
        document.getElementById('kat-id').value = ''; 
        document.getElementById('kat-name').value = ''; 
        document.getElementById('kat-budget').value = ''; 
        window.selectKatType(window.activeKatTab); 
    }
    document.getElementById('modal-kategori').classList.add('show');
};

window.simpanKategori = async function() {
    const id = document.getElementById('kat-id').value, 
          type = document.getElementById('kat-type').value, 
          name = window.escapeHTML(document.getElementById('kat-name').value.trim()), 
          budget = window.parseRupiah(document.getElementById('kat-budget').value), 
          errBox = document.getElementById('kat-error-msg');
    if (!name) { 
        errBox.innerText = "Nama kategori wajib diisi!"; 
        errBox.style.display = 'block'; 
        return; 
    }
    if (id) { 
        const idx = window.categories.findIndex(c => String(c.id) == String(id)); 
        window.categories[idx] = { ...window.categories[idx], type, name, budget }; 
    } else { 
        window.categories.push({ id: window.generateUUID(), type, name, budget, icon: type === 'in' ? "payments" : "category", color: type === 'in' ? "#2e7d32" : "#78909c" }); 
    }
    window.closeModal('modal-kategori'); 
    await window.saveDataToFirestore();
};

window.hapusKategori = function(id) { 
    if(window.transactions.some(t => String(t.categoryId) === String(id))) { 
        return window.customAlert("Sedang Digunakan", "Kategori ini sudah pernah dipakai di riwayat transaksi. Silakan edit saja namanya."); 
    }
    window.customConfirm("Hapus Kategori", "Yakin ingin menghapus kategori ini secara permanen?", async () => { 
        window.categories = window.categories.filter(c => String(c.id) !== String(id)); 
        await window.saveDataToFirestore(); 
    }); 
};

// ==========================================
// 13. KENDARAAN LOGIC (kendaraan.html)
// ==========================================
window.renderVehiclePage = function() {
    const accKm = Number(window.vehicleSettings.accumulatedKmForOil||0);
    if(document.getElementById('text-km-terkumpul')) document.getElementById('text-km-terkumpul').innerText = accKm.toFixed(1).replace('.', ',');
    const persentase = Math.min((accKm / 2000) * 100, 100);
    const barOli = document.getElementById('bar-oli'); 
    if(barOli) barOli.style.width = persentase + '%';
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
            let defaultKm = 0; 
            if(window.kmRecords.length > 0) { 
                const sorted = [...window.kmRecords].reverse(); 
                const lastValid = sorted.find(r => typeof r.kmAkhir === 'number');
                if (lastValid) defaultKm = lastValid.kmAkhir; 
            }
            let prefillKm = (defaultKm && typeof defaultKm === 'number') ? defaultKm : '';
            tripContainer.innerHTML = `<p style="font-size: 13px; color: #64748b; margin-bottom: 15px; font-weight:600; line-height:1.5;">Catat KM awal motor Anda sebelum mulai beraktivitas.</p><div class="form-group"><label class="form-label">KM Awal (Pagi)</label><input type="text" id="trip-km-awal" class="form-input" value="${prefillKm}" placeholder="Cth: 57378.1" inputmode="decimal"></div><button class="btn-submit" onclick="window.mulaiTripPagi()">Mulai Perjalanan <span class="material-icons-round">play_arrow</span></button>`;
        }
    }

    const container = document.getElementById('km-list-container'); 
    if(container) {
        container.innerHTML = '';
        if (window.kmRecords.length === 0) { 
            container.innerHTML = `<div class="empty-state"><span class="material-icons-round" style="font-size: 40px; color:#cbd5e1;">history</span><p>Belum ada riwayat jarak tempuh.</p></div>`; 
            return; 
        }

        const sortedRecords = [...window.kmRecords].reverse();
        sortedRecords.forEach(k => {
            const dateObj = new Date(k.tanggal); 
            const dateStr = `${String(dateObj.getDate()).padStart(2, '0')}/${String(dateObj.getMonth()+1).padStart(2, '0')}/${dateObj.getFullYear()}`;
            if (k.kmAkhir === 'Ganti Oli') {
                 container.innerHTML += `<div class="history-item" style="background:#f0fdf4; border:1px solid #bbf7d0;"><div class="history-icon" style="background:#22c55e;"><span class="material-icons-round" style="color:white;">settings</span></div><div class="history-details"><div class="history-title" style="color:#15803d;">Oli Diganti Baru</div><div class="history-date">${dateStr}</div></div><div class="history-amount" style="color:#15803d;">0 KM</div><button class="btn-icon delete" onclick="window.hapusKM('${k.id}')" title="Hapus"><span class="material-icons-round" style="font-size: 18px;">delete</span></button></div>`;
            } else {
                 container.innerHTML += `<div class="history-item"><div class="history-icon"><span class="material-icons-round">add_road</span></div><div class="history-details"><div class="history-title">Trip ${dateStr}</div><div class="history-date">Awal: ${k.kmAwal} &rarr; Akhir: ${k.kmAkhir}</div></div><div class="history-amount">+ ${k.jarak} KM</div><button class="btn-icon delete" onclick="window.hapusKM('${k.id}')" title="Hapus"><span class="material-icons-round" style="font-size: 18px;">delete</span></button></div>`;
            }
        });
    }
};

window.mulaiTripPagi = async function() {
    const kmAwalInput = document.getElementById('trip-km-awal').value.trim(); 
    const kmAwal = parseFloat(kmAwalInput.replace(',', '.'));
    if(isNaN(kmAwal) || kmAwal < 0) { 
        window.customAlert("Peringatan", "Masukkan KM Awal motor yang valid (contoh: 57378.1)"); 
        return; 
    }
    window.vehicleSettings.activeTrip = { tanggal: window.getLocalDateString(), kmAwal: kmAwal }; 
    await window.saveDataToFirestore();
};

window.selesaiTripMalam = async function() {
    const kmAkhirInput = document.getElementById('trip-km-akhir').value.trim(); 
    const kmAkhir = parseFloat(kmAkhirInput.replace(',', '.'));
    if(isNaN(kmAkhir) || kmAkhir < Number(window.vehicleSettings.activeTrip.kmAwal||0)) { 
        window.customAlert("Peringatan", "KM Akhir tidak boleh lebih kecil dari KM Awal (" + window.vehicleSettings.activeTrip.kmAwal + ")"); 
        return; 
    }
    const jarakTempuh = parseFloat((kmAkhir - Number(window.vehicleSettings.activeTrip.kmAwal||0)).toFixed(1));
    const recordBaru = { 
        id: window.generateUUID(), 
        tanggal: window.vehicleSettings.activeTrip.tanggal, 
        kmAwal: window.vehicleSettings.activeTrip.kmAwal, 
        kmAkhir: kmAkhir, 
        jarak: jarakTempuh 
    };
    window.kmRecords.push(recordBaru); 
    window.vehicleSettings.accumulatedKmForOil = Number(window.vehicleSettings.accumulatedKmForOil||0) + jarakTempuh; 
    window.vehicleSettings.activeTrip = null; 
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
    const container = document.getElementById('target-container'); 
    if(!container) return;
    if (window.targets.length === 0) { 
        container.innerHTML = `<div class="empty-state"><div class="icon-wrapper"><span class="material-icons-round">flag</span></div><h4 style="font-size:16px; color:#1a1a1a; margin-bottom:6px; font-weight:800;">Belum ada target</h4><p style="font-size:14px; color:#94a3b8; font-weight:600; line-height: 1.4;">Buat tabungan atau pantau investasi pertamamu di sini.</p></div>`; 
        return; 
    }

    let html = '';
    [...window.targets].reverse().forEach(t => {
        const isInvest = t.tipe === 'investasi'; 
        let badgeHtml = isInvest ? `<span class="badge badge-invest">Aktif</span>` : `<span class="badge badge-tabungan">Aktif</span>`; 
        let fillClass = isInvest ? `fill-invest` : `fill-tabungan`;
        let saranHtml = ''; 
        let sisaUangText = 'Rp 0'; 
        let pct = 0;

        let targetAmt = Number(t.targetAmount||0);
        let currAmt = Number(t.currentAmount||0);
        let valTerkini = Number(t.nilaiTerkini !== undefined ? t.nilaiTerkini : currAmt);

        if (targetAmt > 0) {
            let uangDihitung = isInvest ? valTerkini : currAmt; 
            let sisaUang = targetAmt - uangDihitung; 
            if(sisaUang < 0) sisaUang = 0;
            sisaUangText = window.formatRupiah(sisaUang); 
            pct = Math.min((uangDihitung / targetAmt) * 100, 100);

            if (t.deadline) {
                const today = new Date(); today.setHours(0, 0, 0, 0); 
                const deadlineDate = new Date(t.deadline); deadlineDate.setHours(0, 0, 0, 0);
                if (sisaUang <= 0) { 
                    saranHtml = `<div class="pill-box" style="border-color: #bbf7d0; background: #f0fdf4; justify-content: center;"><div style="font-size: 13.5px; color: #16a34a; font-weight: 800; display: flex; align-items: center; gap: 8px;"><span class="material-icons-round" style="font-size: 20px;">task_alt</span> Target Tercapai! 🎉</div></div>`; 
                } else {
                    const diffTime = deadlineDate - today; 
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    if (diffDays > 0) { 
                        const saranHarian = Math.ceil(sisaUang / diffDays); 
                        saranHtml = `<div class="pill-box"><div class="pill-left"><span class="material-icons-round" style="font-size: 18px;">calendar_today</span> Sisa ${diffDays} Hari</div><div class="pill-right">Nabung: <span>${window.formatRupiah(saranHarian)}</span> <span style="font-size: 11px;">/hari</span></div></div>`; 
                    } else { 
                        saranHtml = `<div class="pill-box" style="border-color: #fecaca; background: #fff1f2;"><div class="pill-left" style="color: #e11d48;"><span class="material-icons-round" style="font-size: 18px;">error_outline</span> Terlambat ${Math.abs(diffDays)} Hari</div><div class="pill-right" style="color: #e11d48;">Kurang: <span>${window.formatRupiah(sisaUang)}</span></div></div>`; 
                    }
                }
            }
        }

        let cardContent = '';
        if (isInvest) {
            let retur = valTerkini - currAmt;
            let returnColor = retur > 0 ? '#10b981' : (retur < 0 ? '#e11d48' : '#64748b'); 
            let returnText = retur > 0 ? '+ ' + window.formatRupiah(retur) : (retur < 0 ? '- ' + window.formatRupiah(Math.abs(retur)) : window.formatRupiah(0));
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
    const btns = document.querySelectorAll('#target-type-segment .segmented-btn');
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
    } else { 
        document.getElementById('label-name').innerText = "Nama Tabungan / Tujuan"; 
        document.getElementById('label-amount').innerText = "Target Uang (Rp)"; 
        document.getElementById('label-current-amount').innerText = "Saldo Tabungan Saat Ini (Rp)"; 
    }
};

window.openTargetModal = function(id = null) {
    document.getElementById('target-error-msg').style.display = 'none';
    if (id) { 
        const t = window.targets.find(x => String(x.id) === String(id)); 
        document.getElementById('target-modal-title').innerText = 'Edit Data'; 
        document.getElementById('target-id').value = t.id; 
        document.getElementById('target-name').value = t.name; 
        document.getElementById('target-amount').value = Number(t.targetAmount||0) === 0 ? '' : window.formatNumberWithDot(t.targetAmount.toString()); 
        document.getElementById('target-current-amount').value = Number(t.currentAmount||0) === 0 ? '' : window.formatNumberWithDot(t.currentAmount.toString()); 
        document.getElementById('target-deadline').value = t.deadline || ''; 
        window.selectTargetType(t.tipe || 'biasa'); 
    } else { 
        document.getElementById('target-modal-title').innerText = 'Buat Baru'; 
        document.getElementById('target-id').value = ''; 
        document.getElementById('target-name').value = ''; 
        document.getElementById('target-amount').value = ''; 
        document.getElementById('target-current-amount').value = ''; 
        document.getElementById('target-deadline').value = ''; 
        window.selectTargetType('biasa');
    }
    document.getElementById('modal-target').classList.add('show');
};

window.simpanTarget = async function() {
    const id = document.getElementById('target-id').value; 
    const tipe = document.getElementById('target-type').value; 
    const name = window.escapeHTML(document.getElementById('target-name').value.trim()); 
    const targetAmount = window.parseRupiah(document.getElementById('target-amount').value) || 0; 
    const currentAmount = window.parseRupiah(document.getElementById('target-current-amount').value) || 0; 
    const deadline = document.getElementById('target-deadline').value; 
    const errBox = document.getElementById('target-error-msg');
    if (!name) { 
        errBox.innerText = "Nama wajib diisi!"; 
        errBox.style.display = 'block'; 
        return; 
    }
    
    if (id) { 
        const idx = window.targets.findIndex(t => String(t.id) == String(id)); 
        const selisihModal = currentAmount - Number(window.targets[idx].currentAmount||0);
        window.targets[idx].name = name; 
        window.targets[idx].tipe = tipe; 
        window.targets[idx].targetAmount = targetAmount; 
        window.targets[idx].currentAmount = currentAmount; 
        window.targets[idx].deadline = deadline;
        if (tipe === 'biasa') { 
            window.targets[idx].nilaiTerkini = currentAmount; 
        } else if (tipe === 'investasi') { 
            window.targets[idx].nilaiTerkini = Number(window.targets[idx].nilaiTerkini||0) + selisihModal; 
            if(window.targets[idx].nilaiTerkini < 0) window.targets[idx].nilaiTerkini = 0; 
        }
    } else { 
        window.targets.push({ id: window.generateUUID(), tipe, name, targetAmount, currentAmount: currentAmount, nilaiTerkini: currentAmount, deadline: deadline }); 
    }
    window.closeModal('modal-target'); 
    await window.saveDataToFirestore();
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
                batch.set(doc(db, "users", window.currentUserId), window.getUserDocPayload(), { merge: true });
                
                await batch.commit();
                window.callPageRender();
            } catch (e) {
                console.error(e);
                window.customAlert("Error", "Gagal menghapus target di database.", "error");
            }
        }
    });
};

window.selectActionWallet = function(id, el) { 
    document.getElementById('action-wallet').value = id; 
    document.querySelectorAll('#action-wallet-chips .chip').forEach(c => c.classList.remove('active')); 
    el.classList.add('active'); 
};

window.openActionModal = function(id, type) {
    const t = window.targets.find(x => String(x.id) === String(id)); 
    if(!t) return;
    document.getElementById('action-error-msg').style.display = 'none'; 
    document.getElementById('action-target-id').value = t.id; 
    document.getElementById('action-type').value = type; 
    document.getElementById('action-amount').value = ''; 
    let valTerkini = Number(t.nilaiTerkini !== undefined ? t.nilaiTerkini : t.currentAmount||0);
    document.getElementById('update-amount').value = valTerkini > 0 ? window.formatNumberWithDot(valTerkini.toString()) : '';
    
    const areaTrx = document.getElementById('area-transaksi'); 
    const areaUpdate = document.getElementById('area-update-nilai'); 
    const title = document.getElementById('action-modal-title'); 
    const btnSubmit = document.getElementById('btn-action-submit'); 
    const walletLabel = document.getElementById('action-wallet-label');

    if (type === 'update') {
        title.innerText = `Update Nilai Terkini`; 
        areaTrx.style.display = 'none'; 
        areaUpdate.style.display = 'block'; 
        btnSubmit.innerText = "Simpan Nilai Pasar"; 
        btnSubmit.style.background = "#16a34a";
    } else {
        areaTrx.style.display = 'block'; 
        areaUpdate.style.display = 'none';
        if(type === 'setor') { 
            title.innerText = t.tipe === 'investasi' ? `Top Up` : `Setor Tabungan`; 
            walletLabel.innerText = "Sumber Dana (Dari dompet mana?)"; 
            btnSubmit.innerText = "Simpan Setoran"; 
            btnSubmit.style.background = "linear-gradient(135deg, #249a95 0%, #1e8580 100%)"; 
        } else if(type === 'tarik') { 
            title.innerText = `Jual / Tarik Dana`; 
            walletLabel.innerText = "Tujuan Dana (Masuk ke dompet mana?)"; 
            btnSubmit.innerText = "Simpan Penarikan"; 
            btnSubmit.style.background = "#e11d48"; 
        }

        const chipContainer = document.getElementById('action-wallet-chips');
        const dompetAktif = window.wallets.filter(w => !w.isArchived);

        if(dompetAktif.length === 0) { 
            chipContainer.innerHTML = `<span style="font-size:12px; color:#e11d48;">Anda belum punya dompet.</span>`; 
            document.getElementById('action-wallet').value = ''; 
        } else { 
            let wHTML = ''; 
            let defaultWallet = dompetAktif[0].id; 
            dompetAktif.forEach(w => { 
                wHTML += `<div class="chip ${w.id == defaultWallet ? 'active' : ''}" onclick="window.selectActionWallet('${w.id}', this)"><span class="material-icons-round" style="font-size:16px">${w.icon}</span> ${window.escapeHTML(w.name)}</div>`; 
            }); 
            chipContainer.innerHTML = wHTML; 
            document.getElementById('action-wallet').value = defaultWallet; 
        }
    }
    document.getElementById('modal-action').classList.add('show');
};

window.prosesAksiTarget = async function() {
    const submitBtn = document.getElementById('btn-action-submit');
    if(submitBtn && submitBtn.disabled) return;
    
    const id = document.getElementById('action-target-id').value; 
    const type = document.getElementById('action-type').value; 
    const errBox = document.getElementById('action-error-msg');
    const targetIndex = window.targets.findIndex(t => String(t.id) === String(id)); 
    if(targetIndex === -1) return; 
    const t = window.targets[targetIndex];

    if (type === 'update') { 
        const newNilai = window.parseRupiah(document.getElementById('update-amount').value) || 0; 
        window.targets[targetIndex].nilaiTerkini = newNilai; 
        window.closeModal('modal-action'); 
        await window.saveDataToFirestore(); 
        return; 
    }

    const walletId = document.getElementById('action-wallet').value; 
    const amount = window.parseRupiah(document.getElementById('action-amount').value);
    if (!amount || amount <= 0 || !walletId) { 
        errBox.innerText = "Nominal atau dompet tidak valid."; 
        errBox.style.display = 'block'; 
        return; 
    }
    const wallet = window.wallets.find(w => String(w.id) === String(walletId));
    
    if(submitBtn) { submitBtn.disabled = true; submitBtn.innerText = "Memproses..."; }
    const originalTransactions = JSON.parse(JSON.stringify(window.transactions));

    try {
        if (type === 'setor') {
            if(amount > Number(wallet.balance||0)) { 
                errBox.innerText = `Saldo dompet tidak cukup! Sisa: ${window.formatRupiah(wallet.balance)}`; 
                errBox.style.display = 'block'; 
                return; 
            }
            wallet.balance = Number(wallet.balance||0) - amount;
            const newTrx = { 
                id: window.generateUUID(), type: 'out', amount: amount, 
                note: `Setor/Top Up: ${t.name}`, walletId: wallet.id, walletName: wallet.name, 
                categoryId: 999, categoryName: 'Alokasi Target', 
                date: window.getLocalDateString(), targetId: t.id 
            };
            window.transactions.push(newTrx);
            window.targets[targetIndex].currentAmount = Number(t.currentAmount||0) + amount; 
            if(t.tipe === 'investasi') window.targets[targetIndex].nilaiTerkini = Number(t.nilaiTerkini||t.currentAmount||0) + amount; 
            
            await window.saveTransactionToDB(newTrx);
        } else if (type === 'tarik') {
            const maxTarik = t.tipe === 'investasi' ? Number(t.nilaiTerkini||t.currentAmount||0) : Number(t.currentAmount||0);
            if(amount > maxTarik) { 
                errBox.innerText = `Maksimal penarikan: ${window.formatRupiah(maxTarik)}`; 
                errBox.style.display = 'block'; 
                return; 
            }

            wallet.balance = Number(wallet.balance||0) + amount;

            if(t.tipe === 'investasi') {
                let currAmt = Number(t.currentAmount||0);
                let valTerkini = Number(t.nilaiTerkini||currAmt);
                let persentaseDitarik = valTerkini > 0 ? (amount / valTerkini) : 0; 
                if (persentaseDitarik > 1) persentaseDitarik = 1; 
                let potonganModal = currAmt * persentaseDitarik;
                
                const newTrx = { 
                    id: window.generateUUID(), type: 'in', amount: amount, 
                    note: `Jual/Tarik: ${t.name}`, walletId: wallet.id, walletName: wallet.name, 
                    categoryId: 999, categoryName: 'Pencairan Investasi', 
                    date: window.getLocalDateString(), targetId: t.id, modalDeducted: potonganModal 
                };
                window.transactions.push(newTrx);
                window.targets[targetIndex].nilaiTerkini = Math.max(0, valTerkini - amount);
                window.targets[targetIndex].currentAmount = Math.max(0, currAmt - potonganModal);
                await window.saveTransactionToDB(newTrx);
            } else {
                const newTrx = { 
                    id: window.generateUUID(), type: 'in', amount: amount, 
                    note: `Jual/Tarik: ${t.name}`, walletId: wallet.id, walletName: wallet.name, 
                    categoryId: 999, categoryName: 'Pencairan Investasi', 
                    date: window.getLocalDateString(), targetId: t.id 
                };
                window.transactions.push(newTrx);
                window.targets[targetIndex].currentAmount = Math.max(0, Number(t.currentAmount||0) - amount);
                await window.saveTransactionToDB(newTrx);
            }
        }

        window.recalculateBalances(); 
        await window.saveDataToFirestore();
        window.closeModal('modal-action');
    } catch(e) {
        window.transactions = originalTransactions; 
        window.recalculateBalances();
        window.customAlert("Error", "Gagal memproses aksi.", "error");
    } finally {
        if(submitBtn) { submitBtn.disabled = false; submitBtn.innerText = "Simpan"; }
    }
};
