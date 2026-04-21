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
    console.info(`[Nav] Navigation initialized — ${sidebarLinks.length} sidebar links found`);
    
    sidebarLinks.forEach(link => {
        link.addEventListener('click', function() {
            const page     = this.getAttribute('data-page');
            const title    = this.getAttribute('data-title');
            const subtitle = this.getAttribute('data-subtitle');
            
            // Remove active highlight from all links, then apply to the clicked one
            sidebarLinks.forEach(l => l.classList.remove('active'));
            this.classList.add('active');
            
            // Update header text to match the selected page
            if (pageTitle && title) pageTitle.textContent = title;
            if (pageSubtitle && subtitle) pageSubtitle.textContent = subtitle;
            
            if (contentFrame && page) {
                console.info(`[Nav] Navigating to: ${page}`);
                // Changing src reloads the iframe, which re-runs initializeDashboard
                // automatically via navigation.js — no manual call needed here
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
        console.info('[Nav] Running in main window — initializing navigation');
        initializeNavigation();
    } else {
        console.info('[Nav] Running inside iframe — initializing dashboard');
        initializeDashboard();
    }
    
    console.info('[Nav] Application initialized successfully');
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