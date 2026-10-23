const ENDPOINT = 'https://leetcode.com/graphql';

const QUERY = `
  query Profile($username: String!) {
    matchedUser(username: $username) {
      username
      submitStats {
        acSubmissionNum { difficulty count submissions }
      }
      profile { ranking }
      recentSubmissionList(num: 10) {
        title
        titleSlug
        timestamp
        statusDisplay
        lang
      }
    }
  }
`;

export async function fetchLeetCodeProfile(username = 'the-null-dev') {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (compatible; profile-card-generator/1.0)',
      Referer: 'https://leetcode.com/',
    },
    body: JSON.stringify({ query: QUERY, variables: { username } }),
  });
  if (!response.ok) throw new Error(`LeetCode returned ${response.status} ${response.statusText}`);
  const result = await response.json();
  if (result.errors?.length) throw new Error(result.errors.map((error) => error.message).join('; '));
  const user = result.data?.matchedUser;
  if (!user) throw new Error(`LeetCode user not found: ${username}`);

  const counts = Object.fromEntries((user.submitStats?.acSubmissionNum ?? []).map((item) => [item.difficulty, item.count]));
  return {
    username: user.username,
    ranking: user.profile?.ranking ?? 0,
    solved: { total: counts.All ?? 0, easy: counts.Easy ?? 0, medium: counts.Medium ?? 0, hard: counts.Hard ?? 0 },
    recent: (user.recentSubmissionList ?? []).filter((submission) => submission.statusDisplay === 'Accepted').slice(0, 6).map((submission) => ({
      title: submission.title,
      url: `https://leetcode.com/problems/${submission.titleSlug}/`,
      timestamp: Number(submission.timestamp) * 1000,
      language: submission.lang,
    })),
  };
}
