'use strict';

var http = require('*/cartridge/scripts/migration/core/contentfulApi');
var auth = require('*/cartridge/scripts/migration/connectors/contentful/contentfulAuth');
var cfg  = require('*/cartridge/scripts/migration/configAccessor');
var ctxUtil = require('*/cartridge/scripts/migration/contentMigration/contentfulContext');

function testEntryAccess(ctx, entryId) {
    if (!entryId) {
        return null;
    }
    var res = http.get(
        ctxUtil.buildUrl(ctx, '/entries/' + encodeURIComponent(entryId)),
        ctxUtil.authHeaders(ctx.token)
    );
    if (res.status !== 200) {
        throw new Error('Default entry not found (' + res.status + '): ' + entryId);
    }
    return res.data;
}

function testConnectionWith(creds) {
    var c = auth.resolveCreds(creds);

    if (!c.spaceId) {
        throw new Error('Space ID is required. Find it in Contentful → Settings → API keys.');
    }
    if (!c.environmentId) {
        throw new Error('Environment ID is required (usually master).');
    }

    if (!auth.hasManagementCreds(c)) {
        throw new Error(
            'Contentful CMA Personal Access Token is required. Create one under Settings → CMA tokens.'
        );
    }

    var ctx = ctxUtil.getContext(c);

    var spaceRes = http.get(
        c.apiHost + '/spaces/' + encodeURIComponent(c.spaceId),
        ctxUtil.authHeaders(ctx.token)
    );
    if (spaceRes.status === 401 || spaceRes.status === 403) {
        throw new Error('Contentful rejected the CMA token (' + spaceRes.status + '). Check the token and space access.');
    }
    if (spaceRes.status !== 200) {
        throw new Error('Unable to access Contentful space (' + spaceRes.status + '). Import metadata/services.xml if needed.');
    }

    var envRes = http.get(
        ctxUtil.buildUrl(ctx, ''),
        ctxUtil.authHeaders(ctx.token)
    );
    if (envRes.status !== 200) {
        throw new Error('Environment not found: ' + c.environmentId + ' (' + envRes.status + ')');
    }

    if (c.defaultEntryId) {
        try {
            testEntryAccess(ctx, c.defaultEntryId);
        } catch (entryErr) {
            // Optional smoke test — do not fail connect when pref is wrong (e.g. token name pasted).
            var spaceName = (spaceRes.data && spaceRes.data.name) || c.spaceId;
            return {
                ok:        true,
                expiresIn: 0,
                authMode:  'cma-pat',
                project:   {
                    key:  c.spaceId,
                    name: spaceName + ' / ' + c.environmentId
                },
                warning:   'Connected, but default entry ID was not found: '
                    + c.defaultEntryId
                    + '. Clear Default entry ID in Site Preferences or use a real entry ID from Content → entry → Info.'
            };
        }
    }

    var spaceName = (spaceRes.data && spaceRes.data.name) || c.spaceId;
    return {
        ok:        true,
        expiresIn: 0,
        authMode:  'cma-pat',
        project:   {
            key:  c.spaceId,
            name: spaceName + ' / ' + c.environmentId
        }
    };
}

function testConnection() {
    return testConnectionWith(cfg.contentful);
}

function injectCredentials(fields, migCfg) {
    var config = migCfg || require('*/cartridge/scripts/migration/configAccessor');
    var cf = config.contentful || {};
    var out = [];
    var i;
    for (i = 0; i < fields.length; i++) {
        var field = fields[i];
        var value = field.value;
        if (field.name === 'spaceId') {
            value = cf.spaceId || value;
        } else if (field.name === 'environmentId') {
            value = cf.environmentId || value;
        } else if (field.name === 'cmaPersonalAccessToken' && cf.cmaPersonalAccessToken) {
            value = '••••••••';
        } else if (field.name === 'apiHost') {
            value = cf.apiHost || value;
        } else if (field.name === 'defaultEntryId') {
            value = cf.defaultEntryId || value;
        }
        out.push({
            name:             field.name,
            label:            field.label,
            type:             field.type,
            required:         field.required,
            value:            value,
            placeholder:      field.placeholder || '',
            secretConfigured: field.name === 'cmaPersonalAccessToken' && !!cf.cmaPersonalAccessToken
        });
    }
    return out;
}

function emptyStepContent(title) {
    return {
        titleSuffix: title,
        intro:       'Not applicable for Contentful CMS.',
        sections:    [],
        summary:     ''
    };
}

module.exports = {
    id:                  'contentful',
    getAccessToken:      auth.getAccessToken,
    hasManagementCreds:  auth.hasManagementCreds,
    testConnectionWith:  testConnectionWith,
    testConnection:      testConnection,
    getSchemaCounts:     function () { return {}; },
    getAttrDefsForTask:  function () { return []; },
    getAttrIdsForTask:   function () { return []; },
    injectCredentials:   injectCredentials,
    getDefaultTasks:     function () { return []; },
    buildFetchContent:   function () { return emptyStepContent('CMS content'); },
    buildAiMapContent:   function () { return emptyStepContent('CMS mapping'); }
};
