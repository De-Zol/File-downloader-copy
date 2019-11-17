import {EventEmitter} from 'events';
import * as request from 'request';
import * as path from 'path';
import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';

export class FileDownloader extends EventEmitter {
    private _filePath = '';
    private _chunkSizeInBytes = 0;
    private _chunkSizeInKBytes = 100;
    private _downloadedSize = 0;
    private _fileLength = 0;

    constructor(private _url: string, private _saveDir: string) {
        super();

        this._chunkSizeInBytes = 1024 * this._chunkSizeInKBytes;
    }

    public start() {
        this._getFileName()
            .then(async (fileName) => {
                this._filePath = path.join(this._saveDir, fileName);
                console.log(this._filePath);
                while (this._downloadedSize < this._fileLength) {
                    try {
                        await this._downloadChunk();
                        this._downloadedSize += this._chunkSizeInBytes;
                        console.log('_downloadedSize', this._downloadedSize);
                    } catch (err) {
                        console.log('err', err);
                    }
                }
                console.log('done');
            });
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

    public stop() {

    }

    public resume() {

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
}
