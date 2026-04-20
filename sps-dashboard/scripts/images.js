/* Texas A&M University
** Safe Pass Systems - RIPPLE
** Emergency Service Dashboard
** Author: Parker Williamson
** File: images.js
** --------
** Image viewer controls, live image request from the RIPPLE system, and
** persistent image storage as real JPEG files on the server.
**
** Image persistence strategy
** ──────────────────────────
** When images are received (from /api/images/latest or /api/imagerequest),
** they are immediately sent to POST /api/images/save which writes them to
** disk as images/Pole1Image.jpg and images/Pole2Image.jpg.
**
** On every subsequent dashboard load, the selector buttons point directly
** to those static file paths — the browser just fetches a JPEG.  No
** base64 data URIs, no multi-megabyte localStorage entries.
**
** localStorage is used only to store a small metadata object (timestamp
** + filenames) so the dashboard knows fresh images exist on disk and can
** skip the /api/images/latest DB round-trip.
**
** Depends on: (no other custom modules — self-contained)
**
** Functions defined here:
**   changeImage(src)
**   initializeImageButtons()
**   saveImagesToDisk(images)
**   markImagesAsFresh(filenames)
**   getImageFreshness()
**   loadSavedImages()
**   initializeImageRequestButton()
**   _applyImagesToButtons(sources)
*/


// ── Constants ─────────────────────────────────────────────────────────────────
// Static file paths served by Express from the project /images/ folder
const POLE1_IMAGE_PATH = 'images/Pole1Image.jpg';
const POLE2_IMAGE_PATH = 'images/Pole2Image.jpg';

// localStorage key — stores only metadata (timestamp + filenames), not image data
const CACHE_META_KEY = 'ripple_images_meta';
const IMG_BTN_STATE_KEY = 'ripple_img_btn_disabled';
const IMG_BTN_STATE_TIME_KEY = 'ripple_img_btn_disabled_time';

/* Validates that a base64 data URI is a real JPEG by checking its magic bytes.
** Every valid JPEG file begins with the hex sequence FF D8 FF regardless of
** content, so decoding just the first 3 bytes is enough to confirm the format.
** Parameters:
**     string dataUri  e.g. "data:image/jpeg;base64,/9j/4AAQ..."
** Return:
**     boolean  true if the data URI is a valid JPEG, false otherwise
*/
function isValidJpeg(dataUri) {
    if (!dataUri || typeof dataUri !== 'string') return false;

    // Must be a data URI with a base64 payload
    const match = dataUri.match(/^data:image\/\w+;base64,(.+)$/);
    if (!match) return false;

    try {
        // Decode only the first 4 base64 chars — enough to get 3 raw bytes
        const raw = atob(match[1].slice(0, 4));
        // JPEG magic bytes: FF D8 FF
        return raw.charCodeAt(0) === 0xFF &&
               raw.charCodeAt(1) === 0xD8 &&
               raw.charCodeAt(2) === 0xFF;
    } catch (_) {
        return false;
    }
}/* isValidJpeg() */


/* Filters an image array, replacing any invalid or non-JPEG entries with null.
** Logs a warning for each image that fails validation.
** Parameters:
**     array images  [pole1DataUri|null, pole2DataUri|null]
** Return:
**     array  same length, invalid entries replaced with null
*/
function validateImages(images) {
    return images.map((img, i) => {
        if (!img) return null;
        if (!isValidJpeg(img)) {
            console.warn(`[Images] Pole ${i + 1} image failed JPEG validation — discarding`);
            return null;
        }
        console.info(`[Images] Pole ${i + 1} image passed JPEG validation`);
        return img;
    });
}/* validateImages() */


/* Sets the main image viewer <img> to the given src (file path or data URI).
** Parameters:
**     string src
** Return:
**     None
*/
function changeImage(src) {
    const img = document.getElementById("image");
    if (!img) return;
    // Always append a cache-busting timestamp for file paths so the browser
    // never serves a stale cached version after a new image has been saved to disk.
    // Data URIs are always fresh so they don't need it.
    if (src && !src.startsWith('data:')) {
        img.src = src.split('?')[0] + '?t=' + Date.now();
    } else {
        img.src = src;
    }
}


