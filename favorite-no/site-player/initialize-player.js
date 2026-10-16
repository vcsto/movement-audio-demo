// Copied verbatim from the live Teaching Channel Scripts/general.js.
function keepPosterVisibleWithCors(player) {
    if (!player || typeof player.ready !== 'function') {
        return;
    }
    const decouple = function () {
        const posterImage = player.getChild('posterImage');
        const img = posterImage && posterImage.el() ? posterImage.el().querySelector('img') : null;
        if (!img) {
            return;
        }
        if (img.getAttribute('crossorigin') === null && !img.crossOrigin) {
            return;
        }
        const src = img.getAttribute('src');
        img.removeAttribute('crossorigin');
        img.crossOrigin = null;
        if (src) {
            img.setAttribute('src', src);
        }
    };
    player.ready(decouple);
    player.on('posterchange', decouple);
}

function initializeVideoPlayer(videoId, transcriptUrl, skipSeconds = 10) {
    const existingPlayer = videojs.getPlayer(videoId);
    const player = existingPlayer || videojs(videoId, {
        playbackRates: [0.5, 1, 1.5, 2],
        // Force video.js's HLS engine (VHS/MSE) instead of letting browsers that
        // advertise native HLS (e.g. Chrome on Android) handle the .m3u8 themselves,
        // which stalls on our CMAF/fMP4 renditions.
        html5: {
            vhs: {
                overrideNative: true,
                // Start the ABR estimate at 2 Mbps instead of VHS's conservative
                // default so the first segments come from the top (~1.16 Mbps)
                // rendition; our ladder is all-1080p, so the low rung looks blocky.
                bandwidth: 2000000
            },
            nativeAudioTracks: false,
            nativeVideoTracks: false
        }
    });

    keepPosterVisibleWithCors(player);

    const createSkipButton = (direction, iconSVG) => {
        const label = direction === 'rewind' ? 'Rewind 10 seconds' : 'Skip forward 10 seconds';
        const btn = videojs.dom.createEl('button', {
            className: 'vjs-skip-button vjs-control playback-btn',
            innerHTML: iconSVG
        });
        btn.setAttribute('aria-label', label);

        btn.onclick = () => {
            const current = player.currentTime();
            if (direction === 'rewind') {
                player.currentTime(Math.max(0, current - skipSeconds));
            } else {
                player.currentTime(Math.min(player.duration(), current + skipSeconds));
            }
        };

        return btn;
    };

    const rewindIcon = `
        <svg viewBox="0 0 512 512" aria-hidden="true">
          <path d="M256 48C141.1 48 48 141.1 48 256H0l80 96 80-96h-48c0-97 79-176 176-176s176 79 176 176-79 176-176 176c-41.2 0-79-14.2-108.6-37.9l-33.1 39.4C165.3 458.1 208.4 472 256 472c114.9 0 208-93.1 208-208S370.9 48 256 48z"/>
          <text x="200" y="320" font-size="180" fill="white">10</text>
        </svg>`;

    const forwardIcon = `
        <svg viewBox="0 0 512 512" aria-hidden="true">
          <path d="M256 48C370.9 48 464 141.1 464 256h48l-80 96-80-96h48c0-97-79-176-176-176S80 159 80 256s79 176 176 176c41.2 0 79-14.2 108.6-37.9l33.1 39.4C346.7 458.1 303.6 472 256 472c-114.9 0-208-93.1-208-208S141.1 48 256 48z"/>
          <text x="150" y="320" font-size="180" fill="white">10</text>
        </svg>`;

    player.ready(() => {
        const controlBar = player.getChild('controlBar');
        const playButton = controlBar.getChild('playToggle');

        const rewindBtn = createSkipButton('rewind', rewindIcon);
        const forwardBtn = createSkipButton('forward', forwardIcon);

        player.controlBar.playbackRateMenuButton.show();

        playButton.el().parentNode.insertBefore(rewindBtn, playButton.el().nextSibling);
        rewindBtn.parentNode.insertBefore(forwardBtn, rewindBtn.nextSibling);

        const hideEmptyCaptionsItems = () => {
            const captionsButton = player.controlBar.subsCapsButton;
            if (!captionsButton || !captionsButton.menu) return;
            captionsButton.menu.children().forEach(child => {
                if (child.track && !child.track.label && !child.track.language) {
                    if (typeof child.hide === 'function') child.hide();
                    try { child.track.mode = 'disabled'; } catch (e) {}
                }
            });
        };

        player.on('loadedmetadata', () => setTimeout(hideEmptyCaptionsItems, 100));
        const tracks = player.textTracks();
        if (tracks && typeof tracks.addEventListener === 'function') {
            tracks.addEventListener('addtrack', hideEmptyCaptionsItems);
            tracks.addEventListener('change', hideEmptyCaptionsItems);
        }
    });

    return player;
}
