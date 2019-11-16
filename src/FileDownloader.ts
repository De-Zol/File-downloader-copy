import {EventEmitter} from 'events';
import * as request from 'request';
import * as path from 'path';
import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';

export class FileDownloader extends EventEmitter {
    private _filePath = '';

    constructor(private _url: string, private _saveDir: string) {
        super();
    }

    public start() {
        this._getFileName()
            .then((fileName) => {
                this._filePath = path.join(this._saveDir, fileName);
                console.log(this._filePath);
                request.get(this._url)
                    .on('end', () => console.log('end download'))
                    .on('error', (err) => console.log('download error', err))
                    .pipe(fs.createWriteStream(this._filePath));
            });
    }

    public stop() {

    }

    public resume() {

    }

    private _getFileName(): Promise<string> {
        return new Promise((resolve, reject) => {
            const req = request.head(this._url, {method: 'HEAD'});
            req.on('response', (resp) => {
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
                    fileName = arr[i].split(regex)[1];
                }
            }
        }
        return fileName;
    }

    private _getFileNameFromPath(resp): string {
        console.log('getFileNameFromPath', resp.req.path);
        return decodeURIComponent(path.basename(resp.req.path).split('?')[0]);
    }
}
