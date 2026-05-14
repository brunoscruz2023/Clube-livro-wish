import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/books/:isbn", async (req, res) => {
    const { isbn } = req.params;
    const cleanIsbn = isbn.replace(/[^0-9X]/gi, "");
    const apiKey = process.env.BOOKS_API_KEY;

    try {
      // 1. Try Google Books API
      const googleUrl = `https://www.googleapis.com/books/v1/volumes?q=isbn:${cleanIsbn}${apiKey ? `&key=${apiKey}` : ""}`;
      const googleResponse = await fetch(googleUrl);
      const googleData = await googleResponse.json();

      if (googleData.totalItems > 0) {
        return res.json({ source: "google", data: googleData });
      }

      // 2. Fallback: OpenLibrary
      const olUrl = `https://openlibrary.org/api/books?bibkeys=ISBN:${cleanIsbn}&format=json&jscmd=data`;
      const olResponse = await fetch(olUrl);
      const olData = await olResponse.json();

      return res.json({ source: "openlibrary", data: olData });
    } catch (error) {
      console.error("Error fetching book details:", error);
      res.status(500).json({ error: "Failed to fetch book details" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
