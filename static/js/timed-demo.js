(() => {
const video = document.querySelector('#video');
const subtitleChoice = document.querySelector('#subtitle-choice');
const textChoice = document.querySelector('#text-choice');

textChoice.onchange = () => {
  for (const panel of document.querySelectorAll('.streams > section')) {
    panel.hidden = panel.id !== textChoice.querySelector(':checked').value;
  }
};

const exclusive = { subs: 'subs-sdh', 'subs-sdh': 'subs', us: 'uk', uk: 'us' };

function selectSubtitles() {
  for (const element of video.querySelectorAll('track[kind="subtitles"]')) {
    element.track.mode = subtitleChoice.querySelector(`[value="${element.id.slice(6)}"]`).checked ? 'showing' : 'hidden';
  }
}
subtitleChoice.onchange = event => {
  const value = event.target.value;
  if (event.target.checked) {
    for (const input of subtitleChoice.querySelectorAll('input')) {
      if (value === 'off' ? input.value !== 'off' : input.value === exclusive[value] || input.value === 'off') input.checked = false;
    }
  }
  if (!subtitleChoice.querySelector(':checked')) subtitleChoice.querySelector('[value="off"]').checked = true;
  selectSubtitles();
};

function reportError(message) {
  const output = document.querySelector('#demo-error');
  output.hidden = false;
  output.textContent = message;
}
video.addEventListener('error', () => reportError('You may need to reload the page.'));
const adParagraphStarts = {
  us: new Set(['1', '4', '5', '11', '16']),
  uk: new Set(['1', '3', '4', '7', '13']),
};

// Cues sit on the bottom edge of the letterboxed picture (1280x532 at y=94 in a 720px frame).
// Chrome ignores cue.lineAlign, so place each cue's top edge: bottom minus its rendered lines.
const PICTURE_BOTTOM = (94 + 532) / 720 * 100;
const LINE_HEIGHT = 8; // % of video height, matches video::cue in index.css
const placedCues = [];
const measure = document.createElement('canvas').getContext('2d');

function countLines(text) {
  // Browsers size cue text at 5% of the video box (index.css scales it by 4/3) and wrap at its full width.
  measure.font = `${Math.min(video.clientWidth, video.clientHeight) * 0.05 * 4 / 3}px sans-serif`;
  let lines = 0;
  for (const paragraph of text.split('\n')) {
    let current = '';
    lines++;
    for (const word of paragraph.split(' ')) {
      const candidate = current ? `${current} ${word}` : word;
      if (current && measure.measureText(candidate).width > video.clientWidth) {
        lines++;
        current = word;
      } else {
        current = candidate;
      }
    }
  }
  return lines;
}

function placeCue(cue, text) {
  cue.snapToLines = false;
  cue.line = PICTURE_BOTTOM - countLines(text) * LINE_HEIGHT;
}
new ResizeObserver(() => placedCues.forEach(({ cue, text }) => placeCue(cue, text))).observe(video);

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
    output.textContent = "You may need to reload the page.";
    reportError("You may need to reload the page.");
  };
  element.onload = () => {
    output.replaceChildren();
    let paragraph;
    const rows = Array.from(element.track.cues, cue => {
      const line = document.createElement(isAD ? 'span' : 'p');
      const text = cue.getCueAsHTML().textContent;
      if (isAD) cue.text = `<c.ad>${cue.text}</c>`;
      placedCues.push({ cue, text });
      placeCue(cue, text);
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
  for (const element of video.querySelectorAll('track[kind="subtitles"]')) {
    subtitleChoice.querySelector(`[value="${element.id.slice(6)}"]`).checked = element.track.mode === 'showing';
  }
  subtitleChoice.querySelector('[value="off"]').checked = !subtitleChoice.querySelector(':checked:not([value="off"])');
  for (const track of video.textTracks) {
    if (track.mode === 'disabled') track.mode = 'hidden';
  }
};
setupScreenplay().catch(() => {
  document.querySelector('.screenplay-text').textContent = 'You may need to reload the page.';
});

})();
