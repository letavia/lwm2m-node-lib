var config = {};

// Configuration of the LWTM2M Server
//--------------------------------------------------
config.server = {
    port: 60001,                         // Port where the server will be listening
    udpWindow: 100,
    defaultType: 'Device',
    logLevel: 'FATAL'
};

// Configuration of the LWTM2M Client
//--------------------------------------------------
config.client = {
    //lifetime: '85671',
    lifetime: '60',
    version: '1.0',
    logLevel: 'FATAL',
    observe: {
        period: 3000
    }
}

module.exports = config;
