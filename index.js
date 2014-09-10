/* jslint node: true */
'use strict';

var crypto      = require('crypto');
var restify     = require('restify');
var request     = require('request');
var FeedParser  = require('feedparser');
var redis       = require('redis');
var url         = require('url');
var Q           = require('q');

var TTL         = 1800;

var port = process.env.PORT || 5000;
var server = restify.createServer({
    name: 'parsr',
    version: '0.9.0'
});

server.use(restify.acceptParser(server.acceptable));
server.use(restify.queryParser());
server.use(restify.bodyParser());
server.use(restify.CORS());
server.use(restify.fullResponse());

// Auth to redis
var redisURL = url.parse(process.env.REDISCLOUD_URL);
var client = redis.createClient(redisURL.port, redisURL.hostname, { no_ready_check: true });
client.auth(redisURL.auth.split(':')[1]);

server.get('/parse', function (req, res, next) {
    var url = req.params.url;
    var key = crypto.createHash('md5').update(url).digest('hex');
    var items = [];

    // First check if cached in redis
    checkRedis(key)
        .then(function(data) {
            // Cache hit, send data
            res.send(JSON.parse(data));
        })
        .fail(function() {
            // Cache miss, request, parse, and send data
            request(url).pipe(new FeedParser())
                .on('error', function(error) {
                    next(error);
                })
                .on('readable', function() {
                    var item;
                    while (!!(item = this.read())) {
                        items.push(item);
                    }
                })
                .on('end', function() {
                    console.log('redis', 'setex', TTL, key);
                    client.setex(key, TTL, JSON.stringify(items));
                    res.send(items);
                });
        });

    return next();
});

/**
 * Checks and returns data for key if set.
 *
 * @params {String} key Key to fetch from redis
 *
 * @returns {String} Stringified JSON if exists, else error
 */
function checkRedis(key) {
    var deferred = Q.defer();

    client.get(key, function(err, data) {
        if (err || !data) {
            deferred.reject(err);
        } else {
            deferred.resolve(data);
        }
    });

    return deferred.promise;
}

server.listen(port, function () {
    console.log('%s listening at %s', server.name, server.url);
});
