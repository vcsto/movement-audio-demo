(() => {
  'use strict';
  const video = document.querySelector('#myVideo video');
  const shell = document.getElementById('myVideo');
  const status = document.getElementById('ad-status');
  const tabs = [...document.querySelectorAll('[role=tab]')];
  let started = false;
  function selectTab(tab, focus = false) {
    tabs.forEach(item => {
      const selected = item === tab;
      item.setAttribute('aria-selected', String(selected));
      item.tabIndex = selected ? 0 : -1;
      item.classList.toggle('active', selected);
      const panel = document.getElementById(item.getAttribute('aria-controls'));
      panel.hidden = !selected; panel.classList.toggle('active', selected);
    });
    if (focus) tab.focus();
  }
  tabs.forEach(tab => {
    tab.addEventListener('click', () => selectTab(tab));
    tab.addEventListener('keydown', event => {
      let index = tabs.indexOf(tab);
      if (event.key === 'ArrowRight') index = (index + 1) % tabs.length;
      else if (event.key === 'ArrowLeft') index = (index - 1 + tabs.length) % tabs.length;
      else if (event.key === 'Home') index = 0;
      else if (event.key === 'End') index = tabs.length - 1;
      else if (!['Enter', ' '].includes(event.key)) return;
      event.preventDefault(); selectTab(tabs[index], true);
    });
  });
  function prepareVideo() {
    if (started) return;
    started = true;
    // A transcript jump prepares a paused player before its first play event.
    lessonPlayer.hasStarted(true);
    lessonPlayer.userActive(true);
    shell.classList.add('ad-started');
    shell.querySelector('.vjs-poster')?.setAttribute('hidden', '');
    document.querySelector('.tc-video-detail-overlay').classList.add('ad-started');
    video.tabIndex = 0;
  }
  document.getElementById('js-watch-now').addEventListener('click', () => {
    prepareVideo();
    video.play().catch(() => status.textContent = 'Use the video Play button to begin.');
    video.focus({preventScroll: true});
  });
  document.querySelectorAll('[data-review-time]').forEach(button => button.addEventListener('click', () => {
    const seek = () => { video.dispatchEvent(new Event('description-review')); video.currentTime = Number(button.dataset.reviewTime); video.pause(); };
    if (video.readyState === 0) {
      video.addEventListener('loadedmetadata', seek, {once: true}); prepareVideo();
    } else { prepareVideo(); seek(); }
    shell.scrollIntoView({behavior: 'instant', block: 'center'});
    video.focus({preventScroll: true});
    status.textContent = 'Paused at ' + button.textContent + ' for review. Press Play to continue with your selected audio-description setting.';
  }));
  video.addEventListener('ended', () => status.textContent = 'End of the six-minute excerpt.');
  video.addEventListener('error', () => status.textContent = 'The local video could not load. Please reload the page.');
  document.getElementById('ad-script-link').addEventListener('click', () => selectTab(document.getElementById('tab-transcript')));
  document.querySelector('.js-video-detail-back')?.addEventListener('click', () => { video.dispatchEvent(new Event('description-review')); video.pause(); selectTab(document.getElementById('tab-description')); });
  document.querySelectorAll('[data-demo-action]').forEach(button => button.addEventListener('click', () => {
    status.textContent = 'Local preview: account and sharing features are available on the Teaching Channel website.';
  }));
  document.querySelectorAll('.detail-page-overlay[data-url]').forEach(link => {
    link.addEventListener('click', () => location.href = 'https://platform.teachingchannel.com' + link.dataset.url);
    link.addEventListener('keydown', e => { if (e.key === 'Enter') link.click(); });
  });
  document.querySelectorAll('.nav-button').forEach(button => button.addEventListener('click', () => {
    document.querySelector('.carousel').scrollBy({left: button.classList.contains('nav-left') ? -500 : 500, behavior: 'smooth'});
  }));
  selectTab(document.getElementById('tab-transcript'));
})();
