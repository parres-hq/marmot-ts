import {
  getDisplayName,
  getProfilePicture,
  normalizeToPubkey,
  ProfileContent,
} from "applesauce-core/helpers";
import { ProfilePointer } from "applesauce-core/helpers/pointers";
import { PrimalCache } from "applesauce-extra";
import {
  KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useObservableMemo } from "../../hooks/use-observable";
import { eventStore } from "../../lib/nostr";

/** Create a hook for loading a users profile */
function useProfile(user: ProfilePointer): ProfileContent | undefined {
  return useObservableMemo(
    () => eventStore.profile(user),
    [user.pubkey, user.relays?.join("|")],
  );
}

interface SearchResult {
  pubkey: string;
}

function SearchResultItem({
  pubkey,
  isHighlighted,
  onSelect,
  onMouseEnter,
}: {
  pubkey: string;
  isHighlighted: boolean;
  onSelect: (pubkey: string) => void;
  onMouseEnter: () => void;
}) {
  const profile = useProfile({ pubkey });

  const displayName = getDisplayName(profile, pubkey.slice(0, 8) + "...");
  const picture = getProfilePicture(
    profile,
    `https://robohash.org/${pubkey}.png`,
  );

  return (
    <li
      role="option"
      aria-selected={isHighlighted}
      className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors ${
        isHighlighted ? "bg-base-200" : "hover:bg-base-200"
      }`}
      onClick={() => onSelect(pubkey)}
      onMouseEnter={onMouseEnter}
    >
      <div className="avatar">
        <div className="w-10 h-10 rounded-full">
          <img src={picture} alt={displayName} />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{displayName}</div>
        <div className="text-sm text-base-content/60 font-mono truncate">
          {pubkey.slice(0, 16)}...
        </div>
      </div>
    </li>
  );
}

export default function UserSearch({
  onSelect,
  className,
  placeholder = "Search for a user...",
}: {
  onSelect: (pubkey: string) => void;
  className?: string;
  placeholder?: string;
}) {
  const [inputValue, setInputValue] = useState("");
  const [isValidPubkey, setIsValidPubkey] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const changeRef = useRef(onSelect);
  changeRef.current = onSelect;

  // Create PrimalCache instance
  const primal = useMemo(() => new PrimalCache(), []);

  // Cleanup PrimalCache on unmount
  useEffect(() => {
    return () => {
      primal.close();
    };
  }, [primal]);

  // Search function
  const performSearch = useCallback(
    async (query: string) => {
      if (!query.trim() || query.length < 2) {
        setSearchResults([]);
        setIsOpen(false);
        return;
      }

      setIsSearching(true);

      try {
        const events = await primal.userSearch(query.trim(), 10);

        // Add events to store
        for (const event of events) {
          eventStore.add(event);
        }

        // Convert to search results (deduplicated)
        const seenPubkeys = new Set<string>();
        const results: SearchResult[] = [];
        for (const event of events) {
          if (seenPubkeys.has(event.pubkey)) continue;
          seenPubkeys.add(event.pubkey);
          results.push({ pubkey: event.pubkey });
        }

        setSearchResults(results);
        setIsOpen(results.length > 0);
        setHighlightedIndex(-1);
      } catch (error) {
        console.error("Search failed:", error);
        setSearchResults([]);
        setIsOpen(false);
      } finally {
        setIsSearching(false);
      }
    },
    [primal],
  );

  // Debounced search effect
  useEffect(() => {
    // Don't search if input is a valid pubkey
    if (isValidPubkey) {
      setSearchResults([]);
      setIsOpen(false);
      return;
    }

    const debounceTimer = setTimeout(() => {
      performSearch(inputValue);
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [inputValue, isValidPubkey, performSearch]);

  // Validate pubkey when input changes
  useEffect(() => {
    if (!inputValue.trim()) {
      setIsValidPubkey(false);
      return;
    }

    try {
      const normalizedPubkey = normalizeToPubkey(inputValue.trim());
      if (normalizedPubkey) {
        setIsValidPubkey(true);
        changeRef.current(normalizedPubkey);
      } else {
        setIsValidPubkey(false);
      }
    } catch {
      setIsValidPubkey(false);
    }
  }, [inputValue]);

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = useCallback((pubkey: string) => {
    setInputValue(pubkey);
    setIsOpen(false);
    setHighlightedIndex(-1);
    changeRef.current(pubkey);
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (!isOpen || searchResults.length === 0) {
        // Allow opening results on arrow down even if closed
        if (event.key === "ArrowDown" && searchResults.length > 0) {
          event.preventDefault();
          setIsOpen(true);
          setHighlightedIndex(0);
        }
        return;
      }

      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          setHighlightedIndex((prev) =>
            prev < searchResults.length - 1 ? prev + 1 : 0,
          );
          break;

        case "ArrowUp":
          event.preventDefault();
          setHighlightedIndex((prev) =>
            prev > 0 ? prev - 1 : searchResults.length - 1,
          );
          break;

        case "Enter":
          event.preventDefault();
          if (
            highlightedIndex >= 0 &&
            highlightedIndex < searchResults.length
          ) {
            handleSelect(searchResults[highlightedIndex].pubkey);
          }
          break;

        case "Escape":
          event.preventDefault();
          setIsOpen(false);
          setHighlightedIndex(-1);
          break;

        case "Tab":
          setIsOpen(false);
          setHighlightedIndex(-1);
          break;
      }
    },
    [isOpen, searchResults, highlightedIndex, handleSelect],
  );

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listboxRef.current) {
      const highlightedElement = listboxRef.current.children[
        highlightedIndex
      ] as HTMLElement;
      highlightedElement?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex]);

  const listboxId = "pubkey-picker-listbox";

  return (
    <div ref={containerRef} className={`relative w-full ${className ?? ""}`}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (searchResults.length > 0 && !isValidPubkey) {
              setIsOpen(true);
            }
          }}
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-controls={listboxId}
          aria-activedescendant={
            highlightedIndex >= 0
              ? `pubkey-option-${highlightedIndex}`
              : undefined
          }
          aria-autocomplete="list"
          className={`input input-bordered w-full pr-10 ${
            inputValue.trim() && !isValidPubkey
              ? "input-warning"
              : isValidPubkey
                ? "input-success"
                : ""
          }`}
        />

        {/* Loading indicator */}
        {isSearching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <span className="loading loading-spinner loading-sm"></span>
          </div>
        )}

        {/* Success indicator */}
        {!isSearching && isValidPubkey && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-success">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        )}
      </div>

      {/* Popover dropdown */}
      {isOpen && searchResults.length > 0 && (
        <div className="absolute z-50 w-full mt-1">
          <ul
            ref={listboxRef}
            id={listboxId}
            role="listbox"
            aria-label="Search results"
            className="bg-base-100 rounded-lg shadow-lg border border-base-300 max-h-80 overflow-y-auto"
          >
            {searchResults.map((result, index) => (
              <SearchResultItem
                key={result.pubkey}
                pubkey={result.pubkey}
                isHighlighted={index === highlightedIndex}
                onSelect={handleSelect}
                onMouseEnter={() => setHighlightedIndex(index)}
              />
            ))}
          </ul>
        </div>
      )}

      {/* Helper text */}
      {inputValue.trim() && !isValidPubkey && !isOpen && !isSearching && (
        <label className="label pt-1 pb-0">
          <span className="label-text-alt text-base-content/60">
            Type to search or enter a valid pubkey/npub
          </span>
        </label>
      )}
    </div>
  );
}
