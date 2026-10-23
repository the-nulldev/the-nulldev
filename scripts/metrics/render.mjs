import ICONS from './icons.json' with { type: 'json' };
import { TOOLS } from './tools.mjs';

const COLORS = {
  bg: '#0d1117',
  panel: '#161b22',
  panelRaised: '#21262d',
  border: '#30363d',
  text: '#c9d1d9',
  muted: '#8b949e',
  blue: '#58a6ff',
  green: '#3fb950',
  yellow: '#d29922',
  red: '#f85149',
  teal: '#39c5cf',
};

const escapeXml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
}[character]));

const text = (x, y, value, size = 14, color = COLORS.text, weight = 400, anchor = 'start') =>
  `<text x="${x}" y="${y}" fill="${color}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}">${escapeXml(value)}</text>`;
const rect = (x, y, width, height, fill, radius = 12, stroke = 'none') =>
  `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" fill="${fill}" stroke="${stroke}"/>`;
const line = (x1, y1, x2, y2, color = COLORS.border) =>
  `<path d="M${x1} ${y1}H${x2}" stroke="${color}" stroke-width="1"/>`;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const short = (value, max = 38) => {
  const string = String(value ?? '');
  return string.length > max ? `${string.slice(0, max - 1)}…` : string;
};
const number = (value) => new Intl.NumberFormat('en').format(Number(value) || 0);
const byDate = (date) => new Date(date);

function svgStart(width, height, title, description) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title description"><title id="title">${escapeXml(title)}</title><desc id="description">${escapeXml(description)}</desc><rect width="100%" height="100%" fill="${COLORS.bg}"/><style>text{font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}</style>`;
}

function cardHeading(x, y, title, subtitle = '') {
  return `${text(x, y, title, 18, COLORS.blue, 600)}${subtitle ? text(x, y + 19, subtitle, 12, COLORS.muted) : ''}`;
}

function normalizeContributions(days = [], sample = false) {
  let sorted = [...days].sort((a, b) => byDate(a.date) - byDate(b.date)).slice(-371);
  if (sample) {
    const now = new Date();
    now.setUTCHours(0, 0, 0, 0);
    const byDateValue = new Map(sorted.map((day) => [day.date, day.contributionCount ?? 0]));
    sorted = [];
    for (let offset = 364; offset >= 0; offset -= 1) {
      const date = new Date(now.getTime() - offset * 86_400_000);
      const dateValue = date.toISOString().slice(0, 10);
      const pattern = (offset * 17 + (offset % 7) * 13) % 19;
      const deterministicCount = offset < 2 ? 2 : (pattern < 13 ? 0 : (pattern % 6) + 1);
      sorted.push({ date: dateValue, contributionCount: byDateValue.get(dateValue) ?? deterministicCount });
    }
  } else if (!sorted.length) {
    const now = new Date();
    for (let offset = 364; offset >= 0; offset -= 1) {
      const date = new Date(now.getTime() - offset * 86_400_000);
      sorted.push({ date: date.toISOString().slice(0, 10), contributionCount: 0 });
    }
  }
  return sorted;
}

function contributionTiles(days = [], startX = 0, startY = 0, sample = false) {
  const sorted = normalizeContributions(days, sample);
  const start = new Date(`${sorted[0].date}T00:00:00Z`);
  const entries = Array.from({ length: start.getUTCDay() }, () => null).concat(sorted);
  const weeks = [];
  for (let index = 0; index < entries.length; index += 7) weeks.push(entries.slice(index, index + 7));
  const max = Math.max(1, ...sorted.map((day) => day.contributionCount ?? 0));
  const palette = ['#e6edf3', '#b7e3c6', '#65c988', '#2da44e', '#116329'];
  const cells = [];
  weeks.forEach((week, weekIndex) => week.forEach((day, dayIndex) => {
    if (day) cells.push({ day, weekIndex, dayIndex });
  }));
  cells.sort((a, b) => a.weekIndex + a.dayIndex - b.weekIndex - b.dayIndex);
  let shapes = '';
  cells.forEach(({ day, weekIndex, dayIndex }) => {
    const count = day.contributionCount ?? 0;
    const level = count ? clamp(Math.ceil((count / max) * 4), 1, 4) : 0;
    const x = startX + weekIndex * 5.2 + dayIndex * 2.8;
    const y = startY + weekIndex * 2 - dayIndex * 5.5;
    const height = level * 2.4;
    const top = y - height;
    if (height) {
      shapes += `<polygon points="${x},${top} ${x + 6},${top - 3} ${x + 12},${top} ${x + 6},${top + 3}" fill="${palette[level]}" stroke="${COLORS.bg}" stroke-width="0.45"><title>${escapeXml(`${day.date}: ${count} contributions`)}</title></polygon>`;
      shapes += `<polygon points="${x},${top} ${x + 6},${top + 3} ${x + 6},${y + 3} ${x},${y}" fill="#2da44e" opacity="0.86"/>`;
      shapes += `<polygon points="${x + 6},${top + 3} ${x + 12},${top} ${x + 12},${y} ${x + 6},${y + 3}" fill="#116329" opacity="0.9"/>`;
    } else {
      shapes += `<polygon points="${x},${y} ${x + 6},${y - 3} ${x + 12},${y} ${x + 6},${y + 3}" fill="${palette[0]}" stroke="${COLORS.bg}" stroke-width="0.45"><title>${escapeXml(`${day.date}: 0 contributions`)}</title></polygon>`;
    }
  });
  return shapes;
}

