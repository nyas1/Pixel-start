import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useStickyState } from '../hooks/useStickyState';
import { THEMES, LINKS_DATA, SEARCH_ENGINES } from '../constants';
import { TodoItem, LinkGroup, Theme, Layouts, FunOptions, SearchEngineId } from '../types';

// Default Layouts
const DEFAULT_LAYOUTS: Layouts = {
    lg: [
        { i: 'settings-guard', x: 11, y: 0, w: 1, h: 1, static: true },
        { i: 'search', x: 2, y: 0, w: 7, h: 2, minW: 1, minH: 2 },
        { i: 'spotify', x: 9, y: 0, w: 3, h: 3, minW: 2, minH: 2 },
        { i: 'datetime', x: 6, y: 2, w: 3, h: 3, minW: 1, minH: 2 },
        { i: 'stats', x: 5, y: 2, w: 1, h: 3, minW: 1, minH: 2 },
        { i: 'weather', x: 2, y: 2, w: 3, h: 9, minW: 1, minH: 2 },
        { i: 'todo', x: 5, y: 5, w: 4, h: 6, minW: 1, minH: 2 },
        { i: 'links', x: 2, y: 11, w: 7, h: 5, minW: 1, minH: 2 },
        { i: 'snake', x: 2, y: 16, w: 7, h: 2, minW: 1, minH: 2 }
    ],
    md: [
        { i: 'search', x: 0, y: 0, w: 11, h: 2, minW: 2, minH: 2 },
        { i: 'settings-guard', x: 11, y: 0, w: 1, h: 1, static: true },
        { i: 'spotify', x: 8, y: 2, w: 4, h: 4, minW: 2, minH: 2 },
        { i: 'datetime', x: 0, y: 2, w: 8, h: 4, minW: 2, minH: 2 },
        { i: 'stats', x: 8, y: 6, w: 4, h: 3, minW: 2, minH: 2 },
        { i: 'weather', x: 0, y: 6, w: 4, h: 6, minW: 2, minH: 2 },
        { i: 'todo', x: 4, y: 6, w: 8, h: 6, minW: 2, minH: 2 },
        { i: 'links', x: 0, y: 12, w: 12, h: 4, minW: 2, minH: 2 },
        { i: 'snake', x: 0, y: 44, w: 2, h: 4, minW: 1, minH: 2 }
    ],
    sm: [
        { i: 'settings-guard', x: 5, y: 0, w: 1, h: 1, static: true },
        { i: 'search', x: 0, y: 0, w: 5, h: 2, minW: 2, minH: 2 },
        { i: 'spotify', x: 0, y: 2, w: 6, h: 3, minW: 2, minH: 2 },
        { i: 'datetime', x: 0, y: 5, w: 6, h: 4, minW: 2, minH: 2 },
        { i: 'stats', x: 0, y: 9, w: 6, h: 3, minW: 2, minH: 2 },
        { i: 'weather', x: 0, y: 12, w: 6, h: 4, minW: 2, minH: 2 },
        { i: 'todo', x: 0, y: 16, w: 6, h: 5, minW: 2, minH: 2 },
        { i: 'links', x: 0, y: 21, w: 6, h: 4, minW: 2, minH: 2 },
        { i: 'snake', x: 0, y: 25, w: 2, h: 4, minW: 1, minH: 2 }
    ]
};

const funDefaults: FunOptions = {
    matrix: { speed: 50, fade: 0.05, charSet: 'mixed' as const, charFlux: 30, glow: true, fontSize: 16 },
    pipes: { speed: 50, fade: 0.1, count: 5, fontSize: 16, lifetime: 80 },
    donut: { speed: 50 },
    snake: { speed: 100 },
    life: { speed: 50 },
    fireworks: { speed: 50, explosionSize: 50 },
    starfield: { speed: 25 },
    rain: { speed: 48 },
    maze: { speed: 50 },
};

const DEFAULT_SEARCH_ENGINE_IDS = SEARCH_ENGINES.map((engine) => engine.id);

