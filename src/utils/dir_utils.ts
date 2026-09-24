export const IGNORE_DIRS = new Set([
    // Dependencies
    "node_modules",
    "vendor",

    // Version control
    ".git",
    ".svn",
    ".hg",

    // Build output
    "dist",
    "build",
    "out",
    "target",

    // Framework caches / generated files
    ".next",
    ".nuxt",
    ".output",
    ".svelte-kit",
    ".angular",
    ".astro",
    ".turbo",
    ".parcel-cache",
    ".vite",

    // Test / coverage output
    "coverage",
    ".nyc_output",

    // Caches
    ".cache",
    ".eslintcache",

    // IDE
    ".idea",
    ".vscode",

    // OS
    ".DS_Store",
    "Thumbs.db",
]);