/* Texas A&M University
** Safe Pass Systems - RIPPLE
** Emergency Service Dashboard
** Author: Parker Williamson
** File: navigation.js
** --------
** Contains the initialization and functions of the side bar menu navigation.
** Allows for naviagation between pages by the side menu and initializes the page
*/

/* Handles the menu buttons. changes the content in the iframe container to appropriate html page.
** Changes the title/subtitle. Changes the active button on the menu
** Parameters:
**     None
** Return:
**     None
*/
function initializeNavigation() {
    const sidebarLinks = document.querySelectorAll('.sidebar-link');
    const contentFrame = document.getElementById('content-frame');
    const pageTitle = document.getElementById('page-title');
    const pageSubtitle = document.getElementById('page-subtitle');

    if (!contentFrame) {
        console.error('[Nav] Content iframe #content-frame not found');
    }
    console.log(`[Nav] Navigation initialized — ${sidebarLinks.length} sidebar links found`);
    
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
                console.log(`[Nav] Navigating to: ${page}`);
                contentFrame.src = page;
                if(page==="RossStContent"){updatePoleData()}
            }
        });
    });
}/* initializeNavigation() */


/* Makes sure that the window in use is in the iframe container
** false - initializes the navigation which enters into the iframe
** true - initializes the dashboard
** Parameters:
**     None
** Return:
**     None
*/
function initializeApp() {
    if (window.self === window.top) {
        console.log('[Nav] Running in main window — initializing navigation');
        initializeNavigation();
    } else {
        console.log('[Nav] Running inside iframe — initializing dashboard');
        initializeDashboard();
    }
    
    console.log('[Nav] Application initialized successfully');
}/* initializeApp() */

/* Checks status of page - Waits for page to fully load before initialzing
** Parameters:
**     None
** Return:
**     None
*/
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

/* Event listener to resize graph when page size changes
** Parameters:
**     None
** Return:
**     None
*/
let resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        if (waterLevelChart) {
            waterLevelChart.resize();
            console.log('[Nav] Chart resized to fit new window dimensions');
        }
    }, 250);
});