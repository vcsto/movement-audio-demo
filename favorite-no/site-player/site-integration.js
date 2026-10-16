/* Local MP4 and narration use the site's real player and unchanged controls. */
// Same global player labels as the production general.js.
videojs.addLanguage('en', {
  'captions off': 'Off', 'Captions off': 'Off',
  'Subtitles off': 'Off', 'subtitles off': 'Off',
  'Closed Captions': 'Subtitles/closed captions',
  'Captions': 'Subtitles/closed captions', 'Subtitles': 'Subtitles/closed captions'
});
window.lessonPlayer = initializeVideoPlayer('myVideo', 'transcript-en.txt');
const descriptionPanel = document.getElementById('ad-current');
const speechStatus = document.getElementById('flashMessageLiveRegion');
const fullscreenContent = [descriptionPanel, speechStatus].map(element => {
  const home = document.createComment('Audio description original position');
  element.before(home);
  return {element, home};
});
// Keep unsupported-browser feedback visible even when the page is outside fullscreen.
const unavailableNotice = document.createElement('div');
unavailableNotice.className = 'ad-player-notice';
unavailableNotice.hidden = true;
const unavailableText = document.createElement('p');
const dismissNotice = document.createElement('button');
dismissNotice.type = 'button';
dismissNotice.textContent = 'Dismiss';
unavailableNotice.append(unavailableText, dismissNotice);
lessonPlayer.el().append(unavailableNotice);
lessonPlayer.on('descriptionunavailable', () => {
  unavailableText.textContent = document.getElementById('ad-status').textContent;
  unavailableNotice.hidden = false;
});
dismissNotice.addEventListener('click', () => {
  unavailableNotice.hidden = true;
  lessonPlayer.userActive(true);
  lessonPlayer.el().querySelector('button.vjs-subs-caps-button').focus({preventScroll: true});
});
lessonPlayer.ready(() => {
  // Video.js must render captions for its built-in appearance settings to apply.
  lessonPlayer.el().querySelector('video').setAttribute('aria-label', 'My Favorite No (Uncut), first six minutes');
});
lessonPlayer.on('play', () => {
  document.querySelector('.tc-video-detail-overlay').classList.add('ad-started');
});
// Preserve the site's fullscreen sizing with the local fixed-height wrapper.
lessonPlayer.on('fullscreenchange', () => {
  const full = lessonPlayer.isFullscreen();
  lessonPlayer.el().style.setProperty('height', full ? '100vh' : '550px', 'important');
  const focused = document.activeElement;
  const preserveFocus = descriptionPanel.contains(focused);
  for (const {element, home} of fullscreenContent) {
    if (full) lessonPlayer.el().append(element);
    else home.after(element);
  }
  if (preserveFocus) focused.focus({preventScroll: true});
});
