import { useEffect, useState } from 'react';

function buildCatalogUrl(apiBase, params) {
    var base = String(apiBase || '').replace(/\/$/, '');
    var path = base + '/ContentfulContent-List';
    var url = path.indexOf('http') === 0
        ? new URL(path)
        : new URL(path, typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3001');
    if (params.type) url.searchParams.set('type', params.type);
    if (params.query) url.searchParams.set('q', params.query);
    if (params.page) url.searchParams.set('page', String(params.page));
    if (params.pageSize) url.searchParams.set('pageSize', String(params.pageSize));
    return url.toString();
}

function matchesClientQuery(item, query) {
    var q = String(query || '').trim().toLowerCase();
    if (!q) return true;
    var haystack = [
        item.name,
        item.id,
        item.contentId,
        item.entryId,
        item.slug,
        item.contentType,
        item.widgetType
    ].map(function (value) {
        return String(value || '').toLowerCase();
    }).join(' ');
    return haystack.indexOf(q) >= 0;
}

function filterCatalogItems(items, type, query) {
    return items.filter(function (item) {
        if (type) {
            var typeKey = item.contentType || item.widgetType;
            if (typeKey !== type && item.widgetType !== type) return false;
        }
        return matchesClientQuery(item, query);
    });
}

function paginateItems(items, page, pageSize) {
    var total = items.length;
    var pageCount = Math.max(1, Math.ceil(total / pageSize));
    var safePage = Math.min(Math.max(page, 1), pageCount);
    var start = (safePage - 1) * pageSize;
    return {
        items: items.slice(start, start + pageSize),
        total: total,
        page: safePage,
        pageSize: pageSize,
        pageCount: pageCount,
        hasPrevious: safePage > 1,
        hasNext: safePage < pageCount
    };
}

function fetchLocalCatalog() {
    return fetch('/contentful-catalog.json')
        .then(function (response) {
            if (!response.ok) {
                throw new Error('Local Contentful catalog not found');
            }
            return response.json();
        })
        .then(function (payload) {
            if (!payload || !Array.isArray(payload.items)) {
                throw new Error('Invalid Contentful catalog file');
            }
            return payload.items;
        });
}

function fetchFromSfcc(apiBase, params) {
    return fetch(buildCatalogUrl(apiBase, params), {
        headers: { Accept: 'application/json' }
    }).then(function (response) {
        if (!response.ok) {
            throw new Error('Catalog request failed (' + response.status + ')');
        }
        return response.json();
    }).then(function (payload) {
        if (!payload || !payload.ok) {
            throw new Error((payload && payload.error) || 'Catalog request failed');
        }
        payload.source = 'sfcc';
        return payload;
    });
}

function fetchDevContentfulCatalog() {
    return fetch('/contentful-dev-catalog?limit=100', {
        headers: { Accept: 'application/json' }
    }).then(function (response) {
        if (!response.ok) {
            return response.json().catch(function () {
                throw new Error('Contentful dev catalog failed (' + response.status + ')');
            }).then(function (payload) {
                throw new Error((payload && payload.error) || 'Contentful dev catalog failed');
            });
        }
        return response.json();
    }).then(function (payload) {
        if (!payload || !payload.ok) {
            throw new Error((payload && payload.error) || 'Contentful dev catalog failed');
        }
        payload.source = payload.source || 'contentful-cma';
        return payload;
    });
}

function catalogItemsLackPreviewData(items) {
    if (!items || !items.length) return true;
    var i;
    for (i = 0; i < items.length; i++) {
        var it = items[i];
        if (it.hasBody || (it.bodyHtml && String(it.bodyHtml).trim())) return false;
        if (it.attributes && Object.keys(it.attributes).length) return false;
        if (it.imageUrl) return false;
    }
    return true;
}

function shouldPreferLocalCatalog() {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
        if (import.meta.env.VITE_USE_LIVE_SFCC_CATALOG === 'true') return false;
    }
    return true;
}

/**
 * Load migrated Contentful entries from SFCC List API or local catalog JSON.
 */
