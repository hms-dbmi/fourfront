'use strict';

import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import url from 'url';
import memoize from 'memoize-one';
import _ from 'underscore';
import DropdownItem from 'react-bootstrap/esm/DropdownItem';
import DropdownButton from 'react-bootstrap/esm/DropdownButton';

import { console, searchFilters, isSelectAction, memoizedUrlParse, logger } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { navigate } from './../../util';


export class SearchBar extends React.PureComponent {

    static renderHiddenInputsForURIQuery(query) {
        return _.flatten(_.map(
            _.pairs(query),
            function (qp) {
                if (Array.isArray(qp[1])) {
                    return _.map(qp[1], function (queryValue, idx) {
                        return <input key={qp[0] + '.' + idx} type="hidden" name={qp[0]} value={queryValue} />;
                    });
                } else {
                    return <input key={qp[0]} type="hidden" name={qp[0]} value={qp[1]} />;
                }
            }
        ));
    }

    static hasInput(typedSearchQuery) {
        return (typedSearchQuery && typeof typedSearchQuery === 'string' && typedSearchQuery.length > 0) || false;
    }

    static isBrowseOrSearchPage(href) {
        return href && typeof href === 'string' && (href.indexOf('/browse/') > -1 || href.indexOf('/search/') > -1);
    }

    static deriveSearchItemTypeFromHref(href, searchItemType = null) {
        if (SearchBar.isBrowseOrSearchPage(href)) {
            return "within";
        }
        return "sets";
    }

    static buildURIQuery(searchItemType, currentAction, browseBaseState = "all", hrefParts = {}){
        const query = {};
        if (searchItemType === 'within' || isSelectAction(currentAction)) {  // Preserve filters, incl type facet.
            _.extend(query,
                _.omit(hrefParts.query || {}, 'q')  // Remove 'q' as is provided via the <input name="q" .../> element.
            );
        } else if (searchItemType === 'all') {      // Don't preserve _any_ filters (expsettype=replicates, type=expset, etc.) - reinit with type=Item
            _.extend(query, { 'type': 'Item' });
        } else if (searchItemType === 'sets') {     // Don't preserve non-Browse facets - reinit with expsettype=replicates, type=expset, ...
            const browseBaseParams = navigate.getBrowseBaseParams(browseBaseState);
            _.extend(query, browseBaseParams);
        } else {
            logger.error("No valid searchItemType provided");
            throw new Error("No valid searchItemType provided");
        }
        return query;
    }

    constructor(props) {
        super(props);
        this.onToggleVisibility     = this.onToggleVisibility.bind(this);
        this.onChangeSearchItemType = this.onChangeSearchItemType.bind(this);
        this.onSearchInputChange    = this.onSearchInputChange.bind(this);
        this.onToggleSearchItemType = this.onToggleSearchItemType.bind(this);
        this.onResetSearch          = this.onResetSearch.bind(this);
        this.onSearchInputBlur      = this.onSearchInputBlur.bind(this);
        this.getDropdownTitleText   = this.getDropdownTitleText.bind(this);
        this.getActionType          = this.getActionType.bind(this);

        let initialQuery = '';
        if (props.href){
            initialQuery = searchFilters.searchQueryStringFromHref(props.href) || '';
        }

        this.memoized = {
            deriveSearchItemTypeFromHref: memoize(SearchBar.deriveSearchItemTypeFromHref),
            buildURIQuery: memoize(SearchBar.buildURIQuery)
        };

        this.state = {
            'searchItemType'    : this.memoized.deriveSearchItemTypeFromHref(props.href, null),
            'typedSearchQuery'  : initialQuery,
            'isVisible'         : isSelectAction(props.currentAction) || SearchBar.hasInput(initialQuery) || false,
            'isSearchItemTypeDropDownToggleOn': false
        };

        this.inputElemRef = React.createRef();
    }

    componentDidUpdate(pastProps) {
        const { href, currentAction } = this.props;
        const { href: pastHref } = pastProps;

        if (pastHref !== href) {
            this.setState(({ isVisible, searchItemType })=>{
                const typedSearchQuery = searchFilters.searchQueryStringFromHref(href) || '';
                return {
                    // We don't want to hide if was already open.
                    isVisible : isSelectAction(currentAction) || isVisible || SearchBar.hasInput(typedSearchQuery) || false,
                    typedSearchQuery,
                    searchItemType: this.memoized.deriveSearchItemTypeFromHref(href, searchItemType)
                };
            });
        }
    }

