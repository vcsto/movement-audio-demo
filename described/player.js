/* Extended audio descriptions stay on the original video timeline. */
(() => {
  'use strict';
  const cues = JSON.parse(document.getElementById('description-data').textContent);
  const video = document.querySelector('#myVideo video');
  const shell = document.getElementById('myVideo');
  const toggles = [...document.querySelectorAll('.js-movement-audio-toggle')];
  const live = document.getElementById('flashMessageLiveRegion');
  const status = document.getElementById('ad-status');
  const box = document.getElementById('ad-current');
  const text = document.getElementById('ad-text');
  const pause = document.getElementById('ad-pause');
  const retry = document.getElementById('ad-retry');
  const next = document.getElementById('ad-skip');
  const synth = window.speechSynthesis;
  const supported = !!synth && !!window.SpeechSynthesisUtterance;
  const key = 'bookClubDescriptionEnabledV2';
  let enabled = false;
  try { enabled = localStorage.getItem(key) === 'true'; } catch (_) {}
  let started = false, index = 0, active = null, token = 0, timer = null;
  let utterance = null, held = false, failed = false, seekResume = false;
  const stream = 'https://teachingchannel-videos.s3.us-west-2.amazonaws.com/XLwuiS0b/XLwuiS0b.m3u8';

  function message(value, error = false) {
    status.textContent = value;
    status.classList.toggle('ad-error', error);
    live.textContent = value;
  }
  function render() {
    for (const button of toggles) {
      button.setAttribute('aria-pressed', String(enabled));
      button.querySelector('.js-ma-state').textContent = enabled ? 'On' : 'Off';
      button.style.background = enabled ? '#6F2495' : (button.id.endsWith('overlay') ? 'transparent' : '#fff');
      button.style.color = enabled || button.id.endsWith('overlay') ? '#fff' : '#632186';
      button.querySelectorAll('.js-ma-icon-on').forEach(el => el.style.display = enabled ? '' : 'none');
      button.querySelectorAll('.js-ma-icon-off').forEach(el => el.style.display = enabled ? 'none' : '');
    }
  }
  function cancelSpeech() {
    token++;
    clearTimeout(timer);
    utterance = null;
    if (synth) synth.cancel();
  }
  function hideDescription() {
    // Keep keyboard focus on a visible control when this panel closes.
    if (box.contains(document.activeElement)) toggles.at(-1).focus({preventScroll: true});
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
      message('This browser cannot speak audio descriptions. Download the audio description script from the Transcript tab or use a browser with speech synthesis.', true);
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
  toggles.forEach(button => button.addEventListener('click', () => setEnabled(!enabled)));
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
    if (!started || !enabled || active || video.paused || video.seeking || video.ended) return;
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
  video.addEventListener('loadedmetadata', () => {
    document.querySelectorAll('.ad-duration').forEach(el => el.textContent = `${Math.floor(video.duration / 60)}:${String(Math.floor(video.duration % 60)).padStart(2, '0')}`);
  });
  function startVideo() {
    if (!started) {
      started = true;
      shell.classList.add('ad-started');
      shell.querySelector('.vjs-poster')?.setAttribute('hidden', '');
      document.querySelector('.tc-video-detail-overlay').classList.add('ad-started');
      video.controls = true;
      video.tabIndex = 0;
      if (video.canPlayType('application/vnd.apple.mpegurl')) video.src = stream;
      else if (window.Hls && Hls.isSupported()) {
        const hls = new Hls();
        hls.loadSource(stream);
        hls.attachMedia(video);
        hls.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal) message('The video stream was interrupted. Reload the page to retry.', true);
        });
      } else {
        message('This browser could not load the video player. Try a current browser and reload.', true);
        return;
      }
    }
    play(); video.focus({preventScroll: true});
  }
  document.getElementById('js-watch-now').addEventListener('click', startVideo);
  document.querySelectorAll('[data-seek]').forEach(button => button.addEventListener('click', () => {
    const target = Number(button.dataset.seek);
    const jump = () => { video.currentTime = Math.max(0, target - 0.1); play(); };
    if (!started || video.readyState === 0) { video.addEventListener('loadedmetadata', jump, {once: true}); startVideo(); }
    else { if (active) finish(false); jump(); }
  }));
  const tabs = [...document.querySelectorAll('[role=tab]')];
  function selectTab(tab, focus = false) {
    for (const item of tabs) {
      const selected = item === tab;
      item.setAttribute('aria-selected', String(selected)); item.tabIndex = selected ? 0 : -1;
      item.classList.toggle('active', selected);
      const panel = document.getElementById(item.getAttribute('aria-controls'));
      panel.hidden = !selected; panel.classList.toggle('active', selected);
    }
    if (focus) tab.focus();
  }
  for (const tab of tabs) {
    tab.addEventListener('click', () => selectTab(tab));
    tab.addEventListener('keydown', event => {
      let i = tabs.indexOf(tab);
      if (event.key === 'ArrowRight') i = (i + 1) % tabs.length;
      else if (event.key === 'ArrowLeft') i = (i - 1 + tabs.length) % tabs.length;
      else if (event.key === 'Home') i = 0;
      else if (event.key === 'End') i = tabs.length - 1;
      else if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault(); selectTab(tabs[i], true);
    });
  }
  document.getElementById('ad-script-link').addEventListener('click', () => selectTab(document.getElementById('tab-transcript')));
  document.querySelector('.js-video-detail-back')?.addEventListener('click', () => location.href = '../');
  document.querySelectorAll('.detail-page-overlay[data-url]').forEach(el => {
    el.addEventListener('click', () => location.href = 'https://platform.teachingchannel.com' + el.dataset.url);
    el.addEventListener('keydown', e => { if (e.key === 'Enter') el.click(); });
  });
  document.querySelectorAll('.nav-button').forEach(el => el.addEventListener('click', () => document.querySelector('.carousel').scrollBy({left: el.classList.contains('nav-left') ? -500 : 500, behavior: 'smooth'})));
  document.querySelectorAll('[data-demo-action]').forEach(el => el.addEventListener('click', async () => {
    if (el.dataset.demoAction === 'share') {
      try { await navigator.clipboard.writeText(location.href); message('Demo link copied.'); }
      catch (_) { message('Copy this page’s address from the browser to share the demo.'); }
    } else message('This is a standalone demo. Open the Teaching Channel library to use account features.');
  }));
  window.addEventListener('pagehide', cancelSpeech);
  selectTab(tabs[0]);
  if (!supported) enabled = false;
  render();
})();
