'use strict';

import React from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';
import url from 'url';
import memoize from 'memoize-one';
import queryString from 'querystring';
import { get as getSchemas, Term } from './../../../util/Schemas';
import { object, ajax, layout, isServerSide, schemaTransforms, memoizedUrlParse, logger } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import {
    ResultRowColumnBlockValue, columnsToColumnDefinitions, HeadersRow, TableRowToggleOpenButton,
    DisplayTitleColumnWrapper, DisplayTitleColumnDefault
} from '@hms-dbmi-bgm/shared-portal-components/es/components/browse/components/table-commons';
import { SearchResultDetailPane } from '@hms-dbmi-bgm/shared-portal-components/es/components/browse/components/SearchResultDetailPane';
import { columnExtensionMap as columnExtensionMap4DN } from './../../../browse/columnExtensionMap';

import { EmbeddedSearchView } from '@hms-dbmi-bgm/shared-portal-components/es/components/browse/EmbeddedSearchView';
//import { transformedFacets } from './../../../browse/SearchView';






export class EmbeddedItemSearchTable extends React.PureComponent {

    static defaultProps = {
        "columnExtensionMap": columnExtensionMap4DN,
        "facets" : undefined, // Default to those from search response.
    };

    constructor(props){
        super(props);
        this.getCountCallback = this.getCountCallback.bind(this);
        this.state = { totalCount: null };
    }

    getCountCallback(resp){
        const { onLoad } = this.props;
        if (resp && typeof resp.total === 'number'){
            this.setState({ 'totalCount' : resp.total });
        }
        if (typeof onLoad === "function") {
            onLoad(resp);
        }
    }

    render(){
        const {
            title,
            children,
            facets,
            session, schemas: propSchemas,
            renderDetailPane, defaultOpenIndices, maxHeight,
            columns, columnExtensionMap,
            searchHref,
            aboveTableComponent,
            aboveFacetListComponent,
            filterFacetFxn, hideFacets,
            filterColumnFxn, hideColumns,
            targetTabKey,
        } = this.props;
        const { totalCount } = this.state;

        if (typeof searchHref !== "string") {
            logger.error("Expected a string 'searchHref'");
            throw new Error("Expected a string 'searchHref'");
        }

        const schemas = propSchemas || getSchemas() || null; // We might not have this e.g. in placeholders in StaticSections

        const passProps = {
            facets, columns, columnExtensionMap, searchHref, session,
            schemas, renderDetailPane, defaultOpenIndices, maxHeight,
            aboveTableComponent, aboveFacetListComponent,
            filterFacetFxn, hideFacets,
            filterColumnFxn, hideColumns,
            targetTabKey,
            onLoad: this.getCountCallback,
            termTransformFxn: Term.toName
        };

        const showTitle = !title ? null
            : React.isValidElement(title) ? (
                typeof title.type === "string" ? title : React.cloneElement(title, { totalCount })
            ) : title;

        const showChildren = React.isValidElement(children) && typeof children.type !== "string" ?
            React.cloneElement(children, { totalCount }) : children;

        return (
            <div className="embedded-search-view-outer-container">
                <EmbeddedSearchView {...passProps} embeddedTableHeader={showTitle}/>
                { showChildren }
            </div>
        );
    }
}

/**
 * @todo Eventually maybe add UI controls for selecting columns and other things into here.
 */