    getDropdownTitleText() {
        const { searchItemType } = this.state;

        switch (searchItemType) {
            case 'sets':
                return 'Experiment Sets';
            case 'all':
                return 'All Items (advanced)';
            case 'within':
                return 'Within Results';
            default:
                return 'Experiment Sets';
        }
    }

    onChangeSearchItemType(searchItemEventKey) {
        this.setState(function () {
            if (typeof searchItemEventKey === 'string') {

                switch (searchItemEventKey) {
                    case 'sets':
                        return { 'searchItemType': searchItemEventKey };
                    case 'all':
                        return { 'searchItemType': searchItemEventKey };
                    case 'within':
                        return { 'searchItemType': searchItemEventKey };
                    default:
                        return { 'searchItemType': 'sets' };
                }

            }
            else {
                return { 'searchItemType': 'sets' };
            }
        });
    }

    onToggleVisibility(evt){
        const { currentAction } = this.props;
        this.setState(function({ isVisible, typedSearchQuery }){
            return { isVisible: isSelectAction(currentAction) || !isVisible };
        }, ()=> {
            // Guaranteed to be up to date in callback.
            const { isVisible } = this.state;
            if (isVisible && this.inputElemRef.current) {
                this.inputElemRef.current.focus();
            }
        });
    }

    onSearchInputChange(e){
        //const { href, currentAction } = this.props;
        const newValue = e.target.value;
        this.setState(({ searchItemType })=>{
            const state = { 'typedSearchQuery': newValue };
            // Resetting this might be counterintuitive.. commenting out for now.
            // if (searchItemType !== "within" && !SearchBar.hasInput(newValue) && !isSelectAction(currentAction)) {
            //     state.searchItemType = this.memoized.deriveSearchItemTypeFromHref(href, searchItemType);
            // }
            return state;
        });
    }

    onSearchInputBlur(e){
        const { href, currentAction } = this.props;
        const lastQuery = searchFilters.searchQueryStringFromHref(href);

        setTimeout(() => {
            this.setState(({ typedSearchQuery: currQueryStr, isSearchItemTypeDropDownToggleOn }) => {
                let typedSearchQuery = currQueryStr; // No change - default
                if (SearchBar.hasInput(lastQuery) && !SearchBar.hasInput(currQueryStr)) {
                    // Replace new value entered with current search query in URL if new value is empty string
                    typedSearchQuery = lastQuery;
                }
                // Prevent closing onBlur if on selection view, or if have input.
                const isVisible = isSelectAction(currentAction) || SearchBar.hasInput(typedSearchQuery) || isSearchItemTypeDropDownToggleOn || false;
                return { typedSearchQuery, isVisible, isSearchItemTypeDropDownToggleOn: isVisible ? isSearchItemTypeDropDownToggleOn : false };
            });
        }, 200);
    }

    onToggleSearchItemType(isOpen, event) {
        if (!isOpen && this.inputElemRef && this.inputElemRef.current) {
            const { typedSearchQuery } = this.state;
            const isInputElemActive = document.activeElement === this.inputElemRef.current;
            if (!isInputElemActive && typedSearchQuery.length === 0) {
                this.inputElemRef.current.focus();
            }
        }
        this.setState((state, props) => {
            return { isSearchItemTypeDropDownToggleOn: isOpen };
        });
    }

    onResetSearch(e){
        const { href, currentAction } = this.props;
        const hrefParts = _.clone(memoizedUrlParse(href));
        hrefParts.query = _.clone(hrefParts.query || {});
        if (typeof hrefParts.search === 'string'){
            delete hrefParts.query.q;
            delete hrefParts.search;
        }
        this.setState(({ searchItemType })=>{
            return {
                'searchItemType': this.memoized.deriveSearchItemTypeFromHref(href, searchItemType),
                'typedSearchQuery' : '',
                'isVisible' : isSelectAction(currentAction) || false
            };
        }, () => { // Doesn't refer to `this` so could be plain/pure function; but navigation is kind of big 'side effect' so... eh
            navigate(url.format(hrefParts));
        });
    }

