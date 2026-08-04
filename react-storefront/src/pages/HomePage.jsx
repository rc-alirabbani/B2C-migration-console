import React from 'react';
import { Link } from 'react-router-dom';

export default function HomePage() {
    return (
        <div className="home-page">
            <p className="home-page__eyebrow">React storefront</p>
            <h1>CMS migration demos</h1>
            <p>
                Browse migrated content from SFCC libraries — separate folders per CMS in Business Manager
                (<code>amplience/</code> and <code>contentful/</code>).
            </p>

            <h2>Amplience</h2>
            <ul className="home-page__list">
                <li><Link to="/amplience-gallery">Component gallery</Link> — list from SFCC <code>amplience/</code> + live CDN preview</li>
                <li><Link to="/amplience-demo">Live demo</Link> — fetch by Amplience content id or delivery key</li>
            </ul>

            <h2>Contentful</h2>
            <ul className="home-page__list">
                <li><Link to="/contentful-gallery">Component gallery</Link> — list from SFCC <code>contentful/</code> snapshot</li>
                <li><Link to="/contentful-demo">Entry demo</Link> — JSON + body from migrated content asset</li>
            </ul>

            <p className="home-page__meta">
                Sync local catalogs: <code>npm run sync:sfcc-catalog</code> (requires storefront
                <code>AmplienceContent-List</code> and <code>ContentfulContent-List</code>).
            </p>
        </div>
    );
}
