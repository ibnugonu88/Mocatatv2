// ============================================================
// MOCATAT - FITUR TRANSAKSI, 2 LOKASI DOUBLE GRABFOOD & AUTO-TIP (fitur-transaksi.js)
// Audit Fixed: Exact Chip Match, Auto-Rupiah Format on Tip Input & Anti-Duplicate Badges
// ============================================================

import { db, doc, writeBatch } from "./core.js";

// ==========================================
// 1. HELPER NORMALISASI & PENCOCOKAN ALAMAT ANTI-DOUBLE
// ==========================================
window.unescapeHTML = function(str) {
    if (!str) return '';
    return str.toString()
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"');
};

window.normalizeLocationKey = function(str) {
    if (!str) return '';
    return window.unescapeHTML(str).toLowerCase()
        .replace(/\b(jalan|jln|jl)\.?\s*/g, 'jl')
        .replace(/\b(gang|gg)\.?\s*/g, 'gg')
        .replace(/[^a-z0-9]/g, '');
};

window.formatCleanAddress = function(str) {
    if (!str) return '';
    let s = window.unescapeHTML(str).trim();
    s = s.replace(/\b(jalan|jln|jl)\.?\s*(?=[a-z0-9])/gi, 'Jl. ');
    s = s.replace(/\b(gang|gg)\.?\s*(?=[a-z0-9])/gi, 'Gg. ');
    s = s.replace(/\s+/g, ' ').replace(/(^|[\s.,/-])([a-z])/g, (m, sep, char) => sep + char.toUpperCase());
    return s;
};

window.getSavedLocationsCatalog = function() {
    const catalog = [];
    const seenKeys = new Set();

    (window.zones || []).forEach(z => {
        const zoneName = window.formatCleanAddress(z.name || '');
        if (Array.isArray(z.locations)) {
            z.locations.forEach(loc => {
                const cleanLoc = window.formatCleanAddress(loc || '');
                const key = window.normalizeLocationKey(cleanLoc);
                if (cleanLoc && key && !seenKeys.has(key)) {
                    seenKeys.add(key);
                    catalog.push({
                        name: cleanLoc,
                        zoneName: zoneName || 'Titik Lokasi',
                        isZone: false,
                        normKey: key
                    });
                }
            });
        }
        if (zoneName) {
            const zKey = window.normalizeLocationKey(zoneName);
            if (zKey && !seenKeys.has(zKey)) {
                seenKeys.add(zKey);
                catalog.push({
                    name: zoneName,
                    zoneName: 'Nama Daerah',
                    isZone: true,
                    normKey: zKey
                });
            }
        }
    });

    (window.transactions || []).forEach(t => {
        [t.location, t.location2].forEach(rawLoc => {
            if (rawLoc && rawLoc.trim() !== '') {
                const cleanLoc = window.formatCleanAddress(rawLoc);
                const key = window.normalizeLocationKey(cleanLoc);
                if (cleanLoc && key && !seenKeys.has(key)) {
                    seenKeys.add(key);
                    catalog.push({
                        name: cleanLoc,
                        zoneName: 'Tersimpan di Riwayat',
                        isZone: false,
                        normKey: key
                    });
                }
            }
        });
    });

    return catalog;
};

window.resolveCanonicalLocation = function(rawInput) {
    if (!rawInput || !rawInput.trim()) return '';
    const key = window.normalizeLocationKey(rawInput);
    const catalog = window.getSavedLocationsCatalog();
    const matched = catalog.find(item => item.normKey === key);
    if (matched) return matched.name;
    return window.formatCleanAddress(rawInput);
};

window.getZoneNameByLocation = function(rawLoc) {
    if (!rawLoc) return null;
    const targetKey = window.normalizeLocationKey(rawLoc);
    if (!targetKey) return null;

    const zones = window.zones || [];
    for (const z of zones) {
        if (window.normalizeLocationKey(z.name) === targetKey) return z.name;
        if (Array.isArray(z.locations)) {
            const found = z.locations.some(l => window.normalizeLocationKey(l) === targetKey);
            if (found) return z.name;
        }
    }
    return null;
};

