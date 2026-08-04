'use strict';

/* global describe, it */

var expect = require('chai').expect;
var loader = require('../helpers/cartridgeLoader');

loader.installCartridgeResolver();

var xmlBuilder = loader.requireCartridge('contentMigration/contentfulXmlBuilder');

describe('Contentful content library XML', function () {
    var entry = {
        sys: {
            id: 'abc-entry-id',
            type: 'Entry',
            contentType: { sys: { id: 'blogPost' } }
        },
        fields: {
            title: { 'en-US': 'Hello' },
            slug: { 'en-US': 'hello-world' }
        }
    };

    var widget = {
        contentId: 'abc-entry-id',
        deliveryKey: 'hello-world',
        widgetType: 'contentfulWidget',
        schema: 'blogPost',
        preview: { title: 'Hello', body: 'Body text' },
        attributes: {
            contentTypeId: 'blogPost',
            entryId: 'abc-entry-id',
            slug: 'hello-world',
            previewFields: [{ name: 'title', value: 'Hello', type: 'text' }],
            entryFields: entry.fields
        },
        source: {
            fields: entry.fields,
            entry: entry
        },
        sourceMetadata: { locale: 'en-US', contentTypeId: 'blogPost' }
    };

    it('stores full entry JSON in contentfulSourceJson', function () {
        var result = xmlBuilder.buildXml([widget], 'MigrationConsole');
        expect(result.built).to.equal(1);
        expect(result.xml).to.contain('attribute-id="contentfulSourceJson"');
        expect(result.xml).to.contain('"entry"');
        expect(result.xml).to.contain('abc-entry-id');
        expect(result.xml).to.contain('hello-world');
    });
});
