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
                contentFrame.src = page;
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
        // We're in the main page (not iframe)
        initializeNavigation();
    } else {
        // We're inside an iframe
        initializeDashboard();
    }
    
    console.log('Application initialized successfully');
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
        }
    }, 250);
});
