'use strict';
import React from 'react';
import PropTypes from 'prop-types';
import queryString from 'query-string';
import url from 'url';
import _ from 'underscore';
import * as globals from './globals';
import ReactTooltip from 'react-tooltip';
import { ajax, console, object, isServerSide, Filters, layout, DateUtility, navigate } from './util';
import { Button, ButtonToolbar, ButtonGroup, Panel, Table, Collapse} from 'react-bootstrap';
import { Detail } from './item-pages/components';
import FacetList from './facetlist';

var Listing = function (result, schemas, selectCallback) {
    var props;
    if (result['@id']) {
        props = {'context': result,  'key': result['@id'], 'schemas': schemas, 'selectCallback': selectCallback};
    }
    if(props){
        return(<ResultTableEntry {...props} />);
    }else{
        return null;
    }

};

class ResultTableEntry extends React.Component{
    constructor(props){
        super(props);
        this.state = {
            'open': false
        };
    }

    handleToggle = (e) => {
        e.preventDefault();
        this.setState({'open': !this.state.open});
    }

    handleSelect = (e) => {
        e.preventDefault();
        if(!this.props.selectCallback){
            return;
        }
        var processed_link = this.props.context.link_id.replace(/~/g, "/");
        this.props.selectCallback(processed_link);
    }

    render() {
        var result = this.props.context || null;
        var item_type = result['@type'][0];
        var processed_link = result.link_id.replace(/~/g, "/");
        var detailPop = false;
        if(this.props.selectCallback){
            detailPop = true;
        }
        return (
            <div className="result-table-result">
                <div className="row">
                    <div className="col-xs-9 col-md-4 col-lg-4 result-table-entry-div">
                        <Button bsSize="xsmall" className="icon-container pull-left" onClick={this.handleToggle}>
                            <i className={"icon " + (this.state.open ? "icon-minus" : "icon-plus")}></i>
                        </Button>
                        {this.props.selectCallback ?
                            <Button bsSize="xsmall" bsStyle="success" className="icon-container pull-left" onClick={this.handleSelect}>
                                <i className={"icon icon-check"}></i>
                            </Button>
                            : null
                        }
                        {detailPop ?
                            <a href={processed_link} target="_blank">{result.display_title}</a>
                            : <a href={processed_link}>{result.display_title}</a>
                        }
                    </div>
                    <div className="col-xs-12 col-md-3 col-lg-3 result-table-entry-div">
                        {result.lab ? result.lab.display_title : ""}
                    </div>
                    <div className="col-xs-12 col-md-2 col-lg-2 result-table-entry-div">
                        {result.submitted_by ? result.submitted_by.display_title : ""}
                    </div>
                    <div className="col-xs-12 col-md-3 col-lg-3 result-table-entry-div">
                        {result.date_created ?
                            <DateUtility.LocalizedTime timestamp={result.date_created} formatType='date-time-md' dateTimeSeparator=" at " />
                        : null}
                    </div>
                </div>
                <Collapse in={this.state.open}>
                    <div>
                        <ResultDetail result={result} schemas={this.props.schemas} popLink={detailPop}/>
                    </div>
                </Collapse>
            </div>
        );
    }
}

// Uses Detail from item-pages/components to provide item summary panel
class ResultDetail extends React.Component{

    static propTypes = {
        result: PropTypes.object.isRequired,
        schemas: PropTypes.object.isRequired,
        popLink: PropTypes.bool.isRequired
    }

    constructor(props){
        super(props);
    }

    render(){
        var result = this.props.result;
        return(
            <div className="result-table-detail">
                {result.description ?
                    <div className="data-row flexible-description-box result-table-result-heading">
                        {result.description}
                    </div>
                    : null}
                <div className="item-page-detail">
                    <h4 className="text-300">Details</h4>
                    <Detail context={result} schemas={this.props.schemas} open={false} popLink={this.props.popLink}/>
                </div>
            </div>
        );
    }
}

// If the given term is selected, return the href for the term
export function getUnselectHrefIfSelectedFromResponseFilters(term, field, filters) {
    for (var filter in filters) {
        if (filters[filter]['field'] == field && filters[filter]['term'] == term) {
            return url.parse(filters[filter]['remove']).search;
        }
    }
    return null;
}

function buildSearchHref(unselectHref, field, term, searchBase){
    var href;
    if (unselectHref) {
        href = unselectHref;
    } else {
        href = searchBase + field + '=' + encodeURIComponent(term).replace(/%20/g, '+');
    }
    return href;
}

