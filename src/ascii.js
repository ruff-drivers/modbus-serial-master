/*!
 * Copyright (c) 2017 Nanchao Inc.
 * All rights reserved.
 */

'use strict';

var EventEmitter = require('events');
var util = require('util');
var lrc = require('./lrc');

function Ascii(timeout) {
    EventEmitter.call(this);
    this._buffer = Buffer.alloc(0);
    this._timeout = timeout || 0;
    this._timer = null;
    this._stop = true;
    this._expectedLength = 0;
}

util.inherits(Ascii, EventEmitter);

Ascii.prototype._setupTimer = function () {
    clearTimeout(this._timer);
    this._timer = setTimeout(this._timeoutHandle.bind(this), this._timeout);
};

Ascii.prototype._timeoutHandle = function () {
    this._buffer = Buffer.alloc(0);
    this.emit('errorMessage', new Error('Frame timeout'));
};

Ascii.prototype.encode = function (buffer) {
    var lrcValue = lrc(buffer);
    var lrcBuffer = Buffer.alloc(1);
    lrcBuffer.writeUInt8(lrcValue, 0);
    var bufferAll = Buffer.concat([buffer, lrcBuffer]);
    // create a Buffer.alloc of the correct size
    var bufferAscii = Buffer.alloc(bufferAll.length * 2 + 3); // 1 byte start delimit + x2 data as ascii encoded + 2 lrc + 2 end delimit

    // start with the single start delimiter
    bufferAscii.write(':', 0);
    // encode the data, with the new single byte lrc
    bufferAscii.write(bufferAll.toString('hex').toUpperCase(), 1);
    // end with the two end delimiters
    bufferAscii.write('\r\n', bufferAscii.length - 2);
    // bufferAscii.write('\n', bufferAscii.length - 1);

    return bufferAscii;
};

Ascii.prototype.try = function (expectedLength) {
    this._stop = false;
    if (this._timeout > 0) {
        this._setupTimer();
    }
    this._buffer = Buffer.alloc(0);
    this._expectedLength = expectedLength;
};

Ascii.prototype.pushCodedStream = function (data) {
    if (!this._stop) {
        this._buffer = Buffer.concat([this._buffer, data]);
        if (this._buffer.length >= this._expectedLength) {
            this._buffer = this._buffer.slice(0, this._expectedLength);
            this._findFrame();
        } else if (this._buffer.length === 11) { // start(1) + addr(1 * 2) + FC(1 * 2) + exception(1 * 2) + lrc(1 * 2) + end (2)
            if (this._decode(this._buffer) !== null) {
                this._findFrame();
            }
        }
    }
};

Ascii.prototype._findFrame = function () {
    this._stop = true;
    clearTimeout(this._timer);
    this._emit();
};

Ascii.prototype._emit = function () {
    var data = this._decode(this._buffer);
    this._buffer = Buffer.alloc(0);
    if (data === null) {
        this.emit('errorMessage', new Error('Invalid checksum'));
    } else {
        this.emit('message', data);
    }
};

Ascii.prototype._decode = function (buffer) {
    var length = buffer.length;
    if (length < 3 || buffer.readUInt8(0) !== 0x3A || buffer.readUInt8(length - 2) !== 0x0D || buffer.readUInt8(length - 1) !== 0x0A) {
        return null;
    }

    // create a Buffer.alloc of the correct size (based on ascii encoded buffer length)
    var bufferDecoded = Buffer.alloc((buffer.length - 1) / 2);

    // decode into Buffer.alloc (removing delimiters at start and end)
    for (var i = 0; i < (buffer.length - 3) / 2; i++) {
        bufferDecoded.write(String.fromCharCode(buffer.readUInt8(i * 2 + 1), buffer.readUInt8(i * 2 + 2)), i, 1, 'hex');
    }

    // check the lrc is true
    var lrcValue = bufferDecoded.readUInt8(bufferDecoded.length - 2);
    bufferDecoded = bufferDecoded.slice(0, -2);
    if (lrc(bufferDecoded) !== lrcValue) {
        // return null if lrc error
        return null;
    }

    return bufferDecoded;
};

module.exports = Ascii;
