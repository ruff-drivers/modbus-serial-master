/*!
 * Copyright (c) 2017 Nanchao Inc.
 * All rights reserved.
 */

'use strict';

var Modbus = require('./modbus');

function ModbusSerialMaster(port, options) {
    options = options || {};
    this._responseTimeout = options.responseTimeout || 500;
    this._cmdTimeout = options.cmdTimeout || this._responseTimeout;

    this._master = new Modbus(port, {
        mode: options.mode || 'rtu',
        parseSlaveData: options.parseSlaveData === undefined ? true : options.parseSlaveData
    });
}

Object.defineProperties(ModbusSerialMaster.prototype, {
    responseTimeout: {
        get: function () {
            return this._responseTimeout;
        },
        set: function (value) {
            this._responseTimeout = value;
        }
    }
});

ModbusSerialMaster.prototype._getresponse = function (timeout, callback) {
    var that = this;
    var timer = setTimeout(function () {
        removeListener();
        callback(new Error('Response timed out'));
    }, timeout);

    this._master.on('message', messageHandler);
    this._master.on('errorMessage', errorMessageHandler);

    function messageHandler(data) {
        clearTimeout(timer);
        removeListener();
        callback(undefined, data);
    }
    function errorMessageHandler(error) {
        clearTimeout(timer);
        removeListener();
        callback(error);
    }
    function removeListener() {
        that._master.removeListener('message', messageHandler);
        that._master.removeListener('errorMessage', errorMessageHandler);
    }
};

ModbusSerialMaster.prototype._checkResponse = function (slaveAddress, functionCode, response, propertyName, callback) {
    if (response.slaveAddress === slaveAddress) {
        if (response.functionCode === functionCode) {
            propertyName ? callback(undefined, response[propertyName]) : callback();
        } else if (response.functionCode === (functionCode | 0x80)) {
            callback(new Error('Exception code: ' + response.exceptionCode));
        } else {
            callback(new Error('Invalid function code: ' + response.functionCode));
        }
    } else {
        callback(new Error('Invalid slaveAddress: ' + response.slaveAddress));
    }
};

// read status common handler
ModbusSerialMaster.prototype._readStatus = function (requestHandler, parseHandler, checkResponseHandler, callback) {
    var callbackInvoked = false;
    this._getresponse(this._cmdTimeout, function (error, data) {
        if (callbackInvoked === true) {
            return;
        }
        callbackInvoked = true;
        if (error) {
            callback(error);
            return;
        }
        var response = parseHandler(data);
        checkResponseHandler(response, 'status', callback);
    });
    requestHandler(function (error) {
        if (callbackInvoked === true) {
            return;
        }
        if (error) {
            callbackInvoked = true;
            callback(error);
            return;
        }
    });
};

// Modbus "Read Coil Status" (FC=0x01)
ModbusSerialMaster.prototype.readCoils = function (slaveAddress, startAddress, quantity, callback) {
    var master = this._master;
    this._readStatus(
        master.requestReadCoils.bind(master, slaveAddress, startAddress, quantity),
        master.parseReadCoilsResponse.bind(master, quantity),
        this._checkResponse.bind(this, slaveAddress, 0x01),
        callback
    );
};

// Modbus "Read Input Status" (FC=0x02)
ModbusSerialMaster.prototype.readDiscreteInputs = function (slaveAddress, startAddress, quantity, callback) {
    var master = this._master;
    this._readStatus(
        master.requestReadDiscreteInputs.bind(master, slaveAddress, startAddress, quantity),
        master.parseReadDiscreteInputsResponse.bind(master, quantity),
        this._checkResponse.bind(this, slaveAddress, 0x02),
        callback
    );
};

// Modbus "Read Holding Registers" (FC=0x03)
ModbusSerialMaster.prototype.readHoldingRegisters = function (slaveAddress, startAddress, quantity, callback) {
    var master = this._master;
    this._readStatus(
        master.requestReadHoldingRegisters.bind(master, slaveAddress, startAddress, quantity),
        master.parseReadHoldingRegistersResponse.bind(master, quantity),
        this._checkResponse.bind(this, slaveAddress, 0x03),
        callback
    );
};

