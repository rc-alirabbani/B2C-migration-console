'use strict';

var cfg = require('*/cartridge/scripts/migration/configAccessor');

/**
 * Resolve Contentful credentials from Site Preferences.
 * @param {Object} [creds]
 * @returns {Object}
 */
function resolveCreds(creds) {
    var c = creds || cfg.contentful || {};
    return {
        spaceId:                String(c.spaceId || ''),
        environmentId:          String(c.environmentId || 'master'),
        cmaPersonalAccessToken: String(c.cmaPersonalAccessToken || ''),
        apiHost:                String(c.apiHost || 'https://api.contentful.com').replace(/\/$/, ''),
        defaultEntryId:         String(c.defaultEntryId || '')
    };
}

/**
 * @param {Object} [creds]
 * @returns {boolean}
 */
function hasManagementCreds(creds) {
    var token = resolveCreds(creds).cmaPersonalAccessToken;
    return !!(token && token.indexOf('•') === -1);
}

/**
 * @param {Object} [creds]
 * @returns {{ token: string, expiresIn: number, authMode: string }}
 */
function getAccessToken(creds) {
    var c = resolveCreds(creds);
    var token = c.cmaPersonalAccessToken;

    if (!token || token.indexOf('•') !== -1) {
        throw new Error(
            'Contentful CMA Personal Access Token is required. Create one under Contentful → Settings → CMA tokens.'
        );
    }

    return { token: token, expiresIn: 0, authMode: 'cma-pat' };
}

module.exports = {
    resolveCreds:       resolveCreds,
    hasManagementCreds: hasManagementCreds,
    getAccessToken:     getAccessToken
};
