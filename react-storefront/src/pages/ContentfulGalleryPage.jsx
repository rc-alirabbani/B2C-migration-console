import React, { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useContentfulCatalog } from '@royalcyber/amplience-react';
import ContentfulGalleryCard from '../components/ContentfulGalleryCard';
import './amplience-gallery.scss';

const SFCC_CONFIGURED = import.meta.env.VITE_SFCC_STOREFRONT_CONFIGURED === 'true';
const SFCC_STOREFRONT_URL = import.meta.env.VITE_SFCC_STOREFRONT_URL || '';
const API_BASE = SFCC_CONFIGURED
    ? (import.meta.env.DEV ? '/sfcc-api' : SFCC_STOREFRONT_URL)
    : '';
const PAGE_SIZE = 24;

function buildGallerySearch(type, query, page) {
    var params = new URLSearchParams();
    if (type) params.set('type', type);
    if (query) params.set('q', query);
    if (page && page > 1) params.set('page', String(page));
    var search = params.toString();
    return search ? '?' + search : '';
}

export default function ContentfulGalleryPage() {
    var location = useLocation();
    var navigate = useNavigate();
    var params = useMemo(function () {
        return new URLSearchParams(location.search);
    }, [location.search]);

    var type = params.get('type') || '';
    var query = params.get('q') || '';
    var page = Math.max(1, parseInt(params.get('page') || '1', 10) || 1);

    var catalog = useContentfulCatalog({
        apiBase: API_BASE,
        type: type,
        query: query,
        page: page,
        pageSize: PAGE_SIZE,
        enabled: true
    });

    var items = (catalog.data && catalog.data.items) || [];

    var typeFilters = useMemo(function () {
        var fromApi = catalog.data && catalog.data.contentTypes;
        if (fromApi && fromApi.length) {
            return [{ id: '', label: 'All types' }].concat(fromApi.map(function (t) {
                return { id: t, label: t };
            }));
        }
        var map = {};
        items.forEach(function (it) {
            var t = it.contentType || it.widgetType;
            if (t) map[t] = true;
        });
        var keys = Object.keys(map).sort();
        return [{ id: '', label: 'All types' }].concat(keys.map(function (k) {
            return { id: k, label: k };
        }));
    }, [catalog.data, items]);

    function onSearchSubmit(event) {
        event.preventDefault();
        var formData = new FormData(event.currentTarget);
        navigate('/contentful-gallery' + buildGallerySearch(
            String(formData.get('type') || ''),
            String(formData.get('q') || '').trim(),
            1
        ));
    }

    function onTypeChange(nextType) {
        navigate('/contentful-gallery' + buildGallerySearch(nextType, query, 1));
    }

    function onPageChange(nextPage) {
        navigate('/contentful-gallery' + buildGallerySearch(type, query, nextPage));
    }

    var total = catalog.data ? catalog.data.total : 0;
    var pageCount = catalog.data ? catalog.data.pageCount : 1;

    return (
        <div className="amp-gallery-page amp-gallery-page--contentful">
            <header className="amp-gallery-page__intro">
                <p className="amp-gallery-page__eyebrow">Contentful storefront</p>
                <h1>Component gallery</h1>
                <p>
                    Migrated entries from the SFCC <code>contentful/</code> folder (snapshot on content assets).
                    Use <strong>Preview</strong> for the migrated body, or <strong>Open</strong> for full JSON.
                </p>
            </header>

            <form className="amp-gallery-page__search" onSubmit={onSearchSubmit}>
                <input type="hidden" name="type" value={type} />
                <label className="amp-gallery-page__search-label" htmlFor="ctf-gallery-q">
                    Search entries
                </label>
                <div className="amp-gallery-page__search-row">
                    <input
                        id="ctf-gallery-q"
                        className="amp-gallery-page__search-input"
                        type="search"
                        name="q"
                        defaultValue={query}
                        placeholder="Search by name, SFCC id, entry id, or slug"
                    />
                    <button className="amp-gallery-page__search-button" type="submit">Search</button>
                </div>
            </form>

            <nav className="amp-gallery-page__filters" aria-label="Filter by content type">
                {typeFilters.map(function (filter) {
                    var active = type === filter.id;
                    return (
                        <button
                            key={filter.id || 'all'}
                            type="button"
                            className={'amp-gallery-page__filter' + (active ? ' active' : '')}
                            onClick={function () { onTypeChange(filter.id); }}
                        >
                            {filter.label}
                        </button>
                    );
                })}
            </nav>

            {!SFCC_CONFIGURED && !catalog.loading && !items.length ? (
                <p className="amp-gallery-page__info">
                    SFCC storefront proxy not active (check <code>hostname</code> in repo <code>dw.json</code>
                    and restart <code>npm run start:react</code>). For live Contentful data in dev without
                    storefront deploy, set <code>CONTENTFUL_SPACE_ID</code> and
                    <code>CONTENTFUL_CMA_PERSONAL_ACCESS_TOKEN</code> in repo <code>.env</code>
                    (same as BM Site Preferences). For migrated SFCC snapshots, add
                    <code>app_custom_cms</code> to the <strong>storefront</strong> site cartridge path,
                    run <code>npm run upload:cms</code>, then <code>npm run sync:sfcc-catalog -- --force</code>.
                </p>
            ) : null}

            {catalog.error && !items.length ? (
                <p className="amp-gallery-page__error" role="alert">
                    {catalog.error.message}
                    {SFCC_CONFIGURED ? (
                        <span> Check that <code>app_custom_cms</code> is on the storefront site and
                        <code>ContentfulContent-List</code> returns items.</span>
                    ) : null}
                </p>
            ) : null}

            <p className="amp-gallery-page__meta">
                Folder: <code>contentful</code>
                {catalog.source ? <span> · Source: {catalog.source}</span> : null}
            </p>

            {catalog.loading ? <p className="amp-gallery-page__status">Loading entries…</p> : null}

            {!catalog.loading && items.length ? (
                <p className="amp-gallery-page__meta">{total} entr{total === 1 ? 'y' : 'ies'} found</p>
            ) : null}

            {!catalog.loading && !items.length && !catalog.error ? (
                <p className="amp-gallery-page__status">
                    No Contentful entries loaded yet. The BM wizard reads Contentful live; this gallery needs either
                    <strong> Contentful CMA credentials in <code>.env</code></strong> (dev, same as BM prefs) or
                    <strong> migrated SFCC assets</strong> via <code>ContentfulContent-List</code> on the storefront
                    site (<code>app_custom_cms</code> on site cartridge path + <code>upload:cms</code>).
                    {catalog.data && catalog.data.rawAssetCount > 0 && catalog.data.total === 0 ? (
                        <span> SFCC found {catalog.data.rawAssetCount} assets in folder but none matched
                        (check Contentful custom attributes / re-import metadata XML).</span>
                    ) : null}
                </p>
            ) : null}

            <div className="amp-gallery-page__grid">
                {items.map(function (item) {
                    return <ContentfulGalleryCard key={item.id} item={item} />;
                })}
            </div>

            {pageCount > 1 ? (
                <nav className="amp-gallery-page__pagination" aria-label="Gallery pages">
                    {page > 1 ? (
                        <button type="button" onClick={function () { onPageChange(page - 1); }}>Previous</button>
                    ) : null}
                    <span>Page {page} of {pageCount}</span>
                    {page < pageCount ? (
                        <button type="button" onClick={function () { onPageChange(page + 1); }}>Next</button>
                    ) : null}
                </nav>
            ) : null}
        </div>
    );
}
