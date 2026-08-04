'use strict';

/**
 * Vite dev middleware: Contentful Management API catalog for React gallery.
 * Keeps the CMA token server-side in repo root .env (same credentials as BM wizard).
 */

function pickLocale(fields, locale) {
    if (!fields || typeof fields !== 'object') return '';
    if (typeof fields === 'string') return fields.trim();
    if (locale && fields[locale] !== undefined) {
        return pickLocale(fields[locale], null);
    }
    var keys = Object.keys(fields);
    if (!keys.length) return '';
    return pickLocale(fields[keys[0]], null);
}

function richTextToPlain(node) {
    if (!node) return '';
    if (typeof node === 'string') return node;
    if (node.nodeType === 'text' && node.value) return String(node.value);
    var out = '';
    var content = node.content;
    if (content && content.length) {
        var i;
        for (i = 0; i < content.length; i++) {
            out += richTextToPlain(content[i]);
        }
    }
    return out;
}

function fieldText(fields, keys, locale) {
    var i;
    for (i = 0; i < keys.length; i++) {
        var raw = fields[keys[i]];
        if (raw === null || raw === undefined) continue;
        if (typeof raw === 'object' && raw.nodeType === 'document') {
            var plain = richTextToPlain(raw).trim();
            if (plain) return plain;
        }
        var loc = pickLocale(raw, locale);
        if (loc && typeof loc === 'object' && loc.nodeType === 'document') {
            loc = richTextToPlain(loc).trim();
        }
        if (loc) return String(loc).trim();
    }
    return '';
}

function sanitizeIdPart(value) {
    var raw = String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return raw || 'contentful-content';
}

function buildPreviewHtml(title, body) {
    var parts = [];
    if (title) parts.push('<h2>' + title + '</h2>');
    if (body) {
        parts.push(body.indexOf('<') >= 0 ? body : '<p>' + body + '</p>');
    }
    return parts.join('') || '<p></p>';
}

function mapEntryToCatalogItem(entry, locale) {
    var sys = entry.sys || {};
    var fields = entry.fields || {};
    var entryId = String(sys.id || '');
    var contentType = (sys.contentType && sys.contentType.sys && sys.contentType.sys.id) || '';
    var slug = fieldText(fields, ['slug'], locale);
    var title = fieldText(fields, ['title', 'name', 'headline', 'internalName'], locale);
    var body = fieldText(fields, ['body', 'description', 'text', 'richText'], locale);
    var sfccId = 'ctf-' + sanitizeIdPart(slug || entryId);
    var bodyHtml = buildPreviewHtml(title, body);
    var attributes = {
        contentTypeId: contentType,
        entryId: entryId,
        slug: slug,
        locale: locale,
        richText: body,
        previewHtml: bodyHtml,
        previewFields: [],
        previewImages: [],
        entryFields: fields,
        entry: entry
    };

    return {
        id: sfccId,
        name: title || slug || entryId || sfccId,
        description: contentType ? 'Content type: ' + contentType : '',
        widgetType: 'contentfulWidget',
        widgetLabel: contentType || 'contentfulWidget',
        contentType: contentType,
        contentId: entryId,
        entryId: entryId,
        slug: slug,
        deliveryKey: slug,
        imageUrl: '',
        bodyHtml: bodyHtml,
        hasBody: !!body,
        attributes: attributes,
        fields: [],
        images: [],
        source: {
            metadata: { locale: locale, contentType: contentType },
            fields: entry.fields || {},
            entry: entry
        }
    };
}

function createContentfulDevMiddleware(env) {
    var token = env.CONTENTFUL_CMA_PERSONAL_ACCESS_TOKEN
        || env.CONTENTFUL_CMA_TOKEN
        || env.rcMigContentfulCmaPersonalAccessToken
        || '';
    var spaceId = env.CONTENTFUL_SPACE_ID || env.rcMigContentfulSpaceId || '';
    var environmentId = env.CONTENTFUL_ENVIRONMENT_ID
        || env.rcMigContentfulEnvironmentId
        || 'master';
    var apiHost = (env.CONTENTFUL_API_HOST || env.rcMigContentfulApiHost || 'https://api.contentful.com')
        .replace(/\/$/, '');
    var locale = env.CONTENTFUL_LOCALE || env.VITE_CONTENTFUL_LOCALE || 'en-US';

    return function contentfulDevMiddleware(req, res, next) {
        if (!req.url || req.url.indexOf('/contentful-dev-catalog') !== 0) {
            return next();
        }

        if (!token || !spaceId) {
            res.statusCode = 503;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
                ok: false,
                error: 'Set CONTENTFUL_SPACE_ID and CONTENTFUL_CMA_PERSONAL_ACCESS_TOKEN in repo root .env '
                    + '(same values as BM Site Preferences for Contentful).'
            }));
            return;
        }

        var requestUrl = new URL(req.url, 'http://localhost');
        var limit = Math.min(parseInt(requestUrl.searchParams.get('limit') || '100', 10) || 100, 100);
        var cmaUrl = apiHost + '/spaces/' + encodeURIComponent(spaceId)
            + '/environments/' + encodeURIComponent(environmentId)
            + '/entries?limit=' + limit + '&order=-sys.updatedAt';

        fetch(cmaUrl, {
            headers: {
                Authorization: 'Bearer ' + token,
                'Content-Type': 'application/vnd.contentful.management.v1+json'
            }
        })
            .then(function (cmaRes) {
                if (!cmaRes.ok) {
                    return cmaRes.text().then(function (body) {
                        res.statusCode = cmaRes.status;
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify({
                            ok: false,
                            error: 'Contentful CMA (' + cmaRes.status + '): ' + body.slice(0, 500)
                        }));
                    });
                }
                return cmaRes.json().then(function (payload) {
                    var entries = payload.items || [];
                    var items = entries.map(function (entry) {
                        return mapEntryToCatalogItem(entry, locale);
                    });
                    var typeMap = {};
                    items.forEach(function (it) {
                        if (it.contentType) typeMap[it.contentType] = true;
                    });
                    res.statusCode = 200;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({
                        ok: true,
                        source: 'contentful-cma',
                        total: payload.total || items.length,
                        page: 1,
                        pageSize: items.length,
                        pageCount: 1,
                        hasPrevious: false,
                        hasNext: false,
                        folderFound: true,
                        contentTypes: Object.keys(typeMap).sort(),
                        items: items
                    }));
                });
            })
            .catch(function (err) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ ok: false, error: String(err.message || err) }));
            });
    };
}

module.exports = {
    createContentfulDevMiddleware: createContentfulDevMiddleware
};