interface AppContextType {
    currentTheme: string;
    setCurrentTheme: (theme: string) => void;
    customThemes: Record<string, Theme>;
    setCustomThemes: (themes: Record<string, Theme>) => void;
    isThemeMakerOpen: boolean;
    setIsThemeMakerOpen: (isOpen: boolean) => void;
    todos: TodoItem[];
    setTodos: (todos: TodoItem[]) => void;
    linkGroups: LinkGroup[];
    setLinkGroups: (groups: LinkGroup[]) => void;
    customCss: string;
    setCustomCss: (css: string) => void;
    statsMode: 'text' | 'graph' | 'detailed' | 'minimal';
    setStatsMode: (mode: 'text' | 'graph' | 'detailed' | 'minimal') => void;
    weatherMode: 'standard' | 'icon';
    setWeatherMode: (mode: 'standard' | 'icon') => void;
    weatherShowHourlyForecast: boolean;
    setWeatherShowHourlyForecast: (show: boolean) => void;
    layouts: Layouts;
    setLayouts: (layouts: Layouts) => void;
    tempUnit: 'C' | 'F';
    setTempUnit: (unit: 'C' | 'F') => void;
    timeFormat: '12h' | '24h';
    setTimeFormat: (format: '12h' | '24h') => void;
    dateFormat: 'long' | 'short';
    setDateFormat: (format: 'long' | 'short') => void;
    clockShowDay: boolean;
    setClockShowDay: (show: boolean) => void;
    clockShowSeconds: boolean;
    setClockShowSeconds: (show: boolean) => void;
    openInNewTab: boolean;
    setOpenInNewTab: (isOpen: boolean) => void;
    searchDefaultEngine: SearchEngineId;
    setSearchDefaultEngine: (engine: SearchEngineId) => void;
    searchEnabledEngines: SearchEngineId[];
    setSearchEnabledEngines: (engines: SearchEngineId[]) => void;
    searchSlashHotkeyEnabled: boolean;
    setSearchSlashHotkeyEnabled: (enabled: boolean) => void;
    showWidgetTitles: boolean;
    setShowWidgetTitles: (show: boolean) => void;
    showFavicons: boolean;
    setShowFavicons: (show: boolean) => void;
    reserveSettingsSpace: boolean;
    setReserveSettingsSpace: (reserve: boolean) => void;
    customFont: string;
    setCustomFont: (font: string) => void;
    customTabTitle: string;
    setCustomTabTitle: (title: string) => void;
    /** Data URL or https URL; empty restores default tab icon behavior. */
    customTabFavicon: string;
    setCustomTabFavicon: (href: string) => void;
    funOptions: FunOptions;
    setFunOptions: (options: FunOptions) => void;
    activeWidgets: Record<string, boolean>;
    setActiveWidgets: (widgets: Record<string, boolean>) => void;
    /** When true, Spotify cover uses pixel-downscaled art; when false, full-resolution image. */
    spotifyPixelAlbumArt: boolean;
    setSpotifyPixelAlbumArt: (value: boolean) => void;
    /** When true, Spotify shows animated EQ bars; when false, the bar strip is hidden. */
    spotifyPulse: boolean;
    setSpotifyPulse: (value: boolean) => void;
    /**
     * Optional https origin for /api/spotify-now-playing. Empty = same-origin /api only
     * (when this app is served from the host that exposes the API).
     */
    spotifyApiBaseUrl: string;
    setSpotifyApiBaseUrl: (url: string) => void;
    /** GitHub username used to query assigned/authored issues and PRs. */
    githubUsername: string;
    setGithubUsername: (value: string) => void;
    /** Optional https origin for /api/github-work-items. Empty = same-origin /api. */
    githubApiBaseUrl: string;
    setGithubApiBaseUrl: (url: string) => void;
    /** AniList username used for currently watching anime. */
    anilistUsername: string;
    setAnilistUsername: (value: string) => void;
    /** AniList list statuses to show in widget (max 3). */
    anilistShownLists: ('CURRENT' | 'COMPLETED' | 'PAUSED' | 'DROPPED' | 'PLANNING')[];
    setAnilistShownLists: (value: ('CURRENT' | 'COMPLETED' | 'PAUSED' | 'DROPPED' | 'PLANNING')[]) => void;
    /** Where AniList widget links open: AniList page or Miruro watch page. */
    anilistLinkTarget: 'anilist' | 'miruro';
    setAnilistLinkTarget: (value: 'anilist' | 'miruro') => void;
    /** Optional https origin for /api/trakt-continue-watching. Empty = same-origin /api. */
    traktApiBaseUrl: string;
    setTraktApiBaseUrl: (url: string) => void;
    isLayoutLocked: boolean;
    setIsLayoutLocked: (locked: boolean) => void;
    isResizingEnabled: boolean;
    setIsResizingEnabled: (enabled: boolean) => void;
    presets: any[];
    setPresets: (presets: any[]) => void;

