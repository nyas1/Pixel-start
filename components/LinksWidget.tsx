import React from 'react';
import { LinkGroup } from '../types';
import { sanitizeUrl } from '../utils/urlUtils';
import { useAppContext } from '../contexts/AppContext';
import { getCachedFaviconDataUrl, setCachedFaviconDataUrl } from '../utils/faviconCache';

interface LinksWidgetProps {
    groups: LinkGroup[];
    openInNewTab?: boolean;
    showFavicons?: boolean;
}

const getFaviconUrl = (rawUrl: string): string | null => {
    const safeUrl = sanitizeUrl(rawUrl);
    if (!safeUrl || safeUrl === 'about:blank') return null;
    if (safeUrl.startsWith('mailto:')) return null;

    try {
        const parsed = new URL(safeUrl, window.location.origin);
        if (!parsed.hostname) return null;
        return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(parsed.hostname)}&sz=32`;
    } catch {
        return null;
    }
};

const getHostname = (rawUrl: string): string | null => {
    const safeUrl = sanitizeUrl(rawUrl);
    if (!safeUrl || safeUrl === 'about:blank' || safeUrl.startsWith('mailto:')) return null;
    try {
        const parsed = new URL(safeUrl, window.location.origin);
        return parsed.hostname ? parsed.hostname.toLowerCase() : null;
    } catch {
        return null;
    }
};

const getFaviconCandidateUrls = (hostname: string): string[] => [
    // Site-native icon first (often cacheable and stable).
    `https://${hostname}/favicon.ico`,
    // DDG endpoint is frequently CORS-friendly for fetch+cache.
    `https://icons.duckduckgo.com/ip3/${encodeURIComponent(hostname)}.ico`,
    // Keep previous provider as final fallback.
    `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=32`
];

const blobToDataUrl = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('reader-error'));
        reader.readAsDataURL(blob);
    });

const getSafeOverrideFaviconUrl = (rawUrl?: string): string | null => {
    if (!rawUrl || !rawUrl.trim()) return null;
    const safeUrl = sanitizeUrl(rawUrl.trim());
    if (!safeUrl || safeUrl === 'about:blank') return null;
    return safeUrl;
};

const fetchFaviconDataUrl = async (urls: string[]): Promise<string | null> => {
    for (const url of urls) {
        try {
            const res = await fetch(url, { mode: 'cors', cache: 'force-cache' });
            if (!res.ok) continue;
            const blob = await res.blob();
            if (!blob || blob.size === 0 || blob.size > 120 * 1024) continue;
            const dataUrl = await blobToDataUrl(blob);
            if (dataUrl.startsWith('data:')) return dataUrl;
        } catch {
            // Try next candidate.
        }
    }
    return null;
};

const ShortcutLink: React.FC<{ label: string; url: string; openInNewTab: boolean; showFavicons: boolean; faviconOverride?: string; refreshNonce: number }> = ({ label, url, openInNewTab, showFavicons, faviconOverride, refreshNonce }) => {
    const [iconHidden, setIconHidden] = React.useState(false);
    const [resolvedFavicon, setResolvedFavicon] = React.useState<string | null>(null);
    const faviconUrl = getSafeOverrideFaviconUrl(faviconOverride) || getFaviconUrl(url);
    const hostname = getHostname(url);
    const usingOverride = Boolean(getSafeOverrideFaviconUrl(faviconOverride));

    React.useEffect(() => {
        setIconHidden(false);
    }, [faviconUrl, showFavicons, refreshNonce]);

    React.useEffect(() => {
        let cancelled = false;
        const run = async () => {
            if (!showFavicons || !faviconUrl) {
                setResolvedFavicon(null);
                return;
            }
            if (usingOverride || !hostname) {
                setResolvedFavicon(faviconUrl);
                return;
            }

            const cached = getCachedFaviconDataUrl(hostname);
            if (cached) {
                setResolvedFavicon(cached);
                return;
            }

            setResolvedFavicon(faviconUrl);
            try {
                const dataUrl = await fetchFaviconDataUrl(getFaviconCandidateUrls(hostname));
                if (!dataUrl) return;
                setCachedFaviconDataUrl(hostname, dataUrl);
                if (!cancelled) setResolvedFavicon(dataUrl);
            } catch {
                // Keep fallback URL image.
            }
        };
        void run();
        return () => {
            cancelled = true;
        };
    }, [faviconUrl, hostname, showFavicons, usingOverride, refreshNonce]);

    return (
        <a
            href={sanitizeUrl(url)}
            target={openInNewTab ? "_blank" : "_self"}
            rel="noopener noreferrer"
            className="text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:text-shadow-glow transition-all duration-[20ms] text-sm truncate block"
            title={url}
        >
            <span className="inline-flex items-center gap-2">
                {showFavicons && !iconHidden && resolvedFavicon ? (
                    <img
                        src={resolvedFavicon}
                        alt=""
                        width={14}
                        height={14}
                        className="inline-block opacity-80"
                        onError={() => setIconHidden(true)}
                    />
                ) : (
                    <span className="inline-block w-[14px] text-center opacity-50">&gt;</span>
                )}
                <span className="truncate">{label}</span>
            </span>
        </a>
    );
};

export const LinksWidget: React.FC<LinksWidgetProps> = ({ groups, openInNewTab = true, showFavicons = true }) => {
    const { faviconRefreshNonce } = useAppContext();
    return (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 h-full overflow-y-auto custom-scrollbar pr-2">
            {groups.map((group) => (
                <div key={group.category} className="flex flex-col gap-2 min-w-0">
                    <h4 className="text-[var(--color-muted)] text-xs font-bold uppercase mb-1 tracking-wider border-b border-[var(--color-border)] pb-1 w-max">
                        {group.category}
                    </h4>
                    {group.links.length === 0 && (
                        <span className="text-[var(--color-muted)] text-xs italic opacity-50">empty</span>
                    )}
                    {group.links.map(link => (
                        <ShortcutLink
                            key={`${link.label}-${link.url}`}
                            label={link.label}
                            url={link.url}
                            openInNewTab={openInNewTab}
                            showFavicons={showFavicons}
                            faviconOverride={link.favicon}
                            refreshNonce={faviconRefreshNonce}
                        />
                    ))}
                </div>
            ))}
            {groups.length === 0 && (
                <div className="col-span-full flex items-center justify-center text-[var(--color-muted)]">
                    No shortcuts configured. Open settings (top right) to add some.
                </div>
            )}
        </div>
    );
};