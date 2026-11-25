"use client";

import Link from "next/link";
import { BookIcon, GearIcon } from "./icons";

interface AppHeaderProps {
  onOpenSettings: () => void;
  onHome: () => void;
}

export default function AppHeader({ onOpenSettings, onHome }: AppHeaderProps) {
  return (
    <header className="app-header" data-testid="app-header">
      <div className="container app-header__inner">
        <Link
          className="brand"
          href="/"
          onClick={(event) => {
            event.preventDefault();
            onHome();
          }}
          aria-label="BookGrab home"
        >
          <span className="brand__logo">
            <BookIcon />
          </span>
          <span>
            <span className="brand__title" style={{ display: "block" }}>
              BookGrab
            </span>
            <span className="brand__subtitle" style={{ display: "block" }}>
              Find &amp; download books
            </span>
          </span>
        </Link>

        <button
          type="button"
          className="icon-button"
          onClick={onOpenSettings}
          aria-label="Settings"
          data-testid="open-settings"
        >
          <GearIcon />
        </button>
      </div>
    </header>
  );
}