/* Wires each .image-selector-btn so clicking it highlights the button
** and swaps the viewer to the image stored in its data-image attribute.
** Parameters:
**     None
** Return:
**     None
*/
function initializeImageButtons() {
    const buttons = document.querySelectorAll('.image-selector-btn');

    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const src = btn.getAttribute('data-image');
            if (src) changeImage(src);
        });
    });
}/* initializeImageButtons() */


/* Sends base64 image data URIs to the server to be written as JPEG files on disk.
** The server writes to images/Pole1Image.jpg and images/Pole2Image.jpg.
** Parameters:
**     array images  [pole1DataUri|null, pole2DataUri|null]
** Return:
**     Promise<string[]>  filenames that were successfully written, e.g. ['Pole1Image.jpg']
*/
async function saveImagesToDisk(images) {
    try {
        const response = await fetch('/api/images/save', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ images }),
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            console.warn(`[Images] /api/images/save returned ${response.status}: ${err.error ?? 'unknown'}`);
            return [];
        }

        const result = await response.json();
        console.info(`[Images] Saved to disk: ${result.saved.join(', ')}`);
        return result.saved ?? [];

    } catch (err) {
        console.warn('[Images] Failed to save images to disk:', err.message);
        return [];
    }
}/* saveImagesToDisk() */


/* Records that fresh images exist on disk in localStorage.
** Stores only a tiny metadata object — not the image data itself.
** Parameters:
**     string[] filenames  e.g. ['Pole1Image.jpg', 'Pole2Image.jpg']
** Return:
**     None
*/
function markImagesAsFresh(filenames) {
    const meta = {
        savedAt:   new Date().toISOString(),
        filenames,
    };
    try {
        localStorage.setItem(CACHE_META_KEY, JSON.stringify(meta));
        console.info(`[Images] Freshness metadata saved (${meta.savedAt})`);
    } catch (err) {
        console.warn('[Images] Could not write image metadata to localStorage:', err.message);
    }
}/* markImagesAsFresh() */


