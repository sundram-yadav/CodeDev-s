// FocusTube v1.17 — Notes List Upgrade
// ✅ Auto theme sync
// ✅ Adaptive text colors
// ✅ Smooth animations, reminders, timer, export, clear-all, draggable UI
// ✅ Shows all notes for current video with clickable timestamps

const FILTER_KEY = 'ft_filter_keyword';
let keyword = '';
let currentTheme = detectYouTubeTheme();

/* ---------- THEME DETECTION ---------- */
function detectYouTubeTheme() {
    const dark = document.documentElement.hasAttribute('dark') || document.querySelector('ytd-app[dark]');
    return dark ? 'dark' : 'light';
}

function applyThemeToElements() {
    if (!notesBox) return;
    const dark = currentTheme === 'dark';

    // Box base styles
    notesBox.style.background = dark ? '#181818' : '#ffffff';
    notesBox.style.color = dark ? '#fff' : '#000';
    notesBox.style.border = dark ? '1px solid #303030' : '1px solid #ccc';

    // Title + Meta
    const meta = notesBox.querySelector('#ftVideoMeta');
    if (meta) meta.style.color = dark ? '#bdbdbd' : '#333';

    // Textarea styling
    const text = notesBox.querySelector('#ftNoteText');
    if (text) {
        text.style.background = dark ? '#202020' : '#f7f7f7';
        text.style.color = dark ? '#fff' : '#000';
        text.style.border = 'none';
        text.style.caretColor = dark ? '#fff' : '#000';
    }

    // Placeholder color
    const styleId = 'ftDynamicPlaceholder';
    let styleTag = document.getElementById(styleId);
    if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = styleId;
        document.head.appendChild(styleTag);
    }
    styleTag.textContent = `
    #ftNoteText::placeholder {
      color: ${dark ? '#aaa' : '#555'};
    }`;

    // Buttons
    const buttons = notesBox.querySelectorAll('button');
    buttons.forEach(btn => {
        if (btn.id === 'ftAddNote') btn.style.background = '#ff0000';
        else if (btn.id === 'ftExportNotes') btn.style.background = dark ? '#303030' : '#ddd';
        else if (btn.id === 'ftClearAll') btn.style.background = dark ? '#b00020' : '#ff4444';
        btn.style.color = dark ? '#fff' : '#000';
    });
}

function applyThemeToPopup(pop) {
    const dark = currentTheme === 'dark';
    pop.style.background = dark ? '#202020' : '#f9f9f9';
    pop.style.color = dark ? '#fff' : '#000';
}

function applyThemeToTimer(timer) {
    const dark = currentTheme === 'dark';
    timer.style.background = dark ? '#ff0000' : '#d60000';
    timer.style.color = '#fff';
}

function observeThemeChange() {
    const observer = new MutationObserver(() => {
        const newTheme = detectYouTubeTheme();
        if (newTheme !== currentTheme) {
            currentTheme = newTheme;
            applyThemeToElements();
            const pop = document.querySelector('#ftNotePopup');
            if (pop) applyThemeToPopup(pop);
            const timer = document.querySelector('#ftTimerBox');
            if (timer) applyThemeToTimer(timer);
            renderNotesList(); // update list colors
        }
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['dark'] });
}

/* ---------- FILTER ---------- */
function loadKeyword() {
    chrome.storage.sync.get({ [FILTER_KEY]: '' }, res => {
        keyword = (res[FILTER_KEY] || '').toLowerCase();
        applyVideoBlur();
    });
}

function applyVideoBlur() {
    const selectors = [
        '#contents ytd-rich-item-renderer',
        '#items ytd-video-renderer',
        'ytd-grid-video-renderer',
        '#related ytd-compact-video-renderer',
        'ytd-compact-video-renderer'
    ];
    const items = selectors.flatMap(sel => Array.from(document.querySelectorAll(sel)));
    items.forEach(item => {
        const titleEl = item.querySelector('#video-title, a#video-title, h3');
        const title = titleEl ? titleEl.textContent.toLowerCase() : '';
        if (!keyword || title.includes(keyword)) {
            item.style.filter = '';
            item.style.opacity = '1';
            item.style.pointerEvents = '';
        } else {
            item.style.filter = 'blur(6px) grayscale(40%)';
            item.style.opacity = '0.6';
            item.style.pointerEvents = 'none';
        }
    });
}

