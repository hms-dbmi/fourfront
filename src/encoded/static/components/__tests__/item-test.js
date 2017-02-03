'use strict';

/* Written by Carl, used to test the IPannel of item.js. Statically uses a library
and a json of all schemas (such as is called by <fetched.Param name="schemas" url="/profiles/")>*/

jest.autoMockOff();

// Fixes https://github.com/facebook/jest/issues/78
jest.dontMock('react');
jest.dontMock('underscore');


describe('Testing item.js', function() {
    var React, item, Item, testItem, TestUtils, FetchContext, context, schemas, _, Wrapper;

    beforeEach(function() {
        React = require('react');
        TestUtils = require('react-dom/lib/ReactTestUtils');
        _ = require('underscore');
        item = require('./../item-pages/item');
        Item = require('./../item-pages/item-view');
        context = require('../testdata/library/sid38806');
        schemas = require('../testdata/schemas');
        Wrapper = React.createClass({
            render: function() {
                return (
                    <div>{this.props.children}</div>
                );
            }
        });
        testItem = TestUtils.renderIntoDocument(
            <Wrapper>
                <Item schemas={schemas} context={context} />
            </Wrapper>
        );

    });

    it('has the correct number of def terms and def descriptions', function() {
        var defTerms = TestUtils.scryRenderedDOMComponentsWithTag(testItem, 'dt');
        var defDescs = TestUtils.scryRenderedDOMComponentsWithTag(testItem, 'dd');
        expect(defTerms.length).toEqual(19);
        expect(defDescs.length).toEqual(19);
    });

    it('has a good title', function() {
        var titleLine = TestUtils.findRenderedDOMComponentWithClass(testItem, 'experiment-heading');
        var exptHeading = titleLine;
        expect(exptHeading.textContent).toEqual('ENCLB055ZZZ');
    });

    it('expands object views properly', function() {
        var objToggles = TestUtils.scryRenderedDOMComponentsWithClass(testItem, 'item-toggle-link');
        var objDefDesc = objToggles[0];
        // this is the biosamples link
        TestUtils.Simulate.click(objDefDesc);
        var objDefinitions = TestUtils.findRenderedDOMComponentWithClass(testItem, 'sub-descriptions');
        var objEntries = TestUtils.scryRenderedDOMComponentsWithClass(testItem, 'sub-entry');
        // there should be 25 entries within the biosample object subview
        expect(objEntries.length).toEqual(25);
    });

    it('opens and closes tooltips correctly', function(){
        var objTriggers = TestUtils.scryRenderedDOMComponentsWithClass(testItem, 'tooltip-trigger');
        TestUtils.SimulateNative.mouseOver(objTriggers[0]);
        var openTooltips = TestUtils.scryRenderedDOMComponentsWithClass(testItem, 'tooltip-open');
        expect(openTooltips.length > 0).toBeTruthy();
        TestUtils.SimulateNative.mouseOut(objTriggers[0]);
        var openTooltips = TestUtils.scryRenderedDOMComponentsWithClass(testItem, 'tooltip-open');
        expect(openTooltips.length).toEqual(0);
    });
});