// ==========================================
// 2. DROPDOWN SARAN LOKASI (1 & 2), DOUBLE GRABFOOD & QUICK TIP STYLES
// ==========================================
window.ensureCustomLocStyles = function() {
    if (document.getElementById('custom-loc-autocomplete-style')) return;
    const style = document.createElement('style');
    style.id = 'custom-loc-autocomplete-style';
    style.innerHTML = `
        .custom-loc-dropdown {
            background: #ffffff;
            border: 1.5px solid #249a95;
            border-radius: 14px;
            margin-top: 6px;
            max-height: 200px;
            overflow-y: auto;
            -webkit-overflow-scrolling: touch;
            box-shadow: 0 10px 25px rgba(15, 118, 110, 0.15);
            display: none;
            z-index: 99;
        }
        .custom-loc-dropdown.show {
            display: block;
        }
        .custom-loc-item {
            padding: 11px 14px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 10px;
            border-bottom: 1px solid #f1f5f9;
            cursor: pointer;
            transition: background 0.15s ease;
            user-select: none;
            -webkit-tap-highlight-color: transparent;
        }
        .custom-loc-item:last-child {
            border-bottom: none;
        }
        .custom-loc-item:active, .custom-loc-item:hover {
            background: #e0f2f1;
        }
        .custom-loc-name {
            font-size: 13px;
            font-weight: 800;
            color: #1a1a1a;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .custom-loc-zone {
            font-size: 10.5px;
            font-weight: 700;
            color: #0f766e;
            background: #f0fdf4;
            border: 1px solid #bbf7d0;
            padding: 2px 8px;
            border-radius: 8px;
            white-space: nowrap;
        }

        /* TOMBOL PILIHAN KHUSUS GRABFOOD (1 ORDER / 2 ORDER DOUBLE) */
        .order-count-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
            margin-top: 10px;
            padding-top: 10px;
            border-top: 1px dashed #cbd5e1;
        }
        .order-count-btn {
            background: #f8fafc;
            border: 1.5px solid #e2e8f0;
            border-radius: 12px;
            padding: 9px 10px;
            font-size: 12px;
            font-weight: 800;
            color: #475569;
            cursor: pointer;
            text-align: center;
            transition: all 0.15s ease;
            user-select: none;
        }
        .order-count-btn:active {
            transform: scale(0.96);
        }
        .order-count-btn.active {
            background: #dcfce7;
            border-color: #00B14F;
            color: #15803d;
        }

        /* TOMBOL + TIP DI KARTU TRANSAKSI */
        .btn-quick-tip {
            background: #f0fdf4;
            color: #15803d;
            border: 1px solid #86efac;
            padding: 3px 9px;
            border-radius: 8px;
            font-size: 10.5px;
            font-weight: 800;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 3px;
            font-family: inherit;
            transition: transform 0.12s ease, background 0.12s ease;
            white-space: nowrap;
        }
        .btn-quick-tip:active {
            transform: scale(0.93);
            background: #dcfce7;
        }
        .btn-quick-tip.has-tip {
            background: #fef9c3;
            color: #b45309;
            border-color: #fde047;
        }
        .tip-preset-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 8px;
            margin-bottom: 14px;
        }
        .tip-preset-btn {
            background: #f8fafc;
            border: 1.5px solid #e2e8f0;
            border-radius: 12px;
            padding: 10px 6px;
            font-size: 12.5px;
            font-weight: 800;
            color: #0f172a;
            cursor: pointer;
            font-family: inherit;
            transition: all 0.15s ease;
            text-align: center;
        }
        .tip-preset-btn:active, .tip-preset-btn.active {
            background: #e0f2f1;
            border-color: #249a95;
            color: #0f766e;
            transform: scale(0.97);
        }
    `;
    document.head.appendChild(style);
};

