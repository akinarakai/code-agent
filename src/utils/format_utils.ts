export function formatDuration(ms: number): string {
    if (ms < 1000)
        return `${ms}ms`;

    const seconds = ms / 1000;

    if (seconds < 60)
        return `${seconds.toFixed(2)}s`;

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    return `${minutes}m ${remainingSeconds.toFixed(1)}s`;
}

export function formatNumber(n: number) {
    if (n < 1000) return String(n);
    return (n / 1000).toFixed(1) + "k";
}

export function formatFileSize(bytes: number): string {
    if (bytes < 1024)
        return `${bytes} B`;

    if (bytes < 1024 * 1024)
        return `${(bytes / 1024).toFixed(2)} KB`;

    if (bytes < 1024 * 1024 * 1024)
        return `${(bytes / 1024 / 1024).toFixed(2)} MB`;

    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
        return text;
    }

    return text.slice(0, maxLength) + "...";
}

export function formatTime(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });
}