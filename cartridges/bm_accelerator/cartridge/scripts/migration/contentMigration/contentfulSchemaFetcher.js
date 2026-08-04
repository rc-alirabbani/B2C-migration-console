'use strict';

var http = require('*/cartridge/scripts/migration/core/contentfulApi');
var auth = require('*/cartridge/scripts/migration/connectors/contentful/contentfulAuth');
var ctxUtil = require('*/cartridge/scripts/migration/contentMigration/contentfulContext');

function summarizeContentType(ct) {
    var sys = (ct && ct.sys) || {};
    var fieldCount = (ct.fields && ct.fields.length) || 0;
    return {
        id:                 sys.id || '',
        label:              ct.name || sys.id || 'Untitled',
        schemaUri:          sys.id || '',
        schemaShort:        sys.id || '',
        status:             '',
        sfccComponent:      'contentfulWidget',
        sfccComponentLabel: 'Contentful widget',
        fieldCount:         fieldCount
    };
}

/**
 * List Contentful content types for the configured environment.
 * @param {number} [pageSize]
 * @returns {Object}
 */
function listContentTypes(pageSize) {
    if (!auth.hasManagementCreds(auth.resolveCreds())) {
        throw new Error('CMA Personal Access Token required. Complete Connect step first.');
    }

    var limit = Math.min(Math.max(parseInt(String(pageSize || 100), 10) || 100, 1), 1000);
    var ctx = ctxUtil.getContext();
    var res = http.get(
        ctxUtil.buildUrl(ctx, '/content_types?limit=' + limit),
        ctxUtil.authHeaders(ctx.token)
    );

    if (res.status !== 200) {
        throw new Error('Unable to list content types (' + res.status + ')');
    }

    var raw = res.data.items || [];
    var types = [];
    var i;
    for (i = 0; i < raw.length; i++) {
        types.push(summarizeContentType(raw[i]));
    }

    return {
        total:   res.data.total || types.length,
        types:   types,
        hubName: ctx.creds.spaceId,
        spaceId: ctx.creds.spaceId
    };
}

module.exports = {
    listContentTypes: listContentTypes
};
