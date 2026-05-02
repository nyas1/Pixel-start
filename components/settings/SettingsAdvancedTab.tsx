import React from 'react';
import { AsciiSlider } from '../AsciiSlider';
import { SEARCH_ENGINES } from '../../constants';
import { SearchEngineId } from '../../types';

const FAVICON_FILE_INPUT_MAX = 15 * 1024 * 1024;
/** Keeps data URLs small enough for localStorage alongside other settings */
const FAVICON_DATA_URL_MAX_LEN = 280_000;

function isProbablyImageFile(file: File): boolean {
    if (file.type.startsWith('image/')) return true;
    return /\.(png|jpe?g|gif|webp|bmp|avif|ico)$/i.test(file.name);
}

async function compressImageFileToFaviconDataUrl(file: File): Promise<string> {
    let bitmap: ImageBitmap | null = null;
    let blobUrl: string | null = null;
    let img: HTMLImageElement | null = null;

    try {
        try {
            bitmap = await createImageBitmap(file);
        } catch {
            blobUrl = URL.createObjectURL(file);
            try {
                img = await new Promise<HTMLImageElement>((resolve, reject) => {
                    const el = new Image();
                    el.onload = () => resolve(el);
                    el.onerror = () => reject(new Error('load'));
                    el.src = blobUrl!;
                });
            } catch {
                throw new Error('load');
            }
        }

        const nw = bitmap ? bitmap.width : img!.naturalWidth;
        const nh = bitmap ? bitmap.height : img!.naturalHeight;
        if (!nw || !nh) throw new Error('dims');

        const paint = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
            if (bitmap) ctx.drawImage(bitmap, 0, 0, w, h);
            else ctx.drawImage(img!, 0, 0, w, h);
        };

        const encode = (maxDim: number, quality: number) => {
            let w = nw;
            let h = nh;
            if (w > maxDim || h > maxDim) {
                if (w >= h) {
                    h = Math.max(1, Math.round((h * maxDim) / w));
                    w = maxDim;
                } else {
                    w = Math.max(1, Math.round((w * maxDim) / h));
                    h = maxDim;
                }
            }
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('ctx');
            paint(ctx, w, h);
            let data = '';
            try {
                const webp = canvas.toDataURL('image/webp', quality);
                if (webp.length > 12 && webp.startsWith('data:image/webp')) data = webp;
            } catch {
                /* WebP unsupported */
            }
            if (!data) data = canvas.toDataURL('image/jpeg', quality);
            return data;
        };

        let maxDim = 128;
        let quality = 0.82;
        let data = encode(maxDim, quality);
        let guard = 0;
        while (data.length > FAVICON_DATA_URL_MAX_LEN && maxDim > 24 && guard < 12) {
            maxDim = Math.max(24, Math.floor(maxDim * 0.72));
            quality = Math.max(0.5, quality - 0.08);
            data = encode(maxDim, quality);
            guard += 1;
        }
        if (data.length > FAVICON_DATA_URL_MAX_LEN) throw new Error('toobig');
        return data;
    } finally {
        bitmap?.close();
        if (blobUrl) URL.revokeObjectURL(blobUrl);
    }
}

interface SettingsAdvancedTabProps {
    showWidgetTitles: boolean;
    onToggleWidgetTitles: () => void;
    showFavicons: boolean;
    onToggleShowFavicons: () => void;
    reserveSettingsSpace: boolean;
    onToggleReserveSettings: () => void;
    customFont: string;
    onCustomFontChange: (font: string) => void;
    customTabTitle: string;
    onCustomTabTitleChange: (title: string) => void;
    customTabFavicon: string;
    onCustomTabFaviconChange: (href: string) => void;
    isLayoutLocked: boolean;
    onToggleLayoutLock: () => void;
    onResetLayout: () => void;
    isResizingEnabled: boolean;
    onToggleResizing: () => void;
    statsMode: 'text' | 'graph' | 'detailed' | 'minimal';
    onStatsModeChange: (mode: 'text' | 'graph' | 'detailed' | 'minimal') => void;
    weatherMode: 'standard' | 'icon';
    onWeatherModeChange: (mode: 'standard' | 'icon') => void;
    weatherShowHourlyForecast: boolean;
    onToggleWeatherHourlyForecast: () => void;
    timeFormat: '12h' | '24h';
    onTimeFormatChange: (format: '12h' | '24h') => void;
    dateFormat: 'long' | 'short';
    onDateFormatChange: (format: 'long' | 'short') => void;
    clockShowDay: boolean;
    onToggleClockShowDay: () => void;
    clockShowSeconds: boolean;
    onToggleClockShowSeconds: () => void;
    openInNewTab?: boolean;
    onToggleOpenInNewTab?: () => void;
    searchDefaultEngine: SearchEngineId;
    onSearchDefaultEngineChange: (engine: SearchEngineId) => void;
    searchEnabledEngines: SearchEngineId[];
    onToggleSearchEngine: (engine: SearchEngineId) => void;
    searchSlashHotkeyEnabled: boolean;
    onToggleSearchSlashHotkey: () => void;
    activeWidgets: Record<string, boolean>;
    funOptions: {
        matrix: { speed: number; fade: number; charSet: 'numbers' | 'latin' | 'mixed'; charFlux: number; glow: boolean; fontSize: number };
        pipes: { speed: number; fade: number; count: number; fontSize: number; lifetime: number };
        donut: { speed: number };
        snake: { speed: number };
        life: { speed: number };
        fireworks: { speed: number; explosionSize: number };
        starfield: { speed: number };
        rain: { speed: number };
        maze: { speed: number };
    };
    onFunOptionsChange: (options: any) => void;
    customCss: string;
    onCustomCssChange: (css: string) => void;
    weatherLocation: { latitude: null | number; longitude: null | number };
    setWeatherLocation: (location: { latitude: null | number; longitude: null | number }) => void;
    spotifyPixelAlbumArt: boolean;
    onToggleSpotifyPixelAlbumArt: () => void;
    spotifyPulse: boolean;
    onToggleSpotifyPulse: () => void;
    spotifyApiBaseUrl: string;
    onSpotifyApiBaseUrlChange: (url: string) => void;
    githubUsername: string;
    onGithubUsernameChange: (username: string) => void;
    githubApiBaseUrl: string;
    onGithubApiBaseUrlChange: (url: string) => void;
    anilistUsername: string;
    onAnilistUsernameChange: (username: string) => void;
    anilistShownLists: ('CURRENT' | 'COMPLETED' | 'PAUSED' | 'DROPPED' | 'PLANNING')[];
    onAnilistShownListsChange: (lists: ('CURRENT' | 'COMPLETED' | 'PAUSED' | 'DROPPED' | 'PLANNING')[]) => void;
    anilistLinkTarget: 'anilist' | 'miruro';
    onAnilistLinkTargetChange: (target: 'anilist' | 'miruro') => void;
    traktApiBaseUrl: string;
    onTraktApiBaseUrlChange: (url: string) => void;

}