// Determine whether any of the given terms are selected
function countSelectedTerms(terms, field, filters) {
    var count = 0;
    for(var oneTerm in terms) {
        if(getUnselectHrefIfSelectedFromResponseFilters(terms[oneTerm].key, field, filters)) {
            count++;
        }
    }
    return count;
}
/*
class Term extends React.Component {

    buildSearchHref(selected = getUnselectHrefIfSelectedFromResponseFilters(this.props.term['key'], this.props.facet['field'], this.props.filters)){
        var href;
        if (selected && !this.props.canDeselect) {
            href = null;
        } else if (selected) {
            href = selected;
        } else {
            href = this.props.searchBase + this.props.facet['field'] + '=' + encodeURIComponent(this.props.term['key']).replace(/%20/g, '+');
        }
        return href;
    }

    render () {
        var filters = this.props.filters;
        var term = this.props.term['key'];
        var count = this.props.term['doc_count'];
        var title = this.props.title || term;
        var field = this.props.facet['field'];
        var selected = getUnselectHrefIfSelectedFromResponseFilters(term, field, filters);
        var href = this.buildSearchHref(selected);

        return (
            <li className={"facet-list-element" + (selected ? " selected" : '')} id={selected ? "selected" : null} key={term}>
                <a className="term" data-selected={selected} href={href} onClick={href ? this.props.onFilter : null}>
                    <span className="pull-left facet-selector">
                        {selected ? <i className="icon icon-times-circle icon-fw"></i> : '' }
                    </span>
                    <span className="facet-item">
                        {title}
                    </span>
                    <span className="facet-count">{count}</span>
                </a>
            </li>
        );
    }
}
*/

class TypeTerm extends React.Component {
    render() {
        var term = this.props.term['key'];
        var filters = this.props.filters;
        var total = this.props.total;
        return <Term {...this.props} title={term} filters={filters} total={total} />;
    }
}

class InfoIcon extends React.Component{
    render() {
        if (!this.props.children) return null;
        return (
            <i className="icon icon-info-circle" data-tip={this.props.children}/>
        );
    }
}

/*
class Facet extends React.Component {

    static defaultProps = {
        width : 'inherit'
    }

    constructor(props){
        super(props);
        this.onClick = this.onClick.bind(this);
        this.render = this.render.bind(this);
        this.state = {
            'facetOpen' : false
        };
    }

    onClick() {
        this.setState({facetOpen: !this.state.facetOpen});
    }

    render() {
        var facet = this.props.facet;
        var filters = this.props.filters;
        var title = facet['title'];
        var field = facet['field'];
        var total = facet['total'];
        var termID = title.replace(/\s+/g, '');
        var terms = facet['terms'].filter(function (term) {
            if (term.key) {
                for(var filter in filters) {
                    if(filters[filter].term === term.key) {
                        return true;
                    }
                }
                return term.doc_count > 0;
            } else {
                return false;
            }
        });
        var moreTerms = terms.slice(5);
        var TermComponent = field === 'type' ? TypeTerm : Term;
        var selectedTermCount = countSelectedTerms(moreTerms, field, filters);
        var moreTermSelected = selectedTermCount > 0;
        var canDeselect = (!facet.restrictions || selectedTermCount >= 2);
        var moreSecClass = 'collapse' + ((moreTermSelected || this.state.facetOpen) ? ' in' : '');
        var seeMoreClass = 'btn btn-link' + ((moreTermSelected || this.state.facetOpen) ? '' : ' collapsed');
        var schemaProperty = Filters.Field.getSchemaProperty(field, this.props.schemas, this.props.thisType, true);
        var description = schemaProperty && schemaProperty.description;
        return (
            <div className="facet" hidden={terms.length === 0} style={{width: this.props.width}}>
                <h5 className="facet-title">
                    <span className="inline-block">{ title || field }</span>
                    <InfoIcon children={description}/>
                </h5>
                <ul className="facet-list nav">
                    <div>
                        {terms.slice(0, 5).map(function (term) {
                            return <TermComponent {...this.props} key={term.key} term={term} filters={filters} total={total} canDeselect={canDeselect} />;
                        }.bind(this))}
                    </div>
                    {terms.length > 5 ?
                        <div id={termID} className={moreSecClass}>
                            {moreTerms.map(function (term) {
                                return <TermComponent {...this.props} key={term.key} term={term} filters={filters} total={total} canDeselect={canDeselect} />;
                            }.bind(this))}
                        </div>
                    : null}
                    {(terms.length > 5 && !moreTermSelected) ?
                        <label className="pull-left">
                                <small>
                                    <button type="button" className={seeMoreClass} data-toggle="collapse" data-target={'#'+termID} onClick={this.handleClick} />
                                </small>
                        </label>
                    : null}
                </ul>
            </div>
        );
    }
}
*/

