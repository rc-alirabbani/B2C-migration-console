import React from 'react';
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import HomePage from './pages/HomePage';
import AmplienceDemoPage from './pages/AmplienceDemoPage';
import AmplienceGalleryPage from './pages/AmplienceGalleryPage';
import ContentfulDemoPage from './pages/ContentfulDemoPage';
import ContentfulGalleryPage from './pages/ContentfulGalleryPage';

export default function App() {
    return (
        <div className="app-shell">
            <header className="app-shell__header">
                <Link to="/" className="app-shell__brand">Royal Cyber Storefront</Link>
                <nav className="app-shell__nav" aria-label="CMS demos">
                    <Link to="/">Home</Link>
                    <div className="app-shell__nav-group">
                        <span className="app-shell__nav-label">Amplience</span>
                        <Link to="/amplience-gallery">Gallery</Link>
                        <Link to="/amplience-demo">Demo</Link>
                    </div>
                    <div className="app-shell__nav-group">
                        <span className="app-shell__nav-label">Contentful</span>
                        <Link to="/contentful-gallery">Gallery</Link>
                        <Link to="/contentful-demo">Demo</Link>
                    </div>
                </nav>
            </header>
            <main className="app-shell__main">
                <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/amplience-gallery" element={<AmplienceGalleryPage />} />
                    <Route path="/amplience-demo" element={<AmplienceDemoPage />} />
                    <Route path="/contentful-gallery" element={<ContentfulGalleryPage />} />
                    <Route path="/contentful_gallery" element={<Navigate to="/contentful-gallery" replace />} />
                    <Route path="/contentful-demo" element={<ContentfulDemoPage />} />
                    <Route path="/contentful_demo" element={<Navigate to="/contentful-demo" replace />} />
                </Routes>
            </main>
        </div>
    );
}
