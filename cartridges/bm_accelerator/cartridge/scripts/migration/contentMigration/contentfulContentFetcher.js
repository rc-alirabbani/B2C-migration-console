'use strict';

var http = require('*/cartridge/scripts/migration/core/contentfulApi');
var auth = require('*/cartridge/scripts/migration/connectors/contentful/contentfulAuth');
var ctxUtil = require('*/cartridge/scripts/migration/contentMigration/contentfulContext');
var assetResolver = require('*/cartridge/scripts/migration/contentMigration/contentfulAssetResolver');

function localizedValue(fields, fieldId, locale) {
    if (!fields || !fieldId) return '';
    var val = fields[fieldId];
    if (val === null || val === undefined) return '';
    if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
        return String(val);
    }
    if (typeof val === 'object' && !Array.isArray(val) && locale && val[locale] !== undefined) {
        return localizedValue({ tmp: val[locale] }, 'tmp', null);
    }
    if (typeof val === 'object' && !Array.isArray(val)) {
        var keys = Object.keys(val);
        if (keys.length) {
            return localizedValue({ tmp: val[keys[0]] }, 'tmp', null);
        }
    }
    return '';
}

function entryStatus(entry) {
    var sys = (entry && entry.sys) || {};
    if (sys.archivedVersion) return 'archived';
    if (sys.publishedVersion) {
        if (sys.version > sys.publishedVersion + 1) {
            return 'changed';
        }
        return 'published';
    }
    return 'draft';
}

function summarizeEntry(entry, locale) {
    var sys = entry.sys || {};
    var fields = entry.fields || {};
    var contentTypeId = (sys.contentType && sys.contentType.sys && sys.contentType.sys.id) || '';
    var label = localizedValue(fields, 'title', locale)
        || localizedValue(fields, 'name', locale)
        || localizedValue(fields, 'internalName', locale)
        || localizedValue(fields, 'headline', locale)
        || sys.id
        || 'Untitled';

    return {
        id:           sys.id || '',
        label:        label,
        deliveryKey:  localizedValue(fields, 'slug', locale) || '',
        schema:       contentTypeId,
        schemaShort:  contentTypeId,
        status:       entryStatus(entry),
        locale:       locale,
        lastModified: sys.updatedAt || '',
        hasKey:       !!localizedValue(fields, 'slug', locale),
        repoName:     '',
        repoLabel:    locale || ''
    };
}

function listEntriesPage(ctx, locale, skip, limit) {
    var query = '?limit=' + limit + '&skip=' + skip + '&order=-sys.updatedAt';
    var res = http.get(ctxUtil.buildUrl(ctx, '/entries' + query), ctxUtil.authHeaders(ctx.token));
    if (res.status !== 200) {
        throw new Error('Unable to list entries (' + res.status + ')');
    }
    return res.data;
}

/**
 * List entries from the configured space/environment via CMA.
 * @param {number} [pageSize]
 * @returns {Object}
 */
function listContentItems(pageSize) {
    if (!auth.hasManagementCreds(auth.resolveCreds())) {
        throw new Error('CMA Personal Access Token required to list content. Configure Site Preferences.');
    }

    var limit = Math.min(Math.max(parseInt(String(pageSize || 100), 10) || 100, 1), 100);
    var ctx = ctxUtil.getContext();
    var locale = ctxUtil.getDefaultLocale(ctx);
    var items = [];
    var schemaMap = {};

  // Single CMA page — avoids BM request timeouts on large spaces.
    var page = listEntriesPage(ctx, locale, 0, limit);
    var batch = page.items || [];
    var total = page.total || batch.length;
    var i;
    for (i = 0; i < batch.length; i++) {
        var summary = summarizeEntry(batch[i], locale);
        items.push(summary);
        if (summary.schemaShort) {
            schemaMap[summary.schemaShort] = true;
        }
    }

    var schemas = Object.keys(schemaMap).sort();
    var typeSummaries = [];
    var t;
    for (t = 0; t < schemas.length; t++) {
        typeSummaries.push({
            id:    schemas[t],
            name:  schemas[t],
            label: schemas[t],
            count: 0
        });
    }

    return {
        total:         total,
        loaded:        items.length,
        truncated:     total > items.length,
        items:         items,
        hubName:       ctx.creds.spaceId,
        spaceId:       ctx.creds.spaceId,
        environmentId: ctx.creds.environmentId,
        repositories:  typeSummaries,
        schemas:       schemas,
        locale:        locale
    };
}

