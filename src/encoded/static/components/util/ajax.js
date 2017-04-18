'use strict';

var _ = require('underscore');
var jwt = require('./json-web-token');
var console = require('./patched-console');

/**
 * @private
 */
const defaultHeaders = {
    "Content-Type" : "application/json; charset=UTF-8",
    "Accept" : "application/json",
    "X-Requested-With" : "XMLHttpRequest" // Allows some server-side libs (incl. pyramid) to identify using `request.is_xhr`.
}

/**
 * @private
 * @function
 * @param {XMLHttpRequest} xhr - XHR object.
 * @param {Object} [headers={}] - Headers object.
 * @returns {XMLHttpRequest} XHR object with set headers.
 */
function setHeaders(xhr, headers = {}) {
    headers = jwt.addToHeaders(_.extend({}, defaultHeaders, headers)); // Set defaults, add JWT if set

    // Put everything in the header
    var headerKeys = Object.keys(headers);
    for (var i=0; i < headerKeys.length; i++){
        xhr.setRequestHeader(headerKeys[i], headers[headerKeys[i]]);
    }

    return xhr;
}


export function load(url, callback, method = 'GET', fallback = null, data = null, headers = {}){
    if (typeof window == 'undefined') return null;

    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function() {
        if (xhr.readyState == XMLHttpRequest.DONE ) {
            if (xhr.status == 200) {
                if (typeof callback == 'function'){
                    callback(JSON.parse(xhr.responseText));
                }
            } else {
                var response;
                try {
                    response = JSON.parse(xhr.responseText);
                    console.error('ajax.load error: ', response);
                    if (typeof fallback == 'function') fallback(response);
                } catch (error) {
                    console.error('Non-JSON error response:', xhr.responseText);
                    if (typeof fallback == 'function') fallback(xhr);
                }
            }
        }
    };

    xhr.open(method, url, true);
    xhr = setHeaders(xhr, headers);

    if (data){
        xhr.send(data);
    } else {
        xhr.send();
    }
}

export function promise(url, method = 'GET', headers = {}, data = null, cache = true, debugResponse = false){
    var xhr;
    var promise = new Promise(function(resolve, reject) {
        xhr = new XMLHttpRequest();
        xhr.onload = function() {
            var response = null;
            // response SHOULD be json
            try {
                response = JSON.parse(xhr.responseText);
                if (debugResponse) console.info('Received data from ' + method + ' ' + url + ':', response);
            } catch (e) {
                console.log(xhr);
                console.error("Non-JSON error response:", xhr.responseText);
                reject(xhr);
                return;
            }
            resolve(response);
        };
        xhr.onerror = reject;
        if (cache === false && url.indexOf('format=json') > -1){
            url += '&ts=' + parseInt(Date.now());
        }
        xhr.open(method, url, true);
        xhr = setHeaders(xhr, headers);

        if(data){
            xhr.send(data);
        }else{
            xhr.send();
        }
        return xhr;
    });
    promise.xhr = xhr;
    promise.abort = function(){
        if (promise.xhr.readyState !== 4) promise.xhr.abort();
    };
    return promise;
}