    weatherLocation: { latitude: null | number; longitude: null | number };
    setWeatherLocation: (location: { latitude: null | number; longitude: null | number }) => void;

    // Actions
    handleSaveCustomTheme: (newTheme: Theme) => void;
    handleDeleteCustomTheme: (name: string) => void;
    resetLayout: () => void;
    toggleWidget: (key: string) => void;
    addExtraWidget: (type: string) => void;
    removeExtraWidget: (key: string) => void;
    handleSavePreset: (name: string) => void;
    handleLoadPreset: (preset: any) => void;
    handleDeletePreset: (id: number) => void;

    // Computed
    allThemes: Record<string, Theme>;
    isCrt: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [currentTheme, setCurrentTheme] = useStickyState<string>('greyish', 'tui-theme');
    const [customThemes, setCustomThemes] = useStickyState<Record<string, Theme>>({}, 'tui-custom-themes');
    const [isThemeMakerOpen, setIsThemeMakerOpen] = useState(false);

    const [todos, setTodos] = useStickyState<TodoItem[]>([], 'tui-todos');
    const [linkGroups, setLinkGroups] = useStickyState<LinkGroup[]>(LINKS_DATA, 'tui-links');
    const [customCss, setCustomCss] = useStickyState<string>('', 'tui-custom-css');
    const [statsMode, setStatsMode] = useStickyState<'text' | 'graph' | 'detailed' | 'minimal'>('minimal', 'tui-stats-mode');
    const [weatherMode, setWeatherMode] = useStickyState<'standard' | 'icon'>('standard', 'tui-weather-mode');
    const [weatherShowHourlyForecast, setWeatherShowHourlyForecast] = useStickyState<boolean>(true, 'tui-weather-show-hourly');
    const [layouts, setLayouts] = useStickyState<Layouts>(DEFAULT_LAYOUTS, 'tui-layouts-v4');

    const [tempUnit, setTempUnit] = useStickyState<'C' | 'F'>('C', 'tui-temp-unit');
    const [timeFormat, setTimeFormat] = useStickyState<'12h' | '24h'>('12h', 'tui-time-format');
    const [dateFormat, setDateFormat] = useStickyState<'long' | 'short'>('long', 'tui-date-format');
    const [clockShowDay, setClockShowDay] = useStickyState<boolean>(true, 'tui-clock-show-day');
    const [clockShowSeconds, setClockShowSeconds] = useStickyState<boolean>(true, 'tui-clock-show-seconds');