/*
class FacetList extends React.Component {

    static contextTypes = {
        session: PropTypes.bool
    }

    static defaultProps = {
        orientation: 'vertical'
    }

    render() {
        var { context, term, session } = this.props;

        // Get all facets, and "normal" facets, meaning non-audit facets
        var facets = this.props.facets;
        var normalFacets = facets.filter(facet => facet.field.substring(0, 6) !== 'audit.');

        var filters = this.props.filters;
        var width = 'inherit';
        if (!facets.length && this.props.mode != 'picker') return <div />;
        var hideTypes;
        if (this.props.mode == 'picker') {
            hideTypes = false;
        }else if(this.props.submissionBase){
            hideTypes = true; // don't show types facet if using submission page
        } else {
            hideTypes = filters.filter(filter => filter.field === 'type').length === 1 && normalFacets.length > 1;
        }
        if (this.props.orientation == 'horizontal') {
            width = (100 / facets.length) + '%';
        }

        // See if we need the Clear Filters link or not. context.clear_filters
        var clearButton; // JSX for the clear button
        var clearHref = this.props.submissionBase ? '/' : context.clear_filters;
        var searchQuery = context && context['@id'] && url.parse(context['@id']).search;
        if (searchQuery) {
            // Convert search query string to a query object for easy parsing
            var terms = queryString.parse(searchQuery);

            // See if there are terms in the query string aside from searchTerm, from, and limit
            // We have Clear Filters button if so
            var nonPersistentTerms = _(Object.keys(terms)).any(term => !_.contains(['searchTerm', 'from', 'limit'], term));
            clearButton = nonPersistentTerms && terms['searchTerm'];

            // If no Clear Filters button yet, do the same check with type instead of searchTerm
            if (!clearButton) {
                nonPersistentTerms = _(Object.keys(terms)).any(term => !_.contains(['type', 'from', 'limit'], term));
                clearButton = nonPersistentTerms && terms['type'];
            }
        }

        return (
            <div>
                <div className={"facets-container facets " + this.props.orientation}>
                    <div className="row facets-header">
                        <div className="col-xs-6 facets-title-column">
                            <i className="icon icon-fw icon-filter"></i>
                            &nbsp;
                            <h4 className="facets-title">Properties</h4>
                        </div>
                        <div className={"col-xs-6 clear-filters-control" + (clearButton ? '' : ' placeholder')}>
                            <a href={clearHref} onClick={clearHref ? this.props.onFilter : null} className={"btn btn-xs rounded btn-outline-default"}>
                                <i className="icon icon-times"></i> Clear All
                            </a>
                        </div>
                    </div>
                    {facets.map(facet => {
                        if ((hideTypes && facet.field == 'type') || (!session && facet.field.substring(0, 6) === 'audit.')) {
                            return <span key={facet.field} />;
                        } else {
                            return <Facet {...this.props} key={facet.field} facet={facet} filters={filters}
                                            width={width} />;
                        }
                    })}
                </div>
            </div>
        );
    }

}
*/

// the old Search tabular-style result display
class TabularTableResults extends React.Component{

    static propTypes = {
        results: PropTypes.array.isRequired,
        schemas: PropTypes.object,
    }

    constructor(props){
        super(props);
    }

    render(){
        var results = this.props.results;
        var schemas = this.props.schemas || {};
        // Buttons are included in title bar for correct spacing
        return(
            <div>
                <div className="result-table-header-row-container">
                    <div className="row hidden-xs hidden-sm result-table-header-row">
                        <div className="col-xs-9 col-md-4 col-lg-4 result-table-entry-div">
                            <Button style={{'visibility':'hidden','marginRight':'4px'}} bsSize="xsmall" className="icon-container pull-left" disabled={true}>
                                <i className="icon icon-plus"></i>
                            </Button>
                            {this.props.selectCallback ?
                                <Button style={{'visibility':'hidden','marginRight':'4px'}} bsSize="xsmall" className="icon-container pull-left" disabled={true}>
                                    <i className={"icon icon-check"}></i>
                                </Button>
                                : null
                            }
                            <div>Title</div>
                        </div>
                        <div className="col-xs-12 col-md-3 col-lg-3 result-table-entry-div">
                            <div>Lab</div>
                        </div>
                        <div className="col-xs-12 col-md-2 col-lg-2 result-table-entry-div">
                            <div>Submitter</div>
                        </div>
                        <div className="col-xs-12 col-md-3 col-lg-3 result-table-entry-div">
                            <div>Date Created</div>
                        </div>
                        <div className="col-xs-12 col-md-12 divider-column">
                            <div className="divider"/>
                        </div>
                    </div>
                </div>
                <div className="nav result-table row" id="result-table">
                    {results.length ?
                        results.map(function (result) {
                            if(this.props.selectCallback){
                                return Listing(result, schemas, this.props.selectCallback);
                            }else{
                                return Listing(result, schemas, null);
                            }
                        }.bind(this))
                    : null}
                </div>
            </div>
        );
    }
}

