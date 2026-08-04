import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import './amplience-demo.scss';

const SFCC_CONFIGURED = import.meta.env.VITE_SFCC_STOREFRONT_CONFIGURED === 'true';
const SFCC_STOREFRONT_URL = import.meta.env.VITE_SFCC_STOREFRONT_URL || '';
const API_BASE = SFCC_CONFIGURED
    ? (import.meta.env.DEV ? '/sfcc-api' : SFCC_STOREFRONT_URL)
    : '';

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

export default function ContentfulDemoPage() {
    var location = useLocation();
    var params = useMemo(function () {
        return new URLSearchParams(location.search);
    }, [location.search]);

    var sfccId = params.get('cid') || '';
    var [item, setItem] = useState(null);
    var [loading, setLoading] = useState(false);
    var [error, setError] = useState(null);

    useEffect(function () {
        if (!sfccId || !API_BASE) {
            setItem(null);
            setError(sfccId && !API_BASE
                ? new Error('Configure SFCC storefront URL or use synced catalog only from gallery.')
                : null);
            return undefined;
        }
        var cancelled = false;
        setLoading(true);
        setError(null);
        fetchDetail(sfccId)
            .then(function (payload) {
                if (cancelled) return;
                if (!payload || !payload.ok) {
                    throw new Error((payload && payload.error) || 'Not found');
                }
                setItem(payload.item);
            })
            .catch(function (err) {
                if (!cancelled) setError(err);
            })
            .finally(function () {
                if (!cancelled) setLoading(false);
            });
        return function () {
            cancelled = true;
        };
    }, [sfccId]);

    return (
        <div className="amp-demo-page">
            <header className="amp-demo-page__header">
                <Link className="amp-demo-page__back" to="/contentful-gallery">← Back to Contentful gallery</Link>
                <h1>Contentful entry snapshot</h1>
                <p>Data from migrated SFCC content asset (not live Contentful Delivery API).</p>
            </header>

            {!sfccId ? (
                <p className="amp-demo-page__hint">
                    Pass <code>?cid=ctf-…</code> (SFCC content id) or open from the gallery.
                </p>
            ) : null}

            {loading ? <p>Loading…</p> : null}
            {error ? <p className="amp-demo-page__error" role="alert">{error.message}</p> : null}

            {item ? (
                <div className="amp-demo-page__panels">
                    <section className="amp-demo-panel">
                        <h2>{item.name}</h2>
                        <p><strong>Entry:</strong> <code>{item.entryId}</code></p>
                        {item.slug ? <p><strong>Slug:</strong> <code>{item.slug}</code></p> : null}
                        {item.contentType ? <p><strong>Content type:</strong> <code>{item.contentType}</code></p> : null}
                        {item.imageUrl ? (
                            <p><img src={item.imageUrl} alt="" style={{ maxWidth: '100%' }} /></p>
                        ) : null}
                        {item.bodyHtml ? (
                            <div dangerouslySetInnerHTML={{ __html: item.bodyHtml }} />
                        ) : null}
                    </section>
                    <section className="amp-demo-panel">
                        <h3>Widget attributes (JSON)</h3>
                        <pre className="cms-json-block">{JSON.stringify(item.attributes || {}, null, 2)}</pre>
                    </section>
                    <section className="amp-demo-panel">
                        <h3>Source (JSON)</h3>
                        <pre className="cms-json-block">{JSON.stringify(item.source || {}, null, 2)}</pre>
                    </section>
                </div>
            ) : null}
        </div>
    );
}
