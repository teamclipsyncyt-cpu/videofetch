const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors({
  origin: "https://teamclipsyncyt-cpu.github.io"
}));

app.use(express.json());

app.get("/", (req, res) => {
  res.send("VideoFetch 2.0 Backend is running!");
});

app.get("/api/video", async (req, res) => {
  try {
    const input = req.query.url;

    if (!input) {
      return res.status(400).json({
        error: "Please provide a video URL."
      });
    }

    let url;

    try {
      url = new URL(input);
    } catch {
      return res.status(400).json({
        error: "Invalid URL."
      });
    }

    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return res.status(400).json({
        error: "Invalid protocol."
      });
    }

    const host = url.hostname.toLowerCase();

    const youtubeHosts = [
      "youtube.com",
      "www.youtube.com",
      "m.youtube.com",
      "youtu.be"
    ];

    if (
      youtubeHosts.includes(host) ||
      host.endsWith(".youtube.com")
    ) {
      let videoId = "";

      if (host === "youtu.be") {
        videoId = url.pathname.split("/")[1] || "";
      } else if (url.pathname === "/watch") {
        videoId = url.searchParams.get("v") || "";
      } else {
        const parts = url.pathname.split("/").filter(Boolean);

        if (
          ["shorts", "embed", "live"].includes(parts[0])
        ) {
          videoId = parts[1] || "";
        }
      }

      if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
        return res.status(400).json({
          error: "YouTube video ID not found."
        });
      }

      const videoUrl =
        "https://www.youtube.com/watch?v=" + videoId;

      const oembed =
        "https://www.youtube.com/oembed?url=" +
        encodeURIComponent(videoUrl) +
        "&format=json";

      const response = await fetch(oembed, {
        signal: AbortSignal.timeout(10000)
      });

      if (!response.ok) {
        return res.status(404).json({
          error: "Video information is unavailable."
        });
      }

      const data = await response.json();

      return res.json({
        platform: "YouTube",
        title: data.title,
        author: data.author_name,
        thumbnail: data.thumbnail_url,
        videoUrl: videoUrl
      });
    }

    if (
      host === "instagram.com" ||
      host.endsWith(".instagram.com")
    ) {
      return res.json({
        platform: "Instagram",
        title: "Instagram video",
        message: "Open the original Instagram post to view it.",
        videoUrl: url.href
      });
    }

    return res.status(400).json({
      error: "Currently only YouTube and Instagram links are recognized."
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Server error. Please try again."
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("VideoFetch backend running on port " + PORT);
});
