/**
 * VimWalk Popup - Settings UI
 */

const focusModeToggle = document.getElementById('focusModeToggle');

// Load current state on popup open
browser.storage.local.get('focusMode').then((result) => {
    focusModeToggle.checked = result.focusMode || false;
});

// Handle toggle changes
focusModeToggle.addEventListener('change', async () => {
    const enabled = focusModeToggle.checked;

    // Save to storage
    await browser.storage.local.set({ focusMode: enabled });

    // Send message to active tab's content script
    try {
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        if (tabs[0]) {
            await browser.tabs.sendMessage(tabs[0].id, {
                type: 'FOCUS_MODE_TOGGLE',
                enabled: enabled
            });
        }
    } catch (err) {
        // Content script might not be loaded on this page
        console.log('Could not send message to content script:', err.message);
    }
});
