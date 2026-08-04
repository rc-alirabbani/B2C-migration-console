'use strict';

var server = require('server');

function applyNoPageCache(req, res, next) {
    res.cachePeriod = 0;
    res.cachePeriodUnit = 'minutes';
    next();
}

/**
 * ContentfulContent-List : JSON catalog from SFCC contentful/ folder (React + headless).
 */
server.get('List', applyNoPageCache, function (req, res, next) {
    var helper = require('*/cartridge/scripts/helpers/contentfulContent');
    var type = String(req.querystring.type || '');
    var query = String(req.querystring.q || '').trim();

    try {
        var result = helper.getContentfulAssets({
            page: req.querystring.page,
            pageSize: req.querystring.pageSize || 48,
            type: type,
            query: query
        });

        var items = [];
        var i;
        for (i = 0; i < result.items.length; i++) {
            var item = result.items[i];
            items.push({
                id: item.id,
                name: item.name,
                description: item.description || '',
                widgetType: item.widgetType,
                widgetLabel: item.widgetLabel,
                contentType: item.contentType,
                contentId: item.entryId,
                entryId: item.entryId,
                slug: item.slug,
                deliveryKey: item.slug,
                imageUrl: item.imageUrl || '',
                bodyHtml: item.bodyHtml || '',
                hasBody: !!item.hasBody,
                attributes: item.attributes || {},
                fields: item.fields || [],
                images: item.images || [],
                entry: item.entry || null,
                entryFields: item.entryFields || {},
                source: item.source || {}
            });
        }

        res.json({
            ok: true,
            total: result.total,
            page: result.page,
            pageSize: result.pageSize,
            pageCount: result.pageCount,
            hasPrevious: result.hasPrevious,
            hasNext: result.hasNext,
            type: result.type,
            query: result.query,
            folderFound: result.folderFound,
            libraryId: result.libraryId || '',
            rawAssetCount: result.rawAssetCount || 0,
            skippedAssetCount: result.skippedAssetCount || 0,
            contentTypes: result.contentTypes,
            widgetTypes: helper.getContentTypeFilters(result),
            items: items
        });
    } catch (e) {
        res.setStatusCode(500);
        res.json({
            ok: false,
            error: String(e.message || e)
        });
    }
    return next();
});

/**
 * ContentfulContent-Detail : JSON snapshot for one migrated SFCC content asset.
 */
server.get('Detail', applyNoPageCache, function (req, res, next) {
    var helper = require('*/cartridge/scripts/helpers/contentfulContent');
    var cid = String(req.querystring.cid || '').trim();

    try {
        var model = helper.getContentfulAsset(cid);
        if (!model) {
            res.setStatusCode(404);
            res.json({ ok: false, error: 'Content asset not found: ' + cid });
            return next();
        }
        res.json({ ok: true, item: model });
    } catch (e) {
        res.setStatusCode(500);
        res.json({ ok: false, error: String(e.message || e) });
    }
    return next();
});

module.exports = server.exports();
