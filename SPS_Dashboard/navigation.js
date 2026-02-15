// ============================================
// NAVIGATION HANDLER FOR IFRAME
// ============================================
function initializeNavigation() {
    const sidebarLinks = document.querySelectorAll('.sidebar-link');
    const contentFrame = document.getElementById('content-frame');
    const pageTitle = document.getElementById('page-title');
    const pageSubtitle = document.getElementById('page-subtitle');
    
    sidebarLinks.forEach(link => {
        link.addEventListener('click', function() {
            const page = this.getAttribute('data-page');
            const title = this.getAttribute('data-title');
            const subtitle = this.getAttribute('data-subtitle');
            
            sidebarLinks.forEach(l => l.classList.remove('active'));
            this.classList.add('active');
            
            if (pageTitle && title) pageTitle.textContent = title;
            if (pageSubtitle && subtitle) pageSubtitle.textContent = subtitle;
            
            if (contentFrame && page) {
                if (page === 'RossSt.html') {
                    contentFrame.src = 'RossStContent.html';
                } else if (page === 'Filler.html') {
                    contentFrame.src = 'FillerContent.html';
                } else {
                    contentFrame.src = page;
                }
            }
        });
    });
}

// ============================================
// INITIALIZE APPLICATION
// ============================================
function initializeApp() {
    if (window.self === window.top) {
        // We're in the main page (not iframe)
        initializeNavigation();
    } else {
        // We're inside an iframe
        initializeDashboard();
    }
    
    console.log('Application initialized successfully');
}

// ============================================
// START APPLICATION
// ============================================
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

// ============================================
// HANDLE WINDOW RESIZE
// ============================================
let resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        if (waterLevelChart) {
            waterLevelChart.resize();
        }
    }, 250);
});
