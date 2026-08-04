import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const SFCC_CONFIGURED = import.meta.env.VITE_SFCC_STOREFRONT_CONFIGURED === 'true';
const SFCC_STOREFRONT_URL = import.meta.env.VITE_SFCC_STOREFRONT_URL || '';
const API_BASE = SFCC_CONFIGURED
    ? (import.meta.env.DEV ? '/sfcc-api' : SFCC_STOREFRONT_URL)
    : '';

function shortenId(value) {
    var text = String(value || '');
    if (text.length <= 24) return text;
    return text.slice(0, 12) + '…' + text.slice(-10);
}

function isImageUrl(url) {
    return /^https?:\/\//i.test(String(url || '').trim());
}

function copyText(value) {
    if (!value || typeof navigator === 'undefined' || !navigator.clipboard) return;
    navigator.clipboard.writeText(String(value)).catch(function () {});
}

function fetchDetail(sfccId) {
    var base = API_BASE || '';
    var path = base + '/ContentfulContent-Detail?cid=' + encodeURIComponent(sfccId);
    var url = path.indexOf('http') === 0
        ? path
        : (typeof window !== 'undefined' ? window.location.origin + path : path);
    return fetch(url).then(function (res) {
        return res.json();
    });
}

export default function ContentfulGalleryCard({ item }) {
    var [expanded, setExpanded] = useState(false);
    var [detail, setDetail] = useState(null);
    var [loading, setLoading] = useState(false);
    var [error, setError] = useState(null);
    var entryId = item.entryId || item.contentId || '';
    var demoUrl = '/contentful-demo?cid=' + encodeURIComponent(item.id);
    var thumbUrl = isImageUrl(item.imageUrl) ? item.imageUrl : '';
    var inlineBody = item.bodyHtml || '';

    function onTogglePreview() {
        var next = !expanded;
        setExpanded(next);
        if (!next) return;
        if (inlineBody || (item.attributes && Object.keys(item.attributes).length) || item.entry || item.entryFields) {
            setDetail({
                bodyHtml: inlineBody,
                attributes: item.attributes || {},
                source: item.source || {},
                entry: item.entry || (item.source && item.source.entry) || null,
                entryFields: item.entryFields || (item.source && item.source.fields) || {},
                fields: item.fields || [],
                imageUrl: item.imageUrl || ''
            });
            return;
        }
        if (detail || !API_BASE) return;
        setLoading(true);
        setError(null);
        fetchDetail(item.id)
            .then(function (payload) {
                if (!payload || !payload.ok) {
                    throw new Error((payload && payload.error) || 'Detail request failed');
                }
                setDetail(payload.item);
            })
            .catch(function (err) {
                setError(err);
            })
            .finally(function () {
                setLoading(false);
            });
    }

    var previewBody = detail && detail.bodyHtml ? detail.bodyHtml : '';

    return (
        <article className={'amp-gallery-page__card amp-gallery-page__card--contentful'}>
            {thumbUrl ? (
                <div className="amp-gallery-page__card-hero">
                    <img src={thumbUrl} alt="" loading="lazy" />
                </div>
            ) : null}

            <div className="amp-gallery-page__card-body">
                <div className="amp-gallery-page__card-accent" aria-hidden="true" />
                <div className="amp-gallery-page__card-meta">
                    <div className="amp-gallery-page__card-heading">
                        <h2>{item.name}</h2>
                        <div className="amp-gallery-page__card-tags">
                            <span className="amp-gallery-page__card-type">
                                {item.contentType || item.widgetLabel || 'Contentful'}
                            </span>
                        </div>
                    </div>
                    <div className="amp-gallery-page__card-actions">
                        <button
                            type="button"
                            className={'amp-gallery-page__preview-toggle' + (expanded ? ' is-active' : '')}
                            onClick={onTogglePreview}
                        >
                            {expanded ? 'Hide' : 'Preview'}
                        </button>
                        <Link className="amp-gallery-page__preview-link" to={demoUrl}>Open</Link>
                    </div>
                </div>

                <div className="amp-gallery-page__card-ids">
                    {entryId ? (
                        <div className="amp-gallery-page__card-id-row">
                            <span className="amp-gallery-page__card-id-label">Entry id</span>
                            <button
                                type="button"
                                className="amp-gallery-page__id-pill"
                                onClick={function () { copyText(entryId); }}
                            >
                                <code>{shortenId(entryId)}</code>
                            </button>
                        </div>
                    ) : null}
                    <div className="amp-gallery-page__card-id-row">
                        <span className="amp-gallery-page__card-id-label">SFCC id</span>
                        <button
                            type="button"
                            className="amp-gallery-page__id-pill"
                            onClick={function () { copyText(item.id); }}
                        >
                            <code>{shortenId(item.id)}</code>
                        </button>
                    </div>
                    {item.slug ? (
                        <div className="amp-gallery-page__card-id-row">
                            <span className="amp-gallery-page__card-id-label">Slug</span>
                            <code>{item.slug}</code>
                        </div>
                    ) : null}
                </div>
            </div>

            {expanded ? (
                <div className="amp-gallery-page__card-preview">
                    {loading ? <p className="amp-gallery-page__card-preview-status">Loading snapshot…</p> : null}
                    {error ? (
                        <p className="amp-gallery-page__card-preview-error" role="alert">{error.message}</p>
                    ) : null}
                    {previewBody ? (
                        <div
                            className="amp-gallery-page__card-preview-body"
                            dangerouslySetInnerHTML={{ __html: previewBody }}
                        />
                    ) : null}
                    {!loading && !error && !previewBody && detail ? (
                        <pre className="cms-json-block">{JSON.stringify(
                            detail.entry || detail.entryFields || detail.attributes || {},
                            null,
                            2
                        )}</pre>
                    ) : null}
                    {!loading && !error && !previewBody && !detail && !API_BASE ? (
                        <p className="amp-gallery-page__card-preview-status">
                            Configure SFCC storefront URL to load entry snapshot, or run
                            <code> npm run sync:sfcc-catalog -- --force</code> after deploying
                            <code> app_custom_cms</code>.
                        </p>
                    ) : null}
                </div>
            ) : null}
        </article>
    );
}
