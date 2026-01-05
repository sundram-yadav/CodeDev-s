const kwInput = document.getElementById('keyword');
const setBtn = document.getElementById('set');
const clearBtn = document.getElementById('clear');
const startNotesBtn = document.getElementById('startNotes');
const startTimerBtn = document.getElementById('startTimer');
const statusEl = document.getElementById('status');

/* ---------- THEME DETECTION ---------- */
async function detectYouTubeTheme() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.id) return 'dark';
        if (!tab.url.includes('youtube.com')) return 'dark';
        const [result] = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
                const dark = document.documentElement.hasAttribute('dark') || document.querySelector('ytd-app[dark]');
                return dark ? 'dark' : 'light';
            }
        });
        return result?.result || 'dark';
    } catch {
        return 'dark';
    }
}

function applyTheme(theme) {
    document.body.classList.remove('dark', 'light');
    document.body.classList.add(theme);
}

/* ---------- INITIALIZE POPUP THEME ---------- */
(async () => {
    const theme = await detectYouTubeTheme();
    applyTheme(theme);
})();

/* ---------- STATUS MESSAGE ---------- */
function showStatus(msg, timeout = 2500) {
    statusEl.textContent = msg;
    if (timeout) setTimeout(() => (statusEl.textContent = ''), timeout);
}

/* ---------- FILTER SETUP ---------- */
chrome.storage.sync.get({ 'ft_filter_keyword': '' }, res => {
    kwInput.value = res['ft_filter_keyword'] || '';
});

/* ---------- SAFE MESSAGE SENDER ---------- */
async function sendToActiveTab(msg) {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.id) {
            showStatus('❌ No active tab found');
            return;
        }

        // ✅ Allow on any YouTube page
        if (!tab.url || !tab.url.includes('youtube.com')) {
            showStatus('❌ Please open YouTube first');
            return;
        }

        // try sending message, retry if fails (injection delay)
        const sendMessage = () =>
            new Promise((resolve, reject) => {
                chrome.tabs.sendMessage(tab.id, msg, res => {
                    if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
                    else resolve(res);
                });
            });

        try {
            await sendMessage();
        } catch {
            // If no listener — try injecting content.js again
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['content.js']
            });
            await sendMessage(); // retry
        }
    } catch (e) {
        console.error('Error communicating with tab:', e);
        showStatus('❌ Could not connect to YouTube tab');
    }
}

/* ---------- BUTTON LOGIC ---------- */
setBtn.onclick = async () => {
    const kw = kwInput.value.trim();
    await chrome.storage.sync.set({ 'ft_filter_keyword': kw });
    sendToActiveTab({ type: 'setFilter', keyword: kw });
    showStatus('✅ Keyword saved');
};

clearBtn.onclick = async () => {
    kwInput.value = '';
    await chrome.storage.sync.remove(['ft_filter_keyword']);
    sendToActiveTab({ type: 'setFilter', keyword: '' });
    showStatus('🧹 Filter cleared');
};

startNotesBtn.onclick = () => {
    sendToActiveTab({ type: 'startNotes' });
    showStatus('📝 Notes opened');
};

startTimerBtn.onclick = () => {
    sendToActiveTab({ type: 'startTimer' });
    showStatus('⏱ Timer started');
};
