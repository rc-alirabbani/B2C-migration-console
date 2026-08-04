'use strict';

var ContentMgr = require('dw/content/ContentMgr');
var Site = require('dw/system/Site');

var FOLDER_ID = 'contentful';
var DEFAULT_WIDGET = 'contentfulWidget';
var LIBRARY_PREF = 'rcMigContentLibraryId';

function parseJsonSafe(raw, fallback) {
    if (!raw) return fallback || null;
    try {
        return JSON.parse(String(raw));
    } catch (e) {
        return fallback || null;
    }
}

function matchesQuery(model, query) {
    var q = String(query || '').trim().toLowerCase();
    if (!q) return true;
    var haystack = [
        model.name,
        model.id,
        model.contentId,
        model.entryId,
        model.slug,
        model.contentType,
        model.widgetType,
        model.widgetLabel
    ].join(' ').toLowerCase();
    return haystack.indexOf(q) >= 0;
}

function collectionToArray(collection) {
    var result = [];
    var iterator;
    var i;

    if (!collection) return result;
    if (collection.iterator) {
        iterator = collection.iterator();
        while (iterator.hasNext()) result.push(iterator.next());
        return result;
    }
    if (typeof collection.length === 'number') {
        for (i = 0; i < collection.length; i++) result.push(collection[i]);
    }
    return result;
}

function getConfiguredLibraryId() {
    try {
        var site = Site.getCurrent();
        if (!site) return '';
        var val = site.getCustomPreferenceValue(LIBRARY_PREF);
        if (val === null || val === undefined) return '';
        return String(val).trim();
    } catch (e) {
        return '';
    }
}

function resolveContentLibrary() {
    var libId = getConfiguredLibraryId();
    var lib = null;

    if (libId) {
        lib = ContentMgr.getLibrary(libId);
        if (lib) return lib;
    }

    if (typeof ContentMgr.getSiteLibrary === 'function') {
        lib = ContentMgr.getSiteLibrary();
        if (lib) return lib;
    }

    lib = ContentMgr.getLibrary('MigrationConsole');
    if (lib) return lib;

    try {
        var site = Site.getCurrent();
        if (site && site.getID()) {
            return ContentMgr.getLibrary(site.getID());
        }
    } catch (e2) {
        // ignore
    }
    return null;
}

function getContentFolder(folderId) {
    var fid = folderId || FOLDER_ID;
    var lib = resolveContentLibrary();
    var folder = null;

    if (lib && typeof lib.getFolder === 'function') {
        folder = lib.getFolder(fid);
    }
    if (!folder) {
        folder = ContentMgr.getFolder(fid);
    }
    return folder;
}

function getFolderContent(folderId) {
    var folder = getContentFolder(folderId);
    if (!folder || folder.online === false) return [];

    var content = typeof folder.getOnlineContent === 'function'
        ? folder.getOnlineContent()
        : folder.onlineContent;

    return collectionToArray(content);
}

function parseContentfulSourceJson(raw) {
    var source = parseJsonSafe(raw, {}) || {};
    if (!source || typeof source !== 'object') return { metadata: {}, fields: {}, entry: null };

    if (source.entry && source.fields) {
        return {
            metadata: source.metadata || {},
            fields:   source.fields || {},
            entry:    source.entry
        };
    }
    if (source.item) {
        return {
            metadata: source.metadata || {},
            fields:   source.item || {},
            entry:    source.entry || null
        };
    }
    return {
        metadata: source.metadata || {},
        fields:   source,
        entry:    source.entry || null
    };
}

function isContentfulAsset(asset) {
    if (!asset) return false;
    var id = String(asset.ID || '');
    if (id.indexOf('amp-') === 0) return false;
    if (id.indexOf('ctf-') === 0) return true;
    if (!asset.custom) return false;
    var custom = asset.custom;
    return !!(
        custom.contentfulEntryId
        || custom.contentfulWidgetType
        || custom.contentfulWidgetAttributes
        || custom.contentfulSourceJson
    );
}

/**
 * @param {dw.content.Content} asset
 * @returns {Object|null}
 */
