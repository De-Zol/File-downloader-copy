export enum DownloadStatus {
    IDLE = 'idle',
    PREPARING = 'preparing',
    DOWNLOADING = 'downloading',
    PAUSED = 'paused',
    ENDED = 'ended',
    ERROR = 'error'
}
export enum EventType {
    STATUS = 'status',
    ERROR = 'error',
    PROGRESS = 'progress'
}
