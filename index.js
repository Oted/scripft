var req = require('request');
var cher = require('cheerio');
var Async = require('async');
var Fs = require('fs');
var Emitter = require('./lib/dataemitter');

var queue = [
    "https://c-base.org/"
];

var internals = {
    'batch' : 5,
    'interval' : 1000,
    'visit_thresh' : 5,
    'skip' : ['wiki', 'youtube', 'linkedin', 'google'],
    'targets' : [
        {'path' : 'title'}
        // {'path' : 'a[title]', 'attr' : 'title'}
        // {'path' : 'img[src$=jpg][src^=http]', 'attr' : 'src'},
    ],
    'results' : new Set(),
    'consumed' : new Set()
};

internals.consume = (done) => {
    const targets = queue.splice(0, internals.batch).filter(internals.filterConsumed);

    if (!targets || !targets.length) {
        console.log('Nothing to do atm');
    }

    return Async.each(targets, function(target, next) {
        internals.consumed.add(target);
        return req({
            'uri' : target
        }, function(err, res) {
             if (err) {
                 return next();
             }

             console.log('Handle \n' + target);
             return internals.handleConsumedResult(target, res, next);
        });
    }, done);
};

internals.handleConsumedResult = (target, res, done) => {
    const $ = cher.load(res.body);

    var potTargets = [];
    var emails = res.body.match(/[A-Za-z0-9._%-]+@[A-Za-z0-9.-]+\.(?!png|jpg|gif)[A-Za-z]{2,4}/g);

    $('a[href^=http]').each(function(i, el) {
      let targetA = $(this).attr('href').toString();

      const shouldNotAdd = internals.skip.reduce((bool, skip) => {
        return bool || targetA.indexOf(skip) > -1},
      false);

      if (!shouldNotAdd) potTargets.push($(this).attr('href').toString());
    });

    //find the targets in the internals.target css selector
    internals.targets.forEach((target) => {
        $(target.path).each(function(i, el) {
            var res = target.attr ? $(this).attr(target.attr).toString() : $(this).text();
            internals.results.add(target.attr ? $(this).attr(target.attr).toString() : $(this).text());
        });
    });

    //emit emails
    // (emails || []).forEach((target) => {
        // internals.results.add(target);
    // });


    potTargets = potTargets.map((target) => {
        const domain = target.match(/^(?:https?:\/\/)?(?:[^@\/\n]+@)?(?:www\.)?([^:\/\n]+)/igm);
        return domain[0];
    }).filter(function(item, i, ar) {
        return ar.indexOf(item) === i;
    });

    Emitter.emit({
        'url' : target,
        'nodes' : potTargets
    });

    queue = queue.concat(potTargets).filter(internals.filterConsumed);
    return done();
};

internals.filterConsumed = (target) => {
    return !internals.consumed.has(target);
};

internals.write = () => {
    console.log('Writing ' + Array.from(internals.results).length + ' found targets to log');
    Fs.writeFile("./out.json", JSON.stringify(Array.from(internals.results), null, " "), function(err) {
        if (err) {
            return console.log(err);
        }
    });
};

internals.clean = () => {
    if (internals.results.size > 10000) {
        internals.results.clear();
    }

    if (internals.results.size > 10000) {
        internals.consumed.clear();
    }
}

setInterval(internals.consume, internals.interval);
setInterval(internals.write, 10000);
setInterval(internals.clean, 60000);
