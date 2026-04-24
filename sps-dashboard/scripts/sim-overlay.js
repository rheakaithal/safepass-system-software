/* Texas A&M University
** Safe Pass Systems - RIPPLE
** Emergency Service Dashboard
** Author: Parker Williamson
** File: sim-overlay.js
** --------
** Simulation-only frontend script. Served exclusively by database-test.js,
** which injects it into RossStContent.html at request time.
** Never referenced by any production file.
**
** Overrides initializeImageRequestButton() from images.js with a version
** that captures a webcam frame instead of hitting /api/imagerequest.
** All other helper functions (validateImages, saveImagesToDisk, etc.)
** are already in scope from images.js — nothing is duplicated.
**
** Load order (enforced by database-test.js injection):
**   images.js → ... → dashboard.main.js → sim-overlay.js → navigation.js
**
** Functions defined here:
**   captureWebcamImage()
**   initializeImageRequestButton()  — replaces the version in images.js
*/


/* Captures a single frame from the laptop webcam and returns it as a
** base64 JPEG data URI. Opens the stream, grabs one frame, then
** immediately closes it so the camera indicator light turns off.
** Parameters:
**     None
** Return:
**     Promise<string|null>  JPEG data URI, or null if camera is unavailable
*/
async function captureWebcamImage() {
    let stream = null;
    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });

        // Mount to an off-screen video element so we can read a frame
        const video     = document.createElement('video');
        video.srcObject = stream;
        video.muted     = true;

        // Wait for actual frame data before reading
        await new Promise((resolve, reject) => {
            video.onloadeddata = resolve;
            video.onerror      = reject;
            video.play();
        });

        // Draw one frame onto a canvas and export as JPEG at 92% quality
        const canvas  = document.createElement('canvas');
        canvas.width  = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);

        console.info('[Sim] Webcam frame captured — ' + canvas.width + 'x' + canvas.height + 'px');
        return canvas.toDataURL('image/jpeg', 0.92);

    } catch (err) {
        console.error('[Sim] Webcam capture failed:', err.message);
        return null;
    } finally {
        // Always release the camera so the indicator light turns off
        if (stream) stream.getTracks().forEach(t => t.stop());
    }
}/* captureWebcamImage() */


/* Replaces the production initializeImageRequestButton() from images.js.
** Called by initializeDashboard() at the same call site — the sim version
** is already in scope by the time navigation.js fires DOMContentLoaded.
**
** Flow on click:
**   1. Capture one frame from the laptop webcam  (new Pole 1 image)
**   2. Read the current Pole 1 file from disk    (shifts to Pole 2)
**   3. Validate both as real JPEGs
**   4. Save via /api/images/save
**   5. Update viewer and status badge
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
        console.warn('[Sim] Image request button not found in DOM');
        return;
    }

    _restoreButtonDisabledState(pingButton, imageButton);

    imageButton.addEventListener('click', async () => {
        _disableActionButtons(pingButton, imageButton);
        setImageRequestStatus('pending', 'Requesting\u2026');
        console.info('[Sim] Image request started — capturing webcam frame...');

        try {
            // ── Step 1: Capture webcam frame ──────────────────────────────
            const webcamImage = await captureWebcamImage();
            if (!webcamImage) {
                console.error('[Sim] Webcam capture returned null — aborting');
                setImageRequestStatus('error', 'Camera Unavailable');
                _enableActionButtons(pingButton, imageButton);
                return;
            }

            // ── Step 2: Read existing Pole 1 → will become new Pole 2 ─────
            let currentPole1 = null;
            try {
                const res = await fetch(POLE1_IMAGE_PATH + '?t=' + Date.now());
                if (res.ok) {
                    const blob = await res.blob();
                    currentPole1 = await new Promise((resolve) => {
                        const reader  = new FileReader();
                        reader.onload = () => resolve(reader.result);
                        reader.readAsDataURL(blob);
                    });
                    console.info('[Sim] Existing Pole 1 image read — shifting to Pole 2');
                }
            } catch (_) {
                console.warn('[Sim] Could not read existing Pole 1 image — Pole 2 slot will be empty');
            }

            // ── Step 3: Validate both images ──────────────────────────────
            const validated = validateImages([webcamImage, currentPole1]);
            if (!validated[0]) {
                console.warn('[Sim] Webcam image failed JPEG validation — aborting');
                setImageRequestStatus('error', 'Invalid Image Data');
                _enableActionButtons(pingButton, imageButton);
                return;
            }

            // ── Step 4: Save webcam → Pole 1, old Pole 1 → Pole 2 ────────
            const saved = await saveImagesToDisk(validated);
            if (saved.length > 0) {
                markImagesAsFresh(saved);
                _applyImagesToButtons([POLE1_IMAGE_PATH, POLE2_IMAGE_PATH]);
                setImageRequestStatus('success', 'Images Updated');
                console.info('[Sim] Image request complete — viewer updated');
            } else {
                console.warn('[Sim] Disk save failed — falling back to in-memory display');
                _applyImagesToButtons(validated);
                setImageRequestStatus('error', 'Save Failed');
            }

            _enableActionButtons(pingButton, imageButton);

        } catch (err) {
            console.error('[Sim] Image request failed:', err);
            setImageRequestStatus('error', 'Request Failed');
            _enableActionButtons(pingButton, imageButton);
        }
    });
}/* initializeImageRequestButton() */

console.info('[Sim] Simulation overlay loaded — webcam image capture active');