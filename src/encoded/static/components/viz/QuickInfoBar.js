'use strict';

import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';
import url from 'url';
import memoize from 'memoize-one';
import ReactTooltip from 'react-tooltip';
import { console, searchFilters, analytics, memoizedUrlParse } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { ActiveFiltersBar } from '@hms-dbmi-bgm/shared-portal-components/es/components/browse/components/ActiveFiltersBar';
import { Filters, navigate, Schemas } from './../util';
import { Toggle } from '@hms-dbmi-bgm/shared-portal-components/es/components/forms/components/Toggle';
import { ChartDataController } from './chart-data-controller';




/**
 * Bar shown below header on home and browse pages.
 * Shows counts of selected experiment_sets, experiments, and files against those properties' total counts.
 *
 * Possible todo: Remove functions for updating counts, instead wrap in ChartDataController.provider and aggregate, using shouldComponentUpdate
 * More likely todo: Do chart-stuff aggregation on back-end, display context.charts.aggregations.counts.files, ...experiments, ...experiment_sets, etc. here instead.
 *
 * @module {Component} viz/QuickInfoBar
 * @prop {string} href - Current location/href passed down from Redux store. Used for determining whether to display QuickInfoBar or not.
 */

export default class QuickInfoBar extends React.PureComponent {

