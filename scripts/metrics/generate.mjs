import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchGitHubProfile } from './github.mjs';
import { fetchLeetCodeProfile } from './leetcode.mjs';
import { renderActivity, renderLeetCode, renderProfile, renderRepositories, renderToolIcon, renderTopics } from './render.mjs';
import { TOOLS } from './tools.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const outputDirectory = resolve(root, 'metrics');
const toolOutputDirectory = resolve(outputDirectory, 'tools');
const samplePath = resolve(dirname(fileURLToPath(import.meta.url)), 'fixtures/sample.json');
const isSample = process.argv.includes('--sample');

async function saveCard(fileName, render) {
  try {
    const content = render();
    await writeFile(resolve(outputDirectory, fileName), content, 'utf8');
    console.log(`Updated metrics/${fileName}`);
  } catch (error) {
    console.error(`Could not update metrics/${fileName}: ${error.message}`);
  }
}

await mkdir(outputDirectory, { recursive: true });
await mkdir(toolOutputDirectory, { recursive: true });
let profileData;
if (isSample) {
  profileData = JSON.parse(await readFile(samplePath, 'utf8'));
  console.log('Rendering sample fixture data (offline).');
} else {
  profileData = await fetchGitHubProfile();
  try {
    profileData.leetcode = await fetchLeetCodeProfile();
  } catch (error) {
    console.warn(`LeetCode data unavailable; keeping the previous card: ${error.message}`);
  }
}

const cards = [
  ['profile.svg', () => renderProfile(profileData)],
  ['repositories.svg', () => renderRepositories(profileData)],
  ['activity.svg', () => renderActivity(profileData)],
  ['topics.svg', () => renderTopics(profileData)],
];
for (const [fileName, render] of cards) await saveCard(fileName, render);

for (const tool of TOOLS) {
  await saveCard(`tools/${tool.slug}.svg`, () => renderToolIcon(tool));
}

if (profileData.leetcode) {
  await saveCard('leetcode.svg', () => renderLeetCode(profileData.leetcode));
} else if (isSample) {
  const fixture = JSON.parse(await readFile(samplePath, 'utf8'));
  await saveCard('leetcode.svg', () => renderLeetCode(fixture.leetcode));
}
