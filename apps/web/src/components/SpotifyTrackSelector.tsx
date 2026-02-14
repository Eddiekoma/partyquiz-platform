"use client";

import { useState, useCallback, useEffect } from "react";
import Image from "next/image";

// ============================================
// TYPES
// ============================================

interface SpotifyTrack {
  id: string;
  name: string;
  artists: { id?: string; name: string }[];
  album: {
    id?: string;
    name: string;
    images: { url: string; height?: number; width?: number }[];
    release_date: string;
  };
  duration_ms?: number;
  uri?: string;
}

interface SpotifyAlbum {
  id: string;
  name: string;
  artists: { id?: string; name: string }[];
  images: { url: string }[];
  release_date: string;
  total_tracks: number;
  album_type?: string;
}

interface SpotifyPlaylistItem {
  id: string;
  name: string;
  description?: string | null;
  image: string | null;
  trackCount: number;
  owner: string;
}

interface SpotifyArtist {
  id: string;
  name: string;
  genres: string[];
  images: { url: string; height?: number; width?: number }[];
  popularity: number;
  followers: number;
}

interface SpotifyTrackSelectorProps {
  onSelect: (track: SpotifyTrack) => void;
  selectedTrack?: SpotifyTrack | null;
}

// ============================================
// TABS - 8 ways to find music
// ============================================

type TabKey = "search" | "playlists" | "top" | "saved" | "artists" | "recent" | "new" | "discover";

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: "search", label: "Zoeken", icon: "🔍" },
  { key: "playlists", label: "Lijsten", icon: "📂" },
  { key: "top", label: "Top", icon: "⭐" },
  { key: "saved", label: "Liked", icon: "💚" },
  { key: "artists", label: "Artiesten", icon: "🎤" },
  { key: "recent", label: "Recent", icon: "🕐" },
  { key: "new", label: "Nieuw", icon: "🆕" },
  { key: "discover", label: "Ontdek", icon: "🎲" },
];

const GENRE_PRESETS = [
  "pop", "rock", "hip-hop", "electronic", "dance", "r-n-b", "latin",
  "jazz", "classical", "metal", "indie", "folk", "country", "reggae",
  "blues", "soul", "funk", "punk", "disco", "house", "techno",
  "ambient", "alternative", "k-pop", "afrobeat", "ska",
];

// ============================================
// SMALL SHARED COMPONENTS
// ============================================

function TrackItem({
  track,
  isSelected,
  onSelect,
  extra,
}: {
  track: SpotifyTrack;
  isSelected: boolean;
  onSelect: () => void;
  extra?: string;
}) {
  const albumImage = track.album.images?.[2] || track.album.images?.[0];
  const year = track.album.release_date
    ? new Date(track.album.release_date).getFullYear()
    : "";

  return (
    <div
      className={`flex items-center gap-3 p-3 border rounded-lg transition-colors cursor-pointer ${
        isSelected
          ? "border-green-500 bg-green-900/30"
          : "border-slate-700 hover:border-blue-400 hover:bg-slate-700/50"
      }`}
      onClick={onSelect}
    >
      {albumImage && (
        <Image
          src={albumImage.url}
          alt={track.album.name}
          width={48}
          height={48}
          className="rounded shadow-sm flex-shrink-0"
        />
      )}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-white truncate">{track.name}</p>
        <p className="text-sm text-slate-400 truncate">
          {track.artists.map((a) => a.name).join(", ")}
        </p>
        <p className="text-xs text-slate-500 truncate">
          {track.album.name}
          {year ? ` · ${year}` : ""}
          {track.duration_ms
            ? ` · ${Math.floor(track.duration_ms / 60000)}:${String(
                Math.floor((track.duration_ms % 60000) / 1000)
              ).padStart(2, "0")}`
            : ""}
          {extra ? ` · ${extra}` : ""}
        </p>
      </div>
      {isSelected && (
        <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
          <span className="text-white text-xs">✓</span>
        </div>
      )}
    </div>
  );
}

function TrackList({
  tracks,
  selectedTrack,
  onSelect,
}: {
  tracks: SpotifyTrack[];
  selectedTrack?: SpotifyTrack | null;
  onSelect: (track: SpotifyTrack) => void;
}) {
  return (
    <div className="space-y-2 max-h-96 overflow-y-auto">
      {tracks.map((track, idx) => (
        <TrackItem
          key={`${track.id}-${idx}`}
          track={track}
          isSelected={selectedTrack?.id === track.id}
          onSelect={() => onSelect(track)}
        />
      ))}
    </div>
  );
}

function AlbumCard({
  album,
  onClick,
}: {
  album: SpotifyAlbum;
  onClick: () => void;
}) {
  const image = album.images?.[1] || album.images?.[0];
  const year = album.release_date ? new Date(album.release_date).getFullYear() : "";
  return (
    <div
      className="flex items-center gap-3 p-3 border border-slate-700 rounded-lg hover:border-blue-400 hover:bg-slate-700/50 cursor-pointer transition-colors"
      onClick={onClick}
    >
      {image && (
        <Image src={image.url} alt={album.name} width={48} height={48} className="rounded shadow-sm" />
      )}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-white truncate">{album.name}</p>
        <p className="text-sm text-slate-400 truncate">
          {album.artists.map((a) => a.name).join(", ")}
          {year ? ` · ${year}` : ""}
        </p>
        <p className="text-xs text-slate-500">
          {album.album_type || "album"} · {album.total_tracks} nummers
        </p>
      </div>
      <span className="text-slate-500 text-sm">→</span>
    </div>
  );
}

function ArtistCard({
  artist,
  onClick,
}: {
  artist: SpotifyArtist;
  onClick: () => void;
}) {
  const image = artist.images?.[2] || artist.images?.[0];
  const hasGenres = artist.genres && artist.genres.length > 0;
  return (
    <div
      className="flex items-center gap-3 p-3 border border-slate-700 rounded-lg hover:border-purple-400 hover:bg-slate-700/50 cursor-pointer transition-colors"
      onClick={onClick}
    >
      {image ? (
        <Image src={image.url} alt={artist.name} width={48} height={48} className="rounded-full shadow-sm" />
      ) : (
        <div className="w-12 h-12 bg-slate-700 rounded-full flex items-center justify-center text-xl">🎤</div>
      )}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-white truncate">{artist.name}</p>
        {hasGenres && (
          <p className="text-sm text-slate-400 truncate">
            {artist.genres!.slice(0, 3).join(", ")}
          </p>
        )}
        {(artist.followers && artist.followers > 0) || (artist.popularity && artist.popularity > 0) ? (
          <p className="text-xs text-slate-500">
            {artist.followers && artist.followers > 0 ? `${(artist.followers / 1000).toFixed(0)}K volgers` : ""}
            {artist.popularity && artist.popularity > 0 ? ` · ★ ${artist.popularity}` : ""}
          </p>
        ) : null}
      </div>
      <span className="text-slate-500 text-sm">→</span>
    </div>
  );
}

