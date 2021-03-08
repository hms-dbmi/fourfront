'use strict';

import React from 'react';
import _ from 'underscore';
import url from 'url';

import { unhighlightTerms } from '@hms-dbmi-bgm/shared-portal-components/es/components/viz/utilities';
import { FlexibleDescriptionBox } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/FlexibleDescriptionBox';
import { object, layout, ajax, console, isServerSide, analytics, searchFilters, memoizedUrlParse } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';

import { navigate } from './../../util';
import { ChartDataController } from './../../viz/chart-data-controller';
import * as BarPlot from './../../viz/BarPlot';


/**
 * @callback showFunc
 * @param {string} path - Path of current page or view, derived from 'href' prop on FacetCharts component.
 * @return {string|boolean} - The type of view to display ('full', 'small') or bool.
 */

/**
 * Area for displaying Charts rel to browsing.
 * Originally designed as space for 2 charts, a bigger barplot and a smaller/square/circle pie-like chart, to take up 3/4 and 1/4 width of header respectively (where 1/4 of width ~== height).
 * Now the 1/4 area for smaller chart is used for legend & ui controls.
 */
export class FacetCharts extends React.PureComponent {

    /**
     * @type {Object} defaultProps
     * @static
     * @public
     * @member
     * @constant
     * @property {string} [href='/'] Current page/view URL, used to filter charts and pass 'path' arg to props.show, if provided.
     * @property {boolean|string|showFunc} [show] - Type of view to show or whether to display or not; if function supplied, as well as props.href, path is passed as argument.
     * @property {string[]} initialFields - Array with 2 items representing the x-axis field and the group by field.
     */
    static defaultProps = {
        'href' : '/',
        'show' : function(path, search, hash){
            if (path === '/' || path === '/home') return 'large';
            if (path.indexOf('/browse/') > -1) return true;
            return false;
        },
        'views' : ['small', 'large'],
        // This would override the global default initial fields in ChartDataController.initialize if were different.
        // Maybe will remove these eventually -or- set to re-init on them if no other ChartDataController.Providers present on screen.
        'initialFields' : [
            'experiments_in_set.experiment_type.display_title',
            'experiments_in_set.biosample.biosource.individual.organism.name'
        ]
    };

    /**
     * Binds functions and initiates a state object.
     *
     * @member
     * @ignore
     * @public
     * @constructor
     */
    constructor(props){
        super(props);
        this.show = this.show.bind(this);
        this.state = { 'mounted' : false };
    }

    componentDidMount(){
        setTimeout(() => this.setState({ 'mounted' : true }), 100);
    }

    /**
     * @ignore
     */
    componentDidUpdate(pastProps, pastState){
        if (this.props.debug){
            var propKeys    = _.keys(this.props),
                stateKeys   = _.keys(this.state),
                i;
            for (i = 0; i < propKeys.length; i++){
                if (this.props[propKeys[i]] !== pastProps[propKeys[i]]){
                    console.log('DIFFERENT PROP:', propKeys[i], pastProps[propKeys[i]], this.props[propKeys[i]]);
                }
            }
            for (i = 0; i < stateKeys.length; i++){
                if (this.state[stateKeys[i]] !== pastState[stateKeys[i]]){
                    console.log('DIFFERENT STATE:', stateKeys[i], pastState[stateKeys[i]], this.state[stateKeys[i]]);
                }
            }
        }
    }

    /**
     * Given `this.props`, determines if element is currently meant to be invisible (false) or a certain layout ({string}).
     *
     * @instance
     * @private
     * @param {Object} [props=this.props] - Representation of current or next props for this component.
     * @returns {string|boolean} What layout should currently be rendered.
     */
    show(props = this.props){
        if (props.show === false) return false;
        if (typeof props.show === 'string' && props.views.indexOf(props.show) > -1) return props.show;
        if (typeof props.show === 'function') {
            var show;
            if (typeof props.href === 'string') {
                const urlParts = memoizedUrlParse(props.href);
                show = props.show(urlParts.pathname, urlParts.search, urlParts.hash);
            } else {
                show = props.show();
            }
            if (show === false) return false; // If true, continue to use default ('small')
            if (props.views.indexOf(show) > -1) return show;
        }
        return props.views[0]; // Default
    }