window.ensureOrderCountSelectorDOM = function() {
    window.ensureCustomLocStyles();
    const grabGroup = document.getElementById('grab-service-group');
    if (grabGroup && !document.getElementById('order-count-selector-wrap')) {
        const wrap = document.createElement('div');
        wrap.id = 'order-count-selector-wrap';
        wrap.style.display = 'none';
        wrap.innerHTML = `
            <div class="order-count-row">
                <div class="order-count-btn active" data-count="1" onclick="window.selectOrderCount(1)">🍔 1 Order (Single)</div>
                <div class="order-count-btn" data-count="2" onclick="window.selectOrderCount(2)">⚡ 2 Order (Double Food)</div>
            </div>
            <input type="hidden" id="input-order-count" value="1">
        `;
        grabGroup.appendChild(wrap);
    }

    const locGroup1 = document.getElementById('location-group');
    if (locGroup1 && !document.getElementById('location-group-2')) {
        const locGroup2 = document.createElement('div');
        locGroup2.className = 'form-group';
        locGroup2.id = 'location-group-2';
        locGroup2.style.display = 'none';
        locGroup2.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 7px;">
                <label class="form-label" style="margin-bottom: 0; color: #0f766e;">⚡ Area / Lokasi Jemput 2 (Order Kedua)</label>
            </div>
            <input type="text" id="input-location-2" class="form-input" placeholder="Ketik lokasi jemput kedua (opsional)..." autocomplete="off" autocorrect="off" spellcheck="false">
        `;
        locGroup1.insertAdjacentElement('afterend', locGroup2);
    }
};

window.selectOrderCount = function(count) {
    window.ensureOrderCountSelectorDOM();
    const validCount = Number(count) === 2 ? 2 : 1;
    const countInput = document.getElementById('input-order-count');
    if (countInput) countInput.value = validCount;
    document.querySelectorAll('#order-count-selector-wrap .order-count-btn').forEach(btn => {
        btn.classList.toggle('active', Number(btn.getAttribute('data-count')) === validCount);
    });

    const isInputIn = document.getElementById('input-type')?.value === 'in';
    const isGrabFood = document.getElementById('input-grab-service')?.value === 'GrabFood';
    const showSecondLoc = isInputIn && isGrabFood && validCount === 2;

    const locGroup1Label = document.querySelector('#location-group .form-label');
    if (locGroup1Label) {
        locGroup1Label.innerText = showSecondLoc
            ? '⚡ Area / Lokasi Jemput 1 (Order Pertama)'
            : 'Area / Lokasi Jemput (Opsional)';
    }

    const locGroup2 = document.getElementById('location-group-2');
    if (locGroup2) {
        locGroup2.style.display = showSecondLoc ? 'block' : 'none';
        if (!showSecondLoc) {
            const inp2 = document.getElementById('input-location-2');
            const dd2 = document.getElementById('custom-loc-dropdown-2');
            if (inp2) inp2.value = '';
            if (dd2) dd2.classList.remove('show');
        }
    }
};

window.bindLocationInputAutocomplete = function(inputId, groupId, dropdownId) {
    const locInput = document.getElementById(inputId);
    const locGroup = document.getElementById(groupId);
    if (!locInput || !locGroup) return;

    locInput.removeAttribute('list');
    locInput.setAttribute('autocomplete', 'off');
    locInput.setAttribute('autocorrect', 'off');
    locInput.setAttribute('spellcheck', 'false');

    let dropdown = document.getElementById(dropdownId);
    if (!dropdown) {
        dropdown = document.createElement('div');
        dropdown.id = dropdownId;
        dropdown.className = 'custom-loc-dropdown';
        locInput.insertAdjacentElement('afterend', dropdown);
    }

    if (!locInput.dataset.boundAutocomplete) {
        locInput.dataset.boundAutocomplete = 'true';

        locInput.addEventListener('input', function() {
            window.renderCustomLocationSuggestions(this.value, inputId, dropdownId);
        });

        locInput.addEventListener('focus', function() {
            if (this.value.trim() !== '') {
                window.renderCustomLocationSuggestions(this.value, inputId, dropdownId);
            }
        });
    }
};

window.setupCustomLocationAutocomplete = function() {
    window.ensureCustomLocStyles();
    window.ensureOrderCountSelectorDOM();

    const oldDatalist = document.getElementById('location-suggestions');
    if (oldDatalist) oldDatalist.remove();

    const oldSlideChips = document.getElementById('location-quick-chips');
    if (oldSlideChips) oldSlideChips.remove();

    window.bindLocationInputAutocomplete('input-location', 'location-group', 'custom-loc-dropdown');
    window.bindLocationInputAutocomplete('input-location-2', 'location-group-2', 'custom-loc-dropdown-2');

    if (!window.locOutsideClickBound) {
        window.locOutsideClickBound = true;
        document.addEventListener('click', function(e) {
            [
                { g: 'location-group', d: 'custom-loc-dropdown', i: 'input-location' },
                { g: 'location-group-2', d: 'custom-loc-dropdown-2', i: 'input-location-2' }
            ].forEach(cfg => {
                const lg = document.getElementById(cfg.g);
                const dd = document.getElementById(cfg.d);
                const inp = document.getElementById(cfg.i);
                if (!lg || !dd) return;
                if (!lg.contains(e.target)) {
                    if (dd.classList.contains('show')) {
                        dd.classList.remove('show');
                    }
                    if (inp && inp.value.trim() !== '') {
                        inp.value = window.resolveCanonicalLocation(inp.value);
                    }
                }
            });
        });
    }
};

window.renderCustomLocationSuggestions = function(rawQuery, inputId = 'input-location', dropdownId = 'custom-loc-dropdown') {
    const dropdown = document.getElementById(dropdownId);
    if (!dropdown) return;

    const cleanQuery = (rawQuery || '').trim();
    if (!cleanQuery) {
        dropdown.classList.remove('show');
        dropdown.innerHTML = '';
        return;
    }

    const queryNorm = window.normalizeLocationKey(cleanQuery);
    const queryLower = cleanQuery.toLowerCase();
    const catalog = window.getSavedLocationsCatalog();

    const matches = catalog.filter(item => {
        return (queryNorm && item.normKey.includes(queryNorm)) || item.name.toLowerCase().includes(queryLower);
    });

    if (matches.length === 0) {
        const previewClean = window.formatCleanAddress(cleanQuery);
        const safePreview = window.escapeHTML(previewClean);
        const jsSafePreview = safePreview.replace(/'/g, "\\'");
        dropdown.innerHTML = `
            <div class="custom-loc-item" onclick="window.pilihSaranLokasiKustom('${jsSafePreview}', '${inputId}', '${dropdownId}')">
                <div class="custom-loc-name">
                    <span class="material-icons-round" style="font-size:16px; color:#64748b;">add_location_alt</span>
                    <span>Gunakan: <strong>${safePreview}</strong></span>
                </div>
                <span class="custom-loc-zone" style="background:#f1f5f9; color:#475569; border-color:#e2e8f0;">Alamat Baru</span>
            </div>
        `;
        dropdown.classList.add('show');
        return;
    }

    dropdown.innerHTML = matches.slice(0, 6).map(item => {
        const safeName = window.escapeHTML(item.name);
        const jsSafeName = safeName.replace(/'/g, "\\'");
        const safeZone = window.escapeHTML(item.zoneName || 'Tersimpan');
        const icon = item.isZone ? 'map' : 'place';
        return `
            <div class="custom-loc-item" onclick="window.pilihSaranLokasiKustom('${jsSafeName}', '${inputId}', '${dropdownId}')">
                <div class="custom-loc-name">
                    <span class="material-icons-round" style="font-size:16px; color:#249a95;">${icon}</span>
                    <span>${safeName}</span>
                </div>
                <span class="custom-loc-zone">${safeZone}</span>
            </div>
        `;
    }).join('');
    dropdown.classList.add('show');
};

window.pilihSaranLokasiKustom = function(namaLokasi, inputId = 'input-location', dropdownId = 'custom-loc-dropdown') {
    const locInput = document.getElementById(inputId);
    const dropdown = document.getElementById(dropdownId);
    if (locInput) locInput.value = window.unescapeHTML(namaLokasi);
    if (dropdown) dropdown.classList.remove('show');
};

// ==========================================
// 3. FITUR MODAL INPUT "UANG YANG DITERIMA" (OTOMATIS HITUNG TIP)
// ==========================================
window.generateSmartReceivedPresets = function(baseAmount) {
    const base = Number(baseAmount || 0);
    const candidates = new Set();

    const nextThousand = Math.ceil((base + 100) / 1000) * 1000;
    if (nextThousand > base) candidates.add(nextThousand);

    const nextFiveThousand = Math.ceil((base + 500) / 5000) * 5000;
    if (nextFiveThousand > base) candidates.add(nextFiveThousand);

    const stepOffsets = [2000, 4000, 5000, 7000, 10000, 12000, 15000, 20000, 30000, 40000, 50000];
    stepOffsets.forEach(offset => {
        const rounded = Math.ceil((base + offset) / 1000) * 1000;
        if (rounded > base) candidates.add(rounded);
    });

    [10000, 12000, 15000, 20000, 25000, 30000, 35000, 40000, 50000, 75000, 100000].forEach(note => {
        if (note > base) candidates.add(note);
    });

    return Array.from(candidates).sort((a, b) => a - b).slice(0, 6);
};

window.ensureQuickTipModalDOM = function() {
    window.ensureCustomLocStyles();
    if (document.getElementById('modal-quick-tip')) return;

    const modalEl = document.createElement('div');
    modalEl.id = 'modal-quick-tip';
    modalEl.className = 'modal-overlay';
    modalEl.innerHTML = `
        <div class="modal-box">
            <div class="modal-handle"></div>
            <div class="modal-header">
                <h3 id="quick-tip-title">Uang Diterima & Tip 🎁</h3>
                <button class="btn-close" onclick="window.closeModal('modal-quick-tip')"><span class="material-icons-round">close</span></button>
            </div>
            <div id="quick-tip-error" class="error-msg"></div>
            <input type="hidden" id="quick-tip-trx-id">
            <input type="hidden" id="quick-tip-base-amount">

            <div id="quick-tip-order-info" style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 14px; padding: 11px 14px; margin-bottom: 14px; font-size: 12px; color: #475569; font-weight: 600; display: flex; justify-content: space-between; align-items: center;">
            </div>

            <label class="form-label">Pilih Cepat Total Uang Diterima</label>
            <div class="tip-preset-grid" id="tip-preset-container"></div>

            <div class="form-group" style="margin-bottom: 12px;">
                <label class="form-label">Atau Ketik Total Uang yang Diterima (Rp)</label>
                <input type="text" inputmode="numeric" pattern="[0-9]*" id="quick-tip-input" class="form-input format-rupiah" style="font-size: 22px !important; font-weight: 800 !important; color: #0f766e !important; background: #f0fdfa !important; border: 2px solid #99f6e4 !important;" placeholder="Contoh: 10.000" oninput="window.onQuickTipManualInput(this)">
            </div>

            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 11px 14px; margin-bottom: 14px; display: flex; flex-direction: column; gap: 5px; font-size: 12px; font-weight: 700; color: #166534;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span>Otomatis Dihitung Tip:</span>
                    <strong id="quick-tip-diff-preview" style="font-size: 14.5px; font-weight: 800; color: #d97706;">+Rp 0</strong>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 5px; border-top: 1px dashed #86efac;">
                    <span>Total Masuk ke Dompet:</span>
                    <strong id="quick-tip-total-preview" style="font-size: 15px; font-weight: 800; color: #15803d;">Rp 0</strong>
                </div>
            </div>

            <div style="display: flex; gap: 10px;">
                <button type="button" id="btn-hapus-tip" onclick="window.simpanQuickTip(true)" style="display: none; flex: 0.48; background: #fee2e2; color: #dc2626; border: none; padding: 15px; border-radius: 16px; font-size: 13px; font-weight: 800; cursor: pointer; margin-top: 10px; font-family: inherit;">Reset Tarif Awal</button>
                <button type="button" id="btn-simpan-tip" class="btn-submit" style="flex: 1;" onclick="window.simpanQuickTip(false)">Simpan</button>
            </div>
        </div>
    `;
    document.body.appendChild(modalEl);
};

// Format otomatis titik ribuan saat diketik manual di modal Quick Tip
window.onQuickTipManualInput = function(inputEl) {
    if (inputEl) {
        const rawDigits = inputEl.value.replace(/[^0-9]/g, '');
        inputEl.value = rawDigits ? window.formatNumberWithDot(rawDigits) : '';
    }
    document.querySelectorAll('#tip-preset-container .tip-preset-btn').forEach(btn => btn.classList.remove('active'));
    window.updateQuickTipPreview();
};

window.openQuickTipModal = function(trxId) {
    window.ensureQuickTipModalDOM();
    const trx = (window.transactions || []).find(t => String(t.id) === String(trxId));
    if (!trx) return;

    const errEl = document.getElementById('quick-tip-error');
    if (errEl) errEl.style.display = 'none';

    const currentTip = Number(trx.tipAmount || 0);
    const baseAmount = trx.baseAmount !== undefined
        ? Number(trx.baseAmount)
        : Math.max(0, Number(trx.amount || 0) - currentTip);
    const currentTotal = Number(trx.amount || baseAmount);

    document.getElementById('quick-tip-trx-id').value = trx.id;
    document.getElementById('quick-tip-base-amount').value = baseAmount;

    const cleanNote = window.escapeHTML(window.unescapeHTML(trx.note || 'Order'));
    const loc1Text = trx.location ? window.resolveCanonicalLocation(trx.location) : '';
    const loc2Text = trx.location2 ? window.resolveCanonicalLocation(trx.location2) : '';
    const combinedLoc = [loc1Text, loc2Text].filter(Boolean).join(' & ');
    const locDisplay = combinedLoc ? ` • ${window.escapeHTML(combinedLoc)}` : '';

    document.getElementById('quick-tip-order-info').innerHTML = `
        <div style="min-width:0; flex:1;">
            <div style="font-weight:800; color:#0f172a; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${cleanNote}${locDisplay}</div>
            <div style="font-size:11px; color:#64748b; margin-top:2px;">Dompet: ${window.escapeHTML(trx.walletName || 'Utama')}</div>
        </div>
        <div style="text-align:right; flex-shrink:0; margin-left:10px;">
            <div style="font-size:10px; color:#64748b; font-weight:700;">TARIF AWAL</div>
            <div style="font-size:13.5px; font-weight:800; color:#0f172a;">${window.formatRupiah(baseAmount)}</div>
        </div>
    `;

    const presets = window.generateSmartReceivedPresets(baseAmount);
    const presetContainer = document.getElementById('tip-preset-container');
    if (presetContainer) {
        presetContainer.innerHTML = presets.map(nominal => {
            const isActive = currentTip > 0 && currentTotal === nominal ? 'active' : '';
            return `<button type="button" class="tip-preset-btn ${isActive}" onclick="window.pilihPresetTip(${nominal}, this)">${window.formatRupiah(nominal)}</button>`;
        }).join('');
    }

    const tipInput = document.getElementById('quick-tip-input');
    tipInput.value = currentTip > 0 ? window.formatNumberWithDot(currentTotal.toString()) : '';

    const btnHapusTip = document.getElementById('btn-hapus-tip');
    if (btnHapusTip) btnHapusTip.style.display = currentTip > 0 ? 'block' : 'none';

    window.updateQuickTipPreview();
    document.getElementById('modal-quick-tip').classList.add('show');
};

window.pilihPresetTip = function(nominalDiterima, btnEl) {
    document.querySelectorAll('#tip-preset-container .tip-preset-btn').forEach(btn => btn.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');
    const tipInput = document.getElementById('quick-tip-input');
    if (tipInput) {
        tipInput.value = window.formatNumberWithDot(nominalDiterima.toString());
        window.updateQuickTipPreview();
    }
};

window.updateQuickTipPreview = function() {
    const errEl = document.getElementById('quick-tip-error');
    if (errEl) errEl.style.display = 'none';

    const baseAmount = Number(document.getElementById('quick-tip-base-amount')?.value || 0);
    const receivedVal = window.parseRupiah(document.getElementById('quick-tip-input')?.value || '0');

    const diffPreviewEl = document.getElementById('quick-tip-diff-preview');
    const totalPreviewEl = document.getElementById('quick-tip-total-preview');

    if (receivedVal > baseAmount) {
        const tipDiff = receivedVal - baseAmount;
        if (diffPreviewEl) {
            diffPreviewEl.innerText = `+${window.formatRupiah(tipDiff)}`;
            diffPreviewEl.style.color = '#d97706';
        }
        if (totalPreviewEl) totalPreviewEl.innerText = window.formatRupiah(receivedVal);
    } else {
        if (diffPreviewEl) {
            diffPreviewEl.innerText = '+Rp 0';
            diffPreviewEl.style.color = '#64748b';
        }
        if (totalPreviewEl) totalPreviewEl.innerText = window.formatRupiah(baseAmount);
    }
};

window.simpanQuickTip = async function(isReset = false) {
    const submitBtn = document.getElementById('btn-simpan-tip');
    if (submitBtn && submitBtn.disabled) return;

    const errEl = document.getElementById('quick-tip-error');
    const trxId = document.getElementById('quick-tip-trx-id').value;
    const baseAmount = Number(document.getElementById('quick-tip-base-amount').value || 0);
    const receivedVal = window.parseRupiah(document.getElementById('quick-tip-input').value || '0');

    if (!isReset && receivedVal <= baseAmount) {
        if (errEl) {
            errEl.innerText = `Total uang yang diterima harus lebih besar dari tarif awal (${window.formatRupiah(baseAmount)}).`;
            errEl.style.display = 'block';
        }
        return;
    }

    const idx = (window.transactions || []).findIndex(t => String(t.id) === String(trxId));
    if (idx === -1) return;

    const tipAmount = isReset ? 0 : (receivedVal - baseAmount);
    const finalTotalAmount = isReset ? baseAmount : receivedVal;

    if (submitBtn) { submitBtn.disabled = true; submitBtn.innerText = "Menyimpan..."; }

    const originalTrx = JSON.parse(JSON.stringify(window.transactions[idx]));
    window.transactions[idx].baseAmount = baseAmount;
    window.transactions[idx].tipAmount = tipAmount;
    window.transactions[idx].amount = finalTotalAmount;

    window.recalculateBalances();

    try {
        if (window.currentUserId) {
            const batch = writeBatch(db);
            const trxRef = doc(db, "users", window.currentUserId, "transactions", String(trxId));
            batch.set(trxRef, JSON.parse(JSON.stringify(window.transactions[idx])));
            const userRef = doc(db, "users", window.currentUserId);
            batch.set(userRef, window.getUserDocPayload(), { merge: true });
            await batch.commit();
        }
        window.closeModal('modal-quick-tip');
        window.callPageRender();
    } catch (e) {
        window.transactions[idx] = originalTrx;
        window.recalculateBalances();
        window.customAlert("Error", "Gagal menyimpan ke server.", "error");
    } finally {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.innerText = "Simpan"; }
    }
};

// ==========================================
// 4. PILIHAN CHIP & MODAL INPUT TRANSAKSI UTAMA
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

    // Jika user memilih kategori "Tip Pelanggan" dan kolom Keterangan masih kosong, isi otomatis
    const selectedCat = (window.categories || []).find(c => String(c.id) === String(id));
    const noteInput = document.getElementById('input-note');
    if (selectedCat && noteInput && noteInput.value.trim() === '') {
        if (selectedCat.name.toLowerCase().includes('tip')) {
            noteInput.value = window.unescapeHTML(selectedCat.name);
        }
    }
};

window.selectTrxTargetWallet = function(id, el) { 
    document.getElementById('input-target-wallet').value = id; 
    document.querySelectorAll('#input-target-wallet-chips .chip').forEach(c => c.classList.remove('active')); 
    el.classList.add('active'); 
};

window.selectGrabService = function(service, el) {
    window.ensureOrderCountSelectorDOM();
    const hiddenInput = document.getElementById('input-grab-service'); 
    const noteInput = document.getElementById('input-note');
    const orderCountWrap = document.getElementById('order-count-selector-wrap');

    if (hiddenInput.value === service) { 
        hiddenInput.value = ''; 
        el.classList.remove('grab-active'); 
        if (noteInput.value === service) noteInput.value = ''; 
        if (orderCountWrap) orderCountWrap.style.display = 'none';
        window.selectOrderCount(1);
    } else { 
        document.querySelectorAll('.grab-chip').forEach(c => c.classList.remove('grab-active')); 
        el.classList.add('grab-active'); 
        hiddenInput.value = service; 
        if (noteInput.value === '' || ['GrabBike', 'GrabBike Hemat', 'GrabCar', 'GrabFood', 'GrabExpress', 'GrabMart'].includes(noteInput.value)) { 
            noteInput.value = service; 
        }
        if (service === 'GrabFood') {
            if (orderCountWrap) orderCountWrap.style.display = 'block';
            const currentCount = Number(document.getElementById('input-order-count')?.value || 1);
            window.selectOrderCount(currentCount);
        } else {
            if (orderCountWrap) orderCountWrap.style.display = 'none';
            window.selectOrderCount(1);
        }
    }
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
    if (grabGroup) grabGroup.style.display = (type === 'in') ? 'block' : 'none';
    
    const locationGroup = document.getElementById('location-group');
    if (locationGroup) locationGroup.style.display = (type === 'in') ? 'block' : 'none';
    
    if(document.getElementById('input-grab-service')) document.getElementById('input-grab-service').value = '';
    document.querySelectorAll('.grab-chip').forEach(c => c.classList.remove('grab-active'));

    window.setupCustomLocationAutocomplete();
    const orderCountWrap = document.getElementById('order-count-selector-wrap');
    if (orderCountWrap) orderCountWrap.style.display = 'none';
    window.selectOrderCount(1);

    const dropdown1 = document.getElementById('custom-loc-dropdown');
    const dropdown2 = document.getElementById('custom-loc-dropdown-2');
    if (dropdown1) dropdown1.classList.remove('show');
    if (dropdown2) dropdown2.classList.remove('show');

    let now = new Date(); 
    let defaultTime = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    
    const dompetAktif = window.wallets.filter(w => !w.isArchived);

    let defaultWalletId = dompetAktif.length > 0 ? dompetAktif[0].id : '', 
        targetWalletId = dompetAktif.length > 1 ? dompetAktif[1].id : defaultWalletId, 
        validCats = window.categories.filter(c => c.type === type && c.type !== 'sys'), 
        defaultCatId = validCats.length > 0 ? validCats[0].id : '', 
        amount = '', note = '', trxDate = window.getLocalDateString(), trxTime = defaultTime, grabServiceVal = '', locationVal = '', location2Val = '', orderCountVal = 1;
        
    if (trxId) { 
        const trx = window.transactions.find(t => String(t.id) === String(trxId)); 
        if (trx) { 
            amount = window.formatNumberWithDot(trx.amount.toString()); 
            note = window.unescapeHTML(trx.note); 
            defaultWalletId = trx.walletId; 
            if(trx.type === 'transfer') targetWalletId = trx.targetWalletId; 
            else defaultCatId = trx.categoryId; 
            trxDate = trx.date || trxDate; 
            if (trx.time) trxTime = trx.time;
            if(trx.grabService) grabServiceVal = trx.grabService; 
            if(trx.location) locationVal = window.resolveCanonicalLocation(trx.location);
            if(trx.location2) location2Val = window.resolveCanonicalLocation(trx.location2);
            if(trx.grabService === 'GrabFood' && Number(trx.orderCount) === 2) orderCountVal = 2;
        } 
    }
    
    document.getElementById('input-amount').value = amount; 
    document.getElementById('input-note').value = note; 
    document.getElementById('input-date').value = trxDate; 
    if(document.getElementById('input-time')) document.getElementById('input-time').value = trxTime; 
    document.getElementById('input-wallet').value = defaultWalletId; 
    if(document.getElementById('input-location')) document.getElementById('input-location').value = locationVal;
    if(document.getElementById('input-location-2')) document.getElementById('input-location-2').value = location2Val;
    if(!isTransfer) document.getElementById('input-category').value = defaultCatId; 
    if(isTransfer) document.getElementById('input-target-wallet').value = targetWalletId;
    
    // Perbaikan Bug: Pencocokan eksak nama layanan Grab (agar GrabBike tidak menyalakan GrabBike Hemat)
    if (grabServiceVal && document.getElementById('input-grab-service')) {
        document.getElementById('input-grab-service').value = grabServiceVal;
        document.querySelectorAll('.grab-chip').forEach(c => { 
            const onclickAttr = c.getAttribute('onclick') || '';
            if (onclickAttr.includes(`'${grabServiceVal}'`)) {
                c.classList.add('grab-active'); 
            }
        });
        if (grabServiceVal === 'GrabFood') {
            if (orderCountWrap) orderCountWrap.style.display = 'block';
            window.selectOrderCount(orderCountVal);
            if (orderCountVal === 2 && document.getElementById('input-location-2')) {
                document.getElementById('input-location-2').value = location2Val;
            }
        }
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

// ==========================================
// 5. SIMPAN & HAPUS TRANSAKSI (FIRESTORE BATCH)
// ==========================================
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
    const rawOrderCount = document.getElementById('input-order-count') ? parseInt(document.getElementById('input-order-count').value, 10) : 1;
    const orderCount = (type === 'in' && grabService === 'GrabFood' && rawOrderCount === 2) ? 2 : 1;

    const rawLocationInput = document.getElementById('input-location') ? document.getElementById('input-location').value.trim() : '';
    const canonicalLocation = (type === 'in' && rawLocationInput) ? window.resolveCanonicalLocation(rawLocationInput) : '';
    const locationVal = canonicalLocation ? canonicalLocation : null;

    const rawLocationInput2 = document.getElementById('input-location-2') ? document.getElementById('input-location-2').value.trim() : '';
    const canonicalLocation2 = (type === 'in' && orderCount === 2 && rawLocationInput2) ? window.resolveCanonicalLocation(rawLocationInput2) : '';
    const location2Val = canonicalLocation2 ? canonicalLocation2 : null;

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
    let existingTipAmount = 0;
    let oldTotalAmount = 0;
    if (trxId) {
        const trxLama = window.transactions.find(t => String(t.id) === String(trxId));
        if (trxLama) {
            existingTipAmount = Number(trxLama.tipAmount || 0);
            oldTotalAmount = Number(trxLama.amount || 0);
            if (String(trxLama.walletId) === String(walletId) && (trxLama.type === 'out' || trxLama.type === 'transfer')) {
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

    // Jika nominal utama diubah manual lewat Edit Transaksi, sesuaikan baseAmount dengan aman
    const finalTip = (type === 'in' && trxId && amount === oldTotalAmount && amount > existingTipAmount) ? existingTipAmount : 0;
    const finalBase = type === 'in' ? (amount - finalTip) : amount;
    
    const newTrxData = { 
        id: parsedTrxId, type, amount, note, walletId, 
        walletName: sourceWallet.name, categoryId: catId, 
        categoryName: targetCat ? targetCat.name : (isTransfer ? 'Transfer' : '-'), 
        targetWalletId: targetWalletId, targetWalletName: targetWallet ? targetWallet.name : null, 
        date: trxDate, time: trxTime, 
        grabService: type === 'in' && grabService ? grabService : null, 
        orderCount: orderCount,
        location: locationVal,
        location2: location2Val,
        baseAmount: finalBase,
        tipAmount: finalTip
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
                    else relatedTarget.nilaiTerkini = relatedTarget.currentAmount;
                    if(relatedTarget.currentAmount < 0) relatedTarget.currentAmount = 0; 
                    if(relatedTarget.nilaiTerkini < 0) relatedTarget.nilaiTerkini = 0; 
                } else if (trx.type === 'in') { 
                    let modalKembali = trx.modalDeducted !== undefined ? Number(trx.modalDeducted||0) : Number(trx.amount||0); 
                    relatedTarget.currentAmount += modalKembali; 
                    if(relatedTarget.tipe === 'investasi') { relatedTarget.nilaiTerkini += Number(trx.amount||0); } 
                    else { relatedTarget.nilaiTerkini = relatedTarget.currentAmount; }
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
// 6. RENDER BARIS ITEM TRANSAKSI & HALAMAN RIWAYAT
// ==========================================
window.formatSingleLocBadgeHTML = function(rawLoc, suffix = '') {
    if (!rawLoc || !rawLoc.trim()) return '';
    const canonicalLoc = window.resolveCanonicalLocation(rawLoc);
    const mappedZone = window.getZoneNameByLocation(canonicalLoc);
    const labelLoc = (mappedZone && window.normalizeLocationKey(mappedZone) !== window.normalizeLocationKey(canonicalLoc))
        ? `${window.escapeHTML(mappedZone)} (${window.escapeHTML(canonicalLoc)})`
        : window.escapeHTML(canonicalLoc);
    return `<span style="font-size: 10px; background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; padding: 2px 7px; border-radius: 5px; font-weight: 700; display:inline-block; white-space:nowrap;"><span class="material-icons-round" style="font-size: 10px; vertical-align: middle; color:#1d4ed8;">place</span> ${labelLoc}${suffix}</span>`;
};

window.generateTrxHTML = function(trx, showActions = false) {
    window.ensureCustomLocStyles();
    const isIncome = trx.type === 'in', isTransfer = trx.type === 'transfer';
    const amountClass = isIncome ? 'amount-in' : (isTransfer ? 'amount-transfer' : 'amount-out'); 
    const sign = isIncome ? '+' : (isTransfer ? '' : '-');
    const cleanNoteRaw = window.unescapeHTML(trx.note || '');
    const safeNote = window.escapeHTML(cleanNoteRaw); 
    const timeDisplay = trx.time ? ` • ${trx.time}` : '';

    const tipAmt = Number(trx.tipAmount || 0);
    const baseAmt = trx.baseAmount !== undefined ? Number(trx.baseAmount) : Math.max(0, Number(trx.amount || 0) - tipAmt);
    const infoRincianTip = (isIncome && tipAmt > 0)
        ? ` • <span style="color:#0f766e; font-weight:700;">Tarif ${window.formatRupiah(baseAmt)} + Tip ${window.formatRupiah(tipAmt)}</span>`
        : '';

    const desc = isTransfer
        ? `${window.escapeHTML(trx.walletName)} ➔ ${window.escapeHTML(trx.targetWalletName)}${timeDisplay}`
        : `${window.escapeHTML(trx.walletName)} • ${window.escapeHTML(trx.categoryName || 'Transfer')}${timeDisplay}${infoRincianTip}`;

    const isDoubleFood = trx.grabService === 'GrabFood' && Number(trx.orderCount) === 2;
    const doubleFoodText = isDoubleFood ? ' • ⚡ Double (2 Order)' : '';

    let grabBadge = '';
    if (trx.grabService) {
        const isSameAsTitle = cleanNoteRaw.trim().toLowerCase() === trx.grabService.trim().toLowerCase();
        const badgeText = (isSameAsTitle ? '✓ Order Grab' : window.escapeHTML(trx.grabService)) + doubleFoodText;
        grabBadge = `<span style="font-size: 10px; background: #00B14F; color: white; padding: 2px 7px; border-radius: 5px; font-weight: 800; display:inline-block; white-space:nowrap;">${badgeText}</span>`;
    }
    
    // Anti-Duplicate Badge jika Lokasi 1 & Lokasi 2 sama persis pada Double Order
    let locBadge1 = '';
    let locBadge2 = '';
    if (isDoubleFood && trx.location && trx.location2 && window.normalizeLocationKey(trx.location) === window.normalizeLocationKey(trx.location2)) {
        locBadge1 = window.formatSingleLocBadgeHTML(trx.location, ' (2x)');
    } else {
        locBadge1 = window.formatSingleLocBadgeHTML(trx.location);
        locBadge2 = isDoubleFood ? window.formatSingleLocBadgeHTML(trx.location2) : '';
    }

    const badgesRowHTML = (grabBadge || locBadge1 || locBadge2)
        ? `<div style="display:flex; align-items:center; flex-wrap:wrap; gap:5px; margin-top:2px;">${grabBadge}${locBadge1}${locBadge2}</div>`
        : '';

    let quickTipBtnHTML = '';
    const isStandaloneTipCat = (trx.categoryName || '').toLowerCase().includes('tip');
    if (isIncome && String(trx.categoryId) !== '999' && !isStandaloneTipCat) {
        if (tipAmt > 0) {
            quickTipBtnHTML = `<button class="btn-quick-tip has-tip" onclick="window.openQuickTipModal('${trx.id}')" title="Ubah Uang Diterima">🎁 Tip +${window.formatRupiah(tipAmt)}</button>`;
        } else {
            quickTipBtnHTML = `<button class="btn-quick-tip" onclick="window.openQuickTipModal('${trx.id}')" title="Masukkan Total Uang Diterima">+ Tip</button>`;
        }
    }

    let actionHTML = (showActions && String(trx.categoryId) !== '999' && !isTransfer) 
        ? `<div class="list-actions" style="margin-left: 12px;"><button class="btn-icon" style="padding:5px;" onclick="window.openModalTrans('${trx.type}', '${trx.id}')"><span class="material-icons-round" style="font-size:18px;">edit</span></button><button class="btn-icon delete" style="padding:5px;" onclick="window.hapusTransaksi('${trx.id}')"><span class="material-icons-round" style="font-size:18px;">delete</span></button></div>` 
        : (showActions && isTransfer 
            ? `<div class="list-actions" style="margin-left: 12px;"><button class="btn-icon delete" style="padding:5px;" onclick="window.hapusTransaksi('${trx.id}')"><span class="material-icons-round" style="font-size:18px;">delete</span></button></div>` 
            : (showActions && String(trx.categoryId) === '999' 
                ? `<div class="list-actions" style="margin-left: 12px;"><button class="btn-icon delete" style="padding:5px;" onclick="window.hapusTransaksi('${trx.id}')" title="Batalkan Setoran"><span class="material-icons-round" style="font-size:18px;">delete</span></button></div>` 
                : ''));

    return `
    <div class="trx-item">
        <div class="trx-content">
            <div class="trx-info">
                <span class="trx-title">${safeNote}</span>
                ${badgesRowHTML}
                <span class="trx-date">${desc}</span>
            </div>
            <div style="display:flex; flex-direction:column; align-items:flex-end; gap:5px; flex-shrink:0;">
                <div class="trx-amount ${amountClass}">${sign}${window.formatRupiah(trx.amount)}</div>
                ${quickTipBtnHTML}
            </div>
        </div>
        ${actionHTML}
    </div>`;
};

window.renderHistoryPage = function() {
    const container = document.getElementById('all-transaction-container'); 
    if(!container) return;
    const filterPeriod = document.getElementById('filter-period').value; 
    const filterType = document.getElementById('filter-type').value;
    const searchKeyword = document.getElementById('filter-search') ? document.getElementById('filter-search').value.trim().toLowerCase() : '';
    
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

    if (searchKeyword !== '') {
        const normKeySearch = window.normalizeLocationKey(searchKeyword);
        filtered = filtered.filter(t => {
            const noteStr = (t.note || '').toLowerCase();
            const catStr = (t.categoryName || '').toLowerCase();
            const walStr = (t.walletName || '').toLowerCase();
            const tgtWalStr = (t.targetWalletName || '').toLowerCase();
            const grabStr = (t.grabService || '').toLowerCase();
            const locStr = (t.location || '').toLowerCase();
            const loc2Str = (t.location2 || '').toLowerCase();
            const normLocStr = window.normalizeLocationKey(t.location || '');
            const normLoc2Str = window.normalizeLocationKey(t.location2 || '');
            const zoneStr = (t.location && window.getZoneNameByLocation(t.location) ? window.getZoneNameByLocation(t.location) : '').toLowerCase();
            const zone2Str = (t.location2 && window.getZoneNameByLocation(t.location2) ? window.getZoneNameByLocation(t.location2) : '').toLowerCase();
            return noteStr.includes(searchKeyword) ||
                   catStr.includes(searchKeyword) ||
                   walStr.includes(searchKeyword) ||
                   tgtWalStr.includes(searchKeyword) ||
                   grabStr.includes(searchKeyword) ||
                   locStr.includes(searchKeyword) ||
                   loc2Str.includes(searchKeyword) ||
                   (normKeySearch && (normLocStr.includes(normKeySearch) || normLoc2Str.includes(normKeySearch))) ||
                   zoneStr.includes(searchKeyword) ||
                   zone2Str.includes(searchKeyword);
        });
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
