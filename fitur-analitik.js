// ============================================================
// MOCATAT - FITUR ANALITIK & LOKASI MANGKAL (fitur-analitik.js)
// Mencakup: analitik.html (Statistik) & Pengelompokan Daerah
// ============================================================

// ==========================================
// 10. ANALITIK LOGIC (analitik.html)
// ==========================================
window.renderStatistik = function() {
    const statContainer = document.getElementById('statistik-container'); 
    if(!statContainer) return;
    const filterPeriod = document.getElementById('filter-stat-period') ? document.getElementById('filter-stat-period').value : 'month';
    const now = new Date(), todayStr = window.getLocalDateString(), currentMonthStr = window.getLocalMonthString();
    
    // Hitung awal dan akhir minggu (Senin - Minggu)
    const hariKeMingguIni = now.getDay() === 0 ? 7 : now.getDay(); // Senin = 1 ... Minggu = 7
    let startOfWeek = new Date(now); 
    startOfWeek.setDate(now.getDate() - (hariKeMingguIni - 1)); 
    startOfWeek.setHours(0,0,0,0);
    let endOfWeek = new Date(startOfWeek); 
    endOfWeek.setDate(startOfWeek.getDate() + 6); 
    endOfWeek.setHours(23,59,59,999);
    
    let periodText = filterPeriod === 'today' ? 'Hari Ini' : (filterPeriod === 'week' ? 'Minggu Ini' : (filterPeriod === 'all' ? 'Semua Waktu' : 'Bulan Ini'));

    let totalIn = 0, totalOut = 0; 
    let totalOrders = 0; 
    let grabStats = {}; 
    let locationStats = {}; 
    let locationOrders = {};
    let timeStats = { pagi: 0, siang: 0, sore: 0, malam: 0 }; 
    let expenseByCategoryObj = {}; 
    let serviceExpenses = 0; 
    let serviceCount = 0;

    // Deteksi tanggal pertama kali pengguna mulai mencatat transaksi (agar akurat jika mulai di tengah bulan, misal tgl 21)
    let earliestTrxDateStr = null;
    window.transactions.forEach(t => {
        if (String(t.categoryId) === '999' || !t.date) return;
        if (!earliestTrxDateStr || t.date < earliestTrxDateStr) {
            earliestTrxDateStr = t.date;
        }
    });

    // Jika baru mulai mencatat di bulan ini (misal tgl 21), maka hari mulai bulan ini = 21. Jika sudah ada catatan dari bulan lalu, mulai dari tgl 1.
    let startDayThisMonth = 1;
    if (earliestTrxDateStr && earliestTrxDateStr.startsWith(currentMonthStr)) {
        const parsedStartDay = parseInt(earliestTrxDateStr.split('-')[2], 10);
        if (!isNaN(parsedStartDay) && parsedStartDay > 1 && parsedStartDay <= now.getDate()) {
            startDayThisMonth = parsedStartDay;
        }
    }
    
    // Pembagi hari yang akurat sesuai periode berjalan & tanggal mulai mencatat
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

    // Variabel khusus pelacak anggaran & target harian
    let keluarBulanIniSebelumHariIni = 0;
    let keluarHariIni = 0;
    let masukBulanIniSebelumHariIni = 0;
    let masukHariIni = 0;

    window.transactions.forEach(trx => {
        if (String(trx.categoryId) === '999') return; 

        const amt = Number(trx.amount || 0);

        // Rekap bulan berjalan & hari ini untuk kalkulasi Target Harian
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
                let timeStr = trx.time || "12:00"; 
                let hour = parseInt(timeStr.split(':')[0]);
                if (hour >= 5 && hour <= 11) timeStats.pagi += amt; 
                else if (hour >= 12 && hour <= 14) timeStats.siang += amt; 
                else if (hour >= 15 && hour <= 18) timeStats.sore += amt; 
                else timeStats.malam += amt;
                
                if (trx.grabService) { 
                    totalOrders++; 
                    grabStats[trx.grabService] = (grabStats[trx.grabService] || 0) + amt; 
                }
                if (trx.location && trx.location.trim() !== '') {
                    const mappedZone = typeof window.getZoneNameByLocation === 'function' 
                        ? window.getZoneNameByLocation(trx.location) 
                        : null;
                    const groupLabel = mappedZone || trx.location.trim();
                    locationStats[groupLabel] = (locationStats[groupLabel] || 0) + amt;
                    locationOrders[groupLabel] = (locationOrders[groupLabel] || 0) + 1;
                }
            }
        } 
    });

    // =========================================================
    // LOGIKA TARGET HARIAN PINTAR (PRO-RATA & PLAFON HARIAN)
    // =========================================================
    const totalHariBulanIni = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const sisaHariBulanIni = Math.max(1, totalHariBulanIni - now.getDate() + 1);
    const totalHariAktifBulanIni = Math.max(1, totalHariBulanIni - startDayThisMonth + 1);

    let totalAnggaranKeluar = 0; 
    let totalTargetMasukBulanan = 0;
    window.categories.forEach(c => { 
        if (c.type === 'out') totalAnggaranKeluar += Number(c.budget || 0); 
        if (c.type === 'in') totalTargetMasukBulanan += Number(c.budget || 0);
    });

    // Hanya hitung cicilan harian dari Target yang berstatus AKTIF
    let totalSaranNabungHarian = 0;
    window.targets.forEach(t => {
        if (t.isActive === false) return; 
        let uangDihitung = t.tipe === 'investasi' ? Number(t.nilaiTerkini||0) : Number(t.currentAmount||0); 
        let sisaUang = Number(t.targetAmount||0) - uangDihitung;
        if(Number(t.targetAmount||0) > 0 && sisaUang > 0 && t.deadline) { 
            const today = new Date(); today.setHours(0, 0, 0, 0); 
            const deadlineDate = new Date(t.deadline); deadlineDate.setHours(0, 0, 0, 0); 
            const diffDays = Math.ceil((deadlineDate - today) / (1000 * 60 * 60 * 24)); 
            if(diffDays > 0) { totalSaranNabungHarian += Math.ceil(sisaUang / diffDays); } 
        }
    });

    // 1. Batas Pengeluaran Hari Ini (Pro-rata sejak tanggal mulai catat & dikunci maksimal di plafon harian normal)
    const plafonKeluarHarianNormal = Math.floor(totalAnggaranKeluar / totalHariBulanIni);
    const anggaranEfektifBulanIni = Math.floor((totalAnggaranKeluar / totalHariBulanIni) * totalHariAktifBulanIni);
    const sisaAnggaranAwalHari = Math.max(0, anggaranEfektifBulanIni - keluarBulanIniSebelumHariIni);
    const jatahSisaBagiHari = Math.floor(sisaAnggaranAwalHari / sisaHariBulanIni);
    const saranPengeluaranHarian = totalAnggaranKeluar > 0 ? Math.min(plafonKeluarHarianNormal, jatahSisaBagiHari) : 0;
    const sisaJatahKeluarHariIni = saranPengeluaranHarian - keluarHariIni;

    // 2. Target Kejar Pemasukan Hari Ini
    const targetMasukHarianNormal = Math.ceil(totalTargetMasukBulanan / totalHariBulanIni);
    const targetMasukEfektifBulanIni = Math.ceil((totalTargetMasukBulanan / totalHariBulanIni) * totalHariAktifBulanIni);
    const sisaTargetMasukAwalHari = Math.max(0, targetMasukEfektifBulanIni - masukBulanIniSebelumHariIni);
    const saranDariTargetKategori = totalTargetMasukBulanan > 0 
        ? Math.max(targetMasukHarianNormal, Math.ceil(sisaTargetMasukAwalHari / sisaHariBulanIni)) 
        : 0;
    const saranPendapatanHarian = Math.max(saranPengeluaranHarian + totalSaranNabungHarian, saranDariTargetKategori);
    const kurangKejarHariIni = Math.max(0, saranPendapatanHarian - masukHariIni);

    // Status visual kartu Kejar Pemasukan
    let infoKejarHTML = '';
    if (saranPendapatanHarian === 0) {
        infoKejarHTML = `<div style="font-size: 10px; color: #16a34a; font-weight: 600;">Terkumpul: ${window.formatRupiah(masukHariIni)}</div>`;
    } else if (kurangKejarHariIni === 0) {
        infoKejarHTML = `<div style="font-size: 10px; color: #15803d; font-weight: 800;">✅ Target tercapai! (${window.formatRupiah(masukHariIni)})</div>`;
    } else {
        infoKejarHTML = `<div style="font-size: 10px; color: #16a34a; font-weight: 700;">Kurang: <strong>${window.formatRupiah(kurangKejarHariIni)}</strong> lagi</div><div style="font-size: 9.5px; color: #64748b; font-weight: 600; margin-top: 2px;">Masuk hari ini: ${window.formatRupiah(masukHariIni)}</div>`;
    }

    // Status visual kartu Batas Pengeluaran
    let infoBatasHTML = '';
    if (totalAnggaranKeluar === 0) {
        infoBatasHTML = `<div style="font-size: 10px; color: #ea580c; font-weight: 600;">Belum atur anggaran kategori</div>`;
    } else if (sisaJatahKeluarHariIni >= 0) {
        infoBatasHTML = `<div style="font-size: 10px; color: #ea580c; font-weight: 700;">Sisa hari ini: <strong>${window.formatRupiah(sisaJatahKeluarHariIni)}</strong></div><div style="font-size: 9.5px; color: #64748b; font-weight: 600; margin-top: 2px;">Terpakai: ${window.formatRupiah(keluarHariIni)}</div>`;
    } else {
        infoBatasHTML = `<div style="font-size: 10px; color: #c62828; font-weight: 800;">⚠️ Lewat batas ${window.formatRupiah(Math.abs(sisaJatahKeluarHariIni))}</div><div style="font-size: 9.5px; color: #c62828; font-weight: 600; margin-top: 2px;">Terpakai: ${window.formatRupiah(keluarHariIni)}</div>`;
    }

    let saldoBersih = totalIn - totalOut; 
    let avgPerDay = daysInPeriod > 0 ? Math.floor(totalIn / daysInPeriod) : totalIn; 
    let avgPerOrder = totalOrders > 0 ? Math.floor(totalIn / totalOrders) : 0;
    let maxBar = totalIn + totalOut > 0 ? totalIn + totalOut : 1; 
    let pctIn = (totalIn / maxBar) * 100; 
    let pctOut = (totalOut / maxBar) * 100;

    let htmlContent = `<div class="stat-card" style="background: linear-gradient(135deg, #249a95 0%, #1e8580 100%); color: white; padding: 24px; position: relative; overflow: hidden; margin-bottom: 25px;"><div style="font-size: 11px; font-weight: 800; opacity: 0.9; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px;">Saldo Bersih · ${periodText}</div><div style="font-size: 36px; font-weight: 800; letter-spacing: -1px; margin-bottom: 12px; text-shadow: 0 4px 10px rgba(0,0,0,0.1);">${window.formatRupiah(saldoBersih)}</div><div style="display: inline-flex; align-items: center; gap: 6px; background: rgba(255,255,255,0.2); padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; margin-bottom: 20px;"><span class="material-icons-round" style="font-size: 14px;">receipt_long</span> ${totalOrders} Order Grab</div><div style="margin-bottom: 12px;"><div style="display: flex; height: 8px; border-radius: 4px; overflow: hidden; background: rgba(0,0,0,0.2);"><div style="width: ${pctIn}%; background: #6ee7b7;"></div><div style="width: ${pctOut}%; background: #fca5a5;"></div></div></div><div style="display: flex; flex-direction: column; gap: 8px;"><div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 600;"><span style="display: flex; align-items: center; gap: 6px;"><span style="width: 8px; height: 8px; background: #6ee7b7; border-radius: 50%;"></span> Uang masuk (kotor)</span><span style="font-weight: 800;">${window.formatRupiah(totalIn)}</span></div><div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 600;"><span style="display: flex; align-items: center; gap: 6px;"><span style="width: 8px; height: 8px; background: #fca5a5; border-radius: 50%;"></span> Keluar (pengeluaran)</span><span style="font-weight: 800;">${window.formatRupiah(totalOut)}</span></div></div></div>`;
    
    htmlContent += `<div class="section-title" style="display: flex; align-items: center; gap: 8px; color: #f59e0b; margin-left: 0;"><span class="material-icons-round" style="font-size: 18px;">track_changes</span> TARGET HARIANMU</div><div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 25px;"><div class="stat-card" style="padding: 15px; margin: 0; border: 1.5px solid #bbf7d0; background: #f0fdf4;"><div style="font-size: 11px; color: #16a34a; font-weight: 800; margin-bottom: 4px;">🎯 Kejar Pemasukan</div><div style="font-size: 16px; font-weight: 800; color: #15803d; margin-bottom: 4px;">${window.formatRupiah(saranPendapatanHarian)}</div>${infoKejarHTML}</div><div class="stat-card" style="padding: 15px; margin: 0; border: 1.5px solid ${sisaJatahKeluarHariIni < 0 ? '#fecaca' : '#fed7aa'}; background: ${sisaJatahKeluarHariIni < 0 ? '#fef2f2' : '#fff7ed'};"><div style="font-size: 11px; color: ${sisaJatahKeluarHariIni < 0 ? '#c62828' : '#ea580c'}; font-weight: 800; margin-bottom: 4px;">🛑 Batas Pengeluaran</div><div style="font-size: 16px; font-weight: 800; color: ${sisaJatahKeluarHariIni < 0 ? '#b91c1c' : '#c2410c'}; margin-bottom: 4px;">${window.formatRupiah(saranPengeluaranHarian)}</div>${infoBatasHTML}</div></div>`;
    
    htmlContent += `<div class="section-title" style="display: flex; align-items: center; gap: 8px; color: #249a95; margin-left: 0;"><span class="material-icons-round" style="font-size: 18px;">trending_up</span> PEMASUKAN</div><div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 15px;"><div class="stat-card" style="padding: 15px; margin: 0; display: flex; flex-direction: column; justify-content: center;"><div style="font-size: 11px; color: #777; font-weight: 700; margin-bottom: 4px;">Order</div><div style="font-size: 16px; font-weight: 800; color: #1a1a1a;">${totalOrders}</div><div style="font-size: 10px; color: #94a3b8; font-weight: 600;">Selesai</div></div><div class="stat-card" style="padding: 15px; margin: 0; display: flex; flex-direction: column; justify-content: center;"><div style="font-size: 11px; color: #777; font-weight: 700; margin-bottom: 4px;">/hari</div><div style="font-size: 16px; font-weight: 800; color: #1a1a1a;">${window.formatRupiah(avgPerDay)}</div><div style="font-size: 10px; color: #94a3b8; font-weight: 600;">Rata-rata (${daysInPeriod} hr)</div></div><div class="stat-card" style="padding: 15px; margin: 0; display: flex; flex-direction: column; justify-content: center;"><div style="font-size: 11px; color: #777; font-weight: 700; margin-bottom: 4px;">/order</div><div style="font-size: 16px; font-weight: 800; color: #1a1a1a;">${window.formatRupiah(avgPerOrder)}</div><div style="font-size: 10px; color: #94a3b8; font-weight: 600;">Rata-rata</div></div></div>`;
    
    htmlContent += `<div class="stat-card" style="padding: 16px; margin-bottom: 25px;"><div style="font-size: 13px; font-weight: 800; color: #1a1a1a; margin-bottom: 15px; display: flex; justify-content: space-between;"><span>Jam tercuan</span><span style="font-size:11px; color:#94a3b8;">Makin penuh, makin cuan</span></div>`;
    
    const timeOrdered = ['pagi', 'siang', 'sore', 'malam']; 
    const timeNames = { pagi: 'Pagi', siang: 'Siang', sore: 'Sore', malam: 'Malam' }; 
    let maxIncomeTime = Math.max(...Object.values(timeStats)); 
    if (maxIncomeTime === 0) maxIncomeTime = 1; 
    timeOrdered.forEach(t => { 
        let val = timeStats[t]; 
        let pctTime = (val / maxIncomeTime) * 100; 
        let barColor = pctTime === 100 ? '#00B14F' : '#6ee7b7'; 
        if(val === 0) { pctTime = 0; barColor = '#e2e8f0'; } 
        htmlContent += `<div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;"><div style="font-size: 12px; font-weight: 700; color: #475569; width: 50px;">${timeNames[t]}</div><div style="flex-grow: 1; margin: 0 12px; height: 8px; background: #f1f5f9; border-radius: 4px; overflow: hidden;"><div style="width: ${pctTime}%; height: 100%; background: ${barColor}; border-radius: 4px;"></div></div><div style="font-size: 12px; font-weight: 800; color: #1a1a1a; width: 75px; text-align: right;">${window.formatRupiah(val)}</div></div>`; 
    });
    htmlContent += `</div>`;
    
    htmlContent += `<div class="stat-card" style="padding: 16px; margin-bottom: 25px;"><div style="font-size: 13px; font-weight: 800; color: #1a1a1a; margin-bottom: 15px; display: flex; justify-content: space-between;"><span>Per layanan Grab</span><span style="font-size:11px; color:#94a3b8;">uang masuk</span></div>`;
    if (Object.keys(grabStats).length > 0) { 
        const sortedGrab = Object.entries(grabStats).sort((a, b) => b[1] - a[1]); 
        for (const [service, amount] of sortedGrab) { 
            htmlContent += `<div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #f1f5f9;"><div style="font-size: 13px; font-weight: 700; color: #333; display: flex; align-items:center; gap:6px;"><span class="material-icons-round" style="font-size:14px; color:#00B14F;">check_circle</span> ${window.escapeHTML(service)}</div><div style="font-size: 13px; font-weight: 800; color: #2e7d32;">${window.formatRupiah(amount)}</div></div>`; 
        } 
    } else { 
        htmlContent += `<div style="font-size: 12px; color: #94a3b8; text-align: center; padding: 10px;">Belum ada order</div>`; 
    }
    htmlContent += `</div>`;

    if (Object.keys(locationStats).length > 0) { 
        htmlContent += `<div class="stat-card" style="padding: 16px; margin-bottom: 25px;"><div style="font-size: 13px; font-weight: 800; color: #1a1a1a; margin-bottom: 15px; display: flex; justify-content: space-between;"><span>Per daerah / lokasi</span><a href="lokasi.html" style="font-size:11px; color:#249a95; font-weight:700;">Buka Radar Mangkal ➔</a></div>`; 
        const sortedLocs = Object.entries(locationStats).sort((a, b) => b[1] - a[1]); 
        for (const [loc, amount] of sortedLocs) { 
            const countOrd = locationOrders[loc] || 1;
            htmlContent += `<div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #f1f5f9;"><div style="font-size: 13px; font-weight: 700; color: #333; display: flex; align-items: center; gap:6px;"><span class="material-icons-round" style="font-size:14px; color:#1976d2;">place</span> ${window.escapeHTML(loc)} <span style="font-size:11px; color:#94a3b8; font-weight:600;">(${countOrd}x)</span></div><div style="font-size: 13px; font-weight: 800; color: #1976d2;">${window.formatRupiah(amount)}</div></div>`; 
        } 
        htmlContent += `</div>`; 
    }

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
            if(Number(c.budget||0) > 0) { 
                htmlContent += `<div style="display: flex; justify-content: space-between; font-size: 10px; color: #666; margin-bottom: 6px;"><span>Anggaran: <span style="font-weight: 700;">${window.formatRupiah(c.budget)}</span></span><span style="color: ${sisa < 0 ? '#c62828' : '#2e7d32'}; font-weight:700;">${labelSisa} ${nilaiSisaTampil}</span></div><div style="width: 100%; height: 6px; background: #f0f0f0; border-radius: 4px; overflow: hidden;"><div style="height: 100%; width: ${persenTerpakai}%; background: ${progressColor}; border-radius: 4px;"></div></div>`; 
            } else { 
                htmlContent += `<div style="font-size: 10px; color: #94a3b8;">Tanpa batas anggaran</div>`; 
            }
            htmlContent += `</div>`;
        }
    });
    if(!adaKategoriPengeluaran) { htmlContent += `<div style="font-size: 12px; color: #94a3b8; text-align: center; padding: 10px;">Belum ada pengeluaran</div>`; } 
    htmlContent += `</div>`;
    htmlContent += `<div class="section-title" style="display: flex; align-items: center; gap: 8px; color: #4338ca; margin-left: 0;"><span class="material-icons-round" style="font-size: 18px;">build</span> SERVIS MOTOR</div><div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px;"><div class="stat-card" style="padding: 15px; margin: 0;"><div style="font-size: 11px; color: #777; font-weight: 700; margin-bottom: 4px;">Total servis</div><div style="font-size: 16px; font-weight: 800; color: #1a1a1a; margin-bottom: 2px;">${window.formatRupiah(serviceExpenses)}</div><div style="font-size: 10px; color: #94a3b8; font-weight: 600;">Periode ini</div></div><div class="stat-card" style="padding: 15px; margin: 0;"><div style="font-size: 11px; color: #777; font-weight: 700; margin-bottom: 4px;">Jumlah</div><div style="font-size: 16px; font-weight: 800; color: #1a1a1a; margin-bottom: 2px;">${serviceCount}x</div><div style="font-size: 10px; color: #94a3b8; font-weight: 600;">Catatan servis</div></div></div>`;
    statContainer.innerHTML = htmlContent;
};