export const SettingsAdvancedTab: React.FC<SettingsAdvancedTabProps> = ({
    showWidgetTitles,
    onToggleWidgetTitles,
    showFavicons,
    onToggleShowFavicons,
    reserveSettingsSpace,
    onToggleReserveSettings,
    customFont,
    onCustomFontChange,
    customTabTitle,
    onCustomTabTitleChange,
    customTabFavicon,
    onCustomTabFaviconChange,
    isLayoutLocked,
    onToggleLayoutLock,
    onResetLayout,
    isResizingEnabled,
    onToggleResizing,
    statsMode,
    onStatsModeChange,
    weatherMode,
    onWeatherModeChange,
    weatherShowHourlyForecast,
    onToggleWeatherHourlyForecast,
    timeFormat,
    onTimeFormatChange,
    dateFormat,
    onDateFormatChange,
    clockShowDay,
    onToggleClockShowDay,
    clockShowSeconds,
    onToggleClockShowSeconds,
    openInNewTab,
    onToggleOpenInNewTab,
    searchDefaultEngine,
    onSearchDefaultEngineChange,
    searchEnabledEngines,
    onToggleSearchEngine,
    searchSlashHotkeyEnabled,
    onToggleSearchSlashHotkey,
    activeWidgets,
    funOptions,
    onFunOptionsChange,
    customCss,
    onCustomCssChange,
    weatherLocation, setWeatherLocation,
    spotifyPixelAlbumArt,
    onToggleSpotifyPixelAlbumArt,
    spotifyPulse,
    onToggleSpotifyPulse,
    spotifyApiBaseUrl,
    onSpotifyApiBaseUrlChange,
    githubUsername,
    onGithubUsernameChange,
    githubApiBaseUrl,
    onGithubApiBaseUrlChange,
    anilistUsername,
    onAnilistUsernameChange,
    anilistShownLists,
    onAnilistShownListsChange,
    anilistLinkTarget,
    onAnilistLinkTargetChange,
    traktApiBaseUrl,
    onTraktApiBaseUrlChange,
}) => {
    const clickTimeoutsRef = React.useRef<Record<string, number>>({});
    const faviconFileRef = React.useRef<HTMLInputElement>(null);

    const onFaviconFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file || !isProbablyImageFile(file)) return;
        if (file.size > FAVICON_FILE_INPUT_MAX) {
            window.alert('Image too large to process in the browser (max 15MB).');
            return;
        }
        void (async () => {
            try {
                const data = await compressImageFileToFaviconDataUrl(file);
                onCustomTabFaviconChange(data);
            } catch {
                window.alert('Could not process this image. Try PNG, JPG, WebP, or paste a URL instead.');
            }
        })();
    };

    const handleEngineClick = (engineId: SearchEngineId, clickDetail: number) => {
        const key = String(engineId);

        if (clickDetail === 2) {
            if (clickTimeoutsRef.current[key]) {
                window.clearTimeout(clickTimeoutsRef.current[key]);
                delete clickTimeoutsRef.current[key];
            }
            onSearchDefaultEngineChange(engineId);
            return;
        }

        clickTimeoutsRef.current[key] = window.setTimeout(() => {
            onToggleSearchEngine(engineId);
            delete clickTimeoutsRef.current[key];
        }, 220);
    };

    const ANILIST_LIST_OPTIONS: { id: 'CURRENT' | 'COMPLETED' | 'PAUSED' | 'DROPPED' | 'PLANNING'; label: string }[] = [
        { id: 'CURRENT', label: 'Watching' },
        { id: 'COMPLETED', label: 'Completed' },
        { id: 'PAUSED', label: 'Paused' },
        { id: 'DROPPED', label: 'Dropped' },
        { id: 'PLANNING', label: 'Planning' }
    ];

    const toggleAnilistList = (listId: 'CURRENT' | 'COMPLETED' | 'PAUSED' | 'DROPPED' | 'PLANNING') => {
        const exists = anilistShownLists.includes(listId);
        if (exists) {
            const next = anilistShownLists.filter((id) => id !== listId);
            onAnilistShownListsChange(next.length > 0 ? next : ['CURRENT']);
            return;
        }
        if (anilistShownLists.length >= 3) return;
        onAnilistShownListsChange([...anilistShownLists, listId]);
    };

    return (
        <div className="space-y-6">

            <div className="border border-[var(--color-border)] p-4">
                <h3 className="text-[var(--color-accent)] font-bold mb-2">Appearance</h3>
                <div className="flex flex-col gap-3">

                    <div
                        onClick={onToggleWidgetTitles}
                        className="flex items-center gap-2 cursor-pointer select-none group"
                    >
                        <span className="font-mono text-[var(--color-accent)] font-bold">
                            {showWidgetTitles ? '[x]' : '[ ]'}
                        </span>
                        <span className="text-[var(--color-fg)] text-sm group-hover:text-[var(--color-fg)]">Show Widget Titles</span>
                    </div>

                    <div
                        onClick={onToggleReserveSettings}
                        className="flex items-center gap-2 cursor-pointer select-none group mt-3"
                    >
                        <span className="font-mono text-[var(--color-accent)] font-bold">
                            {reserveSettingsSpace ? '[x]' : '[ ]'}
                        </span>
                        <span className="text-[var(--color-fg)] text-sm group-hover:text-[var(--color-fg)]">Reserve Settings Space</span>
                    </div>

                    <div className="flex flex-col gap-1 mt-2">
                        <span className="text-[var(--color-muted)] text-xs">Custom Font Family</span>
                        <input
                            type="text"
                            placeholder="e.g. Comic Sans MS, Arial"
                            className="bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-fg)] px-2 py-1 text-sm focus:border-[var(--color-accent)] outline-none w-full select-text font-sans"
                            value={customFont}
                            onChange={(e) => onCustomFontChange(e.target.value)}
                        />
                        <span className="text-[var(--color-muted)] text-[10px] opacity-60">Press enter or click away to apply.</span>
                    </div>

                    <div className="flex flex-col gap-1 mt-2 border-t border-[var(--color-border)] pt-3 border-dashed">
                        <span className="text-[var(--color-muted)] text-xs">Tab title</span>
                        <input
                            type="text"
                            className="bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-fg)] px-2 py-1 text-sm focus:border-[var(--color-accent)] outline-none w-full select-text font-sans"
                            value={customTabTitle}
                            onChange={(e) => onCustomTabTitleChange(e.target.value)}
                            placeholder="~"
                        />
                        <span className="text-[var(--color-muted)] text-[10px] opacity-60">Empty defaults to ~.</span>
                    </div>

                    <div className="mt-2 flex flex-col gap-1">
                        <span className="text-[var(--color-muted)] text-xs">Tab favicon</span>
                        <div className="flex min-w-0 flex-nowrap items-center gap-2 overflow-x-auto">
                            <input
                                type="text"
                                className="min-w-[8rem] flex-1 shrink bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-fg)] px-2 py-1 text-sm focus:border-[var(--color-accent)] outline-none select-text font-sans"
                                value={customTabFavicon.startsWith('data:') ? '' : customTabFavicon}
                                onChange={(e) => onCustomTabFaviconChange(e.target.value)}
                                placeholder={
                                    customTabFavicon.startsWith('data:')
                                        ? 'Local image — URL or clear'
                                        : 'https://… (optional)'
                                }
                            />
                            <input
                                ref={faviconFileRef}
                                type="file"
                                accept="image/*,.ico,.png,.jpg,.jpeg,.webp,.gif,.bmp,.avif"
                                className="hidden"
                                onChange={onFaviconFile}
                            />
                            <button
                                type="button"
                                onClick={() => faviconFileRef.current?.click()}
                                className="shrink-0 whitespace-nowrap border border-[var(--color-border)] px-2 py-1 text-xs font-mono text-[var(--color-fg)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] no-radius"
                            >
                                [ CHOOSE IMAGE ]
                            </button>
                            {(customTabFavicon.startsWith('data:') || customTabFavicon.trim().length > 0) && (
                                <button
                                    type="button"
                                    onClick={() => onCustomTabFaviconChange('')}
                                    className="shrink-0 whitespace-nowrap border border-[var(--color-border)] px-2 py-1 text-xs font-mono text-[var(--color-muted)] hover:border-red-500 hover:text-red-500 no-radius"
                                >
                                    [ CLEAR ]
                                </button>
                            )}
                            {customTabFavicon.startsWith('data:') ? (
                                <img
                                    src={customTabFavicon}
                                    alt=""
                                    className="h-8 w-8 shrink-0 border border-[var(--color-border)] object-contain"
                                />
                            ) : null}
                        </div>
                    </div>

                </div>
            </div>


            <div className="border border-[var(--color-border)] p-4">
                <h3 className="text-[var(--color-accent)] font-bold mb-2">Layout</h3>
                <div className="flex flex-col gap-3">

                    <div className="flex items-center gap-4">
                        <button
                            onClick={onToggleLayoutLock}
                            className={`px-3 py-1 border text-xs font-mono transition-colors no-radius ${isLayoutLocked ? 'border-[var(--color-accent)] text-[var(--color-accent)]' : 'border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-fg)]'}`}
                        >
                            [{isLayoutLocked ? 'LOCKED' : 'UNLOCKED'}]
                        </button>
                        <button
                            onClick={onResetLayout}
                            className="px-3 py-1 border border-[var(--color-border)] text-[var(--color-muted)] hover:text-red-500 hover:border-red-500 text-xs font-mono no-radius"
                        >
                            [RESET TO DEFAULT]
                        </button>
                    </div>


                    <div
                        onClick={onToggleResizing}
                        className="flex items-center gap-2 cursor-pointer mt-2 group text-xs font-mono text-left select-none"
                    >
                        <span className={`text-[var(--color-accent)] font-bold`}>
                            {isResizingEnabled ? '[x]' : '[ ]'}
                        </span>
                        <span className={`${isResizingEnabled ? 'text-[var(--color-fg)]' : 'text-[var(--color-muted)] group-hover:text-[var(--color-fg)]'}`}>
                            Enable Resizing (Experimental)
                        </span>
                    </div>
                </div>
            </div>


            <div className="border border-[var(--color-border)] p-4">
                <h3 className="text-[var(--color-accent)] font-bold mb-2">Stats Widget Style</h3>
                <div className="flex flex-col sm:flex-row gap-4 flex-wrap">
                    <div onClick={() => onStatsModeChange('text')} className="flex items-center gap-2 cursor-pointer select-none group">
                        <span className="font-mono text-[var(--color-accent)] font-bold">
                            {statsMode === 'text' ? '[x]' : '[ ]'}
                        </span>
                        <span className="text-[var(--color-fg)] group-hover:text-[var(--color-accent)]">Text</span>
                    </div>
                    <div onClick={() => onStatsModeChange('graph')} className="flex items-center gap-2 cursor-pointer select-none group">
                        <span className="font-mono text-[var(--color-accent)] font-bold">
                            {statsMode === 'graph' ? '[x]' : '[ ]'}
                        </span>
                        <span className="text-[var(--color-fg)] group-hover:text-[var(--color-accent)]">Graphs</span>
                    </div>
                    <div onClick={() => onStatsModeChange('detailed')} className="flex items-center gap-2 cursor-pointer select-none group">
                        <span className="font-mono text-[var(--color-accent)] font-bold">
                            {statsMode === 'detailed' ? '[x]' : '[ ]'}
                        </span>
                        <span className="text-[var(--color-fg)] group-hover:text-[var(--color-accent)]">Detailed</span>
                    </div>
                    <div onClick={() => onStatsModeChange('minimal')} className="flex items-center gap-2 cursor-pointer select-none group">
                        <span className="font-mono text-[var(--color-accent)] font-bold">
                            {statsMode === 'minimal' ? '[x]' : '[ ]'}
                        </span>
                        <span className="text-[var(--color-fg)] group-hover:text-[var(--color-accent)]">Compact</span>
                    </div>
                </div>
            </div>


            <div className="border border-[var(--color-border)] p-4">
                <h3 className="text-[var(--color-accent)] font-bold mb-2">Weather Style</h3>
                <div className="flex flex-col gap-4">

                    <div className="flex flex-col sm:flex-row gap-4">
                        <div onClick={() => onWeatherModeChange('standard')} className="flex items-center gap-2 cursor-pointer select-none group">
                            <span className="font-mono text-[var(--color-accent)] font-bold">
                                {weatherMode === 'standard' ? '[x]' : '[ ]'}
                            </span>
                            <span className="text-[var(--color-fg)] group-hover:text-[var(--color-accent)]">Standard</span>
                        </div>
                        <div onClick={() => onWeatherModeChange('icon')} className="flex items-center gap-2 cursor-pointer select-none group">
                            <span className="font-mono text-[var(--color-accent)] font-bold">
                                {weatherMode === 'icon' ? '[x]' : '[ ]'}
                            </span>
                            <span className="text-[var(--color-fg)] group-hover:text-[var(--color-accent)]">Icon Mode</span>
                        </div>
                    </div>


                    <div
                        onClick={onToggleWeatherHourlyForecast}
                        className="flex items-center gap-2 cursor-pointer select-none group"
                    >
                        <span className="font-mono text-[var(--color-accent)] font-bold">
                            {weatherShowHourlyForecast ? '[x]' : '[ ]'}
                        </span>
                        <span className="text-[var(--color-fg)] group-hover:text-[var(--color-accent)]">Show Hourly Forecast</span>
                    </div>

                    <div className="flex flex-col gap-2 mt-2 border-t border-[var(--color-border)] pt-2 border-dashed">
                        <h3 className="text-[var(--color-accent)] font-bold ">Weather Location</h3>
                        <div className="flex flex-col gap-1 ">
                            <label htmlFor="latitude" className="text-[var(--color-muted)] text-sm">Latitude</label>
                            <input type="text" id="latitude" className="bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-fg)] px-2 py-1 text-sm focus:border-[var(--color-accent)] outline-none w-full select-text font-sans" placeholder={String(weatherLocation.latitude ?? '1.234567')} onChange={(e) => setWeatherLocation({ latitude: Number(e.target.value), longitude: weatherLocation.longitude })} />
                        </div>
                        <div className="flex flex-col gap-1 ">
                            <label htmlFor="longitude" className="text-[var(--color-muted)] text-sm">Longitude</label>
                            <input type="text" id="longitude" className="bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-fg)] px-2 py-1 text-sm focus:border-[var(--color-accent)] outline-none w-full select-text font-sans" placeholder={String(weatherLocation.longitude ?? '1.234567')} onChange={(e) => setWeatherLocation({ latitude: weatherLocation.latitude, longitude: Number(e.target.value) })} />
                        </div>
                    </div>

                </div>
            </div>

            <div className="border border-[var(--color-border)] p-4">
                <h3 className="text-[var(--color-accent)] font-bold mb-2">Date & Time Settings</h3>
                <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-2">
                        <span className="text-[var(--color-muted)] text-xs">Time</span>
                        <div className="flex flex-col sm:flex-row gap-4">
                            <div onClick={() => onTimeFormatChange('12h')} className="flex items-center gap-2 cursor-pointer select-none group">
                                <span className="font-mono text-[var(--color-accent)] font-bold">
                                    {timeFormat === '12h' ? '[x]' : '[ ]'}
                                </span>
                                <span className="text-[var(--color-fg)] group-hover:text-[var(--color-accent)]">12-hour</span>
                            </div>
                            <div onClick={() => onTimeFormatChange('24h')} className="flex items-center gap-2 cursor-pointer select-none group">
                                <span className="font-mono text-[var(--color-accent)] font-bold">
                                    {timeFormat === '24h' ? '[x]' : '[ ]'}
                                </span>
                                <span className="text-[var(--color-fg)] group-hover:text-[var(--color-accent)]">24-hour</span>
                            </div>
                        </div>
                        <div onClick={onToggleClockShowSeconds} className="flex items-center gap-2 cursor-pointer select-none group">
                            <span className="font-mono text-[var(--color-accent)] font-bold">
                                {clockShowSeconds ? '[x]' : '[ ]'}
                            </span>
                            <span className="text-[var(--color-fg)] group-hover:text-[var(--color-accent)]">Show seconds</span>
                        </div>
                    </div>

                    <div className="flex flex-col gap-2">
                        <span className="text-[var(--color-muted)] text-xs">Date</span>
                        <div className="flex flex-col sm:flex-row gap-4">
                            <div onClick={() => onDateFormatChange('long')} className="flex items-center gap-2 cursor-pointer select-none group">
                                <span className="font-mono text-[var(--color-accent)] font-bold">
                                    {dateFormat === 'long' ? '[x]' : '[ ]'}
                                </span>
                                <span className="text-[var(--color-fg)] group-hover:text-[var(--color-accent)]">Long</span>
                            </div>
                            <div onClick={() => onDateFormatChange('short')} className="flex items-center gap-2 cursor-pointer select-none group">
                                <span className="font-mono text-[var(--color-accent)] font-bold">
                                    {dateFormat === 'short' ? '[x]' : '[ ]'}
                                </span>
                                <span className="text-[var(--color-fg)] group-hover:text-[var(--color-accent)]">Short (dd/mm/yy)</span>
                            </div>
                        </div>
                        <div onClick={onToggleClockShowDay} className="flex items-center gap-2 cursor-pointer select-none group">
                            <span className="font-mono text-[var(--color-accent)] font-bold">
                                {clockShowDay ? '[x]' : '[ ]'}
                            </span>
                            <span className="text-[var(--color-fg)] group-hover:text-[var(--color-accent)]">Show day</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="border border-[var(--color-border)] p-4">
                <h3 className="text-[var(--color-accent)] font-bold mb-2">Link Widget</h3>
                <div className="flex flex-col gap-3">
                    <div
                        onClick={onToggleShowFavicons}
                        className="flex items-center gap-2 cursor-pointer select-none group"
                    >
                        <span className="font-mono text-[var(--color-accent)] font-bold">
                            {showFavicons ? '[x]' : '[ ]'}
                        </span>
                        <span className="text-[var(--color-fg)] text-sm group-hover:text-[var(--color-fg)]">Show Favicons</span>
                    </div>
                    <div
                        onClick={() => onToggleOpenInNewTab?.()}
                        className="flex items-center gap-2 cursor-pointer select-none group"
                    >
                        <span className="font-mono text-[var(--color-accent)] font-bold">
                            {openInNewTab ? '[x]' : '[ ]'}
                        </span>
                        <span className="text-[var(--color-fg)] group-hover:text-[var(--color-accent)]">Open Links in New Tab</span>
                    </div>
                </div>
            </div>

            <div className="border border-[var(--color-border)] p-4">
                <h3 className="text-[var(--color-accent)] font-bold mb-2">Search</h3>
                <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                        <span className="text-[var(--color-muted)] text-xs">Engines (single click: enable/disable, double click: set default)</span>
                        <div className="flex flex-wrap gap-4">
                            {SEARCH_ENGINES.map((engine) => (
                                <div
                                    key={engine.id}
                                    onClick={(e) => handleEngineClick(engine.id, e.detail)}
                                    className="flex items-center gap-2 cursor-pointer select-none group"
                                >
                                    <span className="font-mono text-[var(--color-accent)] font-bold">
                                        {searchEnabledEngines.includes(engine.id) ? '[x]' : '[ ]'}
                                    </span>
                                    <span className="text-[var(--color-fg)] group-hover:text-[var(--color-accent)]">
                                        {engine.label}{searchDefaultEngine === engine.id ? ' *' : ''}
                                    </span>
                                </div>
                            ))}
                        </div>
                        <span className="text-[var(--color-muted)] text-[10px] opacity-70">At least one engine stays enabled.</span>
                    </div>
                    <div onClick={onToggleSearchSlashHotkey} className="flex items-center gap-2 cursor-pointer select-none group border-t border-[var(--color-border)] pt-2 border-dashed">
                        <span className="font-mono text-[var(--color-accent)] font-bold">
                            {searchSlashHotkeyEnabled ? '[x]' : '[ ]'}
                        </span>
                        <span className="text-[var(--color-fg)] group-hover:text-[var(--color-accent)]">Use '/' to focus search</span>
                    </div>
                </div>
            </div>

            {activeWidgets.spotify && (
                <div className="border border-[var(--color-border)] p-4">
                    <h3 className="text-[var(--color-accent)] font-bold mb-2">Spotify Widget</h3>
                    <div className="flex flex-col gap-3">
                        <div className="flex flex-col gap-1">
                            <span className="text-[var(--color-muted)] text-xs">Spotify API base URL</span>
                            <input
                                type="url"
                                inputMode="url"
                                autoComplete="off"
                                placeholder="https://your-deploy.vercel.app"
                                className="bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-fg)] px-2 py-1 text-sm focus:border-[var(--color-accent)] outline-none w-full select-text font-sans"
                                value={spotifyApiBaseUrl}
                                onChange={(e) => onSpotifyApiBaseUrlChange(e.target.value)}
                            />
                            <span className="text-[var(--color-muted)] text-[10px] opacity-70">
                                Origin that serves <span className="font-mono">/api/spotify-now-playing</span> (no trailing slash), with <span className="font-mono">SPOTIFY_*</span> on the server. Leave empty when this page&apos;s host already exposes that <span className="font-mono">/api</span> route. Otherwise set your deployed origin here (e.g. Firefox extension).
                            </span>
                        </div>
                        <div
                            onClick={onToggleSpotifyPixelAlbumArt}
                            className="flex items-center gap-2 cursor-pointer select-none group"
                        >
                            <span className="font-mono text-[var(--color-accent)] font-bold">
                                {spotifyPixelAlbumArt ? '[x]' : '[ ]'}
                            </span>
                            <span className="text-[var(--color-fg)] text-sm group-hover:text-[var(--color-fg)]">
                                Pixel album art
                            </span>
                        </div>
                        <div
                            onClick={onToggleSpotifyPulse}
                            className="flex items-center gap-2 cursor-pointer select-none group"
                        >
                            <span className="font-mono text-[var(--color-accent)] font-bold">
                                {spotifyPulse ? '[x]' : '[ ]'}
                            </span>
                            <span className="text-[var(--color-fg)] text-sm group-hover:text-[var(--color-fg)]">
                                EQ Animation
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {activeWidgets.github && (
                <div className="border border-[var(--color-border)] p-4">
                    <h3 className="text-[var(--color-accent)] font-bold mb-2">GitHub Widget</h3>
                    <div className="flex flex-col gap-3">
                        <div className="flex flex-col gap-1">
                            <span className="text-[var(--color-muted)] text-xs">GitHub Username</span>
                            <input
                                type="text"
                                autoComplete="off"
                                placeholder="e.g. octocat"
                                className="bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-fg)] px-2 py-1 text-sm focus:border-[var(--color-accent)] outline-none w-full select-text font-sans"
                                value={githubUsername}
                                onChange={(e) => onGithubUsernameChange(e.target.value)}
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-[var(--color-muted)] text-xs">GitHub API base URL</span>
                            <input
                                type="url"
                                inputMode="url"
                                autoComplete="off"
                                placeholder="https://your-deploy.vercel.app"
                                className="bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-fg)] px-2 py-1 text-sm focus:border-[var(--color-accent)] outline-none w-full select-text font-sans"
                                value={githubApiBaseUrl}
                                onChange={(e) => onGithubApiBaseUrlChange(e.target.value)}
                            />
                            <span className="text-[var(--color-muted)] text-[10px] opacity-70">
                                Origin that serves <span className="font-mono">/api/github-work-items</span> (no trailing slash), with <span className="font-mono">GITHUB_TOKEN</span> set on the server. Leave empty for same-origin.
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {activeWidgets.anilist && (
                <div className="border border-[var(--color-border)] p-4">
                    <h3 className="text-[var(--color-accent)] font-bold mb-2">AniList Widget</h3>
                    <div className="flex flex-col gap-3">
                        <div className="flex flex-col gap-1">
                            <span className="text-[var(--color-muted)] text-xs">AniList Username</span>
                            <input
                                type="text"
                                autoComplete="off"
                                placeholder="e.g. yourname"
                                className="bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-fg)] px-2 py-1 text-sm focus:border-[var(--color-accent)] outline-none w-full select-text font-sans"
                                value={anilistUsername}
                                onChange={(e) => onAnilistUsernameChange(e.target.value)}
                            />
                        </div>
                        <div className="flex flex-col gap-1 border-t border-[var(--color-border)] pt-2 border-dashed">
                            <span className="text-[var(--color-muted)] text-xs">Open anime links in</span>
                            <div className="flex flex-wrap gap-4">
                                <div onClick={() => onAnilistLinkTargetChange('anilist')} className="flex items-center gap-2 cursor-pointer select-none group">
                                    <span className="font-mono text-[var(--color-accent)] font-bold">
                                        {anilistLinkTarget === 'anilist' ? '[x]' : '[ ]'}
                                    </span>
                                    <span className="text-[var(--color-fg)] text-sm">AniList</span>
                                </div>
                                <div onClick={() => onAnilistLinkTargetChange('miruro')} className="flex items-center gap-2 cursor-pointer select-none group">
                                    <span className="font-mono text-[var(--color-accent)] font-bold">
                                        {anilistLinkTarget === 'miruro' ? '[x]' : '[ ]'}
                                    </span>
                                    <span className="text-[var(--color-fg)] text-sm">Miruro</span>
                                </div>
                            </div>
                            <span className="text-[var(--color-muted)] text-[10px] opacity-70">
                                Miruro format: https://www.miruro.to/watch/&lt;anilist-id&gt;/
                            </span>
                        </div>
                        <div className="flex flex-col gap-1 border-t border-[var(--color-border)] pt-2 border-dashed">
                            <span className="text-[var(--color-muted)] text-xs">Lists to show (max 3)</span>
                            <div className="flex flex-wrap gap-3">
                                {ANILIST_LIST_OPTIONS.map((option) => (
                                    <div
                                        key={option.id}
                                        onClick={() => toggleAnilistList(option.id)}
                                        className={`flex items-center gap-2 select-none ${anilistShownLists.length >= 3 && !anilistShownLists.includes(option.id) ? 'cursor-not-allowed opacity-60' : 'cursor-pointer group'}`}
                                    >
                                        <span className="font-mono text-[var(--color-accent)] font-bold">
                                            {anilistShownLists.includes(option.id) ? '[x]' : '[ ]'}
                                        </span>
                                        <span className="text-[var(--color-fg)] text-sm">{option.label}</span>
                                    </div>
                                ))}
                            </div>
                            <span className="text-[var(--color-muted)] text-[10px] opacity-70">
                                Selected: {anilistShownLists.length}/3
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {activeWidgets.trakt && (
                <div className="border border-[var(--color-border)] p-4">
                    <h3 className="text-[var(--color-accent)] font-bold mb-2">Trakt Widget</h3>
                    <div className="flex flex-col gap-3">
                        <div className="flex flex-col gap-1">
                            <span className="text-[var(--color-muted)] text-xs">Trakt API base URL</span>
                            <input
                                type="url"
                                inputMode="url"
                                autoComplete="off"
                                placeholder="https://your-deploy.vercel.app"
                                className="bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-fg)] px-2 py-1 text-sm focus:border-[var(--color-accent)] outline-none w-full select-text font-sans"
                                value={traktApiBaseUrl}
                                onChange={(e) => onTraktApiBaseUrlChange(e.target.value)}
                            />
                            <span className="text-[var(--color-muted)] text-[10px] opacity-70">
                                Origin that serves <span className="font-mono">/api/trakt-continue-watching</span> (no trailing slash), with <span className="font-mono">TRAKT_CLIENT_ID</span>, <span className="font-mono">TRAKT_CLIENT_SECRET</span>, and <span className="font-mono">TRAKT_REFRESH_TOKEN</span> set on the server. Leave empty for same-origin.
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* matrix */}
            {activeWidgets['matrix'] && (
                <div className="border border-[var(--color-border)] p-4 space-y-3">
                    <h3 className="text-[var(--color-accent)] font-bold">⬡ Matrix Widget</h3>

                    <AsciiSlider
                        label="Drop Speed" value={funOptions.matrix.speed} min={5} max={200}
                        displayValue={`${funOptions.matrix.speed}%`}
                        onChange={(v) => onFunOptionsChange({ ...funOptions, matrix: { ...funOptions.matrix, speed: v } })}
                    />

                    <AsciiSlider
                        label="Trail Fade" value={funOptions.matrix.fade} min={0.01} max={0.3} step={0.01}
                        displayValue={`${Math.round((1 - funOptions.matrix.fade * 3.33) * 100)}%`}
                        onChange={(v) => onFunOptionsChange({ ...funOptions, matrix: { ...funOptions.matrix, fade: v } })}
                        hint="Lower = longer trails"
                    />

                    <AsciiSlider
                        label="Letter Size" value={funOptions.matrix.fontSize} min={8} max={32}
                        displayValue={`${funOptions.matrix.fontSize}px`}
                        onChange={(v) => onFunOptionsChange({ ...funOptions, matrix: { ...funOptions.matrix, fontSize: v } })}
                    />


                    <div className="flex items-center justify-between">
                        <span className="text-xs text-[var(--color-fg)]">Glow Letters</span>
                        <div
                            onClick={() => onFunOptionsChange({ ...funOptions, matrix: { ...funOptions.matrix, glow: !funOptions.matrix.glow } })}
                            className="cursor-pointer text-xs font-mono text-[var(--color-accent)] hover:text-[var(--color-fg)] transition-colors select-none"
                        >
                            {funOptions.matrix.glow ? '[x]' : '[ ]'}
                        </div>
                    </div>


                    <div>
                        <div className="text-xs text-[var(--color-fg)] mb-2">Character Set</div>
                        <div className="flex flex-wrap gap-2 text-xs">
                            {(['mixed', 'numbers', 'latin'] as const).map((mode) => (
                                <div
                                    key={mode}
                                    onClick={() => onFunOptionsChange({ ...funOptions, matrix: { ...funOptions.matrix, charSet: mode } })}
                                    className={`cursor-pointer px-2 py-1 border ${funOptions.matrix.charSet === mode ? 'border-[var(--color-accent)] text-[var(--color-accent)]' : 'border-[var(--color-border)] text-[var(--color-muted)]'}`}
                                >
                                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
            {/* pipes */}
            {activeWidgets['pipes'] && (
                <div className="border border-[var(--color-border)] p-4 space-y-3">
                    <h3 className="text-[var(--color-accent)] font-bold">⬡ Pipes Widget</h3>

                    <AsciiSlider
                        label="Draw Speed" value={funOptions.pipes.speed} min={5} max={200}
                        displayValue={`${funOptions.pipes.speed}%`}
                        onChange={(v) => onFunOptionsChange({ ...funOptions, pipes: { ...funOptions.pipes, speed: v } })}
                    />

                    <AsciiSlider
                        label="Trail Length" value={funOptions.pipes.fade} min={0.01} max={0.5} step={0.01}
                        displayValue={`${Math.round((1 - funOptions.pipes.fade * 2) * 100)}%`}
                        onChange={(v) => onFunOptionsChange({ ...funOptions, pipes: { ...funOptions.pipes, fade: v } })}
                        hint="Lower = longer trails"
                    />

                    <AsciiSlider
                        label="Lifetime" value={funOptions.pipes.lifetime} min={20} max={300} step={5}
                        displayValue={`${funOptions.pipes.lifetime} steps`}
                        onChange={(v) => onFunOptionsChange({ ...funOptions, pipes: { ...funOptions.pipes, lifetime: v } })}
                        hint="How long before a pipe resets"
                    />

                    <AsciiSlider
                        label="Pipe Count" value={funOptions.pipes.count} min={1} max={10}
                        onChange={(v) => onFunOptionsChange({ ...funOptions, pipes: { ...funOptions.pipes, count: v } })}
                    />

                    <AsciiSlider
                        label="Pipe Size" value={funOptions.pipes.fontSize} min={8} max={32}
                        displayValue={`${funOptions.pipes.fontSize}px`}
                        onChange={(v) => onFunOptionsChange({ ...funOptions, pipes: { ...funOptions.pipes, fontSize: v } })}
                    />
                </div>
            )}
            {/* donut */}
            {activeWidgets['donut'] && (
                <div className="border border-[var(--color-border)] p-4 space-y-3">
                    <h3 className="text-[var(--color-accent)] font-bold">⬡ Donut Widget</h3>

                    <AsciiSlider
                        label="Spin Speed" value={funOptions.donut.speed} min={5} max={200}
                        displayValue={`${funOptions.donut.speed}%`}
                        onChange={(v) => onFunOptionsChange({ ...funOptions, donut: { ...funOptions.donut, speed: v } })}
                    />
                </div>
            )}
            {/* snake */}
            {activeWidgets['snake'] && (
                <div className="border border-[var(--color-border)] p-4 space-y-3">
                    <h3 className="text-[var(--color-accent)] font-bold">⬡ Snake Widget</h3>
                    <AsciiSlider
                        label="Speed" value={funOptions.snake.speed} min={5} max={100}
                        displayValue={`${funOptions.snake.speed}%`}
                        onChange={(v) => onFunOptionsChange({ ...funOptions, snake: { ...funOptions.snake, speed: v } })}
                    />
                </div>
            )}
            {/* game of life */}
            {activeWidgets['life'] && (
                <div className="border border-[var(--color-border)] p-4 space-y-3">
                    <h3 className="text-[var(--color-accent)] font-bold">⬡ Conway's Life Widget</h3>
                    <AsciiSlider
                        label="Speed" value={funOptions.life.speed} min={5} max={100}
                        displayValue={`${funOptions.life.speed}%`}
                        onChange={(v) => onFunOptionsChange({ ...funOptions, life: { ...funOptions.life, speed: v } })}
                    />
                </div>
            )}
            {/* fireworks */}
            {activeWidgets['fireworks'] && (
                <div className="border border-[var(--color-border)] p-4 space-y-3">
                    <h3 className="text-[var(--color-accent)] font-bold">⬡ Fireworks Widget</h3>
                    <AsciiSlider
                        label="Explosion Size" value={funOptions.fireworks.explosionSize ?? 50} min={10} max={200}
                        displayValue={`${funOptions.fireworks.explosionSize ?? 50}%`}
                        onChange={(v) => onFunOptionsChange({ ...funOptions, fireworks: { ...funOptions.fireworks, explosionSize: v } })}
                    />
                    <AsciiSlider
                        label="Frequency" value={funOptions.fireworks.speed} min={55} max={400}
                        displayValue={`${funOptions.fireworks.speed}%`}
                        onChange={(v) => onFunOptionsChange({ ...funOptions, fireworks: { ...funOptions.fireworks, speed: v } })}
                    />
                </div>
            )}
            {/* starfield */}
            {activeWidgets['starfield'] && (
                <div className="border border-[var(--color-border)] p-4 space-y-3">
                    <h3 className="text-[var(--color-accent)] font-bold">⬡ Starfield Widget</h3>
                    <AsciiSlider
                        label="Warp Speed" value={funOptions.starfield.speed} min={5} max={100}
                        displayValue={`${funOptions.starfield.speed}%`}
                        onChange={(v) => onFunOptionsChange({ ...funOptions, starfield: { ...funOptions.starfield, speed: v } })}
                    />
                </div>
            )}
            {/* rain */}
            {activeWidgets['rain'] && (
                <div className="border border-[var(--color-border)] p-4 space-y-3">
                    <h3 className="text-[var(--color-accent)] font-bold">⬡ Rain Widget</h3>
                    <AsciiSlider
                        label="Intensity" value={funOptions.rain.speed} min={5} max={100}
                        displayValue={`${funOptions.rain.speed}%`}
                        onChange={(v) => onFunOptionsChange({ ...funOptions, rain: { ...funOptions.rain, speed: v } })}
                    />
                </div>
            )}
            {/* maze */}
            {activeWidgets['maze'] && (
                <div className="border border-[var(--color-border)] p-4 space-y-3">
                    <h3 className="text-[var(--color-accent)] font-bold">⬡ Maze Widget</h3>
                    <AsciiSlider
                        label="Generation Speed" value={funOptions.maze.speed} min={5} max={100}
                        displayValue={`${funOptions.maze.speed}%`}
                        onChange={(v) => onFunOptionsChange({ ...funOptions, maze: { ...funOptions.maze, speed: v } })}
                    />
                </div>
            )}

            <div className="border border-[var(--color-border)] p-4">
                <h3 className="text-[var(--color-accent)] font-bold mb-2">Custom CSS</h3>
                <p className="text-[var(--color-muted)] text-xs mb-2">Override theme styles. Saved locally.</p>
                <textarea
                    className="w-full h-40 bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-fg)] p-2 font-mono text-xs focus:border-[var(--color-accent)] outline-none select-text"
                    placeholder=".tui-box { border-radius: 10px; }"
                    value={customCss}
                    onChange={(e) => onCustomCssChange(e.target.value)}
                />
            </div>


            <div className="border border-[var(--color-border)] p-4">
                <h3 className="text-[var(--color-accent)] font-bold mb-2">Export / Import Settings</h3>
                <p className="text-[var(--color-muted)] text-xs mb-3">Backup all settings to a JSON file, or restore from a previous backup.</p>
                <div className="flex gap-3 flex-wrap">
                    <button
                        onClick={() => {
                            const data: Record<string, any> = {};
                            for (let i = 0; i < localStorage.length; i++) {
                                const key = localStorage.key(i);
                                if (key && key.startsWith('tui-')) {
                                    try {
                                        data[key] = JSON.parse(localStorage.getItem(key)!);
                                    } catch {
                                        data[key] = localStorage.getItem(key);
                                    }
                                }
                            }
                            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `terminal-tab-settings-${new Date().toISOString().slice(0, 10)}.json`;
                            a.click();
                            URL.revokeObjectURL(url);
                        }}
                        className="px-4 py-1 border border-[var(--color-border)] text-[var(--color-fg)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] text-xs font-mono no-radius transition-colors"
                    >
                        [ EXPORT ]
                    </button>
                    <button
                        onClick={() => {
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.accept = '.json';
                            input.onchange = (e: any) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                const reader = new FileReader();
                                reader.onload = (ev) => {
                                    try {
                                        const data = JSON.parse(ev.target?.result as string);
                                        if (typeof data !== 'object' || data === null) {
                                            alert('Invalid settings file.');
                                            return;
                                        }
                                        Object.entries(data).forEach(([key, value]) => {
                                            if (key.startsWith('tui-')) {
                                                localStorage.setItem(key, JSON.stringify(value));
                                            }
                                        });
                                        window.location.reload();
                                    } catch {
                                        alert('Failed to parse settings file.');
                                    }
                                };
                                reader.readAsText(file);
                            };
                            input.click();
                        }}
                        className="px-4 py-1 border border-[var(--color-border)] text-[var(--color-fg)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] text-xs font-mono no-radius transition-colors"
                    >
                        [ IMPORT ]
                    </button>
                </div>
            </div>

            <div className="text-[10px] text-[var(--color-muted)] mt-6 text-center opacity-50 font-mono">
                Terminal Tab v1.0.1
            </div>
        </div>
    );
};
