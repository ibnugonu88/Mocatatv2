// ============================================================
// MOCATAT - FITUR ANALITIK & LOKASI MANGKAL (fitur-analitik.js)
// Audit Fixed: Akumulasi Tip Pelanggan, Double GrabFood 2 Lokasi & Visual Alignment
// ============================================================

// ==========================================
// 10. ANALITIK LOGIC (analitik.html)
// ==========================================
window.resolveAnalyticsLocLabel = function(rawLoc) {
    if (!rawLoc || !rawLoc.trim()) return null;
    const mappedZone = typeof window.getZoneNameByLocation === 'function'
        ? window.getZoneNameByLocation(rawLoc)
        : null;
    const cleanLoc = typeof window.resolveCanonicalLocation === 'function'
        ? window.resolveCanonicalLocation(rawLoc)
        : rawLoc.trim();
    return mappedZone || cleanLoc;
};

window.renderStatistik = function() {
    const statContainer = document.getElementById('statistik-container'); 
    if(!statContainer) return;
    const filterPeriod = document.getElementById('filter-stat-period') ? document.getElementById('filter-stat-period').value : 'month';
    const now = new Date(), todayStr = window.getLocalDateString(), currentMonthStr = window.getLocalMonthString();
    
    const hariKeMingguIni = now.getDay() === 0 ? 7 : now.getDay();
    let startOfWeek = new Date(now); 
    startOfWeek.setDate(now.getDate() - (hariKeMingguIni - 1)); 
    startOfWeek.setHours(0,0,0,0);
    let endOfWeek = new Date(startOfWeek); 
    endOfWeek.setDate(startOfWeek.getDate() + 6); 
    endOfWeek.setHours(23,59,59,999);
    
    let periodText = filterPeriod === 'today' ? 'Hari Ini' : (filterPeriod === 'week' ? 'Minggu Ini' : (filterPeriod === 'all' ? 'Semua Waktu' : 'Bulan Ini'));

    let totalIn = 0, totalOut = 0; 
    let totalTargetOut = 0, totalTargetIn = 0;
    let totalOrders = 0; 
    let totalTips = 0;
    let grabStats = {}; 
    let grabOrdersByService = {};
    let locationStats = {}; 
    let locationOrders = {};
    let timeStats = { pagi: 0, siang: 0, sore: 0, malam: 0 }; 
    let expenseByCategoryObj = {}; 
    let serviceExpenses = 0; 
    let serviceCount = 0;

    let earliestTrxDateStr = null;
    window.transactions.forEach(t => {
        if (String(t.categoryId) === '999' || !t.date) return;
        if (!earliestTrxDateStr || t.date < earliestTrxDateStr) {
            earliestTrxDateStr = t.date;
        }
    });

    let startDayThisMonth = 1;
    if (earliestTrxDateStr && earliestTrxDateStr.startsWith(currentMonthStr)) {
        const parsedStartDay = parseInt(earliestTrxDateStr.split('-')[2], 10);
        if (!isNaN(parsedStartDay) && parsedStartDay > 1 && parsedStartDay <= now.getDate()) {
            startDayThisMonth = parsedStartDay;
        }
    }
    
    let daysInPeriod = 1;
    if (filterPeriod === 'week') {
        if (earliestTrxDateStr) {
            const firstDateObj = new Date(earliestTrxDateStr + 'T00:00:00');
            if (firstDateObj > startOfWeek && firstDateObj <= now) {
                const diffW = Math.floor((now.getTime() - firstDateObj.getTime()) / (1000 * 3600 * 24)) + 1;
                daysInPeriod = Math.max(1, diffW);
            } else {
                daysInPeriod = Math.max(1, hariKeMingguIni);
            }
        } else {
            daysInPeriod = Math.max(1, hariKeMingguIni);
        }
    } else if (filterPeriod === 'month') {
        daysInPeriod = Math.max(1, now.getDate() - startDayThisMonth + 1); 
    } else if (filterPeriod === 'today') { 
        daysInPeriod = 1; 
    } else if (filterPeriod === 'all' && earliestTrxDateStr) {
        const firstMs = new Date(earliestTrxDateStr + 'T00:00:00').getTime();
        const diff = now.getTime() - firstMs; 
        daysInPeriod = Math.max(1, Math.ceil(diff / (1000 * 3600 * 24))); 
    }

    let keluarBulanIniSebelumHariIni = 0;
    let keluarHariIni = 0;
    let masukBulanIniSebelumHariIni = 0;
    let masukHariIni = 0;

    window.transactions.forEach(trx => {
        const amt = Number(trx.amount || 0);
        const isSysCategory = String(trx.categoryId) === '999';
        const isTargetTrx = isSysCategory && (
            Boolean(trx.targetId) ||
            trx.categoryName === 'Alokasi Target' ||
            trx.categoryName === 'Pencairan Tabungan' ||
            trx.categoryName === 'Pencairan Investasi'
        );

        if (isSysCategory && !isTargetTrx) return;

        let isMatch = false;
        if (filterPeriod === 'all') isMatch = true; 
        else if (filterPeriod === 'today') isMatch = trx.date === todayStr; 
        else if (filterPeriod === 'week') { 
            if (!trx.date) return; 
            const tDate = new Date(trx.date + 'T12:00:00'); 
            isMatch = tDate >= startOfWeek && tDate <= endOfWeek; 
        } else if (filterPeriod === 'month') {
            isMatch = trx.date && trx.date.startsWith(currentMonthStr);
        }

        if (isTargetTrx) {
            if (isMatch) {
                if (trx.type === 'out') totalTargetOut += amt;
                else if (trx.type === 'in') totalTargetIn += amt;
            }
            return;
        }

        if (trx.date && trx.date.startsWith(currentMonthStr)) { 
            if (trx.type === 'out') {
                if (trx.date === todayStr) keluarHariIni += amt;
                else if (trx.date < todayStr) keluarBulanIniSebelumHariIni += amt;
            }
            if (trx.type === 'in') {
                if (trx.date === todayStr) masukHariIni += amt;
                else if (trx.date < todayStr) masukBulanIniSebelumHariIni += amt;
            }
        }

        if (isMatch) { 
            if (trx.type === 'out') {
                totalOut += amt; 
                let catKey = trx.categoryId ? String(trx.categoryId) : (trx.categoryName || 'Lainnya');
                expenseByCategoryObj[catKey] = (expenseByCategoryObj[catKey] || 0) + amt;
                
                let noteLower = trx.note ? trx.note.toLowerCase() : ''; 
                let catLower = (trx.categoryName||'').toLowerCase();
                if (catLower.includes('servis') || catLower.includes('motor') || catLower.includes('kendaraan') || noteLower.includes('oli')) { 
                    serviceExpenses += amt; 
                    serviceCount++; 
                }
            } 
            if (trx.type === 'in') {
                totalIn += amt; 
                const isStandaloneTipCat = (trx.categoryName || '').toLowerCase().includes('tip');
                if (isStandaloneTipCat) {
                    totalTips += amt;
                } else {
                    totalTips += Number(trx.tipAmount || 0);
                }

                const ordCount = (trx.grabService === 'GrabFood' && Number(trx.orderCount) === 2) ? 2 : 1;

                let timeStr = trx.time || "12:00"; 
                let hour = parseInt(timeStr.split(':')[0], 10);
                if (isNaN(hour)) hour = 12;
                if (hour >= 5 && hour <= 11) timeStats.pagi += amt; 
                else if (hour >= 12 && hour <= 14) timeStats.siang += amt; 
                else if (hour >= 15 && hour <= 18) timeStats.sore += amt; 
                else timeStats.malam += amt;
                
                // Jangan tambah jumlah order jika itu murni transaksi kategori Tip Pelanggan
                if (trx.grabService && !isStandaloneTipCat) { 
                    totalOrders += ordCount; 
                    grabStats[trx.grabService] = (grabStats[trx.grabService] || 0) + amt; 
                    grabOrdersByService[trx.grabService] = (grabOrdersByService[trx.grabService] || 0) + ordCount;
                }

                if (!isStandaloneTipCat) {
                    const groupLabel1 = window.resolveAnalyticsLocLabel(trx.location);
                    const groupLabel2 = (ordCount === 2) ? window.resolveAnalyticsLocLabel(trx.location2) : null;

                    if (ordCount === 2 && groupLabel1 && groupLabel2) {
                        const half1 = Math.floor(amt / 2);
                        const half2 = amt - half1;
                        locationStats[groupLabel1] = (locationStats[groupLabel1] || 0) + half1;
                        locationOrders[groupLabel1] = (locationOrders[groupLabel1] || 0) + 1;
                        locationStats[groupLabel2] = (locationStats[groupLabel2] || 0) + half2;
                        locationOrders[groupLabel2] = (locationOrders[groupLabel2] || 0) + 1;
                    } else if (groupLabel1) {
                        locationStats[groupLabel1] = (locationStats[groupLabel1] || 0) + amt;
                        locationOrders[groupLabel1] = (locationOrders[groupLabel1] || 0) + ordCount;
                    } else if (groupLabel2) {
                        locationStats[groupLabel2] = (locationStats[groupLabel2] || 0) + amt;
                        locationOrders[groupLabel2] = (locationOrders[groupLabel2] || 0) + ordCount;
                    }
                }
            }
        } 
    });

    const totalHariBulanIni = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const sisaHariBulanIni = Math.max(1, totalHariBulanIni - now.getDate() + 1);
    const totalHariAktifBulanIni = Math.max(1, totalHariBulanIni - startDayThisMonth + 1);

    let totalAnggaranKeluar = 0; 
    let totalTargetMasukBulanan = 0;
    window.categories.forEach(c => { 
        if (c.type === 'out') totalAnggaranKeluar += Number(c.budget || 0); 
        if (c.type === 'in') totalTargetMasukBulanan += Number(c.budget || 0);
    });

    let totalSaranNabungHarian = 0;
    const todayObj = new Date();
    todayObj.setHours(0, 0, 0, 0);

    (window.targets || []).forEach(t => {
        if (t.isActive === false) return;
        const targetAmt = Number(t.targetAmount || 0);
        if (targetAmt <= 0) return;

        let setorTargetHariIni = 0;
        (window.transactions || []).forEach(trx => {
            if (trx.date === todayStr && String(trx.targetId) === String(t.id) && String(trx.categoryId) === '999') {
                if (trx.type === 'out') setorTargetHariIni += Number(trx.amount || 0);
                else if (trx.type === 'in') setorTargetHariIni -= Number(trx.amount || 0);
            }
        });
        if (setorTargetHariIni < 0) setorTargetHariIni = 0;

        const uangSekarang = t.tipe === 'investasi'
            ? Number(t.nilaiTerkini !== undefined ? t.nilaiTerkini : (t.currentAmount || 0))
            : Number(t.currentAmount || 0);
        const terkumpulAwalHari = Math.max(0, uangSekarang - setorTargetHariIni);
        const sisaUangAwalHari = Math.max(0, targetAmt - terkumpulAwalHari);

        if (sisaUangAwalHari <= 0) return;

        if (t.deadline) {
            const deadlineDate = new Date(t.deadline);
            deadlineDate.setHours(0, 0, 0, 0);
            const diffDays = Math.ceil((deadlineDate - todayObj) / (1000 * 60 * 60 * 24));
            if (diffDays > 0) {
                totalSaranNabungHarian += Math.ceil(sisaUangAwalHari / diffDays);
            } else {
                totalSaranNabungHarian += sisaUangAwalHari;
            }
        } else {
            totalSaranNabungHarian += Math.ceil(sisaUangAwalHari / 30);
        }
    });

    const plafonKeluarHarianNormal = Math.floor(totalAnggaranKeluar / totalHariBulanIni);
    const anggaranEfektifBulanIni = Math.floor((totalAnggaranKeluar / totalHariBulanIni) * totalHariAktifBulanIni);
    const sisaAnggaranAwalHari = Math.max(0, anggaranEfektifBulanIni - keluarBulanIniSebelumHariIni);
    const jatahSisaBagiHari = Math.floor(sisaAnggaranAwalHari / sisaHariBulanIni);
    const saranPengeluaranHarian = totalAnggaranKeluar > 0 ? Math.min(plafonKeluarHarianNormal, jatahSisaBagiHari) : 0;
    const sisaJatahKeluarHariIni = saranPengeluaranHarian - keluarHariIni;

    const targetMasukHarianNormal = Math.ceil(totalTargetMasukBulanan / totalHariBulanIni);
    const targetMasukEfektifBulanIni = Math.ceil((totalTargetMasukBulanan / totalHariBulanIni) * totalHariAktifBulanIni);
    const sisaTargetMasukAwalHari = Math.max(0, targetMasukEfektifBulanIni - masukBulanIniSebelumHariIni);
    const saranDariTargetKategori = totalTargetMasukBulanan > 0 
        ? Math.max(targetMasukHarianNormal, Math.ceil(sisaTargetMasukAwalHari / sisaHariBulanIni)) 
        : 0;
    const saranPendapatanHarian = Math.max(saranPengeluaranHarian + totalSaranNabungHarian, saranDariTargetKategori);
    const kurangKejarHariIni = Math.max(0, saranPendapatanHarian - masukHariIni);

    let infoKejarHTML = '';
    if (saranPendapatanHarian === 0) {
        infoKejarHTML = `<div style="font-size: 10.5px; color: #15803d; font-weight: 700;">Terkumpul: ${window.formatRupiah(masukHariIni)}</div>`;
    } else if (kurangKejarHariIni === 0) {
        infoKejarHTML = `<div style="font-size: 10.5px; color: #15803d; font-weight: 800;">✅ Target tercapai! (${window.formatRupiah(masukHariIni)})</div>`;
    } else {
        infoKejarHTML = `<div style="font-size: 10.5px; color: #15803d; font-weight: 700;">Kurang: <strong>${window.formatRupiah(kurangKejarHariIni)}</strong> lagi</div><div style="font-size: 10px; color: #475569; font-weight: 600; margin-top: 2px;">Masuk hari ini: ${window.formatRupiah(masukHariIni)}</div>`;
    }

    let infoBatasHTML = '';
    if (totalAnggaranKeluar === 0) {
        infoBatasHTML = `<div style="font-size: 10.5px; color: #c2410c; font-weight: 700;">Belum atur anggaran kategori</div>`;
    } else if (sisaJatahKeluarHariIni >= 0) {
        infoBatasHTML = `<div style="font-size: 10.5px; color: #c2410c; font-weight: 700;">Sisa hari ini: <strong>${window.formatRupiah(sisaJatahKeluarHariIni)}</strong></div><div style="font-size: 10px; color: #475569; font-weight: 600; margin-top: 2px;">Terpakai: ${window.formatRupiah(keluarHariIni)}</div>`;
    } else {
        infoBatasHTML = `<div style="font-size: 10.5px; color: #b91c1c; font-weight: 800;">⚠️ Lewat batas ${window.formatRupiah(Math.abs(sisaJatahKeluarHariIni))}</div><div style="font-size: 10px; color: #b91c1c; font-weight: 700; margin-top: 2px;">Terpakai: ${window.formatRupiah(keluarHariIni)}</div>`;
    }

    const netTargetSetor = Math.max(0, totalTargetOut - totalTargetIn);
    const labaNarikMurni = totalIn - totalOut;
    const saldoBersih = labaNarikMurni - netTargetSetor; 
    const avgPerDay = daysInPeriod > 0 ? Math.floor(totalIn / daysInPeriod) : totalIn; 
    const avgPerOrder = totalOrders > 0 ? Math.floor(totalIn / totalOrders) : 0;

    const maxBar = (totalIn + totalOut + netTargetSetor) > 0 ? (totalIn + totalOut + netTargetSetor) : 1; 
    const pctIn = (totalIn / maxBar) * 100; 
    const pctOut = (totalOut / maxBar) * 100;
    const pctTarget = (netTargetSetor / maxBar) * 100;

    let bannerPenjelasanTarget = '';
    if (saldoBersih < 0 && labaNarikMurni >= 0 && netTargetSetor > 0) {
        bannerPenjelasanTarget = `
        <div style="background: rgba(254, 240, 138, 0.2); border: 1px solid rgba(253, 224, 71, 0.45); border-radius: 12px; padding: 9px 12px; margin-bottom: 14px; font-size: 11px; line-height: 1.45; font-weight: 700; color: #fef9c3; display: flex; align-items: flex-start; gap: 8px;">
            <span class="material-icons-round" style="font-size: 16px; color: #fde047; flex-shrink: 0; margin-top: 1px;">savings</span>
            <span>Uangmu aman! Untung narik <strong>${window.formatRupiah(labaNarikMurni)}</strong> ditambah <strong>${window.formatRupiah(Math.abs(saldoBersih))}</strong> dari saldo dompet sudah berpindah ke Tabungan Target.</span>
        </div>`;
    }

    const infoTipBarisHTML = totalTips > 0
        ? `<div style="display: flex; justify-content: space-between; font-size: 11.5px; font-weight: 600; opacity: 0.92; padding-left: 14px;">
                <span>🎁 Termasuk Tip Pelanggan</span>
                <span style="font-weight: 800; color: #fde047;">+${window.formatRupiah(totalTips)}</span>
           </div>`
        : '';

    let htmlContent = `
    <div class="stat-card" style="background: linear-gradient(145deg, #166e6a 0%, #249a95 60%, #2bb0aa 100%); color: white; padding: 22px 20px; position: relative; overflow: hidden; margin-bottom: 22px; border: none; box-shadow: 0 12px 28px -4px rgba(22, 110, 106, 0.3);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <div style="font-size: 11px; font-weight: 800; opacity: 0.92; text-transform: uppercase; letter-spacing: 0.8px;">Penghasilan Bersih · ${periodText}</div>
            <div style="display: inline-flex; align-items: center; gap: 5px; background: rgba(255,255,255,0.2); padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 800;">
                <span class="material-icons-round" style="font-size: 13px;">receipt_long</span> ${totalOrders} Order
            </div>
        </div>
        <div style="font-size: 34px; font-weight: 800; letter-spacing: -1px; margin-bottom: 4px; text-shadow: 0 4px 10px rgba(0,0,0,0.12);">${window.formatRupiah(saldoBersih)}</div>
        <div style="font-size: 11.5px; opacity: 0.9; font-weight: 600; margin-bottom: 14px;">Sisa bersih setelah dikurangi pengeluaran & setor target</div>

        ${bannerPenjelasanTarget}

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 16px;">
            <div style="background: rgba(255, 255, 255, 0.14); border: 1px solid rgba(255, 255, 255, 0.22); border-radius: 13px; padding: 10px 12px; display: flex; flex-direction: column; justify-content: space-between;">
                <div style="font-size: 10.5px; font-weight: 700; opacity: 0.9; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Untung Murni Narik</div>
                <div style="font-size: 14.5px; font-weight: 800; color: #a7f3d0;">${labaNarikMurni >= 0 ? '+' : ''}${window.formatRupiah(labaNarikMurni)}</div>
            </div>
            <div style="background: rgba(255, 255, 255, 0.14); border: 1px solid rgba(255, 255, 255, 0.22); border-radius: 13px; padding: 10px 12px; display: flex; flex-direction: column; justify-content: space-between;">
                <div style="font-size: 10.5px; font-weight: 700; opacity: 0.9; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Diamankan ke Target</div>
                <div style="font-size: 14.5px; font-weight: 800; color: #fde047;">${window.formatRupiah(netTargetSetor)}</div>
            </div>
        </div>

        <div style="margin-bottom: 12px;">
            <div style="display: flex; height: 8px; border-radius: 4px; overflow: hidden; background: rgba(0,0,0,0.22);">
                <div style="width: ${pctIn}%; background: #6ee7b7;"></div>
                <div style="width: ${pctOut}%; background: #fca5a5;"></div>
                <div style="width: ${pctTarget}%; background: #fde047;"></div>
            </div>
        </div>
        <div style="display: flex; flex-direction: column; gap: 7px;">
            <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 600;">
                <span style="display: flex; align-items: center; gap: 6px;"><span style="width: 8px; height: 8px; background: #6ee7b7; border-radius: 50%;"></span> Uang masuk (kotor)</span>
                <span style="font-weight: 800;">${window.formatRupiah(totalIn)}</span>
            </div>
            ${infoTipBarisHTML}
            <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 600;">
                <span style="display: flex; align-items: center; gap: 6px;"><span style="width: 8px; height: 8px; background: #fca5a5; border-radius: 50%;"></span> Keluar (pengeluaran)</span>
                <span style="font-weight: 800;">- ${window.formatRupiah(totalOut)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 600;">
                <span style="display: flex; align-items: center; gap: 6px;"><span style="width: 8px; height: 8px; background: #fde047; border-radius: 50%;"></span> Setor target (tabungan/investasi)</span>
                <span style="font-weight: 800;">- ${window.formatRupiah(netTargetSetor)}</span>
            </div>
        </div>
    </div>`;
    
    htmlContent += `<div class="section-title" style="display: flex; align-items: center; gap: 8px; color: #d97706; margin-left: 0;"><span class="material-icons-round" style="font-size: 18px;">track_changes</span> TARGET HARIANMU</div><div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 22px;"><div class="stat-card" style="padding: 15px; margin: 0; border: 1.5px solid #86efac; background: #f0fdf4;"><div style="font-size: 11px; color: #15803d; font-weight: 800; margin-bottom: 4px;">🎯 Kejar Pemasukan</div><div style="font-size: 16px; font-weight: 800; color: #14532d; margin-bottom: 4px;">${window.formatRupiah(saranPendapatanHarian)}</div>${infoKejarHTML}</div><div class="stat-card" style="padding: 15px; margin: 0; border: 1.5px solid ${sisaJatahKeluarHariIni < 0 ? '#fca5a5' : '#fdba74'}; background: ${sisaJatahKeluarHariIni < 0 ? '#fef2f2' : '#fff7ed'};"><div style="font-size: 11px; color: ${sisaJatahKeluarHariIni < 0 ? '#b91c1c' : '#c2410c'}; font-weight: 800; margin-bottom: 4px;">🛑 Batas Pengeluaran</div><div style="font-size: 16px; font-weight: 800; color: ${sisaJatahKeluarHariIni < 0 ? '#991b1b' : '#9a3412'}; margin-bottom: 4px;">${window.formatRupiah(saranPengeluaranHarian)}</div>${infoBatasHTML}</div></div>`;
    
    htmlContent += `<div class="section-title" style="display: flex; align-items: center; gap: 8px; color: #0f766e; margin-left: 0;"><span class="material-icons-round" style="font-size: 18px;">trending_up</span> PEMASUKAN</div><div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 14px;"><div class="stat-card" style="padding: 13px 10px; margin: 0; display: flex; flex-direction: column; justify-content: center; min-width: 0;"><div style="font-size: 11px; color: #475569; font-weight: 800; margin-bottom: 3px;">Order</div><div style="font-size: 15px; font-weight: 800; color: #0f172a;">${totalOrders}</div><div style="font-size: 10px; color: #64748b; font-weight: 700;">Selesai</div></div><div class="stat-card" style="padding: 13px 10px; margin: 0; display: flex; flex-direction: column; justify-content: center; min-width: 0;"><div style="font-size: 11px; color: #475569; font-weight: 800; margin-bottom: 3px;">/hari</div><div style="font-size: 14px; font-weight: 800; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${window.formatRupiah(avgPerDay)}</div><div style="font-size: 10px; color: #64748b; font-weight: 700;">Rata-rata (${daysInPeriod} hr)</div></div><div class="stat-card" style="padding: 13px 10px; margin: 0; display: flex; flex-direction: column; justify-content: center; min-width: 0;"><div style="font-size: 11px; color: #475569; font-weight: 800; margin-bottom: 3px;">/order</div><div style="font-size: 14px; font-weight: 800; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${window.formatRupiah(avgPerOrder)}</div><div style="font-size: 10px; color: #64748b; font-weight: 700;">Rata-rata</div></div></div>`;
    
    htmlContent += `<div class="stat-card" style="padding: 16px; margin-bottom: 22px;"><div style="font-size: 13.5px; font-weight: 800; color: #0f172a; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center;"><span>Jam tercuan</span><span style="font-size:11px; color:#475569; font-weight:700;">Makin penuh, makin cuan</span></div>`;
    
    const timeOrdered = ['pagi', 'siang', 'sore', 'malam']; 
    const timeNames = { pagi: 'Pagi', siang: 'Siang', sore: 'Sore', malam: 'Malam' }; 
    let maxIncomeTime = Math.max(...Object.values(timeStats)); 
    if (maxIncomeTime === 0) maxIncomeTime = 1; 
    timeOrdered.forEach(t => { 
        let val = timeStats[t]; 
        let pctTime = (val / maxIncomeTime) * 100; 
        let barColor = pctTime === 100 ? '#00B14F' : '#34d399'; 
        if(val === 0) { pctTime = 0; barColor = '#e2e8f0'; } 
        htmlContent += `<div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;"><div style="font-size: 12.5px; font-weight: 800; color: #334155; width: 52px;">${timeNames[t]}</div><div style="flex-grow: 1; margin: 0 12px; height: 9px; background: #e2e8f0; border-radius: 5px; overflow: hidden;"><div style="width: ${pctTime}%; height: 100%; background: ${barColor}; border-radius: 5px;"></div></div><div style="font-size: 12.5px; font-weight: 800; color: #0f172a; width: 82px; text-align: right;">${window.formatRupiah(val)}</div></div>`; 
    });
    htmlContent += `</div>`;
    
    htmlContent += `<div class="stat-card" style="padding: 16px; margin-bottom: 22px;"><div style="font-size: 13.5px; font-weight: 800; color: #0f172a; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center;"><span>Per layanan Grab</span><span style="font-size:11px; color:#475569; font-weight:700;">Uang masuk</span></div>`;
    if (Object.keys(grabStats).length > 0) { 
        const sortedGrab = Object.entries(grabStats).sort((a, b) => b[1] - a[1]); 
        for (const [service, amount] of sortedGrab) { 
            const jmlOrdSvc = grabOrdersByService[service] || 1;
            htmlContent += `<div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #f1f5f9;"><div style="font-size: 13px; font-weight: 800; color: #1e293b; display: flex; align-items:center; gap:6px;"><span class="material-icons-round" style="font-size:15px; color:#00B14F;">check_circle</span> ${window.escapeHTML(service)} <span style="font-size:11.5px; color:#475569; font-weight:700;">(${jmlOrdSvc} order)</span></div><div style="font-size: 13.5px; font-weight: 800; color: #15803d;">${window.formatRupiah(amount)}</div></div>`; 
        } 
    } else { 
        htmlContent += `<div style="font-size: 12.5px; color: #64748b; font-weight: 600; text-align: center; padding: 12px;">Belum ada order tercatat</div>`; 
    }
    htmlContent += `</div>`;

    if (Object.keys(locationStats).length > 0) { 
        htmlContent += `<div class="stat-card" style="padding: 16px; margin-bottom: 22px;"><div style="font-size: 13.5px; font-weight: 800; color: #0f172a; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center;"><span>Per daerah / lokasi</span><a href="lokasi.html" style="font-size:11.5px; color:#0f766e; font-weight:800;">Buka Radar Mangkal ➔</a></div>`; 
        const sortedLocs = Object.entries(locationStats).sort((a, b) => b[1] - a[1]); 
        for (const [loc, amount] of sortedLocs) { 
            const countOrd = locationOrders[loc] || 1;
            htmlContent += `<div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #f1f5f9;"><div style="font-size: 13px; font-weight: 800; color: #1e293b; display: flex; align-items: center; gap:6px;"><span class="material-icons-round" style="font-size:15px; color:#1d4ed8;">place</span> ${window.escapeHTML(loc)} <span style="font-size:11.5px; color:#475569; font-weight:700;">(${countOrd}x)</span></div><div style="font-size: 13.5px; font-weight: 800; color: #1d4ed8;">${window.formatRupiah(amount)}</div></div>`; 
        } 
        htmlContent += `</div>`; 
    }

    htmlContent += `<div class="section-title" style="display: flex; align-items: center; gap: 8px; color: #c2410c; margin-left: 0;"><span class="material-icons-round" style="font-size: 18px;">money_off</span> PENGELUARAN & ANGGARAN</div><div class="stat-card" style="padding: 16px; margin-bottom: 14px;"><div style="font-size: 13px; font-weight: 800; color: #0f172a; margin-bottom: 10px; display: flex; justify-content: space-between;"><span>Total Pengeluaran Operasional</span><span style="color:#b91c1c;">${window.formatRupiah(totalOut)}</span></div><div style="font-size: 12.5px; font-weight: 800; color: #475569; padding-top: 10px; border-top: 1px dashed #cbd5e1; display: flex; justify-content: space-between;"><span>Total Setor Target & Investasi</span><span style="color:#d97706;">${window.formatRupiah(netTargetSetor)}</span></div></div><div class="stat-card" style="padding: 16px; margin-bottom: 22px;"><div style="font-size: 13.5px; font-weight: 800; color: #0f172a; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center;"><span>Rincian pengeluaran</span><span style="font-size:11px; color:#475569; font-weight:700;">${periodText}</span></div>`;
    let adaKategoriPengeluaran = false;
    window.categories.forEach(c => {
        if(c.type === 'out' && String(c.id) !== '999') {
            adaKategoriPengeluaran = true; 
            let terpakaiPeriod = expenseByCategoryObj[String(c.id)] || expenseByCategoryObj[c.name] || 0; 
            let persenTerpakai = Number(c.budget||0) > 0 ? Math.min((terpakaiPeriod / Number(c.budget||1)) * 100, 100) : 0; 
            let progressColor = persenTerpakai >= 100 ? "#dc2626" : (persenTerpakai > 75 ? "#ea580c" : "#249a95"); 
            let sisa = Number(c.budget||0) - terpakaiPeriod, labelSisa = sisa < 0 ? "Overbudget:" : "Sisa:", nilaiSisaTampil = sisa < 0 ? window.formatRupiah(Math.abs(sisa)) : (Number(c.budget||0) > 0 ? window.formatRupiah(sisa) : "Tanpa Batas");
            htmlContent += `<div style="padding: 10px 0; border-bottom: 1px solid #f1f5f9;"><div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;"><div style="font-size: 13px; font-weight: 800; color: #1e293b;">${window.escapeHTML(c.name)}</div><div style="font-size: 13.5px; font-weight: 800; color: #b91c1c;">${window.formatRupiah(terpakaiPeriod)}</div></div>`;
            if(Number(c.budget||0) > 0) { 
                htmlContent += `<div style="display: flex; justify-content: space-between; font-size: 11px; color: #475569; font-weight: 600; margin-bottom: 6px;"><span>Anggaran: <strong style="color:#0f172a;">${window.formatRupiah(c.budget)}</strong></span><span style="color: ${sisa < 0 ? '#b91c1c' : '#15803d'}; font-weight:800;">${labelSisa} ${nilaiSisaTampil}</span></div><div style="width: 100%; height: 7px; background: #e2e8f0; border-radius: 4px; overflow: hidden;"><div style="height: 100%; width: ${persenTerpakai}%; background: ${progressColor}; border-radius: 4px;"></div></div>`; 
            } else { 
                htmlContent += `<div style="font-size: 11px; color: #64748b; font-weight: 600;">Tanpa batas anggaran</div>`; 
            }
            htmlContent += `</div>`;
        }
    });
    if(!adaKategoriPengeluaran) { htmlContent += `<div style="font-size: 12.5px; color: #64748b; font-weight: 600; text-align: center; padding: 12px;">Belum ada pengeluaran</div>`; } 
    htmlContent += `</div>`;
    htmlContent += `<div class="section-title" style="display: flex; align-items: center; gap: 8px; color: #4338ca; margin-left: 0;"><span class="material-icons-round" style="font-size: 18px;">build</span> SERVIS MOTOR</div><div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 24px;"><div class="stat-card" style="padding: 15px; margin: 0;"><div style="font-size: 11px; color: #475569; font-weight: 800; margin-bottom: 4px;">Total servis</div><div style="font-size: 16px; font-weight: 800; color: #0f172a; margin-bottom: 2px;">${window.formatRupiah(serviceExpenses)}</div><div style="font-size: 10.5px; color: #64748b; font-weight: 700;">Periode ini</div></div><div class="stat-card" style="padding: 15px; margin: 0;"><div style="font-size: 11px; color: #475569; font-weight: 800; margin-bottom: 4px;">Jumlah</div><div style="font-size: 16px; font-weight: 800; color: #0f172a; margin-bottom: 2px;">${serviceCount}x</div><div style="font-size: 10.5px; color: #64748b; font-weight: 700;">Catatan servis</div></div></div>`;
    statContainer.innerHTML = htmlContent;
};