export const SearchTableTitle = React.memo(function (props) {
    const {
        totalCount,
        href: currentSearchHref,
        externalSearchLinkVisible = true,
        title: propTitle,
        titleSuffix,
        headerElement = 'h3'
    } = props;

    const title = (propTitle && typeof propTitle === 'string') ? propTitle : 'Item';
    const linkText = currentSearchHref && typeof currentSearchHref === 'string' && currentSearchHref.indexOf('/browse/') > -1 ?
        'Open In Browse View' : 'Open In Search View';

    return React.createElement(
        headerElement || 'h3',
        { className: 'tab-section-title' },
        (
            <React.Fragment>
                <span>
                    {typeof totalCount === "number" ? <span className="text-500">{totalCount + " "}</span> : null}
                    {title + (typeof totalCount === "number" && totalCount !== 1 ? "s" : "")}
                    {titleSuffix && typeof titleSuffix === "string" && titleSuffix.length > 0 ? <span className="text-500">{" - " + titleSuffix}</span> : null}
                </span>
                {
                    externalSearchLinkVisible && currentSearchHref ?
                        (
                            <a href={currentSearchHref} className="btn btn-primary pull-right" style={{ marginTop: '-10px' }} data-tip="Run embedded search query in Browse/Search View">
                                <i className="icon icon-fw fas icon-external-link-alt mr-07 align-baseline"></i>
                                {linkText}
                            </a>
                        ) : null
                }
            </React.Fragment>
        ));
});
SearchTableTitle.propTypes = {
    totalCount: PropTypes.number,
    href: PropTypes.string,
    externalSearchLinkVisible: PropTypes.bool,
    title: PropTypes.string,
    titleSuffix: PropTypes.string,
    headerElement: PropTypes.oneOf(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']).isRequired,
};

/** @deprecated */

/** @todo Move to shared components repo? */

/** @todo - refactor. Not too important since parent components almost always a PureComponent so perf gain would b minimal */
export class ItemPageTable extends React.Component {

    static scaleColumnDefinitionWidths(realWidth, columnDefinitions){
        const baseWidth = ItemPageTableRow.totalColumnsBaseWidth(columnDefinitions);
        const scale = realWidth / baseWidth;
        return _.map(columnDefinitions, function(c){
            return _.extend({}, c, { 'width' : Math.floor(scale * c.baseWidth) });
        });
    }

    /**
     * Adds a `baseWidth` property to each columnDefinition based off widthMap or default value (100).
     */
    static columnDefinitionsToScaledColumnDefinitions(columnDefinitions){
        return columnDefinitions.map(function(colDef){
            const colDef2 = _.clone(colDef);
            colDef2.baseWidth = colDef.widthMap.sm || colDef.widthMap.md || colDef.widthMap.lg || 100;
            if (typeof colDef.render !== 'function'){
                colDef2.render = null;
            }
            return colDef2;
        });
    }

    static propTypes = {
        'results' : PropTypes.arrayOf(PropTypes.shape({
            'display_title' : PropTypes.string.isRequired
        })).isRequired,
        'loading' : PropTypes.bool,
        'renderDetailPane' : PropTypes.func,
        'defaultOpenIndices' : PropTypes.arrayOf(PropTypes.number),
        'defaultOpenIds' : PropTypes.arrayOf(PropTypes.string),
        'windowWidth' : PropTypes.number.isRequired
    };

    static defaultProps = {
        'renderDetailPane' : function(result, rowNumber, containerWidth){
            return <SearchResultDetailPane {...{ result, rowNumber, containerWidth }} />;
        },
        'constantColumnDefinitions' : null,
        'columnExtensionMap' : {
            'display_title' : {
                'render' : function(result, parentProps){
                    const { schemas, rowNumber, detailOpen, toggleDetailOpen, renderDetailPane, hideTypeTitle = false } = parentProps;

                    if (!hideTypeTitle){
                        const typeTitle = schemaTransforms.getItemTypeTitle(result, schemas || getSchemas());
                        if (typeTitle) {
                            return (
                                <div className="flex-wrap">
                                    <DisplayTitleColumnWrapper {...{ rowNumber, detailOpen, toggleDetailOpen }} result={result}>
                                        <div className="type-title text-truncate">{ typeTitle }</div>
                                        <DisplayTitleColumnDefault />
                                    </DisplayTitleColumnWrapper>
                                </div>
                            );
                        }
                    }

                    return (
                        <DisplayTitleColumnWrapper {...{ rowNumber, detailOpen, toggleDetailOpen }} result={result}>
                            <DisplayTitleColumnDefault />
                        </DisplayTitleColumnWrapper>
                    );
                }
            }
        },
        'columns' : {
            "display_title" : { "title" : "Title" },
            "number_of_experiments" : { "title" : "Exps" },
            "experiments_in_set.experiment_type.display_title": { "title" : "Experiment Type" },
            "experiments_in_set.biosample.biosource.individual.organism.name": { "title" : "Organism" },
            "experiments_in_set.biosample.biosource_summary": { "title" : "Biosource Summary" },
            "experiments_in_set.experiment_categorizer.combined" : { "title" : "Assay Details" }
        },
        'minWidth' : 720
    };

    constructor(props){
        super(props);
        this.state = { 'mounted' : false };
        this.memoized = {
            scaleColumnDefinitionWidths : memoize(ItemPageTable.scaleColumnDefinitionWidths),
            columnDefinitionsToScaledColumnDefinitions : memoize(ItemPageTable.columnDefinitionsToScaledColumnDefinitions)
        };
    }

    componentDidMount(){
        this.setState({ 'mounted' : true });
    }

    render(){
        const { results, loading, columnExtensionMap, columns, width, windowWidth,
            defaultOpenIndices, defaultOpenIds, renderDetailPane, minWidth } = this.props;

        if (loading || !Array.isArray(results)){
            return (
                <div className="text-center" style={{ paddingTop: 20, paddingBottom: 20, fontSize: '2rem', opacity: 0.5 }}>
                    <i className="icon icon-fw icon-spin icon-circle-notch fas"/>
                </div>
            );
        }

        let columnDefinitions = columnsToColumnDefinitions(columns, columnExtensionMap);
        const responsiveGridState = layout.responsiveGridState(windowWidth);

        const useWidth = Math.max(minWidth, (width || layout.gridContainerWidth(windowWidth) || 0));

        if (!useWidth || isNaN(useWidth)){
            logger.error("Make sure width or windowWidth is passed in through props.");
            throw new Error("Make sure width or windowWidth is passed in through props.");
        }

        columnDefinitions = this.memoized.scaleColumnDefinitionWidths(
            useWidth,
            this.memoized.columnDefinitionsToScaledColumnDefinitions(columnDefinitions)
        );

        const commonRowProps = { width: useWidth, columnDefinitions, responsiveGridState /* <- removable? */, renderDetailPane };

        return (
            <div className="item-page-table-container clearfix">
                <HeadersRow mounted columnDefinitions={columnDefinitions} renderDetailPane={renderDetailPane} width={useWidth} />
                { _.map(results, (result, rowIndex) => {
                    var atId = object.atIdFromObject(result);
                    return (
                        <ItemPageTableRow {...this.props} {...commonRowProps}
                            key={atId || rowIndex} result={result} rowNumber={rowIndex} defaultOpen={
                                (Array.isArray(defaultOpenIndices) && _.contains(defaultOpenIndices, rowIndex))
                                || (atId && Array.isArray(defaultOpenIds) && _.contains(defaultOpenIds, atId))
                            } />
                    );
                }) }
            </div>
        );
    }

}

class ItemPageTableRow extends React.PureComponent {

    static totalColumnsBaseWidth(columns){
        return _.reduce(columns, function(m, colDef){
            return m + colDef.baseWidth;
        }, 0);
    }

    constructor(props){
        super(props);
        this.toggleOpen = this.toggleOpen.bind(this);
        this.state = { 'open' : props.defaultOpen || false };
    }

    toggleOpen(){
        this.setState(function({ open }){
            return { open : !open };
        });
    }

    renderRowOfColumns(){
        const { columnDefinitions, result, renderDetailPane, ...passProps } = this.props;
        const { open } = this.state;

        if (!Array.isArray(columnDefinitions)) {
            logger.error('No columns defined.');
            return null;
        }

        const renderedCols = columnDefinitions.map((col, index) => {
            const { width, field } = col;
            return (
                <div style={{ width }} className={"column column-for-" + field} data-field={field} key={field || index}>
                    <ResultRowColumnBlockValue
                        {...passProps} {...{ result, renderDetailPane }}
                        columnDefinition={col} columnNumber={index}
                        key={field} tooltip
                        className={field === 'display_title' && open ? 'open' : null}
                        detailOpen={open} toggleDetailOpen={this.toggleOpen}
                        termTransformFxn={Term.toName}
                    />
                </div>
            );
        });

        const cls = (
            "table-row clearfix" +
            (typeof renderDetailPane !== 'function' ? ' no-detail-pane' : '') +
            (open ? " detail-open" : "")
        );

        return <div className={cls}>{ renderedCols }</div>;
    }

    render(){
        const { result, rowNumber, width, renderDetailPane } = this.props;
        return (
            <div className="item-page-table-row-container" style={{ width }}>
                { this.renderRowOfColumns() }
                { this.state.open && typeof renderDetailPane === 'function' ?
                    <div className="inner-wrapper">{ renderDetailPane(result, rowNumber, width, this.props) }</div>
                    : null }
            </div>
        );
    }
}

export class ItemPageTableIndividualUrlLoader extends React.PureComponent {

    static propTypes = {
        'children' : PropTypes.element.isRequired,
        'itemUrls' : PropTypes.arrayOf(PropTypes.string).isRequired,
        'windowWidth': PropTypes.number.isRequired,
        'maxToLoad' : PropTypes.number.isRequired
    };

    static defaultProps = {
        'maxToLoad' : 7
    };

    constructor(props){
        super(props);
        this.state = {
            'items' : null,
            'loading' : true,
            'itemIndexMapping' : _.object(_.map(props.itemUrls, function(url, i){ return [url, i]; }))
        };
    }

    componentDidMount(){
        this.loadItems();
    }

    loadItems(){
        const { itemUrls = [], maxToLoad } = this.props;
        const onFinishLoad = _.after(Math.min(itemUrls.length, maxToLoad), ()=>{
            this.setState({ 'loading' : false });
        });

        if (itemUrls.length > 0){
            _.forEach(itemUrls.slice(0, maxToLoad), (uri)=>{
                ajax.load(uri, (r)=>{
                    this.setState(function({ items, itemIndexMapping }){
                        items = (items || []).slice(0);
                        items.push(r);
                        items.sort(function(a, b){
                            var aIdx = itemIndexMapping[object.itemUtil.atId(a)] || -1,
                                bIdx = itemIndexMapping[object.itemUtil.atId(b)] || -1;
                            return bIdx - aIdx;
                        });
                        return { items };
                    }, onFinishLoad);
                }, 'GET', onFinishLoad);
            });
        }
    }

    render(){
        const { children, itemUrls } = this.props;
        const { loading, items } = this.state;
        return React.cloneElement(
            children,
            _.extend({ 'countTotalResults' : itemUrls.length }, this.props, { 'loading' : loading, 'results' : items })
        );
    }

}


export function ViewMoreResultsBtn(props){
    const { countTotalResults, results, itemTypeTitle = "Item", hrefWithoutLimit } = props;
    if (!Array.isArray(results)) {
        return null;
    }
    if (typeof countTotalResults !== 'number') {
        // Passed in from ItemPageTableSearchLoader
        return null;
    }
    const visibleResultCount = results.length;
    if (visibleResultCount >= countTotalResults) {
        // Shouldn't ever be greater, but just incase I guess..
        return null;
    }
    if (hrefWithoutLimit){
        return (
            <a className="mt-2 btn btn-lg btn-primary" href={hrefWithoutLimit}>
                { `View all ${itemTypeTitle}s (${countTotalResults - visibleResultCount} more)` }
            </a>
        );
    } else {
        return (countTotalResults - visibleResultCount) + ' more ' + itemTypeTitle + 's';
    }
}

/**
 * TODO: Once/if /search/ accepts POST JSON requests, we can do one single request to get all Items by @id from /search/ instead of multiple AJAX requests.
 * This will be the component to handle it (convert this.item_uris to one /search/ URI, override componentDidMount etc.)
 *
 * Could then automatically detect in ItemPageLoader if length of @ids requested is > 20 or some random number, and auto use this component instead.
 *
 * @export
 * @class ItemPageTableBatchLoader
 * @extends {ItemPageTableIndividualUrlLoader}
 */
export class ItemPageTableBatchLoader extends ItemPageTableIndividualUrlLoader {
    constructor(props){
        super(props);
        if (this.item_uris){
            console.log('TEST', this.item_uris);
        }
    }
}