function activityCounts(commits = []) {
  const byHour = Array(24).fill(0);
  const byWeekday = Array(7).fill(0);
  for (const timestamp of commits) {
    const date = byDate(timestamp);
    if (Number.isNaN(date.getTime())) continue;
    byHour[date.getUTCHours()] += 1;
    byWeekday[date.getUTCDay()] += 1;
  }
  return { byHour, byWeekday };
}

function languageBars(languages = [], x = 650, y = 0, width = 190, limit = 5) {
  const items = languages.slice(0, limit);
  const total = Math.max(1, items.reduce((sum, item) => sum + (item.size ?? 0), 0));
  let output = '';
  items.forEach((item, index) => {
    const rowY = y + index * 27;
    const fraction = (item.size ?? 0) / total;
    output += text(x, rowY + 10, short(item.name, 15), 10, COLORS.muted);
    output += rect(x + 72, rowY + 2, width, 7, COLORS.panelRaised, 4);
    output += rect(x + 72, rowY + 2, Math.max(3, width * fraction), 7, item.color || [COLORS.yellow, COLORS.red, COLORS.blue, COLORS.teal][index % 4], 4);
    output += text(x + width + 82, rowY + 10, `${Math.round(fraction * 100)}%`, 9, COLORS.muted, 500, 'end');
  });
  return output || text(x, y + 12, 'No language data yet', 11, COLORS.muted);
}

function toolIcon(tool, x, y, size = 20) {
  const icon = ICONS[tool.icon];
  if (icon) {
    const color = icon.hex === '000000' ? COLORS.text : `#${icon.hex}`;
    return `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 24 24" aria-label="${escapeXml(tool.name)}"><path fill="${color}" d="${escapeXml(icon.path)}"/></svg>`;
  }
  const fontSize = tool.monogram.length > 2 ? 7 : 9;
  return `<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="4" fill="${tool.color}"/><text x="${x + size / 2}" y="${y + size * 0.68}" fill="#ffffff" font-size="${fontSize}" font-weight="700" text-anchor="middle">${escapeXml(tool.monogram)}</text>`;
}

function iconTile(tool) {
  const brand = toolIcon(tool, 10, 10, 24);
  return `<rect x="1" y="1" width="162" height="42" rx="8" fill="#161b22" stroke="#30363d"/>${brand}${text(42, 27, tool.name, 11, COLORS.text, 550)}`;
}

function formatDiskUsage(kilobytes = 0) {
  const gigabytes = (Number(kilobytes) || 0) / (1024 * 1024);
  if (gigabytes >= 1) return `${gigabytes.toFixed(2)} GB used`;
  return `${(((Number(kilobytes) || 0) / 1024)).toFixed(1)} MB used`;
}

function yearsSince(createdAt) {
  if (!createdAt) return 'Joined GitHub';
  const years = Math.max(0, new Date().getFullYear() - byDate(createdAt).getFullYear());
  return `Joined GitHub ${years} ${years === 1 ? 'year' : 'years'} ago`;
}