export function useContentfulCatalog({
    apiBase,
    type = '',
    query = '',
    page = 1,
    pageSize = 24,
    enabled = true
}) {
    var [data, setData] = useState(null);
    var [loading, setLoading] = useState(false);
    var [error, setError] = useState(null);
    var [source, setSource] = useState('');

    useEffect(function () {
        if (!enabled) {
            setData(null);
            setLoading(false);
            setError(null);
            setSource('');
            return undefined;
        }

        var cancelled = false;
        setLoading(true);
        setError(null);

        function applyClientCatalog(items, sourceName) {
            var filtered = filterCatalogItems(items, type, query);
            var paged = paginateItems(filtered, page, pageSize);
            setData({
                ok: true,
                total: paged.total,
                page: paged.page,
                pageSize: paged.pageSize,
                pageCount: paged.pageCount,
                hasPrevious: paged.hasPrevious,
                hasNext: paged.hasNext,
                type: type,
                query: query,
                folderFound: true,
                contentTypes: [],
                rawAssetCount: items.length,
                source: sourceName,
                items: paged.items
            });
            setSource(sourceName);
            setError(null);
        }

        function applySfccPayload(payload) {
            setData(payload);
            setSource(payload.source || 'sfcc');
            setError(null);
        }

        function tryDevContentful(fallbackError) {
            return fetchDevContentfulCatalog()
                .then(function (payload) {
                    if (cancelled) return;
                    applySfccPayload(payload);
                })
                .catch(function (err) {
                    if (!cancelled && fallbackError) {
                        setError(fallbackError);
                    } else if (!cancelled) {
                        setError(err);
                    }
                });
        }

        function trySfccLive(fallbackError) {
            if (!apiBase) {
                if (!cancelled && fallbackError) {
                    setError(fallbackError);
                }
                return Promise.resolve();
            }
            return fetchFromSfcc(apiBase, {
                type: type,
                query: query,
                page: page,
                pageSize: pageSize
            })
                .then(function (payload) {
                    if (cancelled) return;
                    applySfccPayload(payload);
                })
                .catch(function (err) {
                    if (cancelled) return;
                    return tryDevContentful(fallbackError || err);
                });
        }

        function finishWithLocalCatalog(fallbackError) {
            return fetchLocalCatalog()
                .then(function (items) {
                    if (cancelled) return;
                    if (items.length && !catalogItemsLackPreviewData(items)) {
                        applyClientCatalog(items, 'sfcc-file');
                        return;
                    }
                    if (items.length && apiBase) {
                        return trySfccLive().catch(function () {
                            applyClientCatalog(items, 'sfcc-file');
                        });
                    }
                    if (items.length) {
                        applyClientCatalog(items, 'sfcc-file');
                        return;
                    }
                    return trySfccLive(fallbackError);
                })
                .catch(function () {
                    return trySfccLive(fallbackError || new Error(
                        'Contentful catalog unavailable. Add CONTENTFUL_SPACE_ID and '
                        + 'CONTENTFUL_CMA_PERSONAL_ACCESS_TOKEN to .env, deploy app_custom_cms '
                        + 'to the storefront site, or run npm run sync:sfcc-catalog -- --force.'
                    ));
                });
        }

        var request;

        try {
            if (!shouldPreferLocalCatalog() && apiBase) {
                request = trySfccLive().catch(function (err) {
                    return finishWithLocalCatalog(err);
                });
            } else if (shouldPreferLocalCatalog()) {
                request = finishWithLocalCatalog();
            } else if (apiBase) {
                request = trySfccLive();
            } else {
                request = finishWithLocalCatalog();
            }

            request.finally(function () {
                if (!cancelled) setLoading(false);
            });
        } catch (err) {
            finishWithLocalCatalog(err).finally(function () {
                if (!cancelled) setLoading(false);
            });
        }

        return function () {
            cancelled = true;
        };
    }, [apiBase, type, query, page, pageSize, enabled]);

    return { data: data, loading: loading, error: error, source: source };
}