    const [openInNewTab, setOpenInNewTab] = useStickyState<boolean>(false, 'tui-open-new-tab');
    const [searchDefaultEngine, setSearchDefaultEngine] = useStickyState<SearchEngineId>('google', 'tui-search-default-engine');
    const [searchEnabledEngines, setSearchEnabledEngines] = useStickyState<SearchEngineId[]>(DEFAULT_SEARCH_ENGINE_IDS, 'tui-search-enabled-engines');
    const [searchSlashHotkeyEnabled, setSearchSlashHotkeyEnabled] = useStickyState<boolean>(true, 'tui-search-slash-hotkey');
    const [showWidgetTitles, setShowWidgetTitles] = useStickyState<boolean>(true, 'tui-show-titles');
    const [showFavicons, setShowFavicons] = useStickyState<boolean>(true, 'tui-show-favicons');
    const [reserveSettingsSpace, setReserveSettingsSpace] = useStickyState<boolean>(true, 'tui-reserve-settings');
    const [customFont, setCustomFont] = useStickyState<string>('', 'tui-custom-font');
    const [customTabTitle, setCustomTabTitle] = useStickyState<string>('~', 'tui-tab-title');
    const [customTabFavicon, setCustomTabFavicon] = useStickyState<string>('', 'tui-tab-favicon');

    const [funOptionsRaw, setFunOptions] = useStickyState<FunOptions>(funDefaults, 'tui-fun-options-v3');

    const [weatherLocation, setWeatherLocation] = useStickyState<{ latitude: null | number; longitude: null | number }>({ latitude: null, longitude: null }, 'tui-weather-location');


    // merge defaults
    const funOptions = {
        matrix: { ...funDefaults.matrix, ...funOptionsRaw?.matrix },
        pipes: { ...funDefaults.pipes, ...funOptionsRaw?.pipes },
        donut: { ...funDefaults.donut, ...funOptionsRaw?.donut },
        snake: { ...funDefaults.snake, ...funOptionsRaw?.snake },
        life: { ...funDefaults.life, ...funOptionsRaw?.life },
        fireworks: { ...funDefaults.fireworks, ...funOptionsRaw?.fireworks },
        starfield: { ...funDefaults.starfield, ...funOptionsRaw?.starfield },
        rain: { ...funDefaults.rain, ...funOptionsRaw?.rain },
        maze: { ...funDefaults.maze, ...funOptionsRaw?.maze },
    };

    const [activeWidgets, setActiveWidgets] = useStickyState<Record<string, boolean>>({
        search: true,
        datetime: true,
        stats: true,
        weather: true,
        todo: true,
        links: true,
        spotify: false,
        github: false,
        anilist: false,
        trakt: false,
        donut: false,
        matrix: false,
        pipes: false,
        snake: true,
        life: false,
        fireworks: false,
        starfield: false,
        rain: false,
        maze: false
    }, 'tui-active-widgets-v4');

    const [spotifyPixelAlbumArt, setSpotifyPixelAlbumArt] = useStickyState<boolean>(true, 'tui-spotify-pixel-album-art');
    const [spotifyPulse, setSpotifyPulse] = useStickyState<boolean>(true, 'tui-spotify-pulse');
    const [spotifyApiBaseUrl, setSpotifyApiBaseUrl] = useStickyState<string>('', 'tui-spotify-api-base-url');
    const [githubUsername, setGithubUsername] = useStickyState<string>('', 'tui-github-username');
    const [githubApiBaseUrl, setGithubApiBaseUrl] = useStickyState<string>('', 'tui-github-api-base-url');
    const [anilistUsername, setAnilistUsername] = useStickyState<string>('', 'tui-anilist-username');
    const [anilistShownLists, setAnilistShownLists] = useStickyState<('CURRENT' | 'COMPLETED' | 'PAUSED' | 'DROPPED' | 'PLANNING')[]>(['CURRENT'], 'tui-anilist-shown-lists');
    const [anilistLinkTarget, setAnilistLinkTarget] = useStickyState<'anilist' | 'miruro'>('anilist', 'tui-anilist-link-target');
    const [traktApiBaseUrl, setTraktApiBaseUrl] = useStickyState<string>('', 'tui-trakt-api-base-url');

    const [isLayoutLocked, setIsLayoutLocked] = useStickyState<boolean>(true, 'tui-layout-locked-v2');
    const [isResizingEnabled, setIsResizingEnabled] = useStickyState<boolean>(false, 'tui-resizing-enabled');
    const [presets, setPresets] = useStickyState<any[]>([], 'tui-presets');

