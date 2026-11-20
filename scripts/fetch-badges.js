#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const https = require("https");
const http = require("http");

const MANIFEST_PATH = path.resolve(__dirname, "../assets/badges/manifest.json");
const IMAGES_DIR = path.resolve(__dirname, "../assets/badges");

class CredlyFetcher {
  static BADGES_URL = (username) =>
    `https://www.credly.com/users/${username}/badges.json`;

  static async fetch(username) {
    const url = CredlyFetcher.BADGES_URL(username);
    const response = await HttpClient.getJson(url, {
      Accept: "application/json",
      "User-Agent": "imaad-portfolio-badge-sync",
    });

    const badges = (response.data || [])
      .filter((badge) => badge.public && badge.state === "accepted")
      .map((badge) => {
        const template = badge.badge_template || {};
        const issuer = badge.issuer?.entities?.[0]?.entity?.name || null;

        return {
          id: `credly-${badge.id}`,
          name: template.name || "Badge",
          imageUrl: template.image_url || null,
          issued: badge.issued_at_date || null,
          url: `https://www.credly.com/badges/${badge.id}`,
          issuer,
          source: "credly",
        };
      })
      .filter((badge) => badge.imageUrl);

    return badges;
  }
}

class AccredibleFetcher {
  static API_BASE = "https://api.accredible.com";
  static HMAC_KEY = "chtM@CyP_.7iF.kuQXBv";

  static walletPath(username) {
    return `/v1/credential-net/users/${encodeURIComponent(username)}/user_wallet`;
  }

  static signedHeaders(method, urlPath) {
    const timestamp = Math.round(Date.now() / 1000).toString();
    const pathOnly = urlPath.split("?")[0];
    const message = `${method} ${pathOnly} HTTP/1.1 ${timestamp}`;
    const signature = crypto
      .createHmac("sha256", AccredibleFetcher.HMAC_KEY)
      .update(message)
      .digest("hex");

    return {
      Accept: "application/json",
      "X-Timestamp": timestamp,
      "X-Signature": signature,
    };
  }

  static imageFromDesign(design) {
    if (!design) return null;

    const svg = design.svg || "";
    const match =
      svg.match(/xlink:href="([^"]+)"/i) ||
      svg.match(/href="(https:\/\/[^"]+)"/i);
    if (match) return match[1];

    return design.background || design.rasterized_content_url || null;
  }

  static async fetch(username) {
    const urlPath = AccredibleFetcher.walletPath(username);
    const url = `${AccredibleFetcher.API_BASE}${urlPath}`;
    const headers = AccredibleFetcher.signedHeaders("GET", urlPath);

    const response = await HttpClient.getJson(url, headers);

    const profile = response.data || {};
    const badges = (profile.credentials || [])
      .filter((cred) => cred && !cred.private && !cred.expired)
      .map((cred) => {
        const group = cred.group || {};
        const isBadge = Boolean(cred["badge?"] || group.badge_design);
        const image =
          AccredibleFetcher.imageFromDesign(group.badge_design) ||
          AccredibleFetcher.imageFromDesign(group.certificate_design) ||
          cred.opengraph_image ||
          cred.twittercard_image ||
          null;

        if (!image) return null;

        return {
          id: `accredible-${cred.uuid || cred.id}`,
          name: cred.name || "Credential",
          imageUrl: image,
          issued: cred.issued_on || cred.published_on || null,
          url: cred.url || `https://www.credential.net/${cred.uuid}`,
          issuer: cred.issuer?.name || null,
          source: "accredible",
          kind: isBadge ? "badge" : "certificate",
        };
      })
      .filter(Boolean);

    return badges;
  }
}

class HttpClient {
  static getJson(url, headers = {}) {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const client = parsedUrl.protocol === "https:" ? https : http;

      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === "https:" ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: "GET",
        headers,
      };

