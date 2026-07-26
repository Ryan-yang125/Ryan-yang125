import { readFile, writeFile } from 'node:fs/promises';

const owner = 'Ryan-yang125';
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

if (!token) {
  throw new Error('GITHUB_TOKEN or GH_TOKEN is required');
}

const headers = {
  Accept: 'application/vnd.github+json',
  Authorization: `Bearer ${token}`,
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'Ryan-yang125-profile-updater',
};

async function githubJson(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { ...headers, ...options.headers } });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${url}`);
  }
  return response.json();
}

async function latestRelease(repo, fallback) {
  try {
    const release = await githubJson(`https://api.github.com/repos/${owner}/${repo}/releases/latest`);
    return release.tag_name || fallback;
  } catch (error) {
    console.warn(`Using fallback for ${repo}: ${error.message}`);
    return fallback;
  }
}

async function contributionCount() {
  const query = `query($login: String!) {
    user(login: $login) {
      contributionsCollection {
        contributionCalendar { totalContributions }
      }
    }
  }`;
  const data = await githubJson('https://api.github.com/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { login: owner } }),
  });
  if (data.errors?.length) throw new Error(data.errors.map(({ message }) => message).join('; '));
  return data.data.user.contributionsCollection.contributionCalendar.totalContributions;
}

function replaceMarker(markdown, marker, value) {
  const pattern = new RegExp(`(<!-- ${marker} -->).*?(<!-- \/${marker} -->)`, 's');
  if (!pattern.test(markdown)) throw new Error(`Missing README marker: ${marker}`);
  return markdown.replace(pattern, `$1${value}$2`);
}

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

const [drophere, checkhere, skillManager, contributions, chatLlm] = await Promise.all([
  latestRelease('drophere', 'v1.0.1'),
  latestRelease('checkhere', 'v0.4.0'),
  latestRelease('skill-manager', 'v0.6.0'),
  contributionCount(),
  githubJson(`https://api.github.com/repos/${owner}/ChatLLM-Web`),
]);

let readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');
readme = replaceMarker(readme, 'version:drophere', drophere);
readme = replaceMarker(readme, 'version:checkhere', checkhere);
readme = replaceMarker(readme, 'version:skill-manager', skillManager);
readme = replaceMarker(readme, 'stars:chatllm', chatLlm.stargazers_count);
await writeFile(new URL('../README.md', import.meta.url), readme);

const template = await readFile(new URL('../assets/living-terminal.template.svg', import.meta.url), 'utf8');
const svg = template
  .replaceAll('{{DROPHERE_VERSION}}', escapeXml(drophere))
  .replaceAll('{{CHECKHERE_VERSION}}', escapeXml(checkhere))
  .replaceAll('{{SKILL_MANAGER_VERSION}}', escapeXml(skillManager))
  .replaceAll('{{CONTRIBUTIONS}}', escapeXml(contributions))
  .replaceAll('{{CHATLLM_STARS}}', escapeXml(chatLlm.stargazers_count));
await writeFile(new URL('../assets/living-terminal.svg', import.meta.url), svg);

console.log(JSON.stringify({ drophere, checkhere, skillManager, contributions, chatLlmStars: chatLlm.stargazers_count }));