function fetchEntryWithContext(entryId, ctx, locale) {
    var id = String(entryId || '').trim();
    if (!id) {
        throw new Error('Entry ID is required.');
    }
    var res = http.get(
        ctxUtil.buildUrl(ctx, '/entries/' + encodeURIComponent(id)),
        ctxUtil.authHeaders(ctx.token)
    );
    if (res.status !== 200) {
        throw new Error('Unable to fetch entry (' + res.status + '): ' + id);
    }
    var entry = res.data || {};
    var fields = entry.fields || {};
    var contentTypeId = (entry.sys && entry.sys.contentType && entry.sys.contentType.sys)
        ? entry.sys.contentType.sys.id
        : '';
    var assets = assetResolver.resolveEntryAssets(ctx, fields, locale);

    return {
        deliveryKey:    localizedValue(fields, 'slug', locale),
        contentId:      id,
        hasDeliveryKey: !!localizedValue(fields, 'slug', locale),
        spaceId:        ctx.creds.spaceId,
        environmentId:  ctx.creds.environmentId,
        content:        fields,
        rawItem:        entry,
        label:          summarizeEntry(entry, locale).label,
        status:         entryStatus(entry),
        locale:         locale,
        contentTypeId:  contentTypeId,
        primaryImage:   assets.primaryImage,
        previewImages:  assets.images,
        source:         'cma'
    };
}

function fetchByContentId(contentId) {
    if (!auth.hasManagementCreds(auth.resolveCreds())) {
        throw new Error('CMA Personal Access Token required to fetch entries.');
    }
    var ctx = ctxUtil.getContext();
    var locale = ctxUtil.getDefaultLocale(ctx);
    return fetchEntryWithContext(contentId, ctx, locale);
}

/**
 * @param {string} deliveryKey - treated as entry id when UUID-like or slug lookup skipped
 * @returns {Object}
 */
function fetchBySlug(ctx, locale, slug) {
    var loc = locale || 'en-US';
    var slugQuery = 'fields.slug[' + encodeURIComponent(loc) + ']=' + encodeURIComponent(slug);
    var res = http.get(
        ctxUtil.buildUrl(ctx, '/entries?limit=1&' + slugQuery),
        ctxUtil.authHeaders(ctx.token)
    );
    if (res.status !== 200) {
        throw new Error('Unable to find entry by slug (' + res.status + '): ' + slug);
    }
    var items = res.data.items || [];
    if (!items.length) {
        throw new Error('No entry found for slug: ' + slug);
    }
    return fetchEntryWithContext(items[0].sys.id, ctx, locale);
}

function fetchByDeliveryKey(deliveryKey) {
    var key = String(deliveryKey || '').trim();
    if (!key) {
        throw new Error('Entry ID or slug is required.');
    }
    var ctx = ctxUtil.getContext();
    var locale = ctxUtil.getDefaultLocale(ctx);
    if (/^[a-zA-Z0-9]{10,}$/.test(key) && key.indexOf('/') < 0 && key.indexOf(' ') < 0) {
        return fetchEntryWithContext(key, ctx, locale);
    }
    return fetchBySlug(ctx, locale, key);
}

function fetchByContentIds(contentIds) {
    if (!auth.hasManagementCreds(auth.resolveCreds())) {
        throw new Error('CMA Personal Access Token required to fetch entries.');
    }
    var ctx = ctxUtil.getContext();
    var locale = ctxUtil.getDefaultLocale(ctx);
    var items = [];
    var errors = [];
    var i;
    for (i = 0; i < (contentIds || []).length; i++) {
        var id = String(contentIds[i] || '').trim();
        if (!id) continue;
        try {
            items.push(fetchEntryWithContext(id, ctx, locale));
        } catch (e) {
            errors.push({ contentId: id, error: e.message || String(e) });
        }
    }
    return { items: items, errors: errors };
}

module.exports = {
    listContentItems:   listContentItems,
    fetchByDeliveryKey: fetchByDeliveryKey,
    fetchByContentId:   fetchByContentId,
    fetchByContentIds:  fetchByContentIds
};