function LoadingState({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center py-8 text-slate-400">
      <div className="animate-spin w-5 h-5 border-2 border-slate-600 border-t-blue-500 rounded-full mr-3" />
      <p className="text-sm">{text}</p>
    </div>
  );
}

function EmptyState({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="text-center py-8 text-slate-400">
      <p className="text-4xl mb-2">{icon}</p>
      <p className="text-sm">{text}</p>
    </div>
  );
}

function BackButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1">
      ← {label}
    </button>
  );
}

function SectionHeader({ icon, label, count }: { icon: string; label: string; count?: number }) {
  return (
    <p className="text-sm font-medium text-slate-300">
      {icon} {label}{count != null ? ` (${count})` : ""}
    </p>
  );
}

// ============================================
// ALBUM DRILL-DOWN (reusable)
// ============================================

function AlbumDrillDown({
  album, tracks, loading, selectedTrack, onSelect, onBack, backLabel,
}: {
  album: SpotifyAlbum;
  tracks: SpotifyTrack[];
  loading: boolean;
  selectedTrack?: SpotifyTrack | null;
  onSelect: (track: SpotifyTrack) => void;
  onBack: () => void;
  backLabel: string;
}) {
  return (
    <div className="space-y-3">
      <BackButton label={backLabel} onClick={onBack} />
      <div className="flex items-center gap-3 p-3 bg-slate-800 rounded-lg border border-slate-700">
        {album.images?.[0] && (
          <Image src={album.images[0].url} alt={album.name} width={56} height={56} className="rounded shadow-md" />
        )}
        <div>
          <p className="font-semibold text-white">{album.name}</p>
          <p className="text-sm text-slate-400">
            {album.artists.map((a) => a.name).join(", ")}
            {album.release_date ? ` · ${new Date(album.release_date).getFullYear()}` : ""}
            {` · ${album.total_tracks} nummers`}
          </p>
        </div>
      </div>
      {loading ? <LoadingState text="Album laden..." /> : (
        <TrackList tracks={tracks} selectedTrack={selectedTrack} onSelect={onSelect} />
      )}
    </div>
  );
}

// ============================================
// ARTIST DRILL-DOWN (reusable)
// ============================================

