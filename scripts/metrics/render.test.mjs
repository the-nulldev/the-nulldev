import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { renderActivity, renderLeetCode, renderProfile, renderRepositories, renderToolIcon, renderTopics } from './render.mjs';
import ICONS from './icons.json' with { type: 'json' };
import { TOOLS } from './tools.mjs';

const fixturePath = new URL('./fixtures/sample.json', import.meta.url);
const sample = JSON.parse(await readFile(fixturePath, 'utf8'));
const renderers = [
  ['profile', () => renderProfile(sample)],
  ['repositories', () => renderRepositories(sample)],
  ['activity', () => renderActivity(sample)],
  ['topics', () => renderTopics(sample)],
  ['leetcode', () => renderLeetCode(sample.leetcode)],
];

for (const [name, render] of renderers) {
  test(`${name} card is a complete SVG document`, () => {
    const svg = render();
    assert.match(svg, /^<svg\b/);
    assert.match(svg, /<title id="title">/);
    assert.match(svg, /<\/svg>$/);
    assert.doesNotMatch(svg, />(?:undefined|null)</);
  });
}

test('dynamic text is escaped before being included in SVG', () => {
  const svg = renderProfile({ profile: { name: '<script>&"' }, repositories: [] });
  assert.match(svg, /&lt;script&gt;&amp;&quot;/);
  assert.doesNotMatch(svg, /<script>/);
});

test('renderers handle empty data without throwing', () => {
  for (const [, render] of [
    ['profile', () => renderProfile({})],
    ['repositories', () => renderRepositories({})],
    ['activity', () => renderActivity({})],
    ['topics', () => renderTopics({})],
    ['leetcode', () => renderLeetCode({})],
  ]) assert.match(render(), /^<svg\b/);
});

test('the sample dashboard renders a full year of contribution cubes', () => {
  const svg = renderProfile(sample);
  const days = svg.match(/: \d+ contributions<\/title>/g) ?? [];
  assert.equal(days.length, 365);
  assert.match(svg, /viewBox="0 0 1280 720"/);
  assert.match(svg, /Contributions calendar/);
  assert.match(svg, /Current streak 2 days/);
});

test('every listed tool has a standalone SVG card', () => {
  assert.equal(TOOLS.length, 33);
  for (const tool of TOOLS) {
    const svg = renderToolIcon(tool);
    const escapedName = tool.name.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[character]));
    assert.match(svg, /^<svg\b/);
    assert.ok(svg.includes(`<title id="title">${escapedName} tool icon</title>`));
    if (tool.icon) {
      assert.ok(ICONS[tool.icon], `${tool.name} icon data is present`);
      assert.match(svg, /<path fill="#[0-9a-fA-F]{6}" d="[^"]+"\/>/);
    } else {
      assert.ok(tool.monogram, `${tool.name} has a monogram fallback`);
      assert.ok(svg.includes(tool.monogram));
    }
    assert.match(svg, /<\/svg>$/);
  }
});
