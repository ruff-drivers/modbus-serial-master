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

ModbusSerialMaster.prototype._checkResponse = function (slaveAddress, functionCode, propertyName, response, callback) {
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
ModbusSerialMaster.prototype._commReqRes = function (requestHandler, parseHandler, checkResponseHandler, callback) {
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
        checkResponseHandler(response, callback);
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
    this._commReqRes(
        master.requestReadCoils.bind(master, slaveAddress, startAddress, quantity),
        master.parseReadCoilsResponse.bind(master, quantity),
        this._checkResponse.bind(this, slaveAddress, 0x01, 'status'),
        callback
    );
};

// Modbus "Read Input Status" (FC=0x02)
ModbusSerialMaster.prototype.readDiscreteInputs = function (slaveAddress, startAddress, quantity, callback) {
    var master = this._master;
    this._commReqRes(
        master.requestReadDiscreteInputs.bind(master, slaveAddress, startAddress, quantity),
        master.parseReadDiscreteInputsResponse.bind(master, quantity),
        this._checkResponse.bind(this, slaveAddress, 0x02, 'status'),
        callback
    );
};

// Modbus "Read Holding Registers" (FC=0x03)
ModbusSerialMaster.prototype.readHoldingRegisters = function (slaveAddress, startAddress, quantity, callback) {
    var master = this._master;
    this._commReqRes(
        master.requestReadHoldingRegisters.bind(master, slaveAddress, startAddress, quantity),
        master.parseReadHoldingRegistersResponse.bind(master, quantity),
        this._checkResponse.bind(this, slaveAddress, 0x03, 'status'),
        callback
    );
};

// Modbus "Read Input Registers" (FC=0x04)
ModbusSerialMaster.prototype.readInputRegisters = function (slaveAddress, startAddress, quantity, callback) {
    var master = this._master;
    this._commReqRes(
        master.requestReadInputRegisters.bind(master, slaveAddress, startAddress, quantity),
        master.parseReadInputRegistersResponse.bind(master, quantity),
        this._checkResponse.bind(this, slaveAddress, 0x04, 'status'),
        callback
    );
};

// Modbus "Write Single Coil" (FC=0x05)
ModbusSerialMaster.prototype.writeSingleCoil = function (slaveAddress, address, state, callback) {
    var master = this._master;
    this._commReqRes(
        master.requestWriteSingleCoil.bind(master, slaveAddress, address, state),
        master.parseWriteSingleCoilResponse.bind(master),
        this._checkResponse.bind(this, slaveAddress, 0x05, 'state'),
        callback
    );
};

// Modbus "Write Single Register" (FC=0x06)
ModbusSerialMaster.prototype.writeSingleRegister = function (slaveAddress, address, value, callback) {
    var master = this._master;
    this._commReqRes(
        master.requestWriteSingleRegister.bind(master, slaveAddress, address, value),
        master.parseWriteSingleRegisterResponse.bind(master),
        this._checkResponse.bind(this, slaveAddress, 0x06, 'value'),
        callback
    );
};

// Modbus "Write Multiple Coils" (FC=0x0F)
ModbusSerialMaster.prototype.writeMultipleCoils = function (slaveAddress, startAddress, states, callback) {
    var master = this._master;
    this._commReqRes(
        master.requestWriteMultipleCoils.bind(master, slaveAddress, startAddress, states),
        master.parseWriteMultipleCoilsResponse.bind(master),
        this._checkResponse.bind(this, slaveAddress, 0x0F, 'quantity'),
        callback
    );
};
// Modbus "Write Multiple Registers" (FC=0x10)
ModbusSerialMaster.prototype.writeMultipleRegisters = function (slaveAddress, startAddress, values, callback) {
    var master = this._master;
    this._commReqRes(
        master.requestWriteMultipleRegisters.bind(master, slaveAddress, startAddress, values),
        master.parseWriteMultipleRegistersResponse.bind(master),
        this._checkResponse.bind(this, slaveAddress, 0x10, 'quantity'),
        callback
    );
};

module.exports = ModbusSerialMaster;