function resolveFromContentAsset(asset) {
    if (!asset || asset.online === false || !isContentfulAsset(asset)) return null;

    var custom = asset.custom || {};
    var entryId = String(custom.contentfulEntryId || '').trim();
    var attributes = parseJsonSafe(custom.contentfulWidgetAttributes, {}) || {};
    var parsedSource = parseContentfulSourceJson(custom.contentfulSourceJson);
    var source = {
        metadata: parsedSource.metadata,
        fields:   parsedSource.fields,
        entry:    parsedSource.entry
    };
    var contentType = String(custom.contentfulContentType || attributes.contentTypeId || '');
    var widgetType = String(custom.contentfulWidgetType || DEFAULT_WIDGET);
    var slug = String(custom.contentfulSlug || attributes.slug || '');
    var imageUrl = String(
        custom.contentfulImageUrl
        || attributes.imageUrl
        || (attributes.previewImages && attributes.previewImages[0] && attributes.previewImages[0].url)
        || ''
    );
    var bodyHtml = String(
        custom.body
        || attributes.richText
        || attributes.previewHtml
        || ''
    );
    var previewFields = attributes.previewFields || [];
    var previewImages = attributes.previewImages || [];

    return {
        id: asset.ID,
        name: asset.name || slug || entryId || asset.ID,
        description: asset.description || '',
        widgetType: widgetType,
        widgetLabel: contentType || widgetType,
        contentType: contentType,
        schema: contentType,
        slug: slug,
        entryId: entryId,
        contentId: entryId || asset.ID,
        deliveryKey: slug,
        imageUrl: imageUrl,
        bodyHtml: bodyHtml,
        hasBody: !!bodyHtml,
        attributes: attributes,
        fields: previewFields.length ? previewFields : (attributes.previewFields || []),
        images: previewImages.length ? previewImages : (attributes.previewImages || []),
        source: source,
        entry: source.entry || null,
        entryFields: source.fields || attributes.entryFields || {}
    };
}

function getContentfulAsset(contentId) {
    if (!contentId) return null;
    var id = String(contentId);
    var asset = ContentMgr.getContent(id);
    if (!asset) {
        var folderAssets = getFolderContent();
        var i;
        for (i = 0; i < folderAssets.length; i++) {
            if (String(folderAssets[i].ID || '') === id) {
                asset = folderAssets[i];
                break;
            }
        }
    }
    return resolveFromContentAsset(asset);
}

/**
 * @param {Object} options
 * @returns {Object}
 */
function getContentfulAssets(options) {
    var opts = options || {};
    var pageSize = Math.max(1, Math.min(parseInt(opts.pageSize, 10) || 12, 48));
    var page = Math.max(1, parseInt(opts.page, 10) || 1);
    var type = String(opts.type || '');
    var query = String(opts.query || '').trim();
    var models = [];
    var typeMap = {};
    var rawAssets = getFolderContent(opts.folderId);
    var skipped = 0;

    rawAssets.forEach(function (asset) {
        var model = resolveFromContentAsset(asset);
        if (!model) {
            skipped += 1;
            return;
        }
        if (model.contentType) typeMap[model.contentType] = true;
        var typeKey = model.contentType || model.widgetType;
        if (type && typeKey !== type && model.widgetType !== type) return;
        if (!matchesQuery(model, query)) return;
        models.push(model);
    });

    models.sort(function (a, b) {
        return String(a.name).toLowerCase().localeCompare(String(b.name).toLowerCase());
    });

    var total = models.length;
    var pageCount = Math.max(1, Math.ceil(total / pageSize));
    page = Math.min(page, pageCount);
    var start = (page - 1) * pageSize;
    var lib = resolveContentLibrary();

    return {
        items: models.slice(start, start + pageSize),
        total: total,
        page: page,
        pageSize: pageSize,
        pageCount: pageCount,
        hasPrevious: page > 1,
        hasNext: page < pageCount,
        type: type,
        query: query,
        folderFound: !!getContentFolder(opts.folderId || FOLDER_ID),
        libraryId: lib && lib.ID ? lib.ID : '',
        rawAssetCount: rawAssets.length,
        skippedAssetCount: skipped,
        contentTypes: Object.keys(typeMap).sort()
    };
}

function getContentTypeFilters(assetsResult) {
    var types = (assetsResult && assetsResult.contentTypes) || [];
    var filters = [{ id: '', label: 'All types' }];
    var i;
    for (i = 0; i < types.length; i++) {
        filters.push({ id: types[i], label: types[i] });
    }
    return filters;
}

module.exports = {
    FOLDER_ID:               FOLDER_ID,
    DEFAULT_WIDGET:          DEFAULT_WIDGET,
    matchesQuery:            matchesQuery,
    resolveFromContentAsset: resolveFromContentAsset,
    getContentfulAsset:      getContentfulAsset,
    getContentfulAssets:     getContentfulAssets,
    getContentTypeFilters:   getContentTypeFilters
};
