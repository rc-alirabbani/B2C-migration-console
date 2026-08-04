'use strict';

var WIDGET_TYPE = 'contentfulWidget';

function firstLocalizedString(fields, keys, locale) {
    if (!fields) return '';
    var i;
    for (i = 0; i < keys.length; i++) {
        var val = fields[keys[i]];
        if (val === null || val === undefined) continue;
        if (typeof val === 'string' && val.trim()) return val.trim();
        if (typeof val === 'object' && !Array.isArray(val)) {
            if (locale && typeof val[locale] === 'string' && val[locale].trim()) {
                return val[locale].trim();
            }
            var codes = Object.keys(val);
            if (codes.length && typeof val[codes[0]] === 'string' && val[codes[0]].trim()) {
                return val[codes[0]].trim();
            }
        }
    }
    return '';
}

function buildPreviewHtml(title, body) {
    var parts = [];
    if (title) {
        parts.push('<h2>' + title + '</h2>');
    }
    if (body) {
        parts.push(body.indexOf('<') >= 0 ? body : '<p>' + body + '</p>');
    }
    return parts.join('') || '<p></p>';
}

function localizedFieldValue(fields, fieldId, locale) {
    if (!fields || !fieldId) return '';
    return firstLocalizedString(fields, [fieldId], locale);
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

/**
 * Build preview fields from all Contentful entry fields (localized).
 * @param {Object} content
 * @param {string} locale
 * @returns {{ fields: Array, body: string, image: string }}
 */
function extractPreviewFromFields(content, locale) {
    var fields = [];
    var bodyParts = [];
    var image = '';
    var keys = Object.keys(content || {});
    var i;
    var skipTitle = { title: 1, name: 1, internalName: 1, headline: 1 };

    for (i = 0; i < keys.length; i++) {
        var key = keys[i];
        var raw = content[key];
        if (raw === null || raw === undefined) continue;

        var val = raw;
        if (typeof raw === 'object' && !Array.isArray(raw) && raw.nodeType === 'document') {
            val = richTextToPlain(raw).trim();
        } else if (typeof raw === 'object' && !Array.isArray(raw) && locale && raw[locale] !== undefined) {
            val = raw[locale];
            if (val && typeof val === 'object' && val.nodeType === 'document') {
                val = richTextToPlain(val).trim();
            }
        } else if (typeof raw === 'object' && !Array.isArray(raw)) {
            var locKeys = Object.keys(raw);
            if (locKeys.length && typeof raw[locKeys[0]] === 'string') {
                val = raw[locKeys[0]];
            } else if (locKeys.length && raw[locKeys[0]] && raw[locKeys[0]].nodeType === 'document') {
                val = richTextToPlain(raw[locKeys[0]]).trim();
            } else {
                continue;
            }
        }

        if (typeof val !== 'string' || !val.trim()) continue;
        var text = val.trim();
        fields.push({ name: key, value: text, type: 'text' });
        if (!skipTitle[key] && key !== 'slug') {
            bodyParts.push(text);
        }
        if (!image && (key === 'image' || key === 'imageUrl' || key.indexOf('image') >= 0) && text.indexOf('http') === 0) {
            image = text;
        }
    }

    return {
        fields: fields,
        body:   bodyParts.slice(0, 3).join('\n\n'),
        image:  image
    };
}

function mergePreviewImageFields(fields, previewImages) {
    var out = (fields || []).slice();
    var names = {};
    var i;
    for (i = 0; i < out.length; i++) {
        names[out[i].name] = true;
    }
    for (i = 0; i < (previewImages || []).length; i++) {
        var img = previewImages[i];
        var name = img.field || img.name || ('image' + i);
        if (names[name]) continue;
        names[name] = true;
        out.push({
            name:  name,
            type:  'image',
            value: img.url || ''
        });
    }
    return out;
}

/**
 * Map a fetched Contentful entry to the SFCC widget preview shape.
 * @param {Object} fetched
 * @returns {Object}
 */
function transformFetchedContent(fetched) {
    var content = fetched.content || {};
    var locale = fetched.locale || 'en-US';
    var contentTypeId = fetched.contentTypeId
        || (fetched.rawItem && fetched.rawItem.sys && fetched.rawItem.sys.contentType
            && fetched.rawItem.sys.contentType.sys && fetched.rawItem.sys.contentType.sys.id)
        || '';

    var title = firstLocalizedString(content, ['title', 'name', 'headline', 'internalName'], locale);
    var body = firstLocalizedString(content, ['body', 'description', 'text', 'richText'], locale);
    var slug = localizedFieldValue(content, 'slug', locale) || fetched.deliveryKey || '';
    var extracted = extractPreviewFromFields(content, locale);

    if (!body && extracted.body) {
        body = extracted.body;
    }
    var previewImages = fetched.previewImages || [];
    var primaryImage = fetched.primaryImage || extracted.image || '';
    if (!primaryImage && previewImages.length) {
        primaryImage = previewImages[0].url || '';
    }
    var previewFields = mergePreviewImageFields(extracted.fields, previewImages);
    var rawEntry = fetched.rawItem || null;
    var entryFields = content;

    return {
        widgetType:     WIDGET_TYPE,
        schema:         contentTypeId,
        schemaShort:    contentTypeId,
        contentId:      fetched.contentId || '',
        deliveryKey:    slug,
        spaceId:        fetched.spaceId || '',
        environmentId:  fetched.environmentId || '',
        preview: {
            title:  title || fetched.label || fetched.contentId || '',
            body:   body,
            image:  primaryImage,
            images: previewImages,
            fields: previewFields
        },
        attributes: {
            contentTypeId: contentTypeId,
            entryId:       fetched.contentId || '',
            slug:          slug,
            locale:        locale,
            previewHtml:   buildPreviewHtml(title, body),
            richText:      body,
            previewFields: previewFields,
            previewImages: previewImages,
            imageUrl:      primaryImage,
            entryFields:   entryFields
        },
        source: {
            fields: entryFields,
            entry:  rawEntry
        },
        sourceMetadata: {
            status:         fetched.status || '',
            locale:         locale,
            spaceId:        fetched.spaceId || '',
            environmentId:  fetched.environmentId || '',
            contentTypeId:  contentTypeId,
            resolvedImages: previewImages
        }
    };
}

module.exports = {
    WIDGET_TYPE:            WIDGET_TYPE,
    transformFetchedContent: transformFetchedContent
};
