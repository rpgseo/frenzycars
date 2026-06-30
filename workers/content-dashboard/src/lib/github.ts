const GH_API = 'https://api.github.com';

const GH_HEADERS = (token: string) => ({
  'Authorization': `Bearer ${token}`,
  'Accept': 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'frenzycars-content-dashboard/1.0',
});

export async function readGithubFile(
  token: string,
  repo: string,
  path: string
): Promise<{ content: string; sha: string } | null> {
  const res = await fetch(`${GH_API}/repos/${repo}/contents/${path}`, {
    headers: GH_HEADERS(token),
  });

  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub read error ${res.status}: ${text}`);
  }

  const data = await res.json() as { content: string; sha: string };
  const decoded = atob(data.content.replace(/\n/g, ''));
  return { content: decoded, sha: data.sha };
}

export async function writeGithubFile(
  token: string,
  repo: string,
  path: string,
  content: string,
  sha: string | null,
  message: string
): Promise<string> {
  const encoded = btoa(unescape(encodeURIComponent(content)));

  const body: Record<string, unknown> = {
    message,
    content: encoded,
  };
  if (sha) body['sha'] = sha;

  const res = await fetch(`${GH_API}/repos/${repo}/contents/${path}`, {
    method: 'PUT',
    headers: { ...GH_HEADERS(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub write error ${res.status}: ${text}`);
  }

  const data = await res.json() as { commit: { sha: string } };
  return data.commit.sha;
}
