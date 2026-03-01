document.addEventListener('DOMContentLoaded', () => {
    const toggle = document.getElementById('mouse-toggle');

    browser.storage.local.get('mouseModeEnabled').then((result) => {
        toggle.checked = result.mouseModeEnabled || false;
    }).catch(() => {
        toggle.checked = false;
    });

    toggle.addEventListener('change', () => {
        browser.storage.local.set({ mouseModeEnabled: toggle.checked });
    });
});