    /** Defines buttons/actions to be shown in onHover popover. */
    cursorDetailActions(){
        const { href, browseBaseState, context } = this.props;
        const isBrowseHref = navigate.isBrowseHref(href);
        const currExpSetFilters = searchFilters.contextFiltersToExpSetFilters(context && context.filters);
        return [
            {
                'title' : isBrowseHref ? 'Explore' : 'Browse',
                'function' : function(cursorProps, mouseEvt){
                    var baseParams = navigate.getBrowseBaseParams(browseBaseState),
                        browseBaseHref = navigate.getBrowseBaseHref(baseParams);

                    // Reset existing filters if selecting from 'all' view. Preserve if from filtered view.
                    var currentExpSetFilters = browseBaseState === 'all' ? {} : currExpSetFilters;

                    var newExpSetFilters = _.reduce(cursorProps.path, function(expSetFilters, node){
                        // Do not change filter IF SET ALREADY because we want to strictly enable filters, not disable any.
                        if (expSetFilters && expSetFilters[node.field] && expSetFilters[node.field].has(node.term)){
                            return expSetFilters;
                        }
                        return searchFilters.changeFilter(node.field, node.term, expSetFilters, null, true);// Existing expSetFilters, if null they're retrieved from Redux store, only return new expSetFilters vs saving them == set to TRUE
                    }, currentExpSetFilters);

                    // Register 'Set Filter' event for each field:term pair (node) of selected Bar Section.
                    _.forEach(cursorProps.path, function(node){
                        analytics.event('BarPlot', 'Set Filter', {
                            'eventLabel'        : analytics.eventLabelFromChartNode(node, false),                         // 'New' filter logged here.
                            'field'             : node.field,
                            'term'              : node.term,
                            'currentFilters'    : analytics.getStringifiedCurrentFilters(currExpSetFilters), // 'Existing' filters, or filters at time of action, go here.
                        });
                    });

                    searchFilters.saveChangedFilters(newExpSetFilters, browseBaseHref, () => {
                        // Scroll to top of browse page container after navigation is complete.
                        setTimeout(layout.animateScrollTo, 200, "content", Math.abs(layout.getPageVerticalScrollPosition() - 510) * 2, 79);
                    });
                },
                'disabled' : function(cursorProps){
                    if (currExpSetFilters && typeof currExpSetFilters === 'object'){
                        if (
                            Array.isArray(cursorProps.path) &&
                            (cursorProps.path[0] && cursorProps.path[0].field) &&
                            currExpSetFilters[cursorProps.path[0].field] instanceof Set &&
                            currExpSetFilters[cursorProps.path[0].field].has(cursorProps.path[0].term) &&
                            (
                                !cursorProps.path[1] || (
                                    cursorProps.path[1].field &&
                                    currExpSetFilters[cursorProps.path[1].field] instanceof Set &&
                                    currExpSetFilters[cursorProps.path[1].field].has(cursorProps.path[1].term)
                                )
                            )
                        ) return true;
                    }
                    return false;
                }
            }
        ];
    }

    /**
     * @private
     * @returns {JSX.Element} Area with BarPlot chart, wrapped by `ChartDataController.Provider` instance.
     */
    render(){
        const show = this.show();
        if (!show) return null; // We don't show section at all.

        const { context, debug, windowWidth, colWidthPerScreenSize, schemas, href, isFullscreen, initialFields } = this.props;
        const { mounted } = this.state;

        if (context && context.total === 0) return null;
        if (debug) console.log('WILL SHOW FACETCHARTS', show, href);

        const gridState = layout.responsiveGridState(windowWidth || null);
        const cursorDetailActions = this.cursorDetailActions();
        const browseBaseParams = navigate.getBrowseBaseParams();
        const expSetFilters = searchFilters.contextFiltersToExpSetFilters(context && context.filters, browseBaseParams);
        let height = show === 'small' ? 300 : 450;
        let width;

        if (gridState === 'xs'){
            width = windowWidth - 20;
        } else if (gridState === 'sm'){
            width = layout.gridContainerWidth(windowWidth);
        } else if (isFullscreen){
            width = parseInt((windowWidth - 40) * 0.75) - 20;
        } else {
            width = parseInt(layout.gridContainerWidth(windowWidth) * 0.75);
        }

        if (mounted && gridState === 'xs') height = Math.min(height, 240);

        //vizUtil.unhighlightTerms();

        if (!mounted){
            return ( // + 30 == breadcrumbs (26) + breadcrumbs-margin-bottom (10) + description (30)
                <div className={"facet-charts loading " + show} key="facet-charts" style={{ 'height' : height }}>
                    <i className="icon icon-spin icon-circle-notch fas" style={{ 'top' : (height / 2 - 30) + 'px' }} />
                </div>
            );
        }

        if (debug) console.log('FacetCharts SCHEMAS AT RENDER', schemas);

        // props.initialFields are not used if already initialized.

        return (
            <div className={"facet-charts show-" + show} key="facet-charts">
                <ChartDataController.Provider id="barplot1" initialFields={initialFields}>
                    <BarPlot.UIControlsWrapper legend chartHeight={height} {...{ href, windowWidth, cursorDetailActions, expSetFilters }}>
                        <BarPlot.Chart {...{ width, height, schemas, windowWidth, href, cursorDetailActions, context }} />
                    </BarPlot.UIControlsWrapper>
                </ChartDataController.Provider>
            </div>
        );
    }

}
