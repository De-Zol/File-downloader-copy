import {EventEmitter} from 'events';
import * as request from 'request';
import * as path from 'path';
import * as fs from 'fs';
import {DownloadStatus, EventType} from './types';

export class FileDownloader extends EventEmitter {
    private _filePath = '';
    private _chunkSizeInBytes = 0;
    private _chunkSizeInKBytes = 100;
    private _downloadedSize = 0;
    private _fileLength = 0;
    private _isDownload = false;
    private _status: DownloadStatus = DownloadStatus.IDLE;

    constructor(private _url: string, private _saveDir: string) {
        super();

        this._chunkSizeInBytes = 1024 * this._chunkSizeInKBytes;
        this.emit(EventType.STATUS, this._status);
    }

    public start() {
        this._setDownloadStatus(DownloadStatus.PREPARING);
        this._getFileName()
            .then(async (fileName) => {
                this._filePath = path.join(this._saveDir, fileName);
                await this._download();
                console.log(this._filePath);
                console.log('done');
            }).catch((err) => this.emit(EventType.ERROR, err));
    }

    public stop() {
        if (this._status === DownloadStatus.DOWNLOADING || this._status === DownloadStatus.PREPARING) {
            this._isDownload = false;
            this._setDownloadStatus(DownloadStatus.PAUSED);
        }
    }

    public resume() {
        if (this._status === DownloadStatus.PAUSED) {
            this._download();
        }
    }

    public getDownloadStatus(): DownloadStatus {
        return this._status;
    }

    private async _download() {
        this._setDownloadStatus(DownloadStatus.DOWNLOADING);
        this._isDownload = true;
        while (this._isDownload) {
            try {
                await this._downloadChunk();
                this._downloadedSize += this._chunkSizeInBytes;
                this._isDownload = this._isDownload && this._downloadedSize < this._fileLength;
                console.log('_downloadedSize', this._downloadedSize);
            } catch (err) {
                this._setDownloadStatus(DownloadStatus.ERROR);
                this.emit(EventType.ERROR, err);
                this._isDownload = false;
                console.log('err', err);
            }
        }
        if (this._downloadedSize >= this._fileLength) {
            this._setDownloadStatus(DownloadStatus.ENDED);
        }
    }

    private _downloadChunk(): Promise<void> {
        return new Promise((resolve, reject) => {
            request.get(this._url, this.getRequestOptions())
                .on('error', (err) => reject(err))
                .on('response', (resp) => {
                    let chunkBuffer: Buffer = new Buffer([]);
                    resp.on('data', (chunk) => {
                        chunkBuffer = Buffer.concat([chunkBuffer, chunk]);
                    }).on('end', () => {
                        fs.writeFileSync(this._filePath, chunkBuffer, {flag: 'a'});
                        resolve();
                    });
                });
        });
    }

    private getRequestOptions() {
        let rangeEnd = this._downloadedSize + this._chunkSizeInBytes - 1;
        if (rangeEnd >= this._fileLength) {
            rangeEnd = this._fileLength - 1;
            console.log('last chunk');
        }
        return {
            url: this._url,
            headers: {
                range: `bytes=${this._downloadedSize}-${rangeEnd}`
            }
        };
    }

    private _getFileName(): Promise<string> {
        return new Promise((resolve, reject) => {
            const req = request.head(this._url, {method: 'HEAD'});
            req.on('response', (resp) => {
                this._getFileLength(resp);
                let fileName = this._getFileNameFromHeaders(resp);
                if (!fileName) {
                    fileName = this._getFileNameFromPath(resp);
                }

                if (!fileName) {
                    fileName = 'unnamed';
                }

                resolve(fileName);
            });
            req.on('error', (err) => {
                reject(err);
            });
        });
    }

    private _getFileNameFromHeaders(resp): string {
        const disposition: string = resp.headers['content-disposition'];
        let fileName = '';
        if (disposition) {
            const arr = disposition.split(';');
            for (let i = 0; i < arr.length; i++) {
                if (arr[i].includes('filename')) {
                    const regex = /^filename=/g;
                    fileName = arr[i].trim().split(regex)[1];
                }
            }
        }
        return fileName;
    }

    private _getFileNameFromPath(resp): string {
        console.log('getFileNameFromPath', resp.req.path);
        return decodeURIComponent(path.basename(resp.req.path).split('?')[0]);
    }

    private _getFileLength(resp) {
        this._fileLength = parseInt(resp.headers['content-length'], 10);
        console.log('this._fileLength', this._fileLength);
    }

    private _setDownloadStatus(state: DownloadStatus) {
        this._status = state;
        this.emit(EventType.STATUS, this._status);
    }

}