      const req = client.request(options, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            reject(
              new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`)
            );
            return;
          }
          try {
            resolve(JSON.parse(data));
          } catch (err) {
            reject(new Error(`Invalid JSON: ${err.message}`));
          }
        });
      });

      req.on("error", reject);
      req.setTimeout(30000, () => {
        req.destroy();
        reject(new Error("Request timeout"));
      });
      req.end();
    });
  }

  static downloadFile(url, destPath) {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const client = parsedUrl.protocol === "https:" ? https : http;

      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === "https:" ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: "GET",
        headers: {
          "User-Agent": "imaad-portfolio-badge-sync",
        },
      };

      const makeRequest = (reqUrl, redirectCount = 0) => {
        if (redirectCount > 5) {
          reject(new Error("Too many redirects"));
          return;
        }

        const reqParsed = new URL(reqUrl);
        const reqClient = reqParsed.protocol === "https:" ? https : http;
        const reqOpts = {
          hostname: reqParsed.hostname,
          port: reqParsed.port || (reqParsed.protocol === "https:" ? 443 : 80),
          path: reqParsed.pathname + reqParsed.search,
          method: "GET",
          headers: {
            "User-Agent": "imaad-portfolio-badge-sync",
          },
        };

        const req = reqClient.request(reqOpts, (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            const redirectUrl = res.headers.location.startsWith("http")
              ? res.headers.location
              : new URL(res.headers.location, reqUrl).toString();
            makeRequest(redirectUrl, redirectCount + 1);
            return;
          }

          if (res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error(`HTTP ${res.statusCode} downloading ${url}`));
            return;
          }

          const file = fs.createWriteStream(destPath);
          res.pipe(file);
          file.on("finish", () => {
            file.close();
            resolve();
          });
          file.on("error", (err) => {
            fs.unlink(destPath, () => {});
            reject(err);
          });
        });

        req.on("error", reject);
        req.setTimeout(60000, () => {
          req.destroy();
          reject(new Error("Download timeout"));
        });
        req.end();
      };

      makeRequest(url);
    });
  }
}

class ImageManager {
  static getExtension(url) {
    const pathname = new URL(url).pathname.toLowerCase();
    if (pathname.endsWith(".png")) return ".png";
    if (pathname.endsWith(".jpg") || pathname.endsWith(".jpeg")) return ".jpg";
    if (pathname.endsWith(".webp")) return ".webp";
    if (pathname.endsWith(".svg")) return ".svg";
    if (pathname.endsWith(".gif")) return ".gif";
    return ".png";
  }

  static sanitizeFilename(name) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 50);
  }

  static async downloadBadgeImage(badge) {
    const ext = ImageManager.getExtension(badge.imageUrl);
    const baseName = ImageManager.sanitizeFilename(badge.name);
    const filename = `${badge.source}-${baseName}${ext}`;
    const destPath = path.join(IMAGES_DIR, filename);

    try {
      await HttpClient.downloadFile(badge.imageUrl, destPath);
      return filename;
    } catch (err) {
      console.error(`Failed to download image for ${badge.name}: ${err.message}`);
      return null;
    }
  }
}

class ManifestManager {
  static read() {
    try {
      const content = fs.readFileSync(MANIFEST_PATH, "utf8");
      return JSON.parse(content);
    } catch {
      return { badges: [], lastUpdated: null };
    }
  }

  static write(manifest) {
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n");
  }

  static hasChanges(oldManifest, newBadges) {
    const oldIds = new Set(oldManifest.badges.map((b) => b.id));
    const newIds = new Set(newBadges.map((b) => b.id));

    if (oldIds.size !== newIds.size) return true;

    for (const id of newIds) {
      if (!oldIds.has(id)) return true;
    }

    for (const newBadge of newBadges) {
      const oldBadge = oldManifest.badges.find((b) => b.id === newBadge.id);
      if (!oldBadge) return true;
      if (
        oldBadge.name !== newBadge.name ||
        oldBadge.url !== newBadge.url ||
        oldBadge.issuer !== newBadge.issuer ||
        oldBadge.issued !== newBadge.issued
      ) {
        return true;
      }
    }

    return false;
  }

  static cleanupOrphanedImages(currentImages, keepImages) {
    const keepSet = new Set(keepImages);
    for (const file of currentImages) {
      if (!keepSet.has(file) && file !== "manifest.json") {
        const filePath = path.join(IMAGES_DIR, file);
        try {
          fs.unlinkSync(filePath);
          console.log(`Removed orphaned image: ${file}`);
        } catch {
          // Ignore errors
        }
      }
    }
  }
}

class BadgeFetcher {
  static async run() {
    const credlyUser = process.env.CREDLY_USERNAME || "imaad";
    const accredibleUser = process.env.ACCREDIBLE_USERNAME || "imaadirshad800668";

    console.log(`Fetching badges for Credly user: ${credlyUser}`);
    console.log(`Fetching badges for Accredible user: ${accredibleUser}`);

    const results = await Promise.allSettled([
      CredlyFetcher.fetch(credlyUser),
      AccredibleFetcher.fetch(accredibleUser),
    ]);

    const allBadges = [];
    for (const result of results) {
      if (result.status === "fulfilled") {
        allBadges.push(...result.value);
      } else {
        console.error(`Fetch error: ${result.reason.message}`);
      }
    }

    if (allBadges.length === 0) {
      console.error("No badges fetched from any source");
      process.exit(1);
    }

    const seen = new Set();
    const uniqueBadges = allBadges.filter((badge) => {
      const key = `${badge.name}|${badge.imageUrl}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    uniqueBadges.sort((a, b) => {
      const dateA = a.issued ? new Date(a.issued) : new Date(0);
      const dateB = b.issued ? new Date(b.issued) : new Date(0);
      return dateB - dateA;
    });

    console.log(`Fetched ${uniqueBadges.length} unique badges`);

    const oldManifest = ManifestManager.read();
    const hasChanges = ManifestManager.hasChanges(oldManifest, uniqueBadges);

    if (!hasChanges && process.env.FORCE_UPDATE !== "true") {
      console.log("No changes detected, skipping update");
      console.log("::set-output name=changed::false");
      return;
    }

    console.log("Changes detected, downloading images...");

    const downloadedImages = [];
    for (const badge of uniqueBadges) {
      const filename = await ImageManager.downloadBadgeImage(badge);
      if (filename) {
        badge.image = `assets/badges/${filename}`;
        downloadedImages.push(filename);
        console.log(`Downloaded: ${filename}`);
      } else {
        badge.image = badge.imageUrl;
      }
      delete badge.imageUrl;
    }

    const existingFiles = fs.existsSync(IMAGES_DIR)
      ? fs.readdirSync(IMAGES_DIR)
      : [];
    ManifestManager.cleanupOrphanedImages(existingFiles, [
      ...downloadedImages,
      "manifest.json",
    ]);

    const manifest = {
      lastUpdated: new Date().toISOString(),
      count: uniqueBadges.length,
      badges: uniqueBadges,
    };

    ManifestManager.write(manifest);
    console.log(`Manifest written with ${uniqueBadges.length} badges`);

    if (process.env.GITHUB_OUTPUT) {
      fs.appendFileSync(process.env.GITHUB_OUTPUT, "changed=true\n");
    } else {
      console.log("::set-output name=changed::true");
    }
  }
}

if (require.main === module) {
  BadgeFetcher.run().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
}

module.exports = { BadgeFetcher, CredlyFetcher, AccredibleFetcher };