// Modbus "Read Input Registers" (FC=0x04)
ModbusSerialMaster.prototype.readInputRegisters = function (slaveAddress, startAddress, quantity, callback) {
    var master = this._master;
    this._readStatus(
        master.requestReadInputRegisters.bind(master, slaveAddress, startAddress, quantity),
        master.parseReadInputRegistersResponse.bind(master, quantity),
        this._checkResponse.bind(this, slaveAddress, 0x04),
        callback
    );
};

// Modbus "Write Single Coil" (FC=0x05)
ModbusSerialMaster.prototype.writeSingleCoil = function (slaveAddress, address, state, callback) {
    var that = this;
    var callbackInvoked = false;
    this._getresponse(this._cmdTimeout, function (error, data) {
        if (callbackInvoked === true) {
            return;
        }
        callbackInvoked = true;
        if (error) {
            callback(error);
            return;
        }
        var response = that._master.parseWriteSingleCoilResponse(data);
        that._checkResponse(slaveAddress, 0x05, response, 'state', callback);
    });
    this._master.requestWriteSingleCoil(slaveAddress, address, state, function (error) {
        if (callbackInvoked === true) {
            return;
        }
        if (error) {
            callbackInvoked = true;
            callback(error);
            return;
        }
    });
};

// Modbus "Write Single Register" (FC=0x06)
ModbusSerialMaster.prototype.writeSingleRegister = function (slaveAddress, address, value, callback) {
    var that = this;
    var callbackInvoked = false;
    this._getresponse(this._cmdTimeout, function (error, data) {
        if (callbackInvoked === true) {
            return;
        }
        callbackInvoked = true;
        if (error) {
            callback(error);
            return;
        }
        var response = that._master.parseWriteSingleRegisterResponse(data);
        that._checkResponse(slaveAddress, 0x06, response, 'value', callback);
    });
    this._master.requestWriteSingleRegister(slaveAddress, address, value, function (error) {
        if (callbackInvoked === true) {
            return;
        }
        if (error) {
            callbackInvoked = true;
            callback(error);
            return;
        }
    });
};

// write multiple common handler
ModbusSerialMaster.prototype._writeMultiple = function (requestHandler, parseHandler, checkResponseHandler, callback) {
    var callbackInvoked = false;
    this._getresponse(this._cmdTimeout, function (error, data) {
        if (callbackInvoked === true) {
            return;
        }
        callbackInvoked = true;
        if (error) {
            callback(error);
            return;
        }
        var response = parseHandler(data);
        checkResponseHandler(response, 'quantity', callback);
    });
    requestHandler(function (error) {
        if (callbackInvoked === true) {
            return;
        }
        if (error) {
            callbackInvoked = true;
            callback(error);
            return;
        }
    });
};

// Modbus "Write Multiple Coils" (FC=0x0F)
ModbusSerialMaster.prototype.writeMultipleCoils = function (slaveAddress, startAddress, states, callback) {
    var master = this._master;
    this._writeMultiple(
        master.requestWriteMultipleCoils.bind(master, slaveAddress, startAddress, states),
        master.parseWriteMultipleCoilsResponse.bind(master),
        this._checkResponse.bind(this, slaveAddress, 0x0F),
        callback
    );
};
// Modbus "Write Multiple Registers" (FC=0x10)
ModbusSerialMaster.prototype.writeMultipleRegisters = function (slaveAddress, startAddress, values, callback) {
    var master = this._master;
    this._writeMultiple(
        master.requestWriteMultipleRegisters.bind(master, slaveAddress, startAddress, values),
        master.parseWriteMultipleRegistersResponse.bind(master),
        this._checkResponse.bind(this, slaveAddress, 0x10),
        callback
    );
};

module.exports = ModbusSerialMaster;
