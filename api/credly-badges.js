const CREDLY_BADGES_URL = (username) =>
  `https://www.credly.com/users/${username}/badges.json`;

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const username = process.env.CREDLY_USERNAME || "imaad";

  try {
    const response = await fetch(CREDLY_BADGES_URL(username), {
      headers: {
        Accept: "application/json",
        "User-Agent": "imaad-portfolio",
      },
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: "Credly request failed" });
    }

    const payload = await response.json();
    const badges = (payload.data || [])
      .filter((badge) => badge.public && badge.state === "accepted")
      .map((badge) => {
        const template = badge.badge_template || {};
        const issuer = badge.issuer?.entities?.[0]?.entity?.name || null;

        return {
          id: badge.id,
          name: template.name || "Badge",
          image: template.image_url || null,
          issued: badge.issued_at_date || null,
          url: `https://www.credly.com/badges/${badge.id}`,
          issuer,
        };
      })
      .filter((badge) => badge.image)
      .sort((a, b) => new Date(b.issued) - new Date(a.issued));

    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
    return res.status(200).json({
      username,
      count: badges.length,
      badges,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to fetch Credly badges",
      message: error.message,
    });
  }
};