/* ---------- NOTES BOX ---------- */
let notesBox = null;
function createNotesBox() {
    if (notesBox) return;
    notesBox = document.createElement('div');
    notesBox.id = 'ftNotesBox';
    notesBox.style.cssText = `
    position:fixed;right:20px;bottom:100px;width:340px;
    border-radius:12px;padding:12px;
    box-shadow:0 8px 24px rgba(0,0,0,0.6);
    z-index:2147483647;font-family:Roboto,Arial,sans-serif;
    transition:all 0.3s ease;`;
    notesBox.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
      <strong style="color:#ff0000;font-size:15px;">ConvexTube Notes</strong>
      <button id="ftCloseNotes" style="background:none;border:none;font-size:18px;cursor:pointer;">✖</button>
    </div>
    <div id="ftVideoMeta" style="font-size:12px;margin-bottom:6px;min-height:18px;opacity:1;transition:opacity 0.4s ease;"></div>
    <textarea id="ftNoteText" placeholder="Write note..." style="width:95%;height:80px;margin-top:6px;border:none;border-radius:8px;padding:8px;resize:none;font-size:13px;"></textarea>
    <div style="display:flex;gap:6px;margin-top:10px;">
      <button id="ftAddNote" style="flex:1;padding:8px;border-radius:6px;font-weight:500;cursor:pointer;">Add Note</button>
      <button id="ftExportNotes" style="width:110px;padding:8px;border-radius:6px;font-weight:500;cursor:pointer;">Export All</button>
    </div>
    <div id="ftNotesList" style="max-height:120px;overflow-y:auto;margin-top:8px;font-size:13px;"></div>
    <button id="ftClearAll" style="margin-top:8px;width:100%;padding:6px;border-radius:6px;cursor:pointer;">🗑 Clear All Notes</button>
    <div id="ftNoteStatus" style="font-size:12px;margin-top:6px;min-height:14px;"></div>`;
    document.body.appendChild(notesBox);

    updateVideoMetaDisplay();
    renderNotesList();
    applyThemeToElements();
    makeDraggable(notesBox);

    notesBox.querySelector('#ftCloseNotes').onclick = () => { notesBox.remove(); notesBox = null; };
    notesBox.querySelector('#ftAddNote').onclick = addNoteHandler;
    notesBox.querySelector('#ftExportNotes').onclick = exportNotes;
    notesBox.querySelector('#ftClearAll').onclick = clearAllNotes;
}

/* ---------- RENDER NOTES LIST ---------- */
function renderNotesList() {
    const listEl = notesBox?.querySelector('#ftNotesList');
    if (!listEl) return;
    const vid = getVideoId();
    if (!vid) { listEl.innerHTML = ''; return; }

    chrome.storage.local.get({ notesPerVideo: {} }, res => {
        const entry = res.notesPerVideo[vid];
        if (!entry || !entry.notes?.length) {
            listEl.innerHTML = '<em style="opacity:0.7;">No notes yet</em>';
            return;
        }

        const dark = currentTheme === 'dark';
        const color = dark ? '#66b3ff' : '#1e90ff'; // ✅ blue timestamp colors

        listEl.innerHTML = entry.notes.map(n => `
            <div style="margin-bottom:6px;">
                <span class="ftTimestamp" data-ts="${n.ts}"
                    style="color:${color};cursor:pointer;font-weight:500;">[${n.ts}]</span>
                <span style="margin-left:6px;">${n.text}</span>
            </div>
        `).join('');

        listEl.querySelectorAll('.ftTimestamp').forEach(el => {
            el.onclick = () => {
                const v = document.querySelector('video');
                if (v) v.currentTime = timestampToSeconds(el.dataset.ts);
            };
        });
    });
}


/* ---------- META DISPLAY ---------- */
function updateVideoMetaDisplay() {
    const metaEl = notesBox?.querySelector('#ftVideoMeta');
    if (!metaEl) return;
    const newText = `${getVideoTitle()} — ${location.href}`;
    if (metaEl.textContent.trim() === newText.trim()) return;
    metaEl.style.opacity = '0';
    setTimeout(() => { metaEl.textContent = newText; metaEl.style.opacity = '1'; renderNotesList(); }, 250);
}

/* ---------- ADD NOTE ---------- */
function addNoteHandler() {
    const ta = notesBox.querySelector('#ftNoteText');
    const text = ta.value.trim();
    if (!text) return showNoteStatus('Enter note first');
    const video = document.querySelector('video');
    const time = video ? Math.floor(video.currentTime) : 0;
    const ts = secondsToTimestamp(time);
    const vid = getVideoId();
    const meta = { title: getVideoTitle(), url: location.href };
    if (!vid) return showNoteStatus('No video ID');
    chrome.storage.local.get({ notesPerVideo: {} }, res => {
        const all = res.notesPerVideo;
        if (!all[vid]) all[vid] = { meta, notes: [] };
        all[vid].meta = meta;
        all[vid].notes.push({ ts, text });
        chrome.storage.local.set({ notesPerVideo: all }, () => {
            ta.value = '';
            showNoteStatus('💾 Saved!');
            renderNotesList(); // refresh list
        });
    });
}

/* ---------- EXPORT / CLEAR ---------- */
function exportNotes() {
    chrome.storage.local.get({ notesPerVideo: {} }, res => {
        const all = res.notesPerVideo;
        const videosWithNotes = Object.entries(all).filter(([_, e]) => e.notes && e.notes.length);
        if (!videosWithNotes.length) return showNoteStatus('No notes to export');
        let content = `ConvexTube Notes Export\nExported: ${new Date().toLocaleString()}\n====================================\n`;
        for (const [vid, entry] of videosWithNotes) {
            const meta = entry.meta || { title: 'Unknown Video', url: `https://www.youtube.com/watch?v=${vid}` };
            content += `\n========== Video ==========\nTitle: ${meta.title}\nURL: ${meta.url}\n---------------------------\n`;
            entry.notes.forEach(n => (content += `[${n.ts}] ${n.text}\n`));
        }
        const blob = new Blob([content.trim()], { type: 'text/plain' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'ConvexTube_Notes.txt';
        a.click();
        showNoteStatus('📤 Exported!');
    });
}