    static isInvisibleForHref(href){
        // If have href, only show for /browse/, /search/, and / & /home
        const urlParts = memoizedUrlParse(href);
        // Doing replace twice should be faster than one time with /g regex flag (3 steps each or 15 steps combined w/ '/g')
        const pathParts = urlParts.pathname.replace(/^\//, "").replace(/\/$/, "").split('/');
        if (pathParts[0] === 'browse') return false;
        if (pathParts.length === 1 && pathParts[0] === 'statistics') {
            if (!urlParts.hash || urlParts.hash === '#submissions'){
                return false;
            }
        }
        if (pathParts[0] === 'search') return true;
        if (pathParts[0] === 'home') return false;
        if (pathParts.length === 1 && pathParts[0] === "") return false;
        return true;
    }

    static getCountsFromProps(props){
        const defaultNullCounts = {
            'experiment_sets' : null,
            'experiments' : null,
            'files' : null
        };
        const current = (props.barplot_data_filtered && props.barplot_data_filtered.total) || defaultNullCounts;
        const total = (props.barplot_data_unfiltered && props.barplot_data_unfiltered.total) || defaultNullCounts;
        return { current, total };
    }

    static contextFiltersToInclude(contextFilters, browseBaseParams = {}){
        return (contextFilters|| []).filter(function({ field, term }){
            // Exclude some.
            if (browseBaseParams[field] && browseBaseParams[field].indexOf(term) > -1) {
                return false;
            }
            return true;
        });
    }

    static anyFiltersSet(context, browseBaseState){
        const browseBaseParams = navigate.getBrowseBaseParams(browseBaseState);
        const expSetFilters = searchFilters.contextFiltersToExpSetFilters((context && context.filters) || null, browseBaseParams);
        return (expSetFilters && _.keys(expSetFilters).length > 0);
    }

    static defaultProps = {
        'offset' : {},
        'id' : 'stats',
        'className' : null,
        'showCurrent' : true
    };

    static getDerivedStateFromProps(props, state){
        const expSetFilters = searchFilters.contextFiltersToExpSetFilters((props.context && props.context.filters) || null, navigate.getBrowseBaseParams(props.browseBaseState));
        const show = state.show && expSetFilters && _.keys(expSetFilters).length > 0 && state.show;
        return { show };
    }

    /**
     * Sets this.state, containing counts for filtered & total experiments, experiment_sets, and files.
     * Counts are set to null by default, and instance's updateCurrentAndTotalCounts method must be called
     * each time stats are updated from some high-level component.
     *
     * Currently this is done by having refs...updateCurrentAndTotalCounts being accessible
     * through refs.navigation on app component/module, which makes an 'updateStats' instance function available,
     * which is provided to ChartDataController.
     *
     * Additionally holds {boolean|string} 'show' property, describing what is shown in bottom part; and a {boolean} 'mounted' property.
     */
    constructor(props){
        super(props);
        this.onIconMouseEnter = _.debounce(this.onIconMouseEnter.bind(this), 500, true);
        this.onBrowseStateToggle = _.throttle(this.onBrowseStateToggle.bind(this), 1000, { trailing: false });
        this.onPanelAreaMouseLeave = this.onPanelAreaMouseLeave.bind(this);
        this.handleActiveFilterTermClick = this.handleActiveFilterTermClick.bind(this);
        this.state = {
            'mounted'               : false,
            'show'                  : false,
            'reallyShow'            : false,
            'togglingBrowseState'   : false
        };

        this.memoized = {
            expSetFilters: memoize(searchFilters.contextFiltersToExpSetFilters),
            anyFiltersSet: memoize(QuickInfoBar.anyFiltersSet),
            isInvisibleForHref: memoize(QuickInfoBar.isInvisibleForHref)
        };
    }

    /** @private */
    componentDidMount(){
        this.setState({ 'mounted' : true });
    }

    onIconMouseEnter(e){
        const { context, browseBaseState } = this.props;
        const browseBaseParams = navigate.getBrowseBaseParams(browseBaseState);
        const areAnyFiltersSet = this.memoized.anyFiltersSet(context, browseBaseState);
        if (this.timeout) clearTimeout(this.timeout);
        if (areAnyFiltersSet) {
            this.setState({ 'show' : 'activeFilters', 'reallyShow' : true });
        }

        const expSetFilters = this.memoized.expSetFilters((context && context.filters) || null, browseBaseParams);

        analytics.event('QuickInfoBar', 'Hover over Filters Icon', {
            'eventLabel' : ( areAnyFiltersSet ? "Some filters are set" : "No filters set" ),
            'dimension1' : analytics.getStringifiedCurrentFilters(expSetFilters)
        });
    }

    onPanelAreaMouseLeave(e){
        e.preventDefault();
        this.setState({ 'show' : false }, ()=>{
            this.timeout = setTimeout(this.setState.bind(this), 500, { 'reallyShow' : false });
        });
    }

    onBrowseStateToggle(){
        const { context, browseBaseState, href } = this.props;
        this.setState({ 'togglingBrowseState' : true }, () => {
            navigate.setBrowseBaseStateAndRefresh(browseBaseState === 'only_4dn' ? 'all' : 'only_4dn', href, context, null, () => {
                this.setState({ 'togglingBrowseState' : false });
            });
        });
    }

    handleActiveFilterTermClick(evt, field, term){
        const { context, browseBaseState } = this.props;
        const browseBaseParams = navigate.getBrowseBaseParams(browseBaseState);
        const expSetFilters = this.memoized.expSetFilters((context && context.filters) || null, browseBaseParams);
        searchFilters.changeFilter(field, term, expSetFilters, null, false, null, browseBaseParams);
        analytics.event('QuickInfoBar', 'Unset Filter', {
            'eventLabel' : `Field: ${field}, Term: ${term}`,
            'dimension1' : analytics.getStringifiedCurrentFilters(expSetFilters)
        });
    }

    render(){
        const { id, isLoadingChartData, browseBaseState, href, context, className } = this.props;
        const { show, mounted } = this.state;
        const anyFiltersSet = this.memoized.anyFiltersSet(context, browseBaseState);
        const invisible = this.memoized.isInvisibleForHref(href);
        const browseBaseParams = navigate.getBrowseBaseParams(browseBaseState);
        const expSetFilters = this.memoized.expSetFilters((context && context.filters) || null, browseBaseParams);

        let outerClassName = "explanation";
        if (typeof className === 'string') outerClassName += ' ' + className;
        if (invisible) outerClassName += ' invisible';

        let innerClassName = "inner container";
        if (show !== false) innerClassName += ' showing';
        if (show === 'activeFilters') innerClassName += ' showing-filters';

        let innerBody;
        if (!mounted || invisible) {
            innerBody = (
                <QuickInfoBarBody {...this.props} {...this.state} {...{ anyFiltersSet, expSetFilters }} />
            );
        } else {
            innerBody = (
                <ChartDataController.Provider id="quick_info_bar1">
                    <QuickInfoBarBody {...this.props} {...this.state} {...{ anyFiltersSet, expSetFilters }} onIconMouseEnter={this.onIconMouseEnter}
                        onBrowseStateToggle={this.onBrowseStateToggle} handleActiveFilterTermClick={this.handleActiveFilterTermClick} />
                </ChartDataController.Provider>
            );
        }

        return (
            <div id={id} className={outerClassName} key="outer">
                <div className={innerClassName} onMouseLeave={this.onPanelAreaMouseLeave} key="inner">
                    { innerBody }
                </div>
            </div>
        );
    }
}


function QuickInfoBarBody (props) {
    const {
        context, schemas, expSetFilters,
        isLoadingChartData, browseBaseState, togglingBrowseState,
        show, reallyShow, mounted, anyFiltersSet,
        onIconMouseEnter, onBrowseStateToggle, handleActiveFilterTermClick
    } = props;

    const { total, current } = QuickInfoBar.getCountsFromProps(props);

    // StatsCol also gets show, onIconMouseEnter, etc via ...props.
    return (
        <React.Fragment>
            <div className="row">
                <StatsCol {...props} {...{ anyFiltersSet, total, current }} />
                <BrowseBaseStateToggleCol browseBaseState={browseBaseState} onToggle={onBrowseStateToggle}
                    isLoading={togglingBrowseState || isLoadingChartData} />
            </div>
            <HoverBar {...{ context, schemas, show, reallyShow, handleActiveFilterTermClick, expSetFilters }} />
        </React.Fragment>
    );
}

function HoverBar({ context, expSetFilters, schemas, show, reallyShow, handleActiveFilterTermClick }){

    if (show === 'activeFilters' || (show === false && reallyShow)) {
        return (
            <div className="bottom-side">
                <div className="crumbs-label">
                    Filtered by
                </div>
                <ActiveFiltersBar {...{ context, schemas }} filters={expSetFilters} onTermClick={handleActiveFilterTermClick}
                    termTransformFxn={Schemas.Term.toName} fieldTransformFxn={Schemas.Field.toName} />
            </div>
        );
    } else {
        return null;
    }
}

const BrowseBaseStateToggleCol = React.memo(function(props){
    const { browseBaseState, isLoading, onToggle } = props;
    const checked = browseBaseState === 'all';
    return (
        <div className="col-4 text-right browse-base-state-toggle-container">
            <div className="inner-more">
                <Toggle disabled={isLoading} id="toggle-external-data-switch" checked={checked} onChange={onToggle} />
                <small>Include External Data</small>
            </div>
        </div>
    );
});

const StatsCol = React.memo(function StatsCol(props){
    const { onIconMouseEnter, anyFiltersSet, total, current, show, expSetFilters } = props;
    const { experiment_sets: totalSets, experiments: totalExps, files: totalFiles } = total || {};

    let stats;
    if (current && (typeof current.experiment_sets === 'number' || typeof current.experiments === 'number' || typeof current.files === 'number')) {
        stats = {
            'experiment_sets'   : <span>{ current.experiment_sets }<small> / { total.experiment_sets || 0 }</small></span>,
            'experiments'       : <span>{ current.experiments }<small> / {total.experiments || 0}</small></span>,
            'files'             : <span>{ current.files }<small> / {total.files || 0}</small></span>
        };
    } else {
        stats = {
            'experiment_sets'   : totalSets || 0,
            'experiments'       : totalExps || 0,
            'files'             : totalFiles || 0
        };
    }
    const statProps = _.extend(_.pick(props, 'id', 'href', 'isLoadingChartData'), { expSetFilters });
    return (
        <div className="col-8 left-side clearfix">
            <Stat {...statProps} shortLabel="Experiment Sets" longLabel="Experiment Sets" classNameID="expsets" value={stats.experiment_sets} key="expsets" />
            <Stat {...statProps} shortLabel="Experiments" longLabel="Experiments" classNameID="experiments" value={stats.experiments} key="experiments" />
            <Stat {...statProps} shortLabel="Files" longLabel="Files in Experiments" classNameID="files" value={stats.files} key="files" />
            <div className={"any-filters glance-label" + (show ? " showing" : "")} data-tip={anyFiltersSet ? "Filtered" : "No Filters Set"}
                onMouseEnter={onIconMouseEnter}>
                <i className="icon icon-filter fas" style={{ 'opacity' : anyFiltersSet ? 1 : 0.25 }} />
            </div>
        </div>
    );
});

class Stat extends React.PureComponent {

