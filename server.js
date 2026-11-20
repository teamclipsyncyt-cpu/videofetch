const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 10000;
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

app.use(cors({ origin: "https://teamclipsyncyt-cpu.github.io" }));
app.use(express.json());

app.get("/", (req, res) => {
  res.send("VideoFetch 2.1 Backend is running!");
});

function getYouTubeVideoId(input) {
  let url;
  try {
    url = new URL(input);
  } catch {
    return null;
  }

  if (!["http:", "https:"].includes(url.protocol)) return null;

  const host = url.hostname.toLowerCase();
  let id = "";

  if (host === "youtu.be") {
    id = url.pathname.split("/").filter(Boolean)[0] || "";
  } else if (
    ["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com"].includes(host) ||
    host.endsWith(".youtube.com")
  ) {
    if (url.pathname === "/watch") {
      id = url.searchParams.get("v") || "";
    } else {
      const parts = url.pathname.split("/").filter(Boolean);
      if (["shorts", "embed", "live"].includes(parts[0])) {
        id = parts[1] || "";
      }
    }
  } else {
    return null;
  }

  return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
}

// YouTube basic title and thumbnail
app.get("/api/video", async (req, res) => {
  try {
    let parsedUrl;

    try {
      parsedUrl = new URL(req.query.url);
    } catch {
      return res.status(400).json({ error: "Invalid URL." });
    }

    const parsedHost = parsedUrl.hostname.toLowerCase();

    if (parsedHost === "instagram.com" || parsedHost.endsWith(".instagram.com")) {
      return res.json({
        platform: "Instagram",
        title: "Instagram video",
        message: "Open the original Instagram post to view it.",
        videoUrl: parsedUrl.href
      });
    }

    const videoId = getYouTubeVideoId(req.query.url);

    if (!videoId) {
      return res.status(400).json({ error: "Valid YouTube video URL required." });
    }

    const videoUrl = "https://www.youtube.com/watch?v=" + videoId;

    const response = await fetch(
      "https://www.youtube.com/oembed?url=" +
      encodeURIComponent(videoUrl) +
      "&format=json"
    );

    if (!response.ok) {
      return res.status(404).json({ error: "Video information is unavailable." });
    }

    const data = await response.json();

    return res.json({
      platform: "YouTube",
      title: data.title,
      author: data.author_name,
      thumbnail: data.thumbnail_url,
      videoUrl
    });

  } catch (error) {
    console.error("/api/video error:", error);
    return res.status(500).json({ error: "Server error. Please try again." });
  }
});

// YouTube detailed information
app.get("/api/youtube-details", async (req, res) => {
  try {
    if (!YOUTUBE_API_KEY) {
      return res.status(503).json({
        error: "YouTube API key is not configured on the backend yet."
      });
    }

    const videoId = getYouTubeVideoId(req.query.url);

    if (!videoId) {
      return res.status(400).json({
        error: "Please enter a valid YouTube video link."
      });
    }

    const apiUrl = new URL("https://www.googleapis.com/youtube/v3/videos");

    apiUrl.searchParams.set("part", "snippet,statistics,contentDetails");
    apiUrl.searchParams.set("id", videoId);
    apiUrl.searchParams.set("key", YOUTUBE_API_KEY);

    const response = await fetch(apiUrl);
    const result = await response.json();

    if (!response.ok) {
      console.error("YouTube API response:", result);

      const reason = result?.error?.errors?.[0]?.reason;

      if (reason === "quotaExceeded") {
        return res.status(429).json({
          error: "YouTube API daily quota is used up. Please try again tomorrow."
        });
      }

      return res.status(502).json({
        error: "YouTube API could not return details. Check the API key and API settings."
      });
    }

    if (!result.items || result.items.length === 0) {
      return res.status(404).json({
        error: "Video not found, private, deleted, or unavailable."
      });
    }

    const item = result.items[0];
    const snippet = item.snippet || {};
    const stats = item.statistics || {};
    const content = item.contentDetails || {};
    const thumbs = snippet.thumbnails || {};

    const thumbnail = (
      thumbs.maxres ||
      thumbs.standard ||
      thumbs.high ||
      thumbs.medium ||
      thumbs.default ||
      {}
    ).url || null;

    return res.json({
      videoId,
      videoUrl: "https://www.youtube.com/watch?v=" + videoId,
      title: snippet.title || "",
      channelTitle: snippet.channelTitle || "",
      thumbnail,
      viewCount: stats.viewCount ?? null,
      likeCount: stats.likeCount ?? null,
      commentCount: stats.commentCount ?? null,
      duration: content.duration || null,
      publishedAt: snippet.publishedAt || null,
      description: snippet.description || "",
      tags: Array.isArray(snippet.tags) ? snippet.tags : []
    });

  } catch (error) {
    console.error("/api/youtube-details error:", error);

    return res.status(500).json({
      error: "Server error while getting YouTube details."
    });
  }
});

// Instagram recognition
app.get("/api/instagram", (req, res) => {
  try {
    const url = new URL(req.query.url);

    if (
      url.hostname !== "instagram.com" &&
      !url.hostname.endsWith(".instagram.com")
    ) {
      return res.status(400).json({
        error: "Valid Instagram URL required."
      });
    }

    return res.json({
      platform: "Instagram",
      title: "Instagram video",
      message: "Open the original Instagram post to view it.",
      videoUrl: url.href
    });

  } catch {
    return res.status(400).json({ error: "Invalid Instagram URL." });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("VideoFetch backend running on port " + PORT);
});
