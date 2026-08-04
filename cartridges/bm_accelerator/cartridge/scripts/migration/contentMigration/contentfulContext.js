'use strict';

var http = require('*/cartridge/scripts/migration/core/contentfulApi');
var auth = require('*/cartridge/scripts/migration/connectors/contentful/contentfulAuth');

function authHeaders(token) {
    return {
        Authorization:  'Bearer ' + token,
        'Content-Type': 'application/json'
    };
}

/**
 * @param {Object} [creds]
 * @returns {{ creds: Object, token: string, apiHost: string, envPath: string }}
 */
function getContext(creds) {
    var c = auth.resolveCreds(creds);
    if (!c.spaceId) {
        throw new Error('Contentful Space ID is required. Find it under Settings → API keys.');
    }
    if (!c.environmentId) {
        throw new Error('Contentful Environment ID is required (usually master).');
    }
    var token = auth.getAccessToken(c).token;
    var envPath = '/spaces/' + encodeURIComponent(c.spaceId)
        + '/environments/' + encodeURIComponent(c.environmentId);
    return {
        creds:    c,
        token:    token,
        apiHost:  c.apiHost,
        envPath:  envPath
    };
}

/**
 * @param {Object} ctx - from getContext
 * @param {string} suffix - path after environment (e.g. /entries)
 * @returns {string}
 */
function buildUrl(ctx, suffix) {
    var path = String(suffix || '');
    if (path.indexOf('/') !== 0) {
        path = '/' + path;
    }
    return ctx.apiHost + ctx.envPath + path;
}

/**
 * @param {Object} ctx
 * @returns {string} default locale code
 */
function getDefaultLocale(ctx) {
    var res = http.get(buildUrl(ctx, '/locales'), authHeaders(ctx.token));
    if (res.status !== 200) {
        return 'en-US';
    }
    var items = res.data.items || [];
    var i;
    for (i = 0; i < items.length; i++) {
        if (items[i].default) {
            return items[i].code || 'en-US';
        }
    }
    if (items.length && items[0].code) {
        return items[0].code;
    }
    return 'en-US';
}

module.exports = {
    authHeaders:      authHeaders,
    getContext:       getContext,
    buildUrl:         buildUrl,
    getDefaultLocale: getDefaultLocale
};