    const allThemes = { ...THEMES, ...customThemes };
    const isCrt = currentTheme === 'crt';

    useEffect(() => {
        const title = (customTabTitle ?? '').trim() || '~';
        document.title = title;

        const url = (customTabFavicon ?? '').trim();
        let link = document.querySelector('link[data-tui-favicon="1"]') as HTMLLinkElement | null;
        if (!url) {
            if (link) link.remove();
            return;
        }
        if (!link) {
            link = document.createElement('link');
            link.rel = 'icon';
            link.setAttribute('data-tui-favicon', '1');
            document.head.appendChild(link);
        }
        link.href = url;
    }, [customTabTitle, customTabFavicon]);

    // settings-guard
    useEffect(() => {
        if (reserveSettingsSpace) {
            setLayouts((prevLayouts) => {
                const nextLayouts = { ...prevLayouts };
                let hasChanges = false;

                (['lg', 'md', 'sm', 'xs', 'xxs'] as const).forEach((bp) => {
                    if (!nextLayouts[bp]) return;

                    const layout = [...nextLayouts[bp]];
                    const guardIndex = layout.findIndex((item) => item.i === 'settings-guard');

                    let targetX = 0;
                    if (bp === 'lg' || bp === 'md') targetX = 11;
                    else if (bp === 'sm') targetX = 5;
                    else if (bp === 'xs') targetX = 3;
                    else if (bp === 'xxs') targetX = 1;

                    const guardItem = { i: 'settings-guard', x: targetX, y: 0, w: 1, h: 1, static: true };

                    if (guardIndex === -1) {
                        layout.push(guardItem);
                        nextLayouts[bp] = layout;
                        hasChanges = true;
                    } else {
                        const current = layout[guardIndex];
                        if (current.x !== targetX || current.y !== 0 || !current.static || current.w !== 1 || current.h !== 1) {
                            layout[guardIndex] = { ...current, ...guardItem };
                            nextLayouts[bp] = layout;
                            hasChanges = true;
                        }
                    }
                });

                return hasChanges ? nextLayouts : prevLayouts;
            });
        }
    }, [reserveSettingsSpace, setLayouts]);

    // migrations
    useEffect(() => {
        if (currentTheme === 'vss') {
            setCurrentTheme('crt');
        }
        if (currentTheme === 'lavander') {
            setCurrentTheme('lavender');
        }
        // @ts-ignore - handling migration from old state
        if (weatherMode === 'ascii') {
            // @ts-ignore
            setWeatherMode('icon');
        }
    }, [currentTheme, setCurrentTheme, weatherMode, setWeatherMode]);

    // Migrate old search engine key.
    useEffect(() => {
        const legacyEngine = localStorage.getItem('tui-search-engine') as SearchEngineId | null;
        if (!legacyEngine) return;
        if (!DEFAULT_SEARCH_ENGINE_IDS.includes(legacyEngine)) return;
        if (searchDefaultEngine === 'google') {
            setSearchDefaultEngine(legacyEngine);
        }
        localStorage.removeItem('tui-search-engine');
    }, [searchDefaultEngine, setSearchDefaultEngine]);

    // Keep search settings valid.
    useEffect(() => {
        if (!searchEnabledEngines || searchEnabledEngines.length === 0) {
            setSearchEnabledEngines(DEFAULT_SEARCH_ENGINE_IDS);
            return;
        }

        if (!searchEnabledEngines.includes(searchDefaultEngine)) {
            setSearchDefaultEngine(searchEnabledEngines[0]);
        }
    }, [searchDefaultEngine, searchEnabledEngines, setSearchDefaultEngine, setSearchEnabledEngines]);

