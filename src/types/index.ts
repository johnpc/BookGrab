export interface Book {
  id: string;
  title: string;
  author: string;
  narrator?: string; // Optional for audiobooks
  format: string;
  length?: string; // Optional for audiobooks
  torrentLink: string;
  category: "audiobook" | "ebook";
  thumbnail?: string; // URL to book thumbnail
  size?: string; // Size of the torrent
  seeders?: number; // Number of seeders
  leechers?: number; // Number of leechers
  added?: string; // Date added
  tags?: string; // Tags associated with the book
  completed?: number; // Number of times completed/snatched
}

export interface SearchResponse {
  books: Book[];
  error?: string;
}

export interface TransmissionResponse {
  success: boolean;
  message: string;
  error?: string;
}