/* Reads the image freshness metadata from localStorage.
** Returns null if no metadata exists.
** Parameters:
**     None
** Return:
**     { savedAt: string, filenames: string[] } | null
*/
function getImageFreshness() {
    try {
        const raw = localStorage.getItem(CACHE_META_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (_) {
        return null;
    }
}/* getImageFreshness() */


/* Loads the most recent pole images into the viewer on dashboard startup.
**
** Priority order:
**   1. On-disk files (images/Pole1Image.jpg etc.) — used when freshness
**      metadata exists in localStorage, meaning the server already has the
**      files from a previous image request.  Zero DB traffic, instant load.
**
**   2. /api/images/latest — fetches base64 data from the database, then
**      immediately saves it to disk so next time falls into path 1.
**      Used on first load after a clean deployment or cache clear.
**
** Parameters:
**     None
** Return:
**     None (async)
*/
async function loadSavedImages() {
    console.info('[Images] Loading saved images...');

    // ── Helper: check if a static file is actually reachable ─────────────────
    const fileExists = (filePath) => fetch(filePath, { method: 'HEAD' })
        .then(r => r.ok)
        .catch(() => false);

    // ── 1. Check which disk files actually exist ──────────────────────────────
    const meta = getImageFreshness();
    const [pole1Exists, pole2Exists] = meta
        ? await Promise.all([fileExists(POLE1_IMAGE_PATH), fileExists(POLE2_IMAGE_PATH)])
        : [false, false];

    if (pole1Exists && pole2Exists) {
        // Fast path — both files confirmed on disk, no DB needed
        console.info(`[Images] Both disk images verified (saved ${meta.savedAt}) — loading from file paths`);
        _applyImagesToButtons([POLE1_IMAGE_PATH, POLE2_IMAGE_PATH]);
        return;
    }

    // Build the result array — start with whatever is already on disk
    const finalSources = [
        pole1Exists ? POLE1_IMAGE_PATH : null,
        pole2Exists ? POLE2_IMAGE_PATH : null,
    ];

    if (meta) {
        if (!pole1Exists) console.warn('[Images] Pole 1 image missing from disk — will fetch from database');
        if (!pole2Exists) console.warn('[Images] Pole 2 image missing from disk — will fetch from database');
        try { localStorage.removeItem(CACHE_META_KEY); } catch (_) {}
    }

    // If at least one exists already, show it immediately while DB fetch runs
    if (pole1Exists || pole2Exists) {
        _applyImagesToButtons(finalSources);
    }

    // ── 2. Fetch only the missing images from the database ────────────────────
    const needsPole1 = !pole1Exists;
    const needsPole2 = !pole2Exists;

    if (!needsPole1 && !needsPole2) return;  // shouldn't reach here but guard anyway

    console.info(`[Images] Fetching missing image(s) from database — Pole 1: ${needsPole1}, Pole 2: ${needsPole2}`);

    try {
        const loadImageTimeout = remoteConfig.LOAD_IMAGE_TIMEOUT;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), loadImageTimeout + 1000);

        const response = await fetch('/api/images/latest', { signal: controller.signal });
        clearTimeout(timeout);

        if (!response.ok) {
            console.warn(`[Images] /api/images/latest returned ${response.status}`);
            return;
        }

        const result = await response.json();
        const dbImages = result.images ?? [];

        if (dbImages.length === 0 || (!dbImages[0] && !dbImages[1])) {
            console.info('[Images] No images available in database yet');
            return;
        }

        // Only keep the images we actually need — null out the ones already on disk
        const toFetch = [
            needsPole1 ? dbImages[0] : null,
            needsPole2 ? dbImages[1] : null,
        ];

        console.info('[Images] Received image(s) from database — validating...');
        const validated = validateImages(toFetch);

        if (!validated[0] && !validated[1]) {
            console.warn('[Images] All fetched images failed JPEG validation — aborting save');
            return;
        }

        console.info('[Images] Validation passed — saving to disk...');
        const saved = await saveImagesToDisk(validated);

        // Merge newly saved images with whatever was already on disk
        if (validated[0]) finalSources[0] = saved.includes('Pole1Image.jpg') ? POLE1_IMAGE_PATH : validated[0];
        if (validated[1]) finalSources[1] = saved.includes('Pole2Image.jpg') ? POLE2_IMAGE_PATH : validated[1];

        if (saved.length > 0) markImagesAsFresh(saved);

        _applyImagesToButtons(finalSources);

    } catch (error) {
        if (error.name === 'AbortError') {
            console.warn('[Images] Database image fetch timed out');
        } else {
            console.warn('[Images] Failed to load images from database:', error);
        }
    }
}/* loadSavedImages() */


/* Applies an image source array to the selector buttons and displays
** the first available image in the viewer.
**
** Button layout in RossStContent.html:
**   index 0 → Location  (static placeholder, never overwritten by live images)
**   index 1 → Pole 1
**   index 2 → Pole 2
**
** Parameters:
**     array sources  [pole1Src|null, pole2Src|null]
**                    each entry is a file path or base64 data URI
** Return:
**     None
*/
function _applyImagesToButtons(sources) {
    const buttons = document.querySelectorAll('.image-selector-btn');

    sources.forEach((src, i) => {
        if (!src) return;
        const btn = buttons[i + 1];   // +1 to skip the Location button at index 0
        if (btn) {
            btn.setAttribute('data-image', src);
            console.info(`[Images] Pole ${i + 1} button set to: ${src.startsWith('data:') ? `<data URI ${Math.round(src.length / 1024)} KB>` : src}`);
        }
    });

    // Show the first available image and activate its button
    const firstSrc = sources[0] ?? sources[1];
    if (!firstSrc) return;

    changeImage(firstSrc);

    buttons.forEach(b => b.classList.remove('active'));
    const activeIdx = sources[0] ? 1 : 2;
    if (buttons[activeIdx]) buttons[activeIdx].classList.add('active');
}/* _applyImagesToButtons() */

let _imageStatusTimeout = null;

