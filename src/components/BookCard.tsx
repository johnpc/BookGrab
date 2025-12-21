"use client";

import { useState } from "react";
import { Book } from "@/types";

export default function BookCard({ book }: { book: Book }) {
  const [isGrabbing, setIsGrabbing] = useState(false);
  const [grabStatus, setGrabStatus] = useState<"idle" | "success" | "error">(
    "idle",
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [showDetails, setShowDetails] = useState(false);

  const handleGrab = async () => {
    setIsGrabbing(true);
    setGrabStatus("idle");
    setErrorMessage("");

    try {
      const response = await fetch("/api/grab", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          torrentUrl: book.torrentLink,
          category: book.category,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to grab book");
      }

      setGrabStatus("success");
    } catch (error) {
      console.error("Error grabbing book:", error);
      setGrabStatus("error");
      setErrorMessage(
        error instanceof Error ? error.message : "Unknown error occurred",
      );
    } finally {
      setIsGrabbing(false);
    }
  };

  const formattedDate = book.added
    ? new Date(book.added).toLocaleDateString()
    : null;

  return (
    <div style={{
      background: "#1e293b",
      border: "1px solid #334155",
      borderRadius: "12px",
      padding: "16px",
      display: "flex",
      flexDirection: "column",
      gap: "12px"
    }}>
      {/* Header: Type badge + Format + Size */}
      <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
        <span style={{
          padding: "4px 10px",
          borderRadius: "6px",
          fontSize: "12px",
          fontWeight: "600",
          background: book.category === "audiobook" ? "#1e3a8a" : "#065f46",
          color: book.category === "audiobook" ? "#93c5fd" : "#6ee7b7"
        }}>
          {book.category === "audiobook" ? "Audiobook" : "Ebook"}
        </span>
        <span style={{
          padding: "4px 10px",
          borderRadius: "6px",
          fontSize: "12px",
          fontWeight: "600",
          background: "#374151",
          color: "#d1d5db"
        }}>
          {book.format.toUpperCase()}
        </span>
        {book.size && (
          <span style={{
            marginLeft: "auto",
            fontSize: "13px",
            color: "#94a3b8",
            fontWeight: "500"
          }}>
            {book.size}
          </span>
        )}
      </div>

      {/* Title */}
      <h3 style={{
        fontSize: "17px",
        fontWeight: "700",
        color: "#f1f5f9",
        margin: 0,
        lineHeight: "1.4"
      }}>
        <a
          href={`https://www.myanonamouse.net/t/${book.id}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "inherit", textDecoration: "none" }}
        >
          {book.title}
        </a>
      </h3>

      {/* Author & Narrator */}
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <p style={{ fontSize: "14px", color: "#94a3b8", margin: 0 }}>
          by <span style={{ color: "#cbd5e1" }}>{book.author}</span>
        </p>
        {book.narrator && book.category === "audiobook" && (
          <p style={{ fontSize: "13px", color: "#64748b", margin: 0 }}>
            Narrated by {book.narrator}
          </p>
        )}
      </div>

      {/* Length if available */}
      {book.length && (
        <p style={{ fontSize: "13px", color: "#64748b", margin: 0 }}>
          Duration: {book.length}
        </p>
      )}

      {/* Stats - Clear labels */}
      <div style={{
        display: "flex",
        gap: "20px",
        padding: "12px 0",
        borderTop: "1px solid #334155",
        borderBottom: "1px solid #334155"
      }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <span style={{ fontSize: "18px", fontWeight: "700", color: "#22c55e" }}>
            {book.seeders}
          </span>
          <span style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>Seeders</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <span style={{ fontSize: "18px", fontWeight: "700", color: "#f87171" }}>
            {book.leechers}
          </span>
          <span style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>Leechers</span>
        </div>
        {book.completed !== undefined && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <span style={{ fontSize: "18px", fontWeight: "700", color: "#94a3b8" }}>
              {book.completed}
            </span>
            <span style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>Downloads</span>
          </div>
        )}
      </div>

      {/* Expandable Details */}
      {(formattedDate || book.tags) && (
        <button
          onClick={() => setShowDetails(!showDetails)}
          style={{
            background: "none",
            border: "none",
            color: "#64748b",
            cursor: "pointer",
            fontSize: "13px",
            fontWeight: "500",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
            padding: "6px 0"
          }}
        >
          {showDetails ? "Hide details" : "More details"}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            style={{ transform: showDetails ? "rotate(180deg)" : "rotate(0deg)" }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      )}

      {showDetails && (
        <div style={{
          padding: "12px",
          background: "#0f172a",
          borderRadius: "8px",
          fontSize: "13px",
          color: "#94a3b8",
          display: "flex",
          flexDirection: "column",
          gap: "6px"
        }}>
          {formattedDate && <div>Added: {formattedDate}</div>}
          {book.tags && <div>Tags: {book.tags}</div>}
        </div>
      )}

      {/* Status Messages */}
      {grabStatus === "success" && (
        <div style={{
          padding: "12px",
          background: "#065f46",
          borderRadius: "8px",
          color: "#6ee7b7",
          fontSize: "14px",
          fontWeight: "600",
          textAlign: "center"
        }}>
          Added to Transmission!
        </div>
      )}

      {grabStatus === "error" && (
        <div style={{
          padding: "12px",
          background: "#7f1d1d",
          borderRadius: "8px",
          color: "#fca5a5",
          fontSize: "14px",
          fontWeight: "600",
          textAlign: "center"
        }}>
          {errorMessage || "Failed to add torrent"}
        </div>
      )}

      {/* Download Button */}
      <button
        onClick={handleGrab}
        disabled={isGrabbing || grabStatus === "success"}
        style={{
          width: "100%",
          padding: "14px",
          background: grabStatus === "success" ? "#059669" : "#3b82f6",
          border: "none",
          borderRadius: "8px",
          color: "white",
          fontSize: "15px",
          fontWeight: "700",
          cursor: isGrabbing || grabStatus === "success" ? "not-allowed" : "pointer",
          opacity: isGrabbing || grabStatus === "success" ? 0.7 : 1
        }}
      >
        {isGrabbing ? "Downloading..." : grabStatus === "success" ? "Downloaded!" : "Download"}
      </button>
    </div>
  );
}
