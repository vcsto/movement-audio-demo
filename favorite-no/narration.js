/* Extended audio descriptions stay on the original video timeline. */
(() => {
  'use strict';
  const cues = JSON.parse(document.getElementById('description-data').textContent);
  const video = document.querySelector('#myVideo video');
  const live = document.getElementById('flashMessageLiveRegion');
  const status = document.getElementById('ad-status');
  const box = document.getElementById('ad-current');
  const text = document.getElementById('ad-text');
  const pause = document.getElementById('ad-pause');
  const retry = document.getElementById('ad-retry');
  const next = document.getElementById('ad-skip');
  const synth = window.speechSynthesis;
  const supported = !!synth && !!window.SpeechSynthesisUtterance;
  const key = 'favoriteNoDescriptionEnabledV1';
  let enabled = false;
  try { enabled = localStorage.getItem(key) === 'true'; } catch (_) {}
  let index = 0, active = null, token = 0, timer = null;
  let utterance = null, held = false, failed = false, seekResume = false;

  function message(value, error = false) {
    status.textContent = value;
    status.classList.toggle('ad-error', error);
    document.getElementById('ad-panel-status').textContent = value;
    live.textContent = value;
  }
  function render() {
    lessonPlayer.trigger('descriptionstatechange');
  }
  function cancelSpeech() {
    token++;
    clearTimeout(timer);
    utterance = null;
    if (synth) synth.cancel();
  }
  function hideDescription() {
    // Keep keyboard focus on a visible control when this panel closes.
    if (box.contains(document.activeElement)) {
      lessonPlayer.userActive(true);
      document.querySelector('button.vjs-subs-caps-button').focus({preventScroll: true});
    }
    box.hidden = true;
  }
  function finish(resume) {
    cancelSpeech();
    active = null; held = false; failed = false;
    hideDescription();
    if (resume) play();
  }
  function play() {
    video.play().catch(() => message('Playback is paused. Use the video Play button to continue.', true));
  }
  function speechError() {
    cancelSpeech();
    failed = true;
    held = false;
    pause.hidden = true;
    retry.hidden = false;
    message('The description could not be spoken. The video remains paused. Retry, or skip this description to continue.', true);
  }
  function sayActive() {
    cancelSpeech();
    held = false; failed = false;
    pause.hidden = false;
    pause.textContent = 'Pause description';
    retry.hidden = true;
    // Short utterances avoid long-speech stalls on some browser voices.
    const sentences = active.text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [active.text];
    const chunks = sentences.flatMap(sentence => {
      const parts = []; let part = '';
      for (const word of sentence.trim().split(/\s+/)) {
        if (part.length + word.length > 140) { parts.push(part); part = ''; }
        part += (part ? ' ' : '') + word;
      }
      if (part) parts.push(part);
      return parts;
    });
    const generation = token;
    let part = 0;
    const speakPart = () => {
      if (generation !== token || !active || held) return;
      if (part === chunks.length) {
        message('Description complete. Video resuming.');
        finish(true);
        return;
      }
      const u = new SpeechSynthesisUtterance(chunks[part++].trim());
      utterance = u;
      u.lang = 'en-US'; u.rate = 1; u.volume = video.muted ? 0 : video.volume;
      const voices = synth.getVoices();
      u.voice = voices.find(v => v.localService && /^en[-_]US/i.test(v.lang)) || voices.find(v => /^en/i.test(v.lang)) || null;
      u.onend = () => {
        if (generation !== token) return;
        clearTimeout(timer);
        speakPart();
      };
      u.onerror = () => { if (generation === token) speechError(); };
      // A failed voice must never silently skip required descriptions.
      timer = setTimeout(() => { if (generation === token) speechError(); }, Math.max(20000, u.text.length * 130));
      try { synth.speak(u); } catch (_) { speechError(); }
    };
    speakPart();
  }
  function describe(cue) {
    active = cue;
    video.pause();
    box.hidden = false;
    text.textContent = cue.text;
    // Do not put the cue text in a live region: screen-reader speech would overlap TTS.
    message('Video paused for audio description.');
    if (!supported) speechError(); else sayActive();
  }
  function setEnabled(on) {
    if (on && !supported) {
      message('Audio description is unavailable in this browser. Try another browser that supports speech synthesis, then turn on Audio description in the CC menu.', true);
      lessonPlayer.trigger('descriptionunavailable');
      return;
    }
    enabled = on;
    try { localStorage.setItem(key, String(on)); } catch (_) {}
    if (!on && active) finish(!held && !failed);
    // Enabling midway does not read every earlier description.
    if (on) index = cues.findIndex(c => c.t >= video.currentTime - 0.35);
    if (index < 0) index = cues.length;
    render();
    message(on ? 'Audio description on. The video pauses while each description is spoken.' : 'Audio description off.');
  }
  pause.addEventListener('click', () => {
    if (!active) return;
    if (held) { sayActive(); message('Description restarted.'); }
    else {
      cancelSpeech(); held = true;
      pause.textContent = 'Resume description';
      message('Description and video paused. Resume restarts this description.');
    }
  });
  retry.addEventListener('click', () => { if (active) { message('Retrying description.'); sayActive(); } });
  next.addEventListener('click', () => { message('Description skipped. Video resuming.'); finish(true); });
  function checkCue() {
    if (!enabled || active || video.paused || video.seeking || video.ended) return;
    if (index < cues.length && video.currentTime >= cues[index].t) describe(cues[index++]);
  }
  video.addEventListener('timeupdate', checkCue);
  // Frame callbacks reduce delay at cue boundaries; timeupdate is the fallback.
  if (video.requestVideoFrameCallback) {
    const frame = () => { checkCue(); video.requestVideoFrameCallback(frame); };
    video.requestVideoFrameCallback(frame);
  }
  video.addEventListener('seeking', () => {
    seekResume = seekResume || (!!active && !held && !failed);
    if (active) finish(false);
  });
  video.addEventListener('seeked', () => {
    index = cues.findIndex(c => c.t >= video.currentTime - 0.35);
    if (index < 0) index = cues.length;
    if (seekResume) { seekResume = false; play(); }
  });
  video.addEventListener('play', () => {
    if (active) { finish(false); message('Description skipped by resuming video.'); }
  });
  video.addEventListener('volumechange', () => { if (active && !held && !failed) sayActive(); });
  video.addEventListener('ended', () => finish(false));
  video.addEventListener('error', () => message('The video could not load. Try reloading the page.', true));
  // Timestamp navigation explicitly pauses, including when speech was active.
  video.addEventListener('description-review', () => {
    seekResume = false;
    if (active) finish(false);
  });
  window.addEventListener('pagehide', cancelSpeech);
  if (!supported) enabled = false;
  // Extend the real Video.js menu so keyboard navigation, focus and disposal
  // behave like its other items. Descriptions are independent of caption choice.
  const MenuItem = videojs.getComponent('MenuItem');
  class AudioDescriptionItem extends MenuItem {
    constructor(player) {
      super(player, {label: 'Audio description', selectable: true, multiSelectable: true, selected: enabled});
      this.addClass('vjs-audio-description-item');
      const sync = () => {
        this.selected(enabled);
        this.controlText('');
        this.el().querySelector('.vjs-menu-item-text').textContent = `Audio description: ${enabled ? 'On' : 'Off'}`;
      };
      this.on(player, 'descriptionstatechange', sync);
      sync();
    }
    handleClick() { setEnabled(!enabled); }
  }
  const captionsMenu = lessonPlayer.controlBar.subsCapsButton;
  const originalItems = captionsMenu.createItems;
  captionsMenu.createItems = function () {
    return [...originalItems.call(this), new AudioDescriptionItem(this.player())];
  };
  captionsMenu.update();
  const menuButton = captionsMenu.el().querySelector('button');
  menuButton.setAttribute('aria-label', 'Captions and audio description');
  menuButton.setAttribute('title', 'Captions and audio description');
  // Correct the production player's Escape focus handling without changing Tab.
  captionsMenu.el().addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !(captionsMenu.menu.el().contains(event.target) || menuButton.getAttribute('aria-expanded') === 'true')) return;
    event.preventDefault();
    event.stopPropagation();
    captionsMenu.unpressButton();
    captionsMenu.removeClass('vjs-hover');
    lessonPlayer.userActive(true);
    menuButton.focus({preventScroll: true});
  }, true);
  render();
})();