    getActionType() {
        const { searchItemType } = this.state;
        switch (searchItemType) {
            case 'sets':
                return "/browse/";
            case 'all':
                return "/search/";
            case 'within':
                return '';
            default:
                return "/browse/";
        }
    }

    render() {
        const { href, currentAction, browseBaseState } = this.props;
        const { searchItemType, typedSearchQuery, isVisible } = this.state;
        const hrefParts = memoizedUrlParse(href);

        const searchQueryFromHref = (hrefParts && hrefParts.query && hrefParts.query.q) || '';
        const searchTypeFromHref = (hrefParts && hrefParts.query && hrefParts.query.type) || '';
        const showingCurrentQuery = (searchQueryFromHref && searchQueryFromHref === typedSearchQuery) && (
            (searchTypeFromHref === 'Item' && searchItemType === 'all') || (searchTypeFromHref === 'ExperimentSetReplicate' && searchItemType === 'sets') || (/*searchTypeFromHref === 'ExperimentSetReplicate' &&*/ searchItemType === 'within')
        );
        const searchBoxHasInput = SearchBar.hasInput(typedSearchQuery);
        const query = this.memoized.buildURIQuery(searchItemType, currentAction, browseBaseState, hrefParts);
        const formClasses = [
            "form-inline",
            "navbar-search-form-container",
            searchQueryFromHref && "has-query",
            searchBoxHasInput && "has-input",
            isVisible && "form-is-visible"
        ];

        return ( // Form submission gets serialized and AJAXed via onSubmit handlers in App.js
            <form className={_.filter(formClasses).join(' ')} action={this.getActionType()} method="GET">
                <div className="form-inputs-container">
                    <SelectItemTypeDropdownBtn {...{ currentAction, searchItemType, href }} disabled={false/*!(searchBoxHasInput || searchQueryFromHref)*/}
                        onChangeSearchItemType={this.onChangeSearchItemType} onToggleSearchItemType={this.onToggleSearchItemType}
                        getDropdownTitleText={this.getDropdownTitleText} currentPageType={this.currentPageType} />
                    <input className="form-control search-query" id="navbar-search" type="search" placeholder="Search" ref={this.inputElemRef}
                        name="q" value={typedSearchQuery} onChange={this.onSearchInputChange} key="search-input" onBlur={this.onSearchInputBlur} />
                    { showingCurrentQuery ? <i className="reset-button icon icon-times fas" onClick={this.onResetSearch} /> : null }
                    { showingCurrentQuery ? null : (
                        <button type="submit" className="search-icon-button">
                            <i className="icon icon-fw icon-search fas"/>
                        </button>
                    ) }
                    { SearchBar.renderHiddenInputsForURIQuery(query) }
                </div>
                <div className="form-visibility-toggle">
                    <button type="button" onClick={this.onToggleVisibility}>
                        <i className="icon icon-fw icon-search fas"/>
                    </button>
                </div>
            </form>
        );
    }
}

const SelectItemTypeDropdownBtn = React.memo(function SelectItemTypeDropdownBtn(props){
    const { currentAction, searchItemType, onChangeSearchItemType, onToggleSearchItemType, href, getDropdownTitleText, disabled = true } = props;
    if (isSelectAction(currentAction)) return null;

    const showWithinResultsOption = useMemo(function(){
        return SearchBar.isBrowseOrSearchPage(href);
    }, [href]);

    return (
        <div className="search-item-type-wrapper">
            <DropdownButton id="search-item-type-selector" size="sm" variant="outline-secondary" disabled={disabled}
                onSelect={onChangeSearchItemType} title={getDropdownTitleText()} onToggle={onToggleSearchItemType}>
                <DropdownItem eventKey="sets" data-key="sets" active={searchItemType === "sets"}>
                    Experiment Sets
                </DropdownItem>
                <DropdownItem eventKey="all" data-key="all" active={searchItemType === "all"}>
                    All Items (advanced)
                </DropdownItem>
                { showWithinResultsOption ?
                    <DropdownItem eventKey="within" data-key="within" active={searchItemType === "within"}>
                        Within Results
                    </DropdownItem>
                    : null }
            </DropdownButton>
        </div>
    );
});

