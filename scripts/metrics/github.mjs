const GRAPHQL_ENDPOINT = 'https://api.github.com/graphql';
const REST_ENDPOINT = 'https://api.github.com';

const PROFILE_QUERY = `
  query Profile($login: String!, $since: GitTimestamp!, $from: DateTime!, $to: DateTime!) {
    user(login: $login) {
      login
      name
      createdAt
      bio
      avatarUrl
      url
      location
      company
      websiteUrl
      followers { totalCount }
      sponsors(first: 1) { totalCount }
      packages(first: 1) { totalCount }
      repositoriesContributedTo(first: 1, includeUserRepositories: false) { totalCount }
      repositories(ownerAffiliations: OWNER, privacy: PUBLIC, first: 100, orderBy: { field: UPDATED_AT, direction: DESC }) {
        totalCount
        nodes {
          name
          description
          url
          stargazerCount
          forkCount
          watchers { totalCount }
          primaryLanguage { name color }
          languages(first: 10, orderBy: { field: SIZE, direction: DESC }) {
            edges { size node { name color } }
          }
          isFork
          updatedAt
          diskUsage
          releases(first: 1) { totalCount }
          licenseInfo { spdxId }
          repositoryTopics(first: 8) { nodes { topic { name } } }
          defaultBranchRef {
            target {
              ... on Commit {
                history(first: 100, since: $since) {
                  nodes { committedDate }
                }
              }
            }
          }
        }
      }
      pinnedItems(first: 6, types: REPOSITORY) {
        nodes {
          ... on Repository {
            name
            description
            url
            stargazerCount
            primaryLanguage { name color }
          }
        }
      }
      contributionsCollection(from: $from, to: $to) {
        contributionCalendar {
          totalContributions
          weeks { contributionDays { date contributionCount } }
        }
      }
      starredRepositories(first: 100, orderBy: { field: STARRED_AT, direction: DESC }) {
        nodes {
          nameWithOwner
          repositoryTopics(first: 8) { nodes { topic { name } } }
        }
      }
    }
  }
`;

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`${response.status} ${response.statusText}: ${detail.slice(0, 300)}`);
  }
  return response.json();
}

function daysAgo(days, now) {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

async function fetchAvatar(url) {
  try {
    const response = await fetch(url, { headers: { 'User-Agent': 'the-nulldev-profile-cards' } });
    if (!response.ok) return '';
    const contentType = response.headers.get('content-type')?.split(';')[0] ?? 'image/png';
    if (!contentType.startsWith('image/')) return '';
    const image = Buffer.from(await response.arrayBuffer());
    if (image.length > 1_000_000) return '';
    return `data:${contentType};base64,${image.toString('base64')}`;
  } catch {
    return '';
  }
}

async function fetchRecentEvents(login, token) {
  try {
    const events = await requestJson(`${REST_ENDPOINT}/users/${encodeURIComponent(login)}/events/public?per_page=100`, {
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'the-nulldev-profile-cards',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    return events.map((event) => ({
      type: event.type ?? 'Activity',
      repo: event.repo?.name ?? '',
      createdAt: event.created_at ?? '',
      action: event.payload?.action ?? '',
      title: event.payload?.commits?.[0]?.message?.split('\n')[0]
        ?? event.payload?.pull_request?.title
        ?? event.payload?.issue?.title
        ?? '',
    })).slice(0, 8);
  } catch {
    return [];
  }
}

export async function fetchGitHubProfile({ login = 'the-nulldev', token = process.env.GITHUB_TOKEN, now = new Date() } = {}) {
  if (!token) throw new Error('GITHUB_TOKEN is required for live GitHub data. Use --sample to render fixture data.');

  const response = await requestJson(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'the-nulldev-profile-cards',
    },
    body: JSON.stringify({
      query: PROFILE_QUERY,
      variables: {
        login,
        since: daysAgo(90, now),
        from: daysAgo(365, now),
        to: now.toISOString(),
      },
    }),
  });
  if (response.errors?.length) throw new Error(response.errors.map((error) => error.message).join('; '));
  const user = response.data?.user;
  if (!user) throw new Error(`GitHub user not found: ${login}`);

  const repos = user.repositories.nodes ?? [];
  const languages = new Map();
  const commits = [];
  const topics = new Map();
  for (const repo of repos) {
    for (const edge of repo.languages?.edges ?? []) {
      const current = languages.get(edge.node.name) ?? { name: edge.node.name, color: edge.node.color ?? '#7fc6ff', size: 0 };
      current.size += edge.size;
      languages.set(edge.node.name, current);
    }
    for (const commit of repo.defaultBranchRef?.target?.history?.nodes ?? []) commits.push(commit.committedDate);
    for (const item of repo.repositoryTopics?.nodes ?? []) {
      const name = item.topic.name;
      topics.set(name, (topics.get(name) ?? 0) + 1);
    }
  }
  const starred = user.starredRepositories.nodes ?? [];
  for (const repo of starred) {
    for (const item of repo.repositoryTopics?.nodes ?? []) {
      const name = item.topic.name;
      topics.set(name, (topics.get(name) ?? 0) + 1);
    }
  }

  const avatarDataUri = await fetchAvatar(user.avatarUrl);
  const recentActivity = await fetchRecentEvents(user.login, token);
  const calendar = user.contributionsCollection.contributionCalendar;
  return {
    profile: {
      login: user.login,
      name: user.name || user.login,
      bio: user.bio ?? '',
      avatarDataUri,
      url: user.url,
      location: user.location ?? '',
      company: user.company ?? '',
      websiteUrl: user.websiteUrl ?? '',
      followers: user.followers.totalCount,
      createdAt: user.createdAt,
    },
    totals: {
      repositories: user.repositories.totalCount,
      stars: repos.reduce((sum, repo) => sum + repo.stargazerCount, 0),
      forks: repos.reduce((sum, repo) => sum + repo.forkCount, 0),
      watchers: repos.reduce((sum, repo) => sum + repo.watchers.totalCount, 0),
      contributions: calendar.totalContributions,
      releases: repos.reduce((sum, repo) => sum + (repo.releases?.totalCount ?? 0), 0),
      packages: user.packages?.totalCount ?? 0,
      diskUsage: repos.reduce((sum, repo) => sum + (repo.diskUsage ?? 0), 0),
      contributedTo: user.repositoriesContributedTo?.totalCount ?? 0,
      sponsors: user.sponsors?.totalCount ?? 0,
      preferredLicense: [...repos.reduce((licenses, repo) => {
        const license = repo.licenseInfo?.spdxId;
        if (license) licenses.set(license, (licenses.get(license) ?? 0) + 1);
        return licenses;
      }, new Map())].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Not specified',
    },
    repositories: repos.filter((repo) => !repo.isFork).sort((a, b) => b.stargazerCount - a.stargazerCount),
    pinned: user.pinnedItems.nodes ?? [],
    contributions: calendar.weeks.flatMap((week) => week.contributionDays),
    languages: [...languages.values()].sort((a, b) => b.size - a.size),
    commits,
    topics: [...topics].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 24),
    starredRepositories: starred.length,
    recentActivity,
  };
}
