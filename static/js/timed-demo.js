(() => {
const video = document.querySelector('#video');
const subtitleChoice = document.querySelector('#subtitle-choice');
const textChoice = document.querySelector('#text-choice');

textChoice.onchange = () => {
  for (const panel of document.querySelectorAll('.streams > section')) {
    panel.hidden = panel.id !== textChoice.querySelector(':checked').value;
  }
};

function selectSubtitles() {
  for (const element of video.querySelectorAll('track[kind="subtitles"]')) {
    element.track.mode = element.id === `track-${subtitleChoice.querySelector(':checked').value}` ? 'showing' : 'hidden';
  }
}
subtitleChoice.onchange = selectSubtitles;

function reportError(message) {
  const output = document.querySelector('#demo-error');
  output.hidden = false;
  output.textContent += `${message} `;
}
video.addEventListener('error', () => reportError('The video could not be loaded. Please reload the page.'));
const adParagraphStarts = {
  us: new Set(['1', '4', '5', '11', '16']),
  uk: new Set(['1', '3', '4', '7', '13']),
};

function setupTrack(id) {
  const output = document.querySelector(`#${id} .transcript`);
  const isAD = id === 'us' || id === 'uk';
  const element = document.createElement('track');
  element.id = `track-${id}`;
  element.kind = 'subtitles';
  element.srclang = 'en';
  element.label = document.querySelector(`#${id} h2`).textContent;
  element.src = `static/data/${id}.vtt`;
  element.onerror = () => {
    output.textContent = "This transcript could not be loaded.";
    reportError(`Could not load ${element.label}. Please reload the page.`);
  };
  element.onload = () => {
    output.replaceChildren();
    let paragraph;
    const rows = Array.from(element.track.cues, cue => {
      const line = document.createElement(isAD ? 'span' : 'p');
      const text = cue.getCueAsHTML().textContent;
      line.textContent = isAD ? text.replace(/\s*\n\s*/g, ' ') : text;
      if (isAD) {
        if (!paragraph || adParagraphStarts[id].has(cue.id)) {
          paragraph = document.createElement('p');
          output.append(paragraph);
        } else {
          paragraph.append(' ');
        }
        paragraph.append(line);
      } else {
        output.append(line);
      }
      return { cue, line };
    });

    let lastTarget;
    function render(forceScroll = false) {
      const active = new Set(element.track.activeCues);
      for (const { cue, line } of rows) {
        line.classList.toggle('active', active.has(cue));
      }
      const target = rows.find(row => active.has(row.cue))
        || rows.findLast(row => row.cue.startTime <= video.currentTime)
        || rows[0];
      if (target && (forceScroll || target !== lastTarget)) {
        output.scrollTop = target.line.offsetTop - output.clientHeight / 3;
        lastTarget = target;
      }
    }
    element.track.oncuechange = () => render();
    video.addEventListener('seeked', () => render());
    textChoice.addEventListener('change', () => render(true));
    render();
  };
  video.append(element);
  element.track.mode = 'hidden';
}

async function setupScreenplay() {
  const output = document.querySelector('.screenplay-text');
  const response = await fetch('static/data/screenplay.xml');
  if (!response.ok) throw new Error('Screenplay request failed');
  const xml = await response.text();
  const screenplay = new DOMParser().parseFromString(`<screenplay>${xml}</screenplay>`, 'application/xml');
  if (screenplay.querySelector('parsererror')) throw new Error('Invalid screenplay XML');
  output.replaceChildren();
  for (const scene of screenplay.documentElement.children) {
    const section = document.createElement('section');
    section.className = 'screenplay-scene';
    for (const block of scene.children) {
      const paragraph = document.createElement(block.tagName === 'stage_direction' ? 'h3' : 'p');
      paragraph.className = block.tagName;
      paragraph.textContent = block.textContent;
      section.append(paragraph);
    }
    output.append(section);
  }
}

['us', 'uk', 'subs', 'subs-sdh'].forEach(setupTrack);
selectSubtitles();
video.textTracks.onchange = () => {
  const showing = [...video.querySelectorAll('track[kind="subtitles"]')]
    .find(element => element.track.mode === 'showing');
  const selected = showing ? showing.id.slice(6) : 'off';
  subtitleChoice.querySelector(`[value="${selected}"]`).checked = true;
  for (const track of video.textTracks) {
    if (track.mode === 'disabled') track.mode = 'hidden';
  }
};
setupScreenplay().catch(() => {
  document.querySelector('.screenplay-text').textContent = 'The screenplay could not be loaded. Please reload the page.';
});

})();