function clearAllNotes() {
    if (confirm('Delete all saved notes?')) {
        chrome.storage.local.clear(() => {
            showNoteStatus('🧹 All notes cleared');
            renderNotesList();
        });
    }
}

/* ---------- REMINDERS ---------- */
function startReminderLoop() {
    setInterval(() => {
        const v = document.querySelector('video');
        if (!v) return;
        const vid = getVideoId();
        if (!vid) return;
        const current = Math.floor(v.currentTime);
        chrome.storage.local.get({ notesPerVideo: {} }, res => {
            const entry = res.notesPerVideo && res.notesPerVideo[vid];
            if (!entry || !Array.isArray(entry.notes)) return;
            for (const n of entry.notes) {
                if (timestampToSeconds(n.ts) === current) showNotePopup(`[${n.ts}] ${n.text}`);
            }
        });
    }, 1000);
}

function showNotePopup(text) {
    if (document.querySelector('#ftNotePopup')) return;
    const pop = document.createElement('div');
    pop.id = 'ftNotePopup';
    pop.style.cssText = `
    position:fixed;bottom:80px;left:50%;transform:translateX(-50%);
    padding:14px 20px;border-radius:10px;
    box-shadow:0 8px 24px rgba(0,0,0,0.6);z-index:2147483647;
    font-family:Roboto,Arial;font-size:14px;max-width:500px;text-align:left;transition:all .3s ease;`;
    applyThemeToPopup(pop);
    pop.innerHTML = `<div style="margin-bottom:8px;">${text}</div>
                   <div style="text-align:right;">
                     <button id="ftOkBtn" style="background:#ff0000;border:none;color:#fff;padding:6px 14px;border-radius:6px;cursor:pointer;">OK</button>
                   </div>`;
    document.body.appendChild(pop);
    pop.querySelector('#ftOkBtn').onclick = () => pop.remove();
}

/* ---------- HELPERS ---------- */
function showNoteStatus(msg) {
    const el = notesBox?.querySelector('#ftNoteStatus');
    if (!el) return;
    el.textContent = msg;
    setTimeout(() => (el.textContent = ''), 2000);
}