class ResultTable extends React.Component {

    static defaultProps = {
        restrictions : {},
        searchBase : ''
    }

    constructor(props){
        super(props);
        this.componentWillReceiveProps = this.componentWillReceiveProps.bind(this);
        this.getSearchType = this.getSearchType.bind(this);
        this.changePage = _.throttle(this.changePage.bind(this), 250);
        this.onFilter = this.onFilter.bind(this);
        this.isTermSelected = this.isTermSelected.bind(this);
        this.render = this.render.bind(this);

        var urlParts = url.parse(this.props.searchBase, true);
        var urlFrom = parseInt(urlParts.query.from || 0);
        var urlLimit = parseInt(urlParts.query.limit || 25);
        var page = 1 + Math.ceil(urlFrom/urlLimit);
        this.state = {
            'page': page,
            'changing_page': false
        };
    }

    componentWillReceiveProps(nextProps){
        // go back to first page if items change
        if(this.props.context.total !== nextProps.context.total){
            this.changePage(1, nextProps.searchBase);
        }
    }

    getSearchType(facets){
        var specificSearchType;
        // Check to see if we are searching among multiple data types
        // If only one type, use that as the search title
        for (var i = 0; i < facets.length; i++){
            if (facets[i]['field'] && facets[i]['field'] == 'type'){
                if (facets[i]['terms'][0]['doc_count'] === facets[i]['total']
                    && facets[i]['total'] > 0 && facets[i]['terms'][0]['key'] !== 'Item'){
                    // it's a single data type, so grab it
                    specificSearchType = facets[i]['terms'][0]['key'];
                }else{
                    specificSearchType = 'Multiple type';
                }
            }
            return specificSearchType;
        }
    }

    changePage(page, urlBase=this.props.searchBase){

        if (typeof this.props.navigate !== 'function') throw new Error("Search doesn't have props.navigate");
        if (typeof urlBase !== 'string') throw new Error("Search doesn't have props.searchBase");
        var urlParts = url.parse(urlBase, true);
        var urlLimit = parseInt(urlParts.query.limit || 25);

        // Check page from URL and state to see if same and if so, cancel navigation.
        if (page === this.state.page){
            console.warn("Already on page " + page);
            return;
        }
        var newFrom = urlLimit * (page - 1);
        urlParts.query.from = newFrom + '';
        urlParts.search = '?' + queryString.stringify(urlParts.query);
        if(this.props.submissionBase){
            this.setState({ 'changingPage' : true }, ()=>{
                this.props.navigate(url.format(urlParts), {}, ()=>{
                    this.setState({
                        'changingPage' : false,
                        'page' : page
                    });
                });
            });
        } else {
            this.setState({ 'changingPage' : true }, ()=>{
                this.props.navigate( url.format(urlParts), { 'replace' : true }, ()=>{
                    this.setState({
                        'changingPage' : false,
                        'page' : page
                    });
                });
            });
        }
    }

    onFilter(field, term, callback) {
        var searchBase = this.props.searchBase;
        var unselectHrefIfSelected = getUnselectHrefIfSelectedFromResponseFilters(term, field, this.props.context.filters);

        var targetSearchHref = buildSearchHref(
            unselectHrefIfSelected,
            field, term, searchBase ? searchBase + '&' : searchBase + '?'
        );

        if (field === 'type' && !(unselectHrefIfSelected)){ // If selecting new type, unselect type=Item
            targetSearchHref = targetSearchHref.replace(/(&)?(type=Item)/,'');
        }
        
        this.props.navigate(targetSearchHref, {});
        setTimeout(callback, 100);
    }

    isTermSelected(term, facet){
        return !!(getUnselectHrefIfSelectedFromResponseFilters(term, facet, this.props.context.filters));
    }

