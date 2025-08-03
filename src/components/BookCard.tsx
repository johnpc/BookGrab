"use client";

import { useState } from "react";
import { Book } from "@/types";
import Image from "next/image";
import {
  Card,
  Flex,
  Text,
  Button,
  Badge,
  Heading,
  Divider,
  useTheme,
  View,
  Alert,
} from "@aws-amplify/ui-react";

interface BookCardProps {
  book: Book;
}

export default function BookCard({ book }: BookCardProps) {
  const [isGrabbing, setIsGrabbing] = useState(false);
  const [grabStatus, setGrabStatus] = useState<"idle" | "success" | "error">(
    "idle",
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const { tokens } = useTheme();

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

  // Format date to a more readable format
  const formattedDate = book.added
    ? new Date(book.added).toLocaleDateString()
    : null;

  return (
    <Card variation="elevated" padding="medium" height="100%">
      <Flex direction={{ base: "column", medium: "row" }} gap="medium">
        {/* Thumbnail */}
        {/* <View
          width={{ base: '100%', medium: '128px' }}
          height={{ base: '160px', medium: '176px' }}
          position="relative"
          borderRadius="medium"
          overflow="hidden"
          backgroundColor={tokens.colors.background.secondary}
        >
          {book.thumbnail ? (
            <Image
              src={`/api/image-proxy?url=${encodeURIComponent(book.thumbnail)}`}
              alt={book.title}
              fill
              style={{ objectFit: 'cover' }}
              sizes="(max-width: 640px) 100vw, 128px"
              unoptimized={true} // Skip Next.js image optimization for external images
            />
          ) : (
            <Flex
              width="100%"
              height="100%"
              alignItems="center"
              justifyContent="center"
              color={tokens.colors.font.secondary}
            >
              {book.category === 'audiobook' ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              )}
            </Flex>
          )}
        </View> */}

        {/* Book Info */}
        <Flex direction="column" flex="1">
          <Heading level={3} fontSize="large" marginBottom="xxs">
            {book.title}
          </Heading>
          <Text
            fontSize="small"
            color={tokens.colors.font.secondary}
            marginBottom="small"
          >
            by {book.author}
            {book.narrator && book.category === "audiobook" && (
              <>
                <br />
                narrated by {book.narrator}
              </>
            )}
          </Text>

          <Flex wrap="wrap" gap="xs" marginBottom="medium">
            <Badge
              variation={book.category === "audiobook" ? "info" : "success"}
              size="small"
            >
              {book.category === "audiobook" ? "🎧 Audiobook" : "📚 Ebook"}
            </Badge>
            <Badge variation="warning" size="small">
              {book.format}
            </Badge>
            {book.length && (
              <Badge variation="default" size="small">
                ⏱️ {book.length}
              </Badge>
            )}
          </Flex>

          {/* Subtle MyAnonyMouse link */}
          <Text fontSize="xs" marginBottom="medium">
            <a
              href={`https://www.myanonamouse.net/t/${book.id}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: tokens.colors.font.secondary.value,
                textDecoration: "none",
                opacity: 0.7,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = "1";
                e.currentTarget.style.textDecoration = "underline";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = "0.7";
                e.currentTarget.style.textDecoration = "none";
              }}
            >
              View on MyAnonyMouse ↗
            </a>
          </Text>

          {/* Stats Row */}
          <Flex alignItems="center" gap="small" marginTop="auto">
            {book.size && (
              <Text fontSize="xs" color={tokens.colors.font.secondary}>
                {book.size}
              </Text>
            )}
            <Flex alignItems="center">
              <Text color="green" fontSize="xs" marginRight="xxs">
                ▲
              </Text>
              <Text fontSize="xs" color={tokens.colors.font.secondary}>
                {book.seeders}
              </Text>
            </Flex>
            <Flex alignItems="center">
              <Text color="red" fontSize="xs" marginRight="xxs">
                ▼
              </Text>
              <Text fontSize="xs" color={tokens.colors.font.secondary}>
                {book.leechers}
              </Text>
            </Flex>
            {book.completed !== undefined && (
              <Flex alignItems="center">
                <Text fontSize="xs" color={tokens.colors.font.secondary}>
                  ✓ {book.completed}
                </Text>
              </Flex>
            )}
          </Flex>
        </Flex>
      </Flex>

      {/* Expandable Details */}
      <Flex direction="column" marginTop="small">
        <Button
          onClick={() => setShowDetails(!showDetails)}
          variation="link"
          size="small"
          gap="xxs"
        >
          {showDetails ? "Hide details" : "Show details"}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            style={{
              transform: showDetails ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.2s ease",
            }}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </Button>

        {showDetails && (
          <Flex
            direction="column"
            marginTop="xs"
            fontSize="xs"
            color={tokens.colors.font.secondary}
          >
            {formattedDate && <Text>Added: {formattedDate}</Text>}
            {book.tags && <Text>Tags: {book.tags}</Text>}
          </Flex>
        )}
      </Flex>

      <Divider marginTop="medium" marginBottom="medium" />

      {/* Action Buttons */}
      <Flex direction="column" gap="small">
        {grabStatus === "success" && (
          <Alert variation="success" isDismissible={false} hasIcon={true}>
            Added to Transmission!
          </Alert>
        )}

        {grabStatus === "error" && (
          <Alert variation="error" isDismissible={false} hasIcon={true}>
            {errorMessage || "Failed to add torrent"}
          </Alert>
        )}

        <Button
          onClick={handleGrab}
          isDisabled={isGrabbing || grabStatus === "success"}
          variation={grabStatus === "success" ? "primary" : undefined}
          // variation='primary'
          colorTheme={grabStatus === "success" ? "success" : "success"}
          isLoading={isGrabbing}
          loadingText="Grabbing..."
          width="100%"
        >
          {grabStatus === "success" ? "Grabbed!" : "Grab"}
        </Button>
      </Flex>
    </Card>
  );
}