function makeDraggable(el) {
    let drag = false, sx = 0, sy = 0, ox = 0, oy = 0;
    el.addEventListener('mousedown', e => {
        if (['TEXTAREA', 'BUTTON'].includes(e.target.tagName)) return;
        drag = true; sx = e.clientX; sy = e.clientY;
        const r = el.getBoundingClientRect(); ox = r.left; oy = r.top;
    });
    window.addEventListener('mouseup', () => drag = false);
    window.addEventListener('mousemove', e => {
        if (!drag) return;
        const dx = e.clientX - sx, dy = e.clientY - sy;
        el.style.left = ox + dx + 'px'; el.style.top = oy + dy + 'px';
        el.style.right = 'auto'; el.style.bottom = 'auto';
    });
}

function getVideoId() { return new URLSearchParams(location.search).get('v'); }
function getVideoTitle() {
    const el = document.querySelector('h1.title yt-formatted-string') || document.querySelector('meta[property="og:title"]');
    const val = el ? (el.textContent || el.getAttribute('content')) : document.title;
    return val ? val.replace(' - YouTube', '').trim() : '';
}
function secondsToTimestamp(sec) { const m = Math.floor(sec / 60).toString().padStart(2, '0'); const s = (sec % 60).toString().padStart(2, '0'); return `${m}:${s}`; }
function timestampToSeconds(ts) { if (!ts) return 0; const [m, s] = ts.split(':').map(Number); return (m || 0) * 60 + (s || 0); }

/* ---------- WATCH VIDEO CHANGES ---------- */
let _lastVid = null, _lastTitle = null;
function watchVideoChanges() {
    const curVid = getVideoId() || ''; const curTitle = getVideoTitle() || '';
    if (curVid !== _lastVid || curTitle !== _lastTitle) {
        _lastVid = curVid; _lastTitle = curTitle;
        if (notesBox) { updateVideoMetaDisplay(); renderNotesList(); }
    }
}
setInterval(watchVideoChanges, 300);
window.addEventListener('yt-navigate-finish', watchVideoChanges);
window.addEventListener('yt-page-data-updated', watchVideoChanges);
window.addEventListener('popstate', watchVideoChanges);

/* ---------- MESSAGE HANDLER ---------- */
chrome.runtime.onMessage.addListener((msg, s, r) => {
    if (msg.type === 'setFilter') { keyword = (msg.keyword || '').toLowerCase(); applyVideoBlur(); r({ status: 'ok' }); }
    else if (msg.type === 'startNotes') { createNotesBox(); r({ status: 'ok' }); }
    else if (msg.type === 'startTimer') { createTimer(); r({ status: 'ok' }); }
});

/* ---------- TIMER ---------- */
let timerBox = null, timerInterval = null, seconds = 0, running = false;
function createTimer() {
    if (timerBox) return;
    timerBox = document.createElement('div');
    timerBox.id = 'ftTimerBox';
    timerBox.style.cssText = `position:fixed;right:20px;bottom:20px;padding:8px 10px;
  border-radius:10px;cursor:move;z-index:2147483647;font-weight:600;transition:all 0.3s ease;`;
    timerBox.innerHTML = `<span id="ftTimerLabel">00:00</span>
  <button id="ftPauseBtn" style="margin-left:6px;background:none;border:none;color:#fff;">Pause</button>
  <button id="ftResetBtn" style="margin-left:4px;background:none;border:none;color:#fff;">Reset</button>`;
    document.body.appendChild(timerBox);
    makeDraggable(timerBox);
    applyThemeToTimer(timerBox);
    const label = timerBox.querySelector('#ftTimerLabel');
    const pause = timerBox.querySelector('#ftPauseBtn');
    const reset = timerBox.querySelector('#ftResetBtn');
    const upd = () => { const m = Math.floor(seconds / 60).toString().padStart(2, '0'); const s = (seconds % 60).toString().padStart(2, '0'); label.textContent = `${m}:${s}`; };
    timerInterval = setInterval(() => { if (running) { seconds++; upd(); } }, 1000);
    pause.onclick = () => { running = !running; pause.textContent = running ? 'Pause' : 'Resume'; };
    reset.onclick = () => { seconds = 0; upd(); };
    running = true;
}

/* ---------- INIT ---------- */
new MutationObserver(() => applyVideoBlur()).observe(document.documentElement, { childList: true, subtree: true });
loadKeyword();
startReminderLoop();
watchVideoChanges();
observeThemeChange();