function streakStats(days = []) {
  const counts = new Map(days.map((day) => [day.date, Number(day.contributionCount) || 0]));
  const dates = [...counts.keys()].sort();
  let best = 0;
  let run = 0;
  for (const date of dates) {
    if (counts.get(date) > 0) {
      run += 1;
      best = Math.max(best, run);
    } else run = 0;
  }
  let current = 0;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  if (!counts.get(today.toISOString().slice(0, 10))) today.setUTCDate(today.getUTCDate() - 1);
  while (counts.get(today.toISOString().slice(0, 10)) > 0) {
    current += 1;
    today.setUTCDate(today.getUTCDate() - 1);
  }
  return { current, best };
}

function stackedLanguages(languages = [], x = 0, y = 0, width = 390) {
  const items = languages.slice(0, 6);
  const total = Math.max(1, items.reduce((sum, item) => sum + (Number(item.size) || 0), 0));
  let output = '';
  let offset = 0;
  items.forEach((language, index) => {
    const segmentWidth = width * ((Number(language.size) || 0) / total);
    output += `<rect x="${x + offset}" y="${y}" width="${Math.max(0, segmentWidth)}" height="7" fill="${language.color || [COLORS.yellow, COLORS.blue, COLORS.green, COLORS.teal][index % 4]}"/>`;
    offset += segmentWidth;
  });
  items.forEach((language, index) => {
    const col = index % 3;
    const row = Math.floor(index / 3);
    const legendX = x + col * 130;
    const legendY = y + 24 + row * 17;
    output += `<circle cx="${legendX + 4}" cy="${legendY - 4}" r="3.5" fill="${language.color || COLORS.blue}"/>`;
    output += text(legendX + 15, legendY, short(language.name, 17), 10, COLORS.muted);
  });
  if (!items.length) output += text(x, y + 17, 'No language data yet', 10, COLORS.muted);
  return output;
}