function ArtistDrillDown({
  artist, topTracks, albums, relatedArtists, loading, selectedTrack,
  onSelect, onBack, onAlbumClick, onRelatedArtistClick, backLabel,
  topTracksTotal, albumsTotal, relatedTotal, loadingMore,
  onLoadMoreTracks, onLoadMoreAlbums, onLoadMoreRelated,
}: {
  artist: SpotifyArtist;
  topTracks: SpotifyTrack[];
  albums: SpotifyAlbum[];
  relatedArtists: SpotifyArtist[];
  loading: boolean;
  selectedTrack?: SpotifyTrack | null;
  onSelect: (track: SpotifyTrack) => void;
  onBack: () => void;
  onAlbumClick: (album: SpotifyAlbum) => void;
  onRelatedArtistClick: (artist: SpotifyArtist) => void;
  backLabel: string;
  topTracksTotal?: number;
  albumsTotal?: number;
  relatedTotal?: number;
  loadingMore?: boolean;
  onLoadMoreTracks?: () => void;
  onLoadMoreAlbums?: () => void;
  onLoadMoreRelated?: () => void;
}) {
  const [artistTab, setArtistTab] = useState<"tracks" | "albums" | "related">("tracks");
  const image = artist.images?.[1] || artist.images?.[0];
  const hasGenres = artist.genres && artist.genres.length > 0;

  const hasMoreTracks = topTracksTotal != null && topTracks.length < topTracksTotal;
  const hasMoreAlbums = albumsTotal != null && albums.length < albumsTotal;
  const hasMoreRelated = relatedTotal != null && relatedArtists.length < relatedTotal;

  return (
    <div className="space-y-3">
      <BackButton label={backLabel} onClick={onBack} />
      <div className="flex items-center gap-4 p-4 bg-slate-800 rounded-lg border border-slate-700">
        {image ? (
          <Image src={image.url} alt={artist.name} width={64} height={64} className="rounded-full shadow-md" />
        ) : (
          <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center text-2xl">🎤</div>
        )}
        <div>
          <p className="font-bold text-white text-lg">{artist.name}</p>
          {hasGenres && (
            <p className="text-sm text-slate-400">{artist.genres!.slice(0, 4).join(", ")}</p>
          )}
          {((artist.followers && artist.followers > 0) || (artist.popularity && artist.popularity > 0)) && (
            <p className="text-xs text-slate-500">
              {artist.followers && artist.followers > 0 ? `${(artist.followers / 1000).toFixed(0)}K volgers` : ""}
              {artist.popularity && artist.popularity > 0 ? ` · Populariteit: ${artist.popularity}/100` : ""}
            </p>
          )}
        </div>
      </div>
      {loading ? <LoadingState text="Artiest laden..." /> : (
        <>
          <div className="flex gap-2">
            {([
              { key: "tracks" as const, label: "Top Tracks", count: topTracks.length, total: topTracksTotal },
              { key: "albums" as const, label: "Albums", count: albums.length, total: albumsTotal },
              { key: "related" as const, label: "Vergelijkbaar", count: relatedArtists.length, total: relatedTotal },
            ]).map((t) => (
              <button
                key={t.key}
                onClick={() => setArtistTab(t.key)}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  artistTab === t.key ? "bg-purple-600 text-white" : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                }`}
              >
                {t.label} ({t.total != null && t.total > t.count ? `${t.count}/${t.total}` : t.count})
              </button>
            ))}
          </div>
          {artistTab === "tracks" && (
            topTracks.length > 0 ? (
              <>
                <TrackList tracks={topTracks} selectedTrack={selectedTrack} onSelect={onSelect} />
                {hasMoreTracks && onLoadMoreTracks && (
                  <button onClick={onLoadMoreTracks} disabled={loadingMore} className="w-full py-2 text-sm text-purple-400 hover:text-purple-300 hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50">
                    {loadingMore ? "Laden..." : `Meer laden (${topTracks.length}/${topTracksTotal})`}
                  </button>
                )}
              </>
            ) : <EmptyState icon="🎵" text="Geen top tracks gevonden" />
          )}
          {artistTab === "albums" && (
            albums.length > 0 ? (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {albums.map((a) => <AlbumCard key={a.id} album={a} onClick={() => onAlbumClick(a)} />)}
                {hasMoreAlbums && onLoadMoreAlbums && (
                  <button onClick={onLoadMoreAlbums} disabled={loadingMore} className="w-full py-2 text-sm text-purple-400 hover:text-purple-300 hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50">
                    {loadingMore ? "Laden..." : `Meer laden (${albums.length}/${albumsTotal})`}
                  </button>
                )}
              </div>
            ) : <EmptyState icon="💿" text="Geen albums gevonden" />
          )}
          {artistTab === "related" && (
            relatedArtists.length > 0 ? (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {relatedArtists.map((ra) => <ArtistCard key={ra.id} artist={ra} onClick={() => onRelatedArtistClick(ra)} />)}
                {hasMoreRelated && onLoadMoreRelated && (
                  <button onClick={onLoadMoreRelated} disabled={loadingMore} className="w-full py-2 text-sm text-purple-400 hover:text-purple-300 hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50">
                    {loadingMore ? "Laden..." : `Meer laden (${relatedArtists.length}/${relatedTotal})`}
                  </button>
                )}
              </div>
            ) : <EmptyState icon="🎤" text="Geen vergelijkbare artiesten gevonden" />
          )}
        </>
      )}
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function SpotifyTrackSelector({ onSelect, selectedTrack }: SpotifyTrackSelectorProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("search");

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState<"all" | "track" | "album" | "artist">("all");
  const [searchYear, setSearchYear] = useState("");
  const [searchGenre, setSearchGenre] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchTracks, setSearchTracks] = useState<SpotifyTrack[]>([]);
  const [searchAlbums, setSearchAlbums] = useState<SpotifyAlbum[]>([]);
  const [searchArtists, setSearchArtists] = useState<SpotifyArtist[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchOffset, setSearchOffset] = useState(0);
  const [searchTotals, setSearchTotals] = useState<{ tracks: number; albums: number; artists: number }>({ tracks: 0, albums: 0, artists: 0 });
  const [searchLoadingMore, setSearchLoadingMore] = useState(false);

  // Album drill-down (shared)
  const [drillAlbum, setDrillAlbum] = useState<SpotifyAlbum | null>(null);
  const [drillAlbumTracks, setDrillAlbumTracks] = useState<SpotifyTrack[]>([]);
  const [drillAlbumLoading, setDrillAlbumLoading] = useState(false);
  const [drillAlbumSource, setDrillAlbumSource] = useState("search");

  // Artist drill-down (shared)
  const [drillArtist, setDrillArtist] = useState<SpotifyArtist | null>(null);
  const [drillArtistTopTracks, setDrillArtistTopTracks] = useState<SpotifyTrack[]>([]);
  const [drillArtistAlbums, setDrillArtistAlbums] = useState<SpotifyAlbum[]>([]);
  const [drillArtistRelated, setDrillArtistRelated] = useState<SpotifyArtist[]>([]);
  const [drillArtistLoading, setDrillArtistLoading] = useState(false);
  const [drillArtistSource, setDrillArtistSource] = useState("search");
  // Pagination totals for artist drill-down
  const [drillArtistTopTracksTotal, setDrillArtistTopTracksTotal] = useState(0);
  const [drillArtistAlbumsTotal, setDrillArtistAlbumsTotal] = useState(0);
  const [drillArtistRelatedTotal, setDrillArtistRelatedTotal] = useState(0);
  const [drillArtistLoadingMore, setDrillArtistLoadingMore] = useState(false);

  // Playlists
  const [playlists, setPlaylists] = useState<SpotifyPlaylistItem[]>([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);
  const [playlistsLoaded, setPlaylistsLoaded] = useState(false);
  const [playlistsTotal, setPlaylistsTotal] = useState(0);
  const [playlistsLoadingMore, setPlaylistsLoadingMore] = useState(false);
  const [selectedPlaylist, setSelectedPlaylist] = useState<SpotifyPlaylistItem | null>(null);
  const [playlistTracks, setPlaylistTracks] = useState<SpotifyTrack[]>([]);
  const [loadingPlaylistTracks, setLoadingPlaylistTracks] = useState(false);
  const [playlistTracksTotal, setPlaylistTracksTotal] = useState(0);

  // Top tracks
  const [topTracks, setTopTracks] = useState<SpotifyTrack[]>([]);
  const [loadingTopTracks, setLoadingTopTracks] = useState(false);
  const [topTracksLoaded, setTopTracksLoaded] = useState(false);
  const [topTimeRange, setTopTimeRange] = useState("medium_term");

  // Saved tracks
  const [savedTracks, setSavedTracks] = useState<SpotifyTrack[]>([]);
  const [loadingSavedTracks, setLoadingSavedTracks] = useState(false);
  const [savedTracksLoaded, setSavedTracksLoaded] = useState(false);
  const [savedOffset, setSavedOffset] = useState(0);
  const [savedTotal, setSavedTotal] = useState(0);

  // Top artists
  const [topArtists, setTopArtists] = useState<SpotifyArtist[]>([]);
  const [loadingTopArtists, setLoadingTopArtists] = useState(false);
  const [topArtistsLoaded, setTopArtistsLoaded] = useState(false);
  const [artistTimeRange, setArtistTimeRange] = useState("medium_term");

  // Recently played
  const [recentTracks, setRecentTracks] = useState<SpotifyTrack[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const [recentLoaded, setRecentLoaded] = useState(false);

  // New releases
  const [newReleases, setNewReleases] = useState<SpotifyAlbum[]>([]);
  const [loadingNewReleases, setLoadingNewReleases] = useState(false);
  const [newReleasesLoaded, setNewReleasesLoaded] = useState(false);
  const [newReleasesOffset, setNewReleasesOffset] = useState(0);
  const [newReleasesLoadingMore, setNewReleasesLoadingMore] = useState(false);

  // Discover (via Search API — Recommendations endpoint deprecated)
  const [discoverTracks, setDiscoverTracks] = useState<SpotifyTrack[]>([]);
  const [loadingDiscover, setLoadingDiscover] = useState(false);
  const [discoverGenre, setDiscoverGenre] = useState("pop");
  const [discoverOffset, setDiscoverOffset] = useState(0);
  const [discoverLoadingMore, setDiscoverLoadingMore] = useState(false);
  const [discoverTotal, setDiscoverTotal] = useState(0);

  // Saved albums (sub of Liked tab)
  const [savedAlbums, setSavedAlbums] = useState<SpotifyAlbum[]>([]);
  const [loadingSavedAlbums, setLoadingSavedAlbums] = useState(false);
  const [savedAlbumsLoaded, setSavedAlbumsLoaded] = useState(false);
  const [savedAlbumsOffset, setSavedAlbumsOffset] = useState(0);
  const [savedAlbumsTotal, setSavedAlbumsTotal] = useState(0);
  const [showSavedAlbums, setShowSavedAlbums] = useState(false);
  const [showAllGenres, setShowAllGenres] = useState(false);

  // General error
  const [error, setError] = useState<string | null>(null);

  // ============================================================
  // DATA LOADERS
  // ============================================================

  const handleSearch = useCallback(async (offset = 0, append = false) => {
    if (!searchQuery.trim()) return;
    if (append) setSearchLoadingMore(true);
    else { setIsSearching(true); setSearchOffset(0); }
    setSearchError(null);
    if (!append) { setDrillAlbum(null); setDrillArtist(null); }
    try {
      let q = searchQuery.trim();
      if (searchYear) q += ` year:${searchYear}`;
      if (searchGenre) q += ` genre:${searchGenre}`;
      const typeMap: Record<string, string> = { all: "track,album,artist", track: "track", album: "album", artist: "artist" };
      const types = typeMap[searchType] || "track,album,artist";
      const response = await fetch(`/api/spotify/search?q=${encodeURIComponent(q)}&type=${types}&limit=10&offset=${offset}`);
      if (!response.ok) throw new Error("Zoeken mislukt");
      const data = await response.json();
      const newTracks = data.tracks || [];
      const newAlbums = (data.albums || []).map((a: any) => ({ ...a, total_tracks: a.total_tracks || 0, album_type: a.album_type || "album" }));
      const newArtists = (data.artists || []).map((a: any) => ({ id: a.id, name: a.name, genres: a.genres || [], images: a.images || [], popularity: a.popularity || 0, followers: a.followers?.total ?? a.followers ?? 0 }));
      if (append) {
        setSearchTracks((prev) => [...prev, ...newTracks]);
        setSearchAlbums((prev) => [...prev, ...newAlbums]);
        setSearchArtists((prev) => [...prev, ...newArtists]);
      } else {
        setSearchTracks(newTracks);
        setSearchAlbums(newAlbums);
        setSearchArtists(newArtists);
      }
      setSearchTotals(data.total || { tracks: 0, albums: 0, artists: 0 });
      setSearchOffset(offset + 10);
    } catch (err: any) {
      setSearchError(err.message || "Zoeken mislukt");
      if (!append) { setSearchTracks([]); setSearchAlbums([]); setSearchArtists([]); }
    } finally { setIsSearching(false); setSearchLoadingMore(false); }
  }, [searchQuery, searchYear, searchGenre, searchType]);

  const openAlbumDrill = useCallback(async (album: SpotifyAlbum, source: string) => {
    setDrillAlbum(album); setDrillAlbumSource(source); setDrillAlbumLoading(true); setDrillArtist(null);
    try {
      const res = await fetch(`/api/spotify/albums/${album.id}/tracks`);
      if (!res.ok) throw new Error("Album laden mislukt");
      const data = await res.json();
      setDrillAlbumTracks(data.tracks || []);
    } catch (err: any) { setError(err.message); }
    finally { setDrillAlbumLoading(false); }
  }, []);

  const closeAlbumDrill = useCallback(() => { setDrillAlbum(null); setDrillAlbumTracks([]); }, []);

  const openArtistDrill = useCallback(async (artist: SpotifyArtist, source: string) => {
    setDrillArtist(artist); setDrillArtistSource(source); setDrillArtistLoading(true); setDrillAlbum(null);
    setDrillArtistTopTracksTotal(0); setDrillArtistAlbumsTotal(0); setDrillArtistRelatedTotal(0);
    try {
      // Note: /artists/{id}/top-tracks and /artists/{id}/related-artists are DEPRECATED (403).
      // These routes now use the Search API as fallback.
      // /artists/{id}/albums still works but limit is max 10.
      const [tracksRes, albumsRes, relatedRes] = await Promise.all([
        fetch(`/api/spotify/artists/${artist.id}/top-tracks?offset=0`),
        fetch(`/api/spotify/artists/${artist.id}/albums?include_groups=album,single&limit=10&offset=0`),
        fetch(`/api/spotify/artists/${artist.id}/related?offset=0`),
      ]);
      const [tracksData, albumsData, relatedData] = await Promise.all([
        tracksRes.ok ? tracksRes.json() : { tracks: [], total: 0 },
        albumsRes.ok ? albumsRes.json() : { albums: [], total: 0 },
        relatedRes.ok ? relatedRes.json() : { artists: [], total: 0 },
      ]);
      setDrillArtistTopTracks(tracksData.tracks || []);
      setDrillArtistTopTracksTotal(tracksData.total || 0);
      setDrillArtistAlbums(albumsData.albums || []);
      setDrillArtistAlbumsTotal(albumsData.total || 0);
      const mappedRelated = (relatedData.artists || []).map((a: any) => ({ id: a.id, name: a.name, genres: a.genres || [], images: a.images || [], popularity: a.popularity || 0, followers: a.followers?.total ?? a.followers ?? 0 }));
      setDrillArtistRelated(mappedRelated);
      setDrillArtistRelatedTotal(relatedData.total || 0);
    } catch (err: any) { setError(err.message); }
    finally { setDrillArtistLoading(false); }
  }, []);

  const loadMoreArtistDrillTracks = useCallback(async () => {
    if (!drillArtist || drillArtistLoadingMore) return;
    const offset = drillArtistTopTracks.length;
    setDrillArtistLoadingMore(true);
    try {
      const res = await fetch(`/api/spotify/artists/${drillArtist.id}/top-tracks?offset=${offset}`);
      if (!res.ok) throw new Error("Meer tracks laden mislukt");
      const data = await res.json();
      setDrillArtistTopTracks((prev) => [...prev, ...(data.tracks || [])]);
      if (data.total) setDrillArtistTopTracksTotal(data.total);
    } catch (err: any) { setError(err.message); }
    finally { setDrillArtistLoadingMore(false); }
  }, [drillArtist, drillArtistTopTracks.length, drillArtistLoadingMore]);

  const loadMoreArtistDrillAlbums = useCallback(async () => {
    if (!drillArtist || drillArtistLoadingMore) return;
    const offset = drillArtistAlbums.length;
    setDrillArtistLoadingMore(true);
    try {
      const res = await fetch(`/api/spotify/artists/${drillArtist.id}/albums?include_groups=album,single&limit=10&offset=${offset}`);
      if (!res.ok) throw new Error("Meer albums laden mislukt");
      const data = await res.json();
      setDrillArtistAlbums((prev) => [...prev, ...(data.albums || [])]);
      if (data.total) setDrillArtistAlbumsTotal(data.total);
    } catch (err: any) { setError(err.message); }
    finally { setDrillArtistLoadingMore(false); }
  }, [drillArtist, drillArtistAlbums.length, drillArtistLoadingMore]);

  const loadMoreArtistDrillRelated = useCallback(async () => {
    if (!drillArtist || drillArtistLoadingMore) return;
    const offset = drillArtistRelated.length;
    setDrillArtistLoadingMore(true);
    try {
      const res = await fetch(`/api/spotify/artists/${drillArtist.id}/related?offset=${offset}`);
      if (!res.ok) throw new Error("Meer artiesten laden mislukt");
      const data = await res.json();
      const mapped = (data.artists || []).map((a: any) => ({ id: a.id, name: a.name, genres: a.genres || [], images: a.images || [], popularity: a.popularity || 0, followers: a.followers?.total ?? a.followers ?? 0 }));
      setDrillArtistRelated((prev) => [...prev, ...mapped]);
      if (data.total) setDrillArtistRelatedTotal(data.total);
    } catch (err: any) { setError(err.message); }
    finally { setDrillArtistLoadingMore(false); }
  }, [drillArtist, drillArtistRelated.length, drillArtistLoadingMore]);

  const closeArtistDrill = useCallback(() => {
    setDrillArtist(null); setDrillArtistTopTracks([]); setDrillArtistAlbums([]); setDrillArtistRelated([]);
    setDrillArtistTopTracksTotal(0); setDrillArtistAlbumsTotal(0); setDrillArtistRelatedTotal(0);
  }, []);

  const loadPlaylists = useCallback(async (offset = 0, append = false) => {
    if (!append && playlistsLoaded) return;
    if (append) setPlaylistsLoadingMore(true);
    else { setLoadingPlaylists(true); setError(null); }
    try {
      const res = await fetch(`/api/spotify/playlists?limit=50&offset=${offset}`);
      if (!res.ok) throw new Error("Afspeellijsten laden mislukt");
      const data = await res.json();
      if (append) setPlaylists((prev) => [...prev, ...(data.playlists || [])]);
      else { setPlaylists(data.playlists || []); setPlaylistsLoaded(true); }
      setPlaylistsTotal(data.total || 0);
    } catch (err: any) { setError(err.message); }
    finally { setLoadingPlaylists(false); setPlaylistsLoadingMore(false); }
  }, [playlistsLoaded]);

  const loadPlaylistTracks = useCallback(async (playlist: SpotifyPlaylistItem, offset = 0, append = false) => {
    setSelectedPlaylist(playlist); setLoadingPlaylistTracks(true);
    try {
      const res = await fetch(`/api/spotify/playlists/${playlist.id}/tracks?limit=50&offset=${offset}`);
      if (!res.ok) throw new Error("Nummers laden mislukt");
      const data = await res.json();
      if (append) setPlaylistTracks((prev) => [...prev, ...(data.tracks || [])]);
      else setPlaylistTracks(data.tracks || []);
      setPlaylistTracksTotal(data.total || 0);
    } catch (err: any) { setError(err.message); }
    finally { setLoadingPlaylistTracks(false); }
  }, []);

  const loadTopTracks = useCallback(async (timeRange?: string) => {
    const range = timeRange || topTimeRange;
    setLoadingTopTracks(true); setError(null);
    try {
      const res = await fetch(`/api/spotify/me/top-tracks?time_range=${range}&limit=50`);
      if (!res.ok) throw new Error("Top tracks laden mislukt");
      const data = await res.json();
      setTopTracks(data.tracks || []); setTopTracksLoaded(true);
    } catch (err: any) { setError(err.message); }
    finally { setLoadingTopTracks(false); }
  }, [topTimeRange]);

  const loadSavedTracks = useCallback(async (offset = 0, append = false) => {
    setLoadingSavedTracks(true); setError(null);
    try {
      const res = await fetch(`/api/spotify/me/saved-tracks?limit=50&offset=${offset}`);
      if (!res.ok) throw new Error("Opgeslagen nummers laden mislukt");
      const data = await res.json();
      if (append) setSavedTracks((prev) => [...prev, ...(data.tracks || [])]);
      else setSavedTracks(data.tracks || []);
      setSavedTotal(data.total || 0); setSavedOffset(offset + (data.tracks?.length || 0)); setSavedTracksLoaded(true);
    } catch (err: any) { setError(err.message); }
    finally { setLoadingSavedTracks(false); }
  }, []);

  const loadSavedAlbums = useCallback(async (offset = 0, append = false) => {
    setLoadingSavedAlbums(true);
    try {
      const res = await fetch(`/api/spotify/me/saved-albums?limit=50&offset=${offset}`);
      if (!res.ok) throw new Error("Opgeslagen albums laden mislukt");
      const data = await res.json();
      if (append) setSavedAlbums((prev) => [...prev, ...(data.albums || [])]);
      else setSavedAlbums(data.albums || []);
      setSavedAlbumsTotal(data.total || 0); setSavedAlbumsOffset(offset + (data.albums?.length || 0)); setSavedAlbumsLoaded(true);
    } catch (err: any) { setError(err.message); }
    finally { setLoadingSavedAlbums(false); }
  }, []);

  const loadTopArtists = useCallback(async (timeRange?: string) => {
    const range = timeRange || artistTimeRange;
    setLoadingTopArtists(true); setError(null);
    try {
      const res = await fetch(`/api/spotify/me/top-artists?time_range=${range}&limit=50`);
      if (!res.ok) throw new Error("Top artiesten laden mislukt");
      const data = await res.json();
      setTopArtists((data.artists || []).map((a: any) => ({ id: a.id, name: a.name, genres: a.genres || [], images: a.images || [], popularity: a.popularity || 0, followers: a.followers?.total ?? a.followers ?? 0 })));
      setTopArtistsLoaded(true);
    } catch (err: any) { setError(err.message); }
    finally { setLoadingTopArtists(false); }
  }, [artistTimeRange]);

  const loadRecentTracks = useCallback(async () => {
    if (recentLoaded) return;
    setLoadingRecent(true); setError(null);
    try {
      const res = await fetch("/api/spotify/me/recently-played?limit=50");
      if (!res.ok) throw new Error("Recent afgespeeld laden mislukt");
      const data = await res.json();
      setRecentTracks(data.tracks || []); setRecentLoaded(true);
    } catch (err: any) { setError(err.message); }
    finally { setLoadingRecent(false); }
  }, [recentLoaded]);

  const loadNewReleases = useCallback(async (offset = 0, append = false) => {
    if (!append && newReleasesLoaded) return;
    if (append) setNewReleasesLoadingMore(true);
    else { setLoadingNewReleases(true); setError(null); }
    try {
      // /browse/new-releases is deprecated (403). Use Search API with tag:new filter instead.
      const res = await fetch(`/api/spotify/search?q=${encodeURIComponent("tag:new")}&type=album&limit=10&offset=${offset}`);
      if (!res.ok) throw new Error("Nieuwe releases laden mislukt");
      const data = await res.json();
      if (append) setNewReleases((prev) => [...prev, ...(data.albums || [])]);
      else { setNewReleases(data.albums || []); setNewReleasesLoaded(true); }
      setNewReleasesOffset(offset + 10);
    } catch (err: any) { setError(err.message); }
    finally { setLoadingNewReleases(false); setNewReleasesLoadingMore(false); }
  }, [newReleasesLoaded]);

  const loadDiscover = useCallback(async (genre?: string, offset = 0, append = false) => {
    const g = genre || discoverGenre;
    if (append) setDiscoverLoadingMore(true);
    else { setLoadingDiscover(true); setError(null); }
    try {
      // /recommendations is deprecated (404). Use Search API with genre filter instead.
      const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(`genre:${g}`)}&type=track&limit=10&offset=${offset}`);
      if (!res.ok) throw new Error("Aanbevelingen laden mislukt");
      const data = await res.json();
      if (append) setDiscoverTracks((prev) => [...prev, ...(data.tracks || [])]);
      else setDiscoverTracks(data.tracks || []);
      setDiscoverTotal(data.total?.tracks || 0);
      setDiscoverOffset(offset + 10);
    } catch (err: any) { setError(err.message); }
    finally { setLoadingDiscover(false); setDiscoverLoadingMore(false); }
  }, [discoverGenre]);

  const loadDiscoverFromTrack = useCallback(async (_trackId: string) => {
    setLoadingDiscover(true); setError(null);
    try {
      // /recommendations is deprecated (404). Search by selected track's artist instead.
      const artistName = selectedTrack?.artists?.[0] || "music";
      const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(`artist:${artistName}`)}&type=track&limit=10`);
      if (!res.ok) throw new Error("Vergelijkbare nummers laden mislukt");
      const data = await res.json();
      setDiscoverTracks(data.tracks || []);
    } catch (err: any) { setError(err.message); }
    finally { setLoadingDiscover(false); }
  }, [selectedTrack]);

  // Auto-load on tab change
  useEffect(() => {
    if (activeTab === "playlists" && !playlistsLoaded) loadPlaylists();
    else if (activeTab === "top" && !topTracksLoaded) loadTopTracks();
    else if (activeTab === "saved" && !savedTracksLoaded) loadSavedTracks(0);
    else if (activeTab === "artists" && !topArtistsLoaded) loadTopArtists();
    else if (activeTab === "recent" && !recentLoaded) loadRecentTracks();
    else if (activeTab === "new" && !newReleasesLoaded) loadNewReleases();
  }, [activeTab, playlistsLoaded, topTracksLoaded, savedTracksLoaded, topArtistsLoaded, recentLoaded, newReleasesLoaded, loadPlaylists, loadTopTracks, loadSavedTracks, loadTopArtists, loadRecentTracks, loadNewReleases]);

  // Reset drill-downs when tab changes
  useEffect(() => { setDrillAlbum(null); setDrillArtist(null); }, [activeTab]);

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="space-y-4">
      {/* Selected Track Display */}
      {selectedTrack && (
        <div className="border border-green-500 bg-green-900/20 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 bg-green-500 rounded-full" />
            <p className="text-sm font-medium text-green-300">Geselecteerd nummer</p>
          </div>
          <div className="flex items-center gap-4">
            {selectedTrack.album.images[0] && (
              <Image src={selectedTrack.album.images[0].url} alt={selectedTrack.album.name} width={64} height={64} className="rounded-md shadow-md" />
            )}
            <div>
              <p className="font-semibold text-white">{selectedTrack.name}</p>
              <p className="text-sm text-slate-400">{selectedTrack.artists.map((a) => a.name).join(", ")}</p>
              <p className="text-xs text-slate-500">
                {selectedTrack.album.name}
                {selectedTrack.album.release_date ? ` (${new Date(selectedTrack.album.release_date).getFullYear()})` : ""}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex overflow-x-auto border-b border-slate-700 scrollbar-hide">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1 px-3 py-2.5 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${
              activeTab === tab.key
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-slate-400 hover:text-slate-300 hover:border-slate-600"
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Error */}
      {(error || searchError) && (
        <div className="border border-red-500/50 bg-red-900/20 rounded-lg p-3">
          <p className="text-red-400 text-sm">❌ {error || searchError}</p>
          <button onClick={() => { setError(null); setSearchError(null); }} className="text-xs text-red-300 underline mt-1">Sluiten</button>
        </div>
      )}

      {/* ====================== SEARCH TAB ====================== */}
      {activeTab === "search" && (
        <div className="space-y-4">
          {drillAlbum ? (
            <AlbumDrillDown album={drillAlbum} tracks={drillAlbumTracks} loading={drillAlbumLoading} selectedTrack={selectedTrack} onBack={closeAlbumDrill} onSelect={onSelect} backLabel="Terug naar resultaten" />
          ) : drillArtist ? (
            <ArtistDrillDown artist={drillArtist} topTracks={drillArtistTopTracks} albums={drillArtistAlbums} relatedArtists={drillArtistRelated} loading={drillArtistLoading} selectedTrack={selectedTrack} onBack={closeArtistDrill} onSelect={onSelect} onAlbumClick={(a) => openAlbumDrill(a, "artist")} onRelatedArtistClick={(a) => openArtistDrill(a, "search")} backLabel="Terug naar resultaten" topTracksTotal={drillArtistTopTracksTotal} albumsTotal={drillArtistAlbumsTotal} relatedTotal={drillArtistRelatedTotal} loadingMore={drillArtistLoadingMore} onLoadMoreTracks={loadMoreArtistDrillTracks} onLoadMoreAlbums={loadMoreArtistDrillAlbums} onLoadMoreRelated={loadMoreArtistDrillRelated} />
          ) : (
            <>
              {/* Search Input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  placeholder="Zoek nummers, artiesten, albums..."
                  className="flex-1 rounded-lg bg-slate-800 border border-slate-600 text-white px-4 py-2.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                />
                <button onClick={() => handleSearch()} disabled={isSearching || !searchQuery.trim()} className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors">
                  {isSearching ? "..." : "🔍"}
                </button>
              </div>

              {/* Filters Row */}
              <div className="flex flex-wrap gap-2">
                <select value={searchType} onChange={(e) => setSearchType(e.target.value as typeof searchType)} className="bg-slate-800 border border-slate-600 text-white text-sm rounded-lg px-3 py-1.5">
                  <option value="all">Alles</option>
                  <option value="track">Nummers</option>
                  <option value="album">Albums</option>
                  <option value="artist">Artiesten</option>
                </select>
                <input
                  type="text"
                  value={searchYear}
                  onChange={(e) => setSearchYear(e.target.value)}
                  placeholder="Jaar (bv. 1985 of 1980-1990)"
                  className="bg-slate-800 border border-slate-600 text-white text-sm rounded-lg px-3 py-1.5 w-48"
                />
                <select value={searchGenre} onChange={(e) => setSearchGenre(e.target.value)} className="bg-slate-800 border border-slate-600 text-white text-sm rounded-lg px-3 py-1.5">
                  <option value="">Genre (optioneel)</option>
                  {GENRE_PRESETS.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>

              {/* Results */}
              {(searchArtists.length > 0 || searchAlbums.length > 0 || searchTracks.length > 0) && (
                <div className="space-y-4">
                  {searchArtists.length > 0 && (
                    <div>
                      <SectionHeader icon="🎤" label="Artiesten" count={searchArtists.length} />
                      <div className="space-y-2">
                        {searchArtists.slice(0, 8).map((artist) => (
                          <ArtistCard key={artist.id} artist={artist} onClick={() => openArtistDrill(artist, "search")} />
                        ))}
                      </div>
                    </div>
                  )}
                  {searchAlbums.length > 0 && (
                    <div>
                      <SectionHeader icon="💿" label="Albums" count={searchAlbums.length} />
                      <div className="space-y-2">
                        {searchAlbums.slice(0, 8).map((album) => (
                          <AlbumCard key={album.id} album={album} onClick={() => openAlbumDrill(album, "search")} />
                        ))}
                      </div>
                    </div>
                  )}
                  {searchTracks.length > 0 && (
                    <div>
                      <SectionHeader icon="🎵" label="Nummers" count={searchTracks.length} />
                      <TrackList tracks={searchTracks} selectedTrack={selectedTrack} onSelect={onSelect} />
                    </div>
                  )}
                  {/* Load More button */}
                  {(searchTracks.length < searchTotals.tracks || searchAlbums.length < searchTotals.albums || searchArtists.length < searchTotals.artists) && (
                    <button
                      onClick={() => handleSearch(searchOffset, true)}
                      disabled={searchLoadingMore}
                      className="w-full py-2.5 text-sm text-blue-400 hover:text-blue-300 disabled:opacity-50 transition-colors"
                    >
                      {searchLoadingMore ? "Laden..." : `Meer laden (${searchTracks.length + searchAlbums.length + searchArtists.length} van ${searchTotals.tracks + searchTotals.albums + searchTotals.artists})`}
                    </button>
                  )}
                </div>
              )}
              {searchTracks.length === 0 && searchAlbums.length === 0 && searchArtists.length === 0 && !isSearching && (
                <EmptyState icon="🔍" text="Zoek naar nummers, artiesten of albums met optionele jaar- en genrefilters." />
              )}
            </>
          )}
        </div>
      )}

      {/* ====================== PLAYLISTS TAB ====================== */}
      {activeTab === "playlists" && (
        <div className="space-y-3">
          {loadingPlaylists ? <LoadingState text="Afspeellijsten laden..." /> : (
            <>
              {selectedPlaylist ? (
                <div className="space-y-3">
                  <BackButton onClick={() => { setSelectedPlaylist(null); setPlaylistTracks([]); setPlaylistTracksTotal(0); }} label="Terug naar afspeellijsten" />
                  <div className="flex items-center gap-3">
                    {selectedPlaylist.image && (
                      <Image src={selectedPlaylist.image} alt={selectedPlaylist.name} width={48} height={48} className="rounded-md" />
                    )}
                    <div>
                      <p className="font-semibold text-white">{selectedPlaylist.name}</p>
                      <p className="text-sm text-slate-400">{selectedPlaylist.trackCount} nummers</p>
                    </div>
                  </div>
                  {loadingPlaylistTracks ? <LoadingState text="Nummers laden..." /> : (
                    <>
                      <TrackList tracks={playlistTracks} selectedTrack={selectedTrack} onSelect={onSelect} />
                      {playlistTracks.length < playlistTracksTotal && (
                        <button onClick={() => loadPlaylistTracks(selectedPlaylist!, playlistTracks.length, true)} className="w-full py-2 text-sm text-blue-400 hover:text-blue-300 transition-colors">
                          Meer laden ({playlistTracks.length}/{playlistTracksTotal})
                        </button>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {playlists.length === 0 && <EmptyState icon="📂" text="Geen afspeellijsten gevonden." />}
                  {playlists.map((pl) => (
                    <button key={pl.id} onClick={() => loadPlaylistTracks(pl)} className="w-full flex items-center gap-3 p-3 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 transition-colors text-left">
                      {pl.image ? (
                        <Image src={pl.image} alt={pl.name} width={48} height={48} className="rounded-md" />
                      ) : (
                        <div className="w-12 h-12 bg-slate-700 rounded-md flex items-center justify-center text-xl">🎵</div>
                      )}
                      <div className="min-w-0">
                        <p className="font-medium text-white truncate">{pl.name}</p>
                        <p className="text-sm text-slate-400">{pl.trackCount} nummers • {pl.owner}</p>
                      </div>
                    </button>
                  ))}
                  {playlists.length < playlistsTotal && (
                    <button onClick={() => loadPlaylists(playlists.length, true)} disabled={playlistsLoadingMore} className="w-full py-2 text-sm text-blue-400 hover:text-blue-300 disabled:opacity-50 transition-colors">
                      {playlistsLoadingMore ? "Laden..." : `Meer laden (${playlists.length}/${playlistsTotal})`}
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ====================== TOP TRACKS TAB ====================== */}
      {activeTab === "top" && (
        <div className="space-y-3">
          <div className="flex gap-2">
            {(["short_term", "medium_term", "long_term"] as const).map((range) => (
              <button
                key={range}
                onClick={() => { setTopTimeRange(range); setTopTracksLoaded(false); }}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  topTimeRange === range ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                }`}
              >
                {range === "short_term" ? "4 weken" : range === "medium_term" ? "6 maanden" : "Altijd"}
              </button>
            ))}
          </div>
          {loadingTopTracks ? <LoadingState text="Top nummers laden..." /> : (
            topTracks.length > 0 ? <TrackList tracks={topTracks} selectedTrack={selectedTrack} onSelect={onSelect} /> : <EmptyState icon="⭐" text="Nog geen luisterdata beschikbaar." />
          )}
        </div>
      )}

      {/* ====================== SAVED TAB ====================== */}
      {activeTab === "saved" && (
        <div className="space-y-3">
          {/* Toggle: Tracks / Albums */}
          <div className="flex gap-2">
            <button onClick={() => setShowSavedAlbums(false)} className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${!showSavedAlbums ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}>
              ❤️ Nummers {savedTotal > 0 && `(${savedTotal})`}
            </button>
            <button onClick={() => { setShowSavedAlbums(true); if (!savedAlbumsLoaded) loadSavedAlbums(0); }} className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${showSavedAlbums ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}>
              💿 Albums {savedAlbumsTotal > 0 && `(${savedAlbumsTotal})`}
            </button>
          </div>

          {!showSavedAlbums ? (
            <>
              {loadingSavedTracks ? <LoadingState text="Opgeslagen nummers laden..." /> : (
                savedTracks.length > 0 ? (
                  <>
                    <TrackList tracks={savedTracks} selectedTrack={selectedTrack} onSelect={onSelect} />
                    {savedTracks.length < savedTotal && (
                      <button onClick={() => loadSavedTracks(savedTracks.length, true)} className="w-full py-2 text-sm text-blue-400 hover:text-blue-300 transition-colors">
                        Meer laden ({savedTracks.length}/{savedTotal})
                      </button>
                    )}
                  </>
                ) : <EmptyState icon="❤️" text="Geen opgeslagen nummers." />
              )}
            </>
          ) : (
            <>
              {drillAlbum ? (
                <AlbumDrillDown album={drillAlbum} tracks={drillAlbumTracks} loading={drillAlbumLoading} selectedTrack={selectedTrack} onBack={closeAlbumDrill} onSelect={onSelect} backLabel="Terug naar albums" />
              ) : (
                <>
                  {loadingSavedAlbums ? <LoadingState text="Opgeslagen albums laden..." /> : (
                    savedAlbums.length > 0 ? (
                      <>
                        <div className="space-y-2">
                          {savedAlbums.map((album) => (
                            <AlbumCard key={album.id} album={album} onClick={() => openAlbumDrill(album, "saved")} />
                          ))}
                        </div>
                        {savedAlbums.length < savedAlbumsTotal && (
                          <button onClick={() => loadSavedAlbums(savedAlbums.length, true)} className="w-full py-2 text-sm text-blue-400 hover:text-blue-300 transition-colors">
                            Meer laden ({savedAlbums.length}/{savedAlbumsTotal})
                          </button>
                        )}
                      </>
                    ) : <EmptyState icon="💿" text="Geen opgeslagen albums." />
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* ====================== ARTISTS TAB ====================== */}
      {activeTab === "artists" && (
        <div className="space-y-3">
          {drillArtist ? (
            <ArtistDrillDown artist={drillArtist} topTracks={drillArtistTopTracks} albums={drillArtistAlbums} relatedArtists={drillArtistRelated} loading={drillArtistLoading} selectedTrack={selectedTrack} onBack={closeArtistDrill} onSelect={onSelect} onAlbumClick={(a) => openAlbumDrill(a, "artist")} onRelatedArtistClick={(a) => openArtistDrill(a, "artists")} backLabel="Terug naar artiesten" topTracksTotal={drillArtistTopTracksTotal} albumsTotal={drillArtistAlbumsTotal} relatedTotal={drillArtistRelatedTotal} loadingMore={drillArtistLoadingMore} onLoadMoreTracks={loadMoreArtistDrillTracks} onLoadMoreAlbums={loadMoreArtistDrillAlbums} onLoadMoreRelated={loadMoreArtistDrillRelated} />
          ) : drillAlbum ? (
            <AlbumDrillDown album={drillAlbum} tracks={drillAlbumTracks} loading={drillAlbumLoading} selectedTrack={selectedTrack} onBack={closeAlbumDrill} onSelect={onSelect} backLabel="Terug naar artiest" />
          ) : (
            <>
              <div className="flex gap-2">
                {(["short_term", "medium_term", "long_term"] as const).map((range) => (
                  <button
                    key={range}
                    onClick={() => { setArtistTimeRange(range); setTopArtistsLoaded(false); }}
                    className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                      artistTimeRange === range ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                    }`}
                  >
                    {range === "short_term" ? "4 weken" : range === "medium_term" ? "6 maanden" : "Altijd"}
                  </button>
                ))}
              </div>
              {loadingTopArtists ? <LoadingState text="Artiesten laden..." /> : (
                topArtists.length > 0 ? (
                  <div className="space-y-2">
                    {topArtists.map((artist) => (
                      <ArtistCard key={artist.id} artist={artist} onClick={() => openArtistDrill(artist, "artists")} />
                    ))}
                  </div>
                ) : <EmptyState icon="🎤" text="Nog geen artiest-data beschikbaar." />
              )}
            </>
          )}
        </div>
      )}

      {/* ====================== RECENT TAB ====================== */}
      {activeTab === "recent" && (
        <div className="space-y-3">
          <button onClick={() => { setRecentLoaded(false); }} className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
            🔄 Vernieuwen
          </button>
          {loadingRecent ? <LoadingState text="Recent beluisterd laden..." /> : (
            recentTracks.length > 0 ? <TrackList tracks={recentTracks} selectedTrack={selectedTrack} onSelect={onSelect} /> : <EmptyState icon="🕐" text="Geen recent beluisterde nummers." />
          )}
        </div>
      )}

      {/* ====================== NEW RELEASES TAB ====================== */}
      {activeTab === "new" && (
        <div className="space-y-3">
          {drillAlbum ? (
            <AlbumDrillDown album={drillAlbum} tracks={drillAlbumTracks} loading={drillAlbumLoading} selectedTrack={selectedTrack} onBack={closeAlbumDrill} onSelect={onSelect} backLabel="Terug naar releases" />
          ) : (
            <>
              {loadingNewReleases ? <LoadingState text="Nieuwe releases laden..." /> : (
                newReleases.length > 0 ? (
                  <>
                    <div className="space-y-2">
                      {newReleases.map((album) => (
                        <AlbumCard key={album.id} album={album} onClick={() => openAlbumDrill(album, "new")} />
                      ))}
                    </div>
                    <button
                      onClick={() => loadNewReleases(newReleasesOffset, true)}
                      disabled={newReleasesLoadingMore}
                      className="w-full py-2 text-sm text-blue-400 hover:text-blue-300 disabled:opacity-50 transition-colors"
                    >
                      {newReleasesLoadingMore ? "Laden..." : `Meer laden (${newReleases.length} geladen)`}
                    </button>
                  </>
                ) : <EmptyState icon="🆕" text="Geen nieuwe releases gevonden." />
              )}
            </>
          )}
        </div>
      )}

      {/* ====================== DISCOVER TAB ====================== */}
      {activeTab === "discover" && (
        <div className="space-y-4">
          {/* Genre Pills */}
          <div>
            <p className="text-sm font-medium text-slate-300 mb-2">🎸 Kies een genre</p>
            <div className="flex flex-wrap gap-2">
              {GENRE_PRESETS.slice(0, showAllGenres ? GENRE_PRESETS.length : 16).map((g) => (
                <button
                  key={g}
                  onClick={() => { setDiscoverGenre(g); setDiscoverOffset(0); loadDiscover(g); }}
                  className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                    discoverGenre === g ? "bg-green-600 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                  }`}
                >
                  {g}
                </button>
              ))}
              {GENRE_PRESETS.length > 16 && (
                <button onClick={() => setShowAllGenres(!showAllGenres)} className="px-3 py-1.5 text-sm rounded-full bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors">
                  {showAllGenres ? "Minder ▲" : `+${GENRE_PRESETS.length - 16} meer ▼`}
                </button>
              )}
            </div>
          </div>

          {/* Similar To Selected Track */}
          {selectedTrack && (
            <div>
              <button
                onClick={() => loadDiscoverFromTrack(selectedTrack.id)}
                className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                🔗 Vergelijkbaar met &quot;{selectedTrack.name}&quot;
              </button>
            </div>
          )}

          {/* CTA if nothing selected */}
          {discoverTracks.length === 0 && !loadingDiscover && (
            <EmptyState icon="🎲" text="Kies een genre om muziek te ontdekken, of selecteer eerst een nummer en klik op 'Vergelijkbaar'." />
          )}

          {/* Results */}
          {loadingDiscover ? <LoadingState text="Muziek ontdekken..." /> : (
            discoverTracks.length > 0 && (
              <div>
                <SectionHeader icon="🎲" label="Ontdekte nummers" count={discoverTracks.length} />
                <TrackList tracks={discoverTracks} selectedTrack={selectedTrack} onSelect={onSelect} />
                {discoverTracks.length < discoverTotal && (
                  <button
                    onClick={() => loadDiscover(discoverGenre, discoverOffset, true)}
                    disabled={discoverLoadingMore}
                    className="w-full py-2 text-sm text-blue-400 hover:text-blue-300 disabled:opacity-50 transition-colors"
                  >
                    {discoverLoadingMore ? "Laden..." : `Meer laden (${discoverTracks.length}/${discoverTotal})`}
                  </button>
                )}
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