    static defaultProps = {
        'value' : 0,
        'longLabel' : 'Experiments',
        'classNameID': 'experiments',
        'id' : null
    };

    /**
     * { classNameID : @type }
     */
    static typesPathMap = {
        'experiments' : "/search/?type=Experiment&experiment_sets.experimentset_type=replicate&experiment_sets.@type=ExperimentSetReplicate",
        'expsets' : "/browse/?type=ExperimentSetReplicate&experimentset_type=replicate",
        'files' : "/search/?type=File&experiments.experiment_sets.@type=ExperimentSetReplicate&experiments.experiment_sets.experimentset_type=replicate"
    }

    filtersHrefChunk(){
        const { expSetFilters, classNameID } = this.props;
        if (classNameID === 'experiments'){
            return searchFilters.expSetFiltersToURLQuery(Filters.transformExpSetFiltersToExpFilters(expSetFilters));
        } else if (classNameID === 'expsets') {
            return searchFilters.expSetFiltersToURLQuery(expSetFilters);
        } else if (classNameID === 'files') {
            return searchFilters.expSetFiltersToURLQuery(Filters.transformExpSetFiltersToFileFilters(expSetFilters));
        }
    }

    label(){
        const { value, shortLabel, expSetFilters, href } = this.props;
        if (!value) {
            return shortLabel;
        }

        // Always goto Browse page for now
        var filtersHrefChunk = searchFilters.expSetFiltersToURLQuery(expSetFilters); //this.filtersHrefChunk();
        var targetHref = navigate.getBrowseBaseHref();
        targetHref += (filtersHrefChunk ? navigate.determineSeparatorChar(targetHref) + filtersHrefChunk : '');

        if (typeof href === 'string'){
            // Strip hostname/port from this.props.href and compare pathnames to check if we are already on this page.
            if (navigate.isBrowseHref(href)) return <span>{ shortLabel }</span>;
            // eslint-disable-next-line no-useless-escape
            if (href.replace(/(http:|https:)(\/\/)[^\/]+(?=\/)/, '') === targetHref) return <span>{ shortLabel }</span>;
        }

        return (
            <a href={targetHref}>{ shortLabel }</a>
        );
    }

    render(){
        const { classNameID, longLabel, value, id, isLoadingChartData } = this.props;
        return (
            <div className={"stat stat-" + classNameID} title={longLabel}>
                <div id={id + '-stat-' + classNameID} className={"stat-value" + (isLoadingChartData ? ' loading' : '')}>
                    { isLoadingChartData ? <i className="icon icon-fw icon-spin icon-circle-notch fas" style={{ opacity : 0.25 }}/> : value }
                </div>
                <div className="stat-label">
                    { this.label() }
                </div>
            </div>
        );
    }

}