    // Apply Theme
    useEffect(() => {
        const theme = allThemes[currentTheme] || THEMES['greyish'];
        const root = document.documentElement;

        root.style.setProperty('--color-bg', theme.colors.bg);
        root.style.setProperty('--color-fg', theme.colors.fg);
        root.style.setProperty('--color-muted', theme.colors.muted);
        root.style.setProperty('--color-border', theme.colors.border);
        root.style.setProperty('--color-accent', theme.colors.accent);
        root.style.setProperty('--color-hover', theme.colors.hover);

        document.body.style.backgroundColor = theme.colors.bg;
    }, [currentTheme, allThemes]); // Added allThemes to deps

    // Apply Custom CSS
    useEffect(() => {
        const styleId = 'tui-user-custom-css';
        let styleEl = document.getElementById(styleId) as HTMLStyleElement;
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = styleId;
            document.head.appendChild(styleEl);
        }
        styleEl.textContent = customCss;
    }, [customCss]);

    // Actions
    const handleSaveCustomTheme = (newTheme: Theme) => {
        setCustomThemes(prev => ({
            ...prev,
            [newTheme.name]: newTheme
        }));
        setCurrentTheme(newTheme.name);
        setIsThemeMakerOpen(false);
    };

    const handleDeleteCustomTheme = (name: string) => {
        const newThemes = { ...customThemes };
        delete newThemes[name];
        setCustomThemes(newThemes);
        if (currentTheme === name) {
            setCurrentTheme('greyish');
        }
    };

    const resetLayout = () => {
        setLayouts(DEFAULT_LAYOUTS);
        setActiveWidgets({
            search: true,
            datetime: true,
            stats: true,
            weather: true,
            todo: true,
            links: true,
            spotify: false,
            github: false,
            anilist: false,
            trakt: false,
            donut: false,
            matrix: false,
            pipes: false,
            snake: true,
            life: false,
            fireworks: false,
            starfield: false,
            rain: false,
            maze: false
        });
        setShowWidgetTitles(true);
        setShowFavicons(true);
        setCustomFont('');
        setCustomTabTitle('~');
        setCustomTabFavicon('');
        setStatsMode('minimal');
        setWeatherMode('standard');
        setWeatherShowHourlyForecast(true);
        setTempUnit('C');
        setTimeFormat('12h');
        setDateFormat('long');
        setClockShowDay(true);
        setClockShowSeconds(true);
        setFunOptions(funDefaults);
        setSearchDefaultEngine('google');
        setSearchEnabledEngines(DEFAULT_SEARCH_ENGINE_IDS);
        setSearchSlashHotkeyEnabled(true);
        setSpotifyPixelAlbumArt(true);
        setSpotifyPulse(true);
        setSpotifyApiBaseUrl('');
        setGithubUsername('');
        setGithubApiBaseUrl('');
        setAnilistUsername('');
        setAnilistShownLists(['CURRENT']);
        setAnilistLinkTarget('anilist');
        setTraktApiBaseUrl('');
    };

    const removeExtraWidget = (key: string) => {
        setActiveWidgets(prev => {
            const next = { ...prev };
            delete next[key];
            return next;
        });

        setLayouts(prev => {
            const nextLayouts = { ...prev } as Layouts;
            Object.keys(nextLayouts).forEach(bp => {
                if (nextLayouts[bp]) {
                    nextLayouts[bp] = nextLayouts[bp].filter(item => item.i !== key);
                }
            });
            return nextLayouts;
        });
    };

    const toggleWidget = (key: string) => {
        if (key.includes('-') && activeWidgets[key]) {
            removeExtraWidget(key);
            return;
        }

        const willBeActive = !activeWidgets[key];
        setActiveWidgets(prev => ({
            ...prev,
            [key]: willBeActive
        }));

        if (willBeActive) {
            setLayouts(prev => {
                const nextLayouts = { ...prev } as Layouts;
                Object.keys(nextLayouts).forEach(bp => {
                    const currentList = nextLayouts[bp] || [];
                    if (!currentList.find((item: any) => item.i === key)) {
                        let maxY = 0;
                        currentList.forEach((item: any) => {
                            maxY = Math.max(maxY, item.y + item.h);
                        });

                        nextLayouts[bp] = [
                            ...currentList,
                            { i: key, x: 0, y: maxY, w: 2, h: 4, minW: 1, minH: 2 }
                        ];
                    }
                });
                return nextLayouts;
            });
        }
    };

    const addExtraWidget = (type: string) => {
        const key = `${type}-${Date.now()}`;
        setActiveWidgets(prev => ({
            ...prev,
            [key]: true
        }));

        setLayouts(prev => {
            const nextLayouts = { ...prev } as Layouts;
            Object.keys(nextLayouts).forEach(bp => {
                const currentList = nextLayouts[bp] || [];
                let maxY = 0;
                currentList.forEach((item: any) => {
                    maxY = Math.max(maxY, item.y + item.h);
                });

                nextLayouts[bp] = [
                    ...currentList,
                    { i: key, x: 0, y: maxY, w: 2, h: 4, minW: 1, minH: 2 }
                ];
            });
            return nextLayouts;
        });
    };

    const handleSavePreset = (name: string) => {
        const newPreset = {
            id: Date.now(),
            name,
            data: {
                currentTheme,
                todos,
                linkGroups,
                customCss,
                statsMode,
                weatherMode,
                weatherShowHourlyForecast,
                tempUnit,
                timeFormat,
                dateFormat,
                clockShowDay,
                clockShowSeconds,
                layouts,
                activeWidgets,
                showWidgetTitles,
                showFavicons,
                customFont,
                customTabTitle,
                customTabFavicon,
                funOptions,
                openInNewTab,
                searchDefaultEngine,
                searchEnabledEngines,
                searchSlashHotkeyEnabled,
                spotifyPixelAlbumArt,
                spotifyPulse,
                spotifyApiBaseUrl,
                githubUsername,
                githubApiBaseUrl,
                anilistUsername,
                anilistShownLists,
                anilistLinkTarget,
                traktApiBaseUrl
            }
        };
        setPresets([...presets, newPreset]);
    };

    const handleLoadPreset = (preset: any) => {
        if (!preset || !preset.data) return;
        const d = preset.data;
        if (d.currentTheme) setCurrentTheme(d.currentTheme);
        if (d.todos) setTodos(d.todos);
        if (d.linkGroups) setLinkGroups(d.linkGroups);
        if (d.customCss !== undefined) setCustomCss(d.customCss);
        if (d.statsMode) setStatsMode(d.statsMode);
        if (d.weatherMode) setWeatherMode(d.weatherMode);
        if (d.weatherShowHourlyForecast !== undefined) setWeatherShowHourlyForecast(d.weatherShowHourlyForecast);
        if (d.tempUnit) setTempUnit(d.tempUnit);
        if (d.timeFormat) setTimeFormat(d.timeFormat);
        if (d.dateFormat) setDateFormat(d.dateFormat);
        if (d.clockShowDay !== undefined) setClockShowDay(d.clockShowDay);
        if (d.clockShowSeconds !== undefined) setClockShowSeconds(d.clockShowSeconds);
        if (d.layouts) setLayouts(d.layouts);
        if (d.activeWidgets) setActiveWidgets(d.activeWidgets);
        if (d.showWidgetTitles !== undefined) setShowWidgetTitles(d.showWidgetTitles);
        if (d.showFavicons !== undefined) setShowFavicons(d.showFavicons);
        if (d.customFont !== undefined) setCustomFont(d.customFont);
        if (d.customTabTitle !== undefined) setCustomTabTitle(d.customTabTitle);
        if (d.customTabFavicon !== undefined) setCustomTabFavicon(d.customTabFavicon);
        if (d.funOptions) setFunOptions(d.funOptions);
        if (d.openInNewTab !== undefined) setOpenInNewTab(d.openInNewTab);
        if (d.searchDefaultEngine) setSearchDefaultEngine(d.searchDefaultEngine);
        if (d.searchEnabledEngines) setSearchEnabledEngines(d.searchEnabledEngines);
        if (d.searchSlashHotkeyEnabled !== undefined) setSearchSlashHotkeyEnabled(d.searchSlashHotkeyEnabled);
        if (d.spotifyPixelAlbumArt !== undefined) setSpotifyPixelAlbumArt(d.spotifyPixelAlbumArt);
        if (d.spotifyPulse !== undefined) setSpotifyPulse(d.spotifyPulse);
        if (d.spotifyApiBaseUrl !== undefined) setSpotifyApiBaseUrl(d.spotifyApiBaseUrl);
        if (d.githubUsername !== undefined) setGithubUsername(d.githubUsername);
        if (d.githubApiBaseUrl !== undefined) setGithubApiBaseUrl(d.githubApiBaseUrl);
        if (d.anilistUsername !== undefined) setAnilistUsername(d.anilistUsername);
        if (d.anilistShownLists !== undefined) setAnilistShownLists(d.anilistShownLists);
        if (d.anilistLinkTarget !== undefined) setAnilistLinkTarget(d.anilistLinkTarget);
        if (d.traktApiBaseUrl !== undefined) setTraktApiBaseUrl(d.traktApiBaseUrl);
    };

    const handleDeletePreset = (id: number) => {
        setPresets(presets.filter(p => p.id !== id));
    };

    const value: AppContextType = {
        currentTheme, setCurrentTheme,
        customThemes, setCustomThemes,
        isThemeMakerOpen, setIsThemeMakerOpen,
        todos, setTodos,
        linkGroups, setLinkGroups,
        customCss, setCustomCss,
        statsMode, setStatsMode,
        weatherMode, setWeatherMode,
        weatherShowHourlyForecast, setWeatherShowHourlyForecast,
        layouts, setLayouts,
        tempUnit, setTempUnit,
        timeFormat, setTimeFormat,
        dateFormat, setDateFormat,
        clockShowDay, setClockShowDay,
        clockShowSeconds, setClockShowSeconds,
        openInNewTab, setOpenInNewTab,
        searchDefaultEngine, setSearchDefaultEngine,
        searchEnabledEngines, setSearchEnabledEngines,
        searchSlashHotkeyEnabled, setSearchSlashHotkeyEnabled,
        showWidgetTitles, setShowWidgetTitles,
        showFavicons, setShowFavicons,
        reserveSettingsSpace, setReserveSettingsSpace,
        customFont, setCustomFont,
        customTabTitle, setCustomTabTitle,
        customTabFavicon, setCustomTabFavicon,
        funOptions, setFunOptions,
        activeWidgets, setActiveWidgets,
        spotifyPixelAlbumArt, setSpotifyPixelAlbumArt,
        spotifyPulse, setSpotifyPulse,
        spotifyApiBaseUrl, setSpotifyApiBaseUrl,
        githubUsername, setGithubUsername,
        githubApiBaseUrl, setGithubApiBaseUrl,
        anilistUsername, setAnilistUsername,
        anilistShownLists, setAnilistShownLists,
        anilistLinkTarget, setAnilistLinkTarget,
        traktApiBaseUrl, setTraktApiBaseUrl,
        isLayoutLocked, setIsLayoutLocked,
        isResizingEnabled, setIsResizingEnabled,
        presets, setPresets,
        weatherLocation, setWeatherLocation,
        handleSaveCustomTheme,
        handleDeleteCustomTheme,
        resetLayout,
        toggleWidget,
        addExtraWidget,
        removeExtraWidget,
        handleSavePreset,
        handleLoadPreset,
        handleDeletePreset,
        allThemes,
        isCrt
    };

    return (
        <AppContext.Provider value={value}>
            {children}
        </AppContext.Provider>
    );
};

export const useAppContext = () => {
    const context = useContext(AppContext);
    if (context === undefined) {
        throw new Error('useAppContext must be used within an AppProvider');
    }
    return context;
};
