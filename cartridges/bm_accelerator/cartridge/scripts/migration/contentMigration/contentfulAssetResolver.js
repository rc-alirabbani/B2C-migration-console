'use strict';

var http = require('*/cartridge/scripts/migration/core/contentfulApi');
var ctxUtil = require('*/cartridge/scripts/migration/contentMigration/contentfulContext');

var assetCache = {};

function normalizeAssetUrl(url) {
    var u = String(url || '').trim();
    if (!u) return '';
    if (u.indexOf('//') === 0) return 'https:' + u;
    return u;
}

function unwrapLocale(val, locale) {
    if (!val || typeof val !== 'object' || Array.isArray(val)) return val;
    if (val.sys && val.sys.type) return val;
    if (val.nodeType) return val;
    if (locale && val[locale] !== undefined) return val[locale];
    var keys = Object.keys(val);
    if (keys.length === 1 && val[keys[0]] !== null && typeof val[keys[0]] === 'object') {
        return val[keys[0]];
    }
    return val;
}

function pickLocalizedFile(fileField, locale) {
    if (!fileField || typeof fileField !== 'object') return null;
    if (fileField.url) return fileField;
    if (locale && fileField[locale] && fileField[locale].url) return fileField[locale];
    var keys = Object.keys(fileField);
    var i;
    for (i = 0; i < keys.length; i++) {
        if (fileField[keys[i]] && fileField[keys[i]].url) {
            return fileField[keys[i]];
        }
    }
    return null;
}

function fetchAsset(ctx, assetId, locale) {
    var id = String(assetId || '').trim();
    if (!id) return null;
    var loc = locale || 'en-US';
    var cacheKey = ctx.creds.spaceId + ':' + ctx.creds.environmentId + ':' + id + ':' + loc;
    if (assetCache[cacheKey]) {
        return assetCache[cacheKey];
    }
    var res = http.get(
        ctxUtil.buildUrl(ctx, '/assets/' + encodeURIComponent(id)),
        ctxUtil.authHeaders(ctx.token)
    );
    if (res.status !== 200 || !res.data) {
        return null;
    }
    var fileField = (res.data.fields && res.data.fields.file) || {};
    var fileMeta = pickLocalizedFile(fileField, loc);
    var url = normalizeAssetUrl(fileMeta && fileMeta.url);
    var title = (res.data.fields && res.data.fields.title) || {};
    var titleVal = unwrapLocale(title, loc);
    var label = typeof titleVal === 'string' ? titleVal : id;
    var out = { id: id, url: url, label: label };
    assetCache[cacheKey] = out;
    return out;
}

function isAssetLink(obj) {
    return !!(obj && obj.sys && obj.sys.type === 'Link' && obj.sys.linkType === 'Asset' && obj.sys.id);
}

function collectAssetIds(value, out, seen) {
    if (!value) return;
    if (isAssetLink(value)) {
        if (!seen[value.sys.id]) {
            seen[value.sys.id] = true;
            out.push(value.sys.id);
        }
        return;
    }
    if (Array.isArray(value)) {
        var i;
        for (i = 0; i < value.length; i++) {
            collectAssetIds(value[i], out, seen);
        }
        return;
    }
    if (typeof value === 'object') {
        var keys = Object.keys(value);
        var k;
        for (k = 0; k < keys.length; k++) {
            collectAssetIds(value[keys[k]], out, seen);
        }
    }
}

/**
 * Resolve linked assets on an entry to preview image URLs.
 * @param {Object} ctx
 * @param {Object} fields - entry.fields
 * @param {string} [locale]
 * @returns {{ images: Array, primaryImage: string }}
 */
function resolveEntryAssets(ctx, fields, locale) {
    var loc = locale || 'en-US';
    var images = [];
    var seenIds = {};
    var fieldKeys = Object.keys(fields || {});
    var f;
    var i;
    var j;
    var ids;

    for (f = 0; f < fieldKeys.length; f++) {
        var fieldId = fieldKeys[f];
        var localized = unwrapLocale(fields[fieldId], loc);
        ids = [];
        collectAssetIds(localized, ids, {});
        for (j = 0; j < ids.length; j++) {
            var assetId = ids[j];
            if (seenIds[assetId]) continue;
            seenIds[assetId] = true;
            var asset = fetchAsset(ctx, assetId, loc);
            if (asset && asset.url) {
                images.push({
                    name: asset.label || fieldId,
                    field: fieldId,
                    url:  asset.url,
                    type: 'image'
                });
            }
        }
    }

    return {
        images:       images,
        primaryImage: images.length ? images[0].url : ''
    };
}

module.exports = {
    normalizeAssetUrl:  normalizeAssetUrl,
    resolveEntryAssets: resolveEntryAssets
};