    render() {
        const batchHubLimit = 100;
        var context = this.props.context;
        var results = context['@graph'];
        var total = context['total'];
        var batch_hub_disabled = total > batchHubLimit;
        var filters = context['filters'];
        var show_link;
        var facets = context['facets'].map(function(facet) {
            if (this.props.restrictions[facet.field] !== undefined) {
                facet = _.clone(facet);
                facet.restrictions = this.props.restrictions[facet.field];
                facet.terms = facet.terms.filter(term => _.contains(facet.restrictions, term.key));
            }
            return facet;
        }.bind(this));

        // get type of this object for getSchemaProperty (if type="Item", no tooltips)
        var thisType = 'Item';
        var searchBits = this.props.searchBase.split(/[\?&]+/);
        var filteredBits = searchBits.filter(bit => bit.slice(0,5) === 'type=' && bit.slice(5,9) !== 'Item');
        if (filteredBits.length == 1){ // if multiple types, don't use any tooltips
            thisType = filteredBits[0].slice(5);
        }
        var urlParts = url.parse(this.props.searchBase, true);
        var urlLimit = parseInt(urlParts.query.limit || 25);
        var num_pages = Math.ceil(this.props.context.total/urlLimit);
        var itemTypeForSchemas = null;
        if (typeof urlParts.query.type === 'string') { // Can also be array
            if (urlParts.query.type !== 'Item') {
                itemTypeForSchemas = urlParts.query.type;
            }
        }

        return (
            <div>

                {this.props.submissionBase ?
                    <h1 className="page-title">{thisType + ' Selection'}</h1>
                    : <h1 className="page-title">{thisType + ' Search'}</h1>
                }
                <h4 className="page-subtitle">Filter & sort results</h4>

                <div className="row">
                    {facets.length ? <div className="col-sm-5 col-md-4 col-lg-3">
                        <FacetList
                            {...this.props}
                            facets={facets}
                            filters={filters}
                            thisType={thisType}
                            expSetFilters={this.props.expSetFilters}
                            onFilter={this.onFilter}
                            filterFacetsFxn={FacetList.filterFacetsForSearch}
                            isTermSelected={this.isTermSelected}
                            itemTypeForSchemas={itemTypeForSchemas}
                        />
                    </div> : ''}
                    <div className="col-sm-7 col-md-8 col-lg-9 expset-result-table-fix">
                        <div className="row above-chart-row">
                            <div className="col-sm-5 col-xs-12">
                                <h5 className='browse-title'>{results.length} of {total} results</h5>
                            </div>
                            <div className="col-sm-7 col-xs-12">
                                <ButtonToolbar className="pull-right">
                                    <ButtonGroup>
                                        <Button disabled={this.state.changing_page || this.state.page === 1} onClick={this.state.changing_page === true ? null : (e)=>{
                                            this.changePage(this.state.page - 1);
                                        }}><i className="icon icon-angle-left icon-fw"></i></Button>
                                        <Button disabled style={{'minWidth': 120 }}>
                                            { this.state.changing_page === true ?
                                                <i className="icon icon-spin icon-circle-o-notch" style={{'opacity': 0.5 }}></i>
                                                : 'Page ' + this.state.page + ' of ' + num_pages
                                            }
                                        </Button>
                                        <Button disabled={this.state.changing_page || this.state.page === num_pages} onClick={this.state.changing_page === true ? null : (e)=>{
                                            this.changePage(this.state.page + 1);
                                        }}><i className="icon icon-angle-right icon-fw"></i></Button>
                                    </ButtonGroup>
                                </ButtonToolbar>
                            </div>
                        </div>
                        <TabularTableResults {...this.props} results={results} schemas={this.props.schemas}/>
                    </div>
                </div>
            </div>
        );
    }

}

export class Search extends React.Component {

    componentDidMount(){
        ReactTooltip.rebuild();
    }

    render() {
        var context = this.props.context;
        var results = context['@graph'];
        var notification = context['notification'];
        var searchBase;
        // submissionBase is supplied when using Search through frontend
        // submission. this switch controls several things, including
        // pagination, clear filter, and types filter.
        if(this.props.submissionBase){
            searchBase = this.props.submissionBase;
        }else{
            searchBase = url.parse(this.props.href).search || '';
        }
        var facetdisplay = context.facets && context.facets.some(function(facet) {
            return facet.total > 0;
        });
        return (
            <div>
                {facetdisplay ?
                    <div className="browse-page-container">
                        <ResultTable {...this.props} searchBase={searchBase} navigate={this.props.navigate || navigate} />
                    </div>
                : <div className='error-page'><h4>{notification}</h4></div>}
            </div>
        );
    }
}

globals.content_views.register(Search, 'Search');
