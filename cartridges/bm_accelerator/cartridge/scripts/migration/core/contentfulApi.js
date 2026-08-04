'use strict';

/**
 * Contentful HTTP calls via Service Framework (accelerator.contentful.api).
 */

var serviceHttp = require('*/cartridge/scripts/migration/core/serviceHttp');

function get(url, headers) {
    return serviceHttp.get('contentful', url, headers);
}

function post(url, headers, body) {
    return serviceHttp.post('contentful', url, headers, body);
}

module.exports = {
    get:  get,
    post: post
};
