/* jslint node: true */
'use strict';

var restify     = require('restify');
var request     = require('request');
var FeedParser  = require('feedparser');

var port = 8080;
var server = restify.createServer({
    name: 'rss-parser',
    version: '1.0.0'
});

server.use(restify.acceptParser(server.acceptable));
server.use(restify.queryParser());
server.use(restify.bodyParser());

server.get('/parse', function (req, res, next) {
    var url = req.params.url;
    var items = [];

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
            res.send(items);
        });

    return next();
});

server.listen(port, function () {
    console.log('%s listening at %s', server.name, server.url);
});