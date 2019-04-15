/*
 * Copyright 2014 Telefonica Investigación y Desarrollo, S.A.U
 *
 * This file is part of fiware-iotagent-lib
 *
 * fiware-iotagent-lib is free software: you can redistribute it and/or
 * modify it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the License,
 * or (at your option) any later version.
 *
 * fiware-iotagent-lib is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public
 * License along with fiware-iotagent-lib.
 * If not, seehttp://www.gnu.org/licenses/.
 *
 * For those usages not covered by the GNU Affero General Public License
 * please contact with::daniel.moranjimenez@telefonica.com
 */
'use strict';

/**
 * This module sets up the connection with the mongodb through mongoose. This connection will be used
 * in mongoose schemas to persist objects.
 */

var mongoose = require('mongoose'),
    constants = require('../../constants'),
    logger = require('logops'),
    async = require('async'),
    errors = require('../../errors'),
    config = require('../../commonConfig'),
    defaultDb,
    DEFAULT_DB_NAME = 'lwm2m',
    context = {
        op: 'LWM2MLib.DbConn'
    };

function loadModels() {
    require('./Device').load(defaultDb);
}

/**
 * Creates a new connection to the Mongo DB.
 *
 * @this Reference to the dbConn module itself.
 */
function init(host, db, port, username, password, authDB, options, callback) {
    /*jshint camelcase:false, validthis:true */
    var hosts,
        url,
        credentials = '',
        retries = 0,
        lastError,
        maxRetries = (config.getConfig().mongodb && config.getConfig().mongodb.retries ||
            constants.DEFAULT_MONGODB_RETRIES);

    if (username && password) {
        credentials = username + ':' + password + '@';
    }

    function addPort(item) {
        return item + ':' + port;
    }

    function commaConcat(previous, current, currentIndex) {
        if (currentIndex !== 0) {
            previous += ',';
        }

        previous += current;

        return previous;
    }

    hosts = host.split(',')
        .map(addPort)
        .reduce(commaConcat, '');

    url = 'mongodb://' + credentials + hosts + '/' + db;
    
    if (authDB) {
        url += '?authSource=' + authDB;
    }

    if (options.replSet) {
        url += '?replicaSet=' + options.replSet.rs_name;
    }

    function createConnectionHandler(error, results) {
        if (defaultDb) {
            logger.info(context, 'Successfully connected to MongoDB.');
            module.exports.db = defaultDb;
            loadModels();
        } else {
            logger.error(context, 'MONGODB-002: Error found after [%d] attempts: %s', retries, error || lastError);
        }

        callback(error);
    }

    function retryCheck() {
        return !defaultDb && retries < maxRetries;
    }

    function connectionAttempt(url, options, callback) {
        var candidateDb;

        logger.info(context, 'Attempting to connect to MongoDB instance. Attempt %d', retries);

        candidateDb = mongoose.createConnection(url, options, function(error, result) {
            if (error) {
                logger.error(context, 'MONGODB-001: Error trying to connect to MongoDB: %s', error);
                lastError = error;
            } else {
                defaultDb = candidateDb;

                defaultDb.on('error', function(error) {
                    logger.error(context, 'Mongo Driver error: %j', error);
                });
                defaultDb.on('connecting', function(error) {
                    logger.debug(context, 'Mongo Driver connecting');
                });
                defaultDb.on('connected', function() {
                    logger.debug(context, 'Mongo Driver connected');
                });
                defaultDb.on('reconnected', function() {
                    logger.debug(context, 'Mongo Driver reconnected');
                });
                defaultDb.on('disconnected', function() {
                    logger.debug(context, 'Mongo Driver disconnected');
                });
                defaultDb.on('disconnecting', function() {
                    logger.debug(context, 'Mongo Driver disconnecting');
                });
                defaultDb.on('open', function() {
                    logger.debug(context, 'Mongo Driver open');
                });
                defaultDb.on('close', function() {
                    logger.debug(context, 'Mongo Driver close');
                });
            }

            callback();
        });
    }

    function tryCreateConnection(callback) {
        var attempt = async.apply(connectionAttempt, url, options, callback),
            seconds = (config.getConfig().mongodb && config.getConfig().mongodb.retryTime ||
                constants.DEFAULT_MONGODB_RETRY_TIME);

        retries++;

        if (retries === 1) {
            logger.info(context, 'First connection attempt');
            attempt();
        } else {
            logger.info(context, 'Waiting %d seconds before attempting again.', seconds);
            setTimeout(attempt, seconds * 1000);
        }
    }

    defaultDb = null;
    async.whilst(retryCheck, tryCreateConnection, createConnectionHandler);
}

function configureDb(callback) {
    /*jshint camelcase:false, validthis:true */
    var currentConfig = config.getConfig();

    if (currentConfig.deviceRegistry && currentConfig.deviceRegistry.type === 'mongodb') {
        if (!currentConfig.mongodb || !currentConfig.mongodb.host) {
            logger.fatal(context, 'MONGODB-003: No host found for MongoDB driver.');
            callback(new errors.BadConfiguration('No host found for MongoDB driver'));
        } else {
            var dbName = currentConfig.mongodb.db,
                port = currentConfig.mongodb.port || 27017,
                authDB,
                options = {};

            if (!currentConfig.mongodb.db) {
                dbName = DEFAULT_DB_NAME;
            }
            
            if (currentConfig.mongodb.authDB) {
                authDB = currentConfig.mongodb.authDB;
            }

            if (currentConfig.mongodb.replicaSet) {
                options.replset = { rs_name: currentConfig.mongodb.replicaSet };
            }

            //init(config.getConfig().mongodb.host, dbName, port,
                //currentConfig.username, currentConfig.password, options, callback);
            init(currentConfig.mongodb.host, dbName, port, currentConfig.mongodb.username, currentConfig.mongodb.password, currentConfig.mongodb.authDB, options, callback);
        }
    } else {
        callback();
    }
}

exports.configureDb = configureDb;
exports.db = defaultDb;
exports.DEFAULT_DB_NAME = DEFAULT_DB_NAME;
