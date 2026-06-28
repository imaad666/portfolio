const GITHUB_GRAPHQL_URL = "https://api.github.com/graphql";

const CONTRIBUTIONS_QUERY = `
  query ($login: String!) {
    user(login: $login) {
      contributionsCollection {
        contributionCalendar {
          totalContributions
          weeks {
            contributionDays {
              date
              contributionCount
              color
            }
          }
        }
      }
    }
  }
`;

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = process.env.GITHUB_TOKEN;
  const login = process.env.GITHUB_USERNAME || "imaad666";

  if (!token) {
    return res.status(503).json({
      error: "GitHub token not configured",
      message: "Add GITHUB_TOKEN to your Vercel project environment variables.",
    });
  }

  try {
    const response = await fetch(GITHUB_GRAPHQL_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "imaad-portfolio",
      },
      body: JSON.stringify({
        query: CONTRIBUTIONS_QUERY,
        variables: { login },
      }),
    });

    const payload = await response.json();

    if (!response.ok || payload.errors?.length) {
      const message = payload.errors?.[0]?.message || "GitHub API request failed";
      return res.status(response.ok ? 502 : response.status).json({ error: message });
    }

    const calendar = payload.data?.user?.contributionsCollection?.contributionCalendar;

    if (!calendar) {
      return res.status(404).json({ error: "Contribution calendar not found" });
    }

    const days = calendar.weeks.flatMap((week) => week.contributionDays);

    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
    return res.status(200).json({
      login,
      totalContributions: calendar.totalContributions,
      weeks: calendar.weeks,
      days,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to fetch GitHub contributions",
      message: error.message,
    });
  }
};