/* Sets the image request status badge to one of three states.
** Parameters:
**     string state  'pending' | 'success' | 'error'
**     string text   label to display
** Return:
**     None
*/
function setImageRequestStatus(state, text) {
    const el = document.getElementById('image-request-status');
    if (!el) return;

    // Clear any pending auto-hide from a previous result
    if (_imageStatusTimeout) {
        clearTimeout(_imageStatusTimeout);
        _imageStatusTimeout = null;
    }

    el.className = `image-request-status status-${state}`;
    el.textContent = text;

    // Auto-hide after 5 seconds on terminal states only —
    // 'pending' stays visible for the full duration of the request
    if (state !== 'pending') {
        _imageStatusTimeout = setTimeout(() => {
            el.className = 'image-request-status';
            el.textContent = '';
            _imageStatusTimeout = null;
        }, 5000);
    }
}

/* Wires the "Request Images" button.
**
** Flow on click:
**   1. POST request to /api/imagerequest — triggers MQTT publish to poles
**   2. Server waits for the DB-complete MQTT signal, then reads the images
**   3. Client receives base64 data URIs in the response
**   4. Client saves them to disk via /api/images/save
**   5. Freshness metadata written to localStorage
**   6. Buttons and viewer updated to show the new file-path images
**
** Parameters:
**     None
** Return:
**     None
*/
function initializeImageRequestButton() {
    const pingButton  = document.querySelector('.ping-button');
    const imageButton = document.getElementById('image-request-button');
    if (!imageButton) {
        console.warn('[Images] Image request button not found in DOM');
        return;
    }

    // ── Restore button state on load ──────────────────────────────────────────
    _restoreButtonDisabledState(pingButton, imageButton);

    imageButton.addEventListener('click', async () => {
        _disableActionButtons(pingButton, imageButton);
        setImageRequestStatus('pending', 'Requesting…');
        console.info('[Images] Image request sent to RIPPLE system — awaiting response...');

        try {
            const imageRequestTimeout = remoteConfig.IMAGE_REQUEST_TIMEOUT;
            const controller = new AbortController();
            const abortTimer = setTimeout(() => controller.abort(), imageRequestTimeout + 1000);

            const response = await fetch('/api/imagerequest', { signal: controller.signal });
            clearTimeout(abortTimer);

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                console.error(`[Images] Server returned ${response.status}: ${err.error ?? 'unknown error'}`);
                _enableActionButtons(pingButton, imageButton);
                setImageRequestStatus('error', 'Request Failed');
                return;
            }

            const result = await response.json();
            const images = result.images ?? [];

            if (images.length === 0 || (!images[0] && !images[1])) {
                console.warn('[Images] Response contained no images');
                _enableActionButtons(pingButton, imageButton);
                setImageRequestStatus('error', 'No Images Returned');
                return;
            }

            console.info(`[Images] Received ${images.filter(Boolean).length} image(s) from RIPPLE system — validating...`);

            // Validate JPEG magic bytes before writing to disk
            const validatedImages = validateImages(images);
            if (!validatedImages[0] && !validatedImages[1]) {
                console.warn('[Images] All images failed JPEG validation — aborting save');
                _enableActionButtons(pingButton, imageButton);
                setImageRequestStatus('error', 'Invalid Image Data');
                return;
            }

            const saved = await saveImagesToDisk(validatedImages);

            if (saved.length > 0) {
                markImagesAsFresh(saved);
                _applyImagesToButtons([POLE1_IMAGE_PATH, POLE2_IMAGE_PATH]);
                setImageRequestStatus('success', 'Images Updated');
            } else {
                console.warn('[Images] Disk save failed — displaying images from memory (will not persist)');
                _applyImagesToButtons(validatedImages);
                setImageRequestStatus('error', 'Imaged Failed to save to disk');
            }

            _enableActionButtons(pingButton, imageButton);
            console.info('[Images] Image Request Button Re-Enabled');
            
        } catch (error) {
            if (error.name === 'AbortError') {
                console.error('[Images] Image request timed out after 2 minutes');
            } else {
                console.error('[Images] Image request failed:', error);
            }
            setImageRequestStatus('error', error.name === 'AbortError' ? 'Timed Out' : 'Request Failed');
        }
    });
}/* initializeImageRequestButton() */