'use strict';

/**
 * Resolve which SFCC content library IMPEX should target.
 * Prefer site preference, then the current site's private library (ContentMgr.getSiteLibrary),
 * not a shared library that happens to share the site ID string.
 */

var Site = require('dw/system/Site');

function getPrefLibraryId() {
    try {
        var site = Site.getCurrent();
        if (!site) return '';
        var val = site.getCustomPreferenceValue('rcMigContentLibraryId');
        if (val === null || val === undefined) return '';
        return String(val).trim();
    } catch (e) {
        return '';
    }
}

function getSiteLibraryId() {
    try {
        var ContentMgr = require('dw/content/ContentMgr');
        var library = ContentMgr.getSiteLibrary();
        if (library && library.ID) {
            return String(library.ID);
        }
    } catch (e) {
        // BM / missing library
    }
    try {
        var site = Site.getCurrent();
        if (site && site.getID()) {
            return String(site.getID());
        }
    } catch (e2) {
        // ignore
    }
    return '';
}

/**
 * @param {string} [overrideId] - explicit library id (export param)
 * @param {string} [fallbackId] - when site library cannot be resolved
 * @returns {string}
 */
function resolveTargetLibraryId(overrideId, fallbackId) {
    var explicit = String(overrideId || '').trim();
    if (explicit) return explicit;

    var pref = getPrefLibraryId();
    if (pref) return pref;

    var siteLib = getSiteLibraryId();
    if (siteLib) return siteLib;

    return String(fallbackId || 'MigrationConsole');
}

/**
 * @param {string} libraryId
 * @returns {dw.content.Library|null}
 */
function getLibrary(libraryId) {
    var id = String(libraryId || '').trim();
    try {
        var ContentMgr = require('dw/content/ContentMgr');
        if (id) {
            var lib = ContentMgr.getLibrary(id);
            if (lib) return lib;
        }
        return ContentMgr.getSiteLibrary();
    } catch (e) {
        return null;
    }
}

module.exports = {
    getPrefLibraryId:        getPrefLibraryId,
    getSiteLibraryId:        getSiteLibraryId,
    resolveTargetLibraryId:  resolveTargetLibraryId,
    getLibrary:              getLibrary
};
