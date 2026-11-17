const crypto = require("crypto");

const ACCREDIBLE_API = "https://api.accredible.com";
const ACCREDIBLE_HMAC_KEY = "chtM@CyP_.7iF.kuQXBv";
const WALLET_PATH = (username) =>
  `/v1/credential-net/users/${encodeURIComponent(username)}/user_wallet`;

function signedHeaders(method, path) {
  const timestamp = Math.round(Date.now() / 1000).toString();
  const pathOnly = path.split("?")[0];
  const message = `${method} ${pathOnly} HTTP/1.1 ${timestamp}`;
  const signature = crypto
    .createHmac("sha256", ACCREDIBLE_HMAC_KEY)
    .update(message)
    .digest("hex");

  return {
    Accept: "application/json",
    "X-Timestamp": timestamp,
    "X-Signature": signature,
  };
}

function imageFromDesign(design) {
  if (!design) return null;

  const svg = design.svg || "";
  const match =
    svg.match(/xlink:href="([^"]+)"/i) ||
    svg.match(/href="(https:\/\/[^"]+)"/i);
  if (match) return match[1];

  return design.background || design.rasterized_content_url || null;
}

function normalizeCredential(credential) {
  const group = credential.group || {};
  const isBadge = Boolean(credential["badge?"] || group.badge_design);
  const image =
    imageFromDesign(group.badge_design) ||
    imageFromDesign(group.certificate_design) ||
    credential.opengraph_image ||
    credential.twittercard_image ||
    null;

  if (!image) return null;

  return {
    id: `accredible-${credential.uuid || credential.id}`,
    name: credential.name || "Credential",
    image,
    issued: credential.issued_on || credential.published_on || null,
    url: credential.url || `https://www.credential.net/${credential.uuid}`,
    issuer: credential.issuer?.name || null,
    source: "accredible",
    kind: isBadge ? "badge" : "certificate",
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const username = process.env.ACCREDIBLE_USERNAME || "imaadirshad800668";
  const path = WALLET_PATH(username);

  try {
    const response = await fetch(`${ACCREDIBLE_API}${path}`, {
      headers: signedHeaders("GET", path),
    });

    if (!response.ok) {
      return res.status(response.status).json({
        error: "Accredible wallet request failed",
      });
    }

    const payload = await response.json();
    const profile = payload.data || {};
    const badges = (profile.credentials || [])
      .filter((credential) => credential && !credential.private && !credential.expired)
      .map(normalizeCredential)
      .filter(Boolean)
      .sort((a, b) => new Date(b.issued || 0) - new Date(a.issued || 0));

    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
    return res.status(200).json({
      username,
      count: badges.length,
      wallet: `https://www.credential.net/profile/${username}/wallet`,
      badges,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to fetch Accredible badges",
      message: error.message,
    });
  }
};