export function renderProfile(data = {}) {
  const profile = data.profile ?? {};
  const totals = data.totals ?? {};
  const repositories = data.pinned?.length ? data.pinned : (data.repositories ?? []).slice(0, 2);
  const languages = data.languages ?? [];
  const commits = data.commits ?? [];
  const contributions = data.contributions ?? [];
  const solved = data.leetcode?.solved ?? {};
  const recentActivity = data.recentActivity ?? [];
  const normalizedContributions = normalizeContributions(contributions, data.sample === true);
  const streak = streakStats(normalizedContributions);
  let output = svgStart(1280, 720, 'GitHub profile dashboard', `GitHub profile overview for ${profile.login || 'the-nulldev'}`);

  output += rect(0, 0, 1280, 58, COLORS.panel, 0);
  output += text(78, 38, '◉', 27, COLORS.text, 700);
  output += text(111, 37, 'GitHub metrics', 15, COLORS.text, 600);

  if (profile.avatarDataUri) {
    output += `<clipPath id="avatar"><circle cx="204" cy="197" r="99"/></clipPath><image href="${escapeXml(profile.avatarDataUri)}" x="105" y="98" width="198" height="198" preserveAspectRatio="xMidYMid slice" clip-path="url(#avatar)"/>`;
    output += `<circle cx="204" cy="197" r="99" fill="none" stroke="${COLORS.border}" stroke-width="2"/>`;
  } else {
    output += `<circle cx="204" cy="197" r="99" fill="${COLORS.panel}" stroke="${COLORS.border}" stroke-width="2"/>`;
    output += text(204, 211, (profile.name || 'G').slice(0, 1).toUpperCase(), 58, COLORS.blue, 600, 'middle');
  }
  output += text(103, 337, profile.name || profile.login || 'GitHub profile', 23, COLORS.text, 650);
  output += text(103, 361, `@${profile.login || 'the-nulldev'}`, 14, COLORS.blue, 500);
  output += text(103, 391, short(profile.bio || 'AI Engineer · Cloud & DevOps', 32), 12, COLORS.muted);
  if (profile.websiteUrl) output += text(103, 421, short(profile.websiteUrl.replace(/^https?:\/\//, ''), 35), 12, COLORS.blue);
  if (profile.location) output += text(103, 444, short(profile.location, 35), 12, COLORS.muted);
  output += line(103, 465, 310);
  output += text(103, 493, number(totals.repositories), 19, COLORS.text, 650);
  output += text(103, 510, 'repositories', 10, COLORS.muted);
  output += text(209, 493, number(profile.followers), 19, COLORS.text, 650);
  output += text(209, 510, 'followers', 10, COLORS.muted);
  output += text(103, 548, `★ ${number(totals.stars)} stars`, 12, COLORS.muted);
  output += text(209, 548, `⑂ ${number(totals.forks)} forks`, 12, COLORS.muted);
  output += text(103, 595, 'OPEN PROFILE ↗', 11, COLORS.blue, 600);
  output += `<a href="${escapeXml(profile.url || 'https://github.com/the-nulldev')}"><rect x="96" y="570" width="220" height="42" fill="transparent"/></a>`;

  output += text(350, 88, profile.name || profile.login || 'GitHub profile', 18, COLORS.blue, 600);
  const leftStats = [
    yearsSince(profile.createdAt),
    `Followed by ${number(profile.followers)} users`,
    `${number(totals.repositories)} Repositories`,
    `Prefer ${short(totals.preferredLicense || 'license not listed', 25)} license`,
    `${number(totals.releases)} Releases`,
    `${number(totals.packages)} Packages`,
    formatDiskUsage(totals.diskUsage),
  ];
  leftStats.forEach((stat, index) => output += text(350, 114 + index * 19, stat, 11, index === 2 ? COLORS.blue : COLORS.muted));
  for (let index = 0; index < 14; index += 1) {
    const fill = index < Math.min(14, totals.contributedTo ?? 0) ? COLORS.green : COLORS.panelRaised;
    output += rect(565 + index * 12, 99, 9, 9, fill, 2);
  }
  const rightStats = [
    `Contributed to ${number(totals.contributedTo)} repositories`,
    `${number(totals.sponsors)} Sponsor${totals.sponsors === 1 ? '' : 's'}`,
    `${number(totals.stars)} Stargazers`,
    `${number(totals.forks)} Forks`,
    `${number(totals.watchers)} Watchers`,
  ];
  rightStats.forEach((stat, index) => output += text(565, 128 + index * 20, stat, 11, COLORS.muted));

  output += cardHeading(350, 270, 'Coding habits and recent activity');
  output += text(350, 292, 'Commit activity per time of day · UTC', 10, COLORS.blue);
  const { byHour, byWeekday } = activityCounts(commits);
  const maxHour = Math.max(1, ...byHour);
  byHour.forEach((count, index) => {
    const height = count ? 6 + (count / maxHour) * 37 : 3;
    const x = 351 + index * 15.5;
    const y = 363 - height;
    output += `<rect x="${x}" y="${y}" width="8" height="${height}" rx="3" fill="${count ? COLORS.green : COLORS.panelRaised}"/>`;
    if (count) output += text(x + 4, y - 3, count, 7, COLORS.muted, 400, 'middle');
    output += text(x + 4, 376, String(index).padStart(2, '0'), 6, COLORS.muted, 400, 'middle');
  });
  output += text(350, 405, 'Commit activity per day', 10, COLORS.blue);
  const maxDay = Math.max(1, ...byWeekday);
  byWeekday.forEach((count, index) => {
    const x = 351 + index * 26;
    const height = count ? 6 + (count / maxDay) * 23 : 3;
    output += `<rect x="${x}" y="${449 - height}" width="13" height="${height}" rx="3" fill="${count ? COLORS.green : COLORS.panelRaised}"/>`;
    output += text(x + 6, 456, ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][index], 7, COLORS.muted, 400, 'middle');
  });
  output += text(550, 405, 'Language activity', 10, COLORS.blue);
  output += languageBars(languages, 550, 419, 105, 3);
  output += text(350, 504, 'Mastered technologies and topics', 12, COLORS.blue, 550);
  TOOLS.forEach((tool, index) => {
    const x = 351 + (index % 8) * 47;
    const y = 520 + Math.floor(index / 8) * 29;
    output += toolIcon(tool, x, y, 21);
    output += `<title>${escapeXml(tool.name)}</title>`;
  });

  output += text(780, 88, 'LeetCode progress', 15, COLORS.blue, 600);
  const ringItems = [
    ['Total', solved.total, COLORS.blue],
    ['Easy', solved.easy, COLORS.green],
    ['Medium', solved.medium, COLORS.yellow],
    ['Hard', solved.hard, COLORS.red],
  ];
  const ringMax = Math.max(1, Number(solved.total) || 0, Number(solved.easy) || 0, Number(solved.medium) || 0, Number(solved.hard) || 0);
  ringItems.forEach(([label, value, color], index) => {
    const cx = 815 + index * 96;
    const radius = 18;
    const circumference = 2 * Math.PI * radius;
    const progress = Math.min(1, (Number(value) || 0) / ringMax);
    output += `<circle cx="${cx}" cy="128" r="${radius}" fill="none" stroke="${COLORS.panelRaised}" stroke-width="4"/>`;
    output += `<circle cx="${cx}" cy="128" r="${radius}" fill="none" stroke="${color}" stroke-width="4" stroke-dasharray="${circumference * progress} ${circumference}" transform="rotate(-90 ${cx} 128)"/>`;
    output += text(cx, 132, number(value), 9, COLORS.text, 600, 'middle');
    output += text(cx, 160, label, 9, COLORS.muted, 400, 'middle');
  });

  output += cardHeading(780, 205, 'Contributions calendar');
  output += contributionTiles(normalizedContributions, 780, 306);
  output += text(990, 236, `Current streak ${streak.current} days`, 10, COLORS.muted);
  output += text(990, 253, `Best streak ${streak.best} days`, 10, COLORS.muted);
  output += text(990, 270, `~${((Number(totals.contributions) || 0) / 365).toFixed(2)} commits per day`, 10, COLORS.muted);

  output += text(780, 425, `${number(repositories.length)} Featured repositories`, 13, COLORS.blue, 550);
  repositories.slice(0, 2).forEach((repo, index) => {
    const y = 449 + index * 32;
    output += text(782, y, short(repo.name, 34), 10, COLORS.text, 550);
    output += text(782, y + 14, short(repo.description || 'Open-source project', 52), 8, COLORS.muted);
    output += `<a href="${escapeXml(repo.url || '#')}"><rect x="778" y="${y - 12}" width="400" height="30" fill="transparent"/></a>`;
  });
  output += text(780, 510, 'Most used languages', 11, COLORS.blue);
  output += stackedLanguages(languages, 780, 521, 395);
  output += text(780, 587, 'Latest activity', 11, COLORS.blue);
  recentActivity.slice(0, 3).forEach((event, index) => {
    const y = 609 + index * 25;
    output += `<circle cx="784" cy="${y - 3}" r="3" fill="${index % 2 ? COLORS.teal : COLORS.green}"/>`;
    output += text(793, y, short(event.title || event.type, 56), 9, COLORS.text);
    output += text(793, y + 12, `${event.type} · ${event.repo}`, 7, COLORS.muted);
  });
  if (!recentActivity.length) output += text(780, 610, 'No recent public activity available', 9, COLORS.muted);
  return `${output}</svg>`;
}

export function renderToolIcon(tool) {
  const title = `${tool.name} tool icon`;
  return `${svgStart(164, 44, title, `${tool.name} icon card in ${tool.category} tools`)}${iconTile(tool)}</svg>`;
}

export function renderRepositories(data = {}) {
  const repos = data.pinned?.length ? data.pinned : (data.repositories ?? []).slice(0, 8);
  let output = svgStart(1000, Math.max(260, 130 + repos.length * 104), 'Featured repositories', 'Pinned GitHub repositories and project details');
  output += text(34, 48, 'Featured repositories', 23, COLORS.text, 650);
  output += text(34, 73, 'Pinned projects from GitHub', 12, COLORS.muted);
  repos.slice(0, 8).forEach((repo, index) => {
    const x = 30 + (index % 2) * 475;
    const y = 96 + Math.floor(index / 2) * 104;
    output += rect(x, y, 450, 88, COLORS.panel, 14, COLORS.border);
    output += text(x + 20, y + 27, short(repo.name, 39), 15, COLORS.blue, 600);
    output += text(x + 20, y + 50, short(repo.description || 'Open-source project', 56), 11, COLORS.muted);
    output += text(x + 20, y + 72, `★ ${number(repo.stargazerCount)}     ${repo.primaryLanguage?.name || 'Code'}`, 10, COLORS.text, 500);
    output += `<a href="${escapeXml(repo.url || '#')}"><rect x="${x}" y="${y}" width="450" height="88" fill="transparent"/></a>`;
  });
  if (!repos.length) output += text(34, 130, 'No pinned repositories found yet.', 13, COLORS.muted);
  return `${output}</svg>`;
}

export function renderActivity(data = {}) {
  const events = data.recentActivity ?? [];
  let output = svgStart(1000, Math.max(260, 130 + events.length * 62), 'Recent GitHub activity', 'Recent public events from GitHub');
  output += text(34, 48, 'Recent activity', 23, COLORS.text, 650);
  output += text(34, 73, 'Latest public events', 12, COLORS.muted);
  events.slice(0, 8).forEach((event, index) => {
    const y = 105 + index * 62;
    output += `<circle cx="48" cy="${y + 8}" r="5" fill="${index % 2 ? COLORS.teal : COLORS.green}"/>`;
    output += text(66, y + 5, short(event.title || event.type, 76), 13, COLORS.text, 500);
    output += text(66, y + 27, `${event.type}  ·  ${event.repo}`, 10, COLORS.muted);
    output += text(966, y + 8, event.createdAt ? byDate(event.createdAt).toISOString().slice(0, 10) : '', 10, COLORS.muted, 400, 'end');
    if (index < events.length - 1) output += line(66, y + 44, 966);
  });
  if (!events.length) output += text(34, 125, 'No public activity was available for this refresh.', 13, COLORS.muted);
  return `${output}</svg>`;
}

export function renderTopics(data = {}) {
  const topics = data.topics ?? [];
  let output = svgStart(1000, 360, 'Topics and technologies', 'GitHub topics from repositories and starred projects');
  output += text(34, 48, 'Topics & technologies', 23, COLORS.text, 650);
  output += text(34, 73, 'What I build with and follow', 12, COLORS.muted);
  topics.slice(0, 24).forEach((topic, index) => {
    const col = index % 4;
    const row = Math.floor(index / 4);
    const x = 32 + col * 242;
    const y = 100 + row * 40;
    output += rect(x, y, 222, 29, COLORS.panel, 14, COLORS.border);
    output += `<circle cx="${x + 15}" cy="${y + 14}" r="4" fill="${[COLORS.blue, COLORS.green, COLORS.teal, COLORS.yellow][index % 4]}"/>`;
    output += text(x + 29, y + 19, short(topic.name, 24), 11, COLORS.text, 500);
    output += text(x + 205, y + 19, number(topic.count), 9, COLORS.muted, 400, 'end');
  });
  if (!topics.length) output += text(34, 125, 'No repository topics were found.', 13, COLORS.muted);
  return `${output}</svg>`;
}

export function renderLeetCode(data = {}) {
  const solved = data.solved ?? {};
  const recent = data.recent ?? [];
  let output = svgStart(1000, 360, 'LeetCode progress', 'Solved problem totals and recent accepted submissions');
  output += text(34, 48, 'LeetCode progress', 23, COLORS.text, 650);
  output += text(34, 73, `@${data.username || 'the-null-dev'} · ranking ${number(data.ranking)}`, 12, COLORS.muted);
  output += rect(32, 96, 936, 94, COLORS.panel, 14);
  const metrics = [
    ['Total solved', solved.total, COLORS.blue],
    ['Easy', solved.easy, COLORS.green],
    ['Medium', solved.medium, COLORS.yellow],
    ['Hard', solved.hard, COLORS.red],
  ];
  metrics.forEach(([label, value, color], index) => {
    const x = 64 + index * 225;
    output += text(x, 139, number(value), 25, color, 650);
    output += text(x, 164, label, 11, COLORS.muted);
  });
  output += cardHeading(34, 229, 'Recent accepted submissions');
  recent.slice(0, 4).forEach((submission, index) => {
    const x = 34 + (index % 2) * 470;
    const y = 255 + Math.floor(index / 2) * 43;
    output += text(x, y, short(submission.title, 43), 12, COLORS.text, 500);
    output += text(x, y + 18, submission.language || 'Accepted', 10, COLORS.muted);
    output += `<a href="${escapeXml(submission.url || 'https://leetcode.com/')}"><rect x="${x - 2}" y="${y - 14}" width="450" height="36" fill="transparent"/></a>`;
  });
  if (!recent.length) output += text(34, 275, 'No recent accepted submissions returned.', 11, COLORS.muted);
  return `${output}</svg>`;
}
