/**
 * Vercel Serverless Function
 * File: /api/peminjaman.js
 *
 * Set environment variable in Vercel:
 * GAS_API_URL = https://script.google.com/macros/s/XXXXX/exec
 *
 * Frontend calls /api/peminjaman, while this server-side function
 * fetches Google Apps Script.
 */

export default async function handler(req, res) {
  const gasUrl = process.env.GAS_API_URL;

  if (!gasUrl) {
    return res.status(500).json({
      success: false,
      message: "Environment variable GAS_API_URL belum diatur di Vercel."
    });
  }

  try {
    const separator = gasUrl.includes("?") ? "&" : "?";
    const response = await fetch(`${gasUrl}${separator}action=json`, {
      method: "GET",
      headers: {
        "Accept": "application/json"
      },
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`Google Apps Script HTTP ${response.status}`);
    }

    const data = await response.json();

    res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=60");
    return res.status(200).json(data);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Gagal mengambil data dari Google Apps Script."
    });
  }
}
