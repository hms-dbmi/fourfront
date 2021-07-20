'use strict';

import React from 'react';
import PropTypes from 'prop-types';
import _, { clone } from 'underscore';
import memoize from 'memoize-one';
import OverlayTrigger from 'react-bootstrap/esm/OverlayTrigger';
import { console, object, logger } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';


export function groupByMultiple(objList, propertiesList){
    var maxDepth = (propertiesList || []).length - 1;
    return (function doGroup(list, depth){
        var groupedLists = _.groupBy(list, propertiesList[depth]);
        if (depth < maxDepth){
            _.keys(groupedLists).forEach(function(k){
                groupedLists[k] = doGroup(groupedLists[k], depth + 1);
            });
        }
        return groupedLists;
    })(objList, 0);

}

/**
 * Taken from https://stackoverflow.com/questions/15298912/javascript-generating-combinations-from-n-arrays-with-m-elements
  */
export function cartesian() {
    var r = [], arg = arguments, max = arg.length-1;
    function helper(arr, i) {
        for (var j=0, l=arg[i].length; j<l; j++) {
            var a = arr.slice(0); // clone arr
            a.push(arg[i][j]);
            if (i==max)
                r.push(a);
            else
                helper(a, i+1);
        }
    }
    helper([], 0);
    return r;
}

export function extendListObjectsWithIndex(objList){
    return _.map(objList || [], function(o, idx){
        return _.extend({ 'index' : idx }, o);
    });
}

export function sumPropertyFromList(objList, property){
    function getCount(num){
        try {
            var n = parseInt(num);
            if (isNaN(n)) return 0;
            return n;
        } catch (e){
            return 0;
        }
    }

    if (Array.isArray(objList)) {
        return _.reduce(objList, function(m,v){
            return m + getCount(object.getNestedProperty(v, property));
        }, 0);
    } else {
        console.log('Not an array');
        throw new Error('Not an array');
    }
}



export class StackedBlockVisual extends React.PureComponent {

    static defaultProps = {
        'groupingProperties' : ['grant_type', 'center_name',  'lab_name'],
        'columnGrouping' : null,
        'additionalData' : null,
        'blockHeight' : 28,
        'blockVerticalSpacing' : 2,
        'blockHorizontalSpacing' : 2,
        'duplicateHeaders' : true,
        'collapseToMatrix' : false,
        // @param data may be either Array (if multiple grouped into 1) or object.
        'showGroupingPropertyTitles' : false,
        'checkCollapsibility' : false,
        'headerPadding' : 80,
        'rowLabelListingProportion': 'wide-listing', //possible values: wide-label/wide-listing/balanced
        'blockClassName' : function(data, blockProps){

            var isMultipleClass = 'single-set';

            if (Array.isArray(data)) {
                if (data.length > 1) {
                    isMultipleClass = 'multiple-sets';
                } else {
                    isMultipleClass = 'single-set';
                }
            }

            return isMultipleClass;
        },
        'blockRenderedContents' : function(data, blockProps){
            var count = 0;
            if (Array.isArray(data)) {
                count = data.length;
            } else if (data) {
                count = 1;
            }
            if (count > 100){
                return <span style={{ 'fontSize' : '0.95rem', 'position' : 'relative', 'top' : -1 }}>{ count }</span>;
            }
            return <span>{ count }</span>;

        }
    };

    static propTypes = {
        rowLabelListingProportion: PropTypes.oneOf(['wide-label', 'wide-listing', 'balanced']),
    }

    static generatePopoverRowsFromJSON(d, props){
        const { groupingProperties, columnGrouping, titleMap } = props;
        const out = [];

        _.forEach(_.keys(d), function(property){
            let val = d[property];
            if (!val) return;

            const boldIt = (
                (groupingProperties && groupingProperties.indexOf(property) > -1) ||
                (columnGrouping && columnGrouping === property)
            );

            if (typeof val === 'object'){
                if (object.isAnItem(val)) {
                    val = object.itemUtil.generateLink(val, true, property);
                } else if (val.props && val.type) {
                    // Do nothing.
                } else {
                    val = <code>{ JSON.stringify(val) }</code>;
                }
            }

            const rowElem = (
                <div className="row popover-entry mb-07" key={property}>
                    <div className="col-5 col-md-4">
                        <div className="text-500 text-ellipsis-continer text-right">
                            { ((titleMap && titleMap[property]) || property) + (val ? ':' : '') }
                        </div>
                    </div>
                    <div className={"col-7 col-md-8" + (boldIt ? ' text-600' : '')}>{ val }</div>
                </div>
            );

            out.push(rowElem);
        });

        return out;
    }

    static aggregateObjectFromList = function(dataList, keysToShow, skipParsingKeys=null){

        if (!keysToShow) keysToShow = _.keys(dataList[0]);

        const moreData = _.reduce(
            dataList,
            function(m, o){
                var i, currKey;
                for (i = 0; i < keysToShow.length; i++){
                    currKey = keysToShow[i];
                    if (typeof o[currKey] === 'number'){
                        if (m[currKey] === null){
                            m[currKey] = 0;
                        }
                        m[currKey] += o[currKey];
                    } else {
                        if (m[currKey] === null){
                            m[currKey] = new Set();
                        }
                        m[currKey].add(o[currKey]);
                    }
                }
                return m;
            },
            _.object(_.zip(keysToShow, [].fill.call({ 'length' : keysToShow.length }, null, 0, keysToShow.length)))
        );

        const skipParsingKeysObj = Array.isArray(skipParsingKeys) && _.object(_.map(skipParsingKeys, function(k){ return [k, true]; }));

        // Convert vals (in Set form) to rendered JSX list
        _.forEach(_.keys(moreData), function(k){
            if (typeof moreData[k] === 'number'){ // Already handled above
                return;
            }

            moreData[k] = _.filter(Array.from(moreData[k]));

            if (moreData[k].length === 0){
                delete moreData[k];
            } else if (moreData[k].length > 1){
                if (skipParsingKeysObj && skipParsingKeysObj[k]){
                    return;
                }
                var showLength = 5,
                    remainingLength = moreData[k].length - showLength;

                if (_.any(moreData[k], function(md){ return md && typeof md === 'object'; })){
                    if (!_.every(moreData[k], object.itemUtil.isAnItem)) {
                        moreData[k] = <span className="text-600">({ moreData[k].length } <span className="text-400">Objects</span>)</span>;
                        return;
                    }
                    moreData[k] = _.uniq(moreData[k], false, object.itemUtil.atId);
                    if (moreData[k].length === 1) {
                        moreData[k] = moreData[k][0];
                        return;
                    }
                    var itemLinks = _.map(_.filter(moreData[k], function(md){ return md && typeof md === 'object' && md.display_title; }), object.itemUtil.generateLink);
                    if (itemLinks && itemLinks.length > 0) remainingLength = itemLinks.length - showLength;
                    moreData[k] = (
                        <div>
                            <span className="text-600">({ itemLinks.length || moreData[k].length } <span className="text-400">Objects</span>)</span>
                            <ol>
                                { _.map(itemLinks.slice(0,showLength), (v,i)=> <li key={i}>{ v }</li> ) }
                            </ol>
                            { remainingLength > 0 ? <div className="more-items-count"> and { remainingLength } more...</div> : null }
                        </div>
                    );
                    return;
                }

                moreData[k] = (
                    <div>
                        <ol>
                            { _.map(moreData[k].slice(0, showLength), (v,i)=> <li key={i}>{ v }</li> ) }
                        </ol>
                        { remainingLength > 0 ? <div className="more-items-count"> and { remainingLength } more...</div> : null }
                    </div>
                );

            } else {
                moreData[k] = moreData[k][0];
            }
        });

        return moreData;
    }

    constructor(props){
        super(props);
        this.renderContents = this.renderContents.bind(this);
        this.handleSorterClick = _.throttle(this.handleSorterClick.bind(this), 250);
        var state = {
            'sorting' : 'both',
            'sortField': null,
            'mounted' : true
        };
        this.memoized = {
            sortBlock: memoize(StackedBlockGroupedRow.sortBlock)
        };

        /*
        var maxCollapsibleDepth = props.groupingProperties.length - 1;
        var unique_open_keys = [];

        _.forEach(props.groupingProperties.slice(0, maxCollapsibleDepth), function(property){
            var values = _.uniq(_.pluck(props.data, property));
            unique_open_keys.push(values);
        });

        var unique_open_keys_full = unique_open_keys[0].slice(0);

        for (var sliceEnd = 2; sliceEnd <= maxCollapsibleDepth; sliceEnd++){
            unique_open_keys_full = unique_open_keys_full.concat(_.map(cartesian.apply(cartesian, unique_open_keys.slice(0, sliceEnd)), function(keySet){
                return keySet.join('~');
            }));
        }

        _.forEach(unique_open_keys_full, function(comboKey){
            if (props && Array.isArray(props.defaultOpenKeys) && props.defaultOpenKeys.indexOf(comboKey) > -1) {
                state['open_' + comboKey] = true;
            } else {
                state['open_' + comboKey] = false;
            }
        });
        */

        this.state = state;
    }

    componentDidMount(){
        this.setState({ 'mounted' : true });
    }

    componentWillUnmount(){
        this.setState({ 'mounted' : false });
    }

    handleSorterClick(evt){
        evt.stopPropagation();
        const { sorting, sortField } = this.state;

        const newSortField = evt.currentTarget.dataset.index;

        let nextSort;
        if (newSortField === sortField || sortField === null) {
            switch (sorting) {
                case "desc":
                    nextSort = "asc";
                    break;
                case "asc":
                    nextSort = "both";
                    break;
                case "both":
                    nextSort = "desc";
                    break;
            }
        } else {
            nextSort = "desc";
        }

        this.setState({ "sorting": nextSort, "sortField": newSortField, "mounted": true });
    }

    renderContents(){
        const { data : propData, groupingProperties, columnGrouping, additionalData } = this.props;
        const { mounted, sorting, sortField } = this.state;
        if (!mounted) return null;
        let tempData = [].concat(propData);
        if (additionalData) {
            // AdditionalData values corresponding to the keys. It is compared with the values coming from the database.
            // If it is a new field, we add it into the data with a push operation.
            _.each(additionalData, (item) => {
                const cloned = _.clone(item);
                delete cloned.count;
                cloned.is_additional_data = true;
                const appendedData = _.times(item.count, function (n) { return _.clone(cloned); });
                tempData = tempData.concat(appendedData);
            });
        }
        const data = extendListObjectsWithIndex(tempData);
        const nestedData = groupByMultiple(data, groupingProperties); // { 'Grant1' : { Lab1: { PI1: [...], PI2: [...] }, Lab2: {} } }
        let columnGroups = null;
        if (typeof columnGrouping === 'string'){
            columnGroups = _.groupBy(data, columnGrouping);
            if (_.keys(columnGroups) < 2) {
                columnGroups = null;
            } else {
                _.keys(columnGroups).forEach(function(k){
                    columnGroups[k] = _.pluck(columnGroups[k], 'index');
                });
            }
        }

        if (!Array.isArray(nestedData) && nestedData) {
            let leftAxisKeys = _.keys(nestedData);

            if (sorting !== 'both') {
                //sort by counts
                if (typeof sortField !== 'undefined') {
                    const sortedKeys = [];
                    _.map(leftAxisKeys, (k) =>
                        sortedKeys.push(this.memoized.sortBlock(nestedData[k], columnGroups, k, sortField))
                    );

                    if (sorting === 'asc') {
                        sortedKeys.sort((a, b) => a.count - b.count);
                    } else if (sorting === 'desc') {
                        sortedKeys.sort((a, b) => b.count - a.count);
                    }

                    //get sorted data keys
                    leftAxisKeys = _.map(sortedKeys, (key) =>
                        key['groupingKey']
                    );
                } else { //sort by row labels
                    if (sorting === 'asc') {
                        leftAxisKeys.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
                    } else if (sorting === 'desc') {
                        leftAxisKeys.sort((a, b) => b.toLowerCase().localeCompare(a.toLowerCase()));
                    }
                }
            } else {
                leftAxisKeys.sort();
            }

            return _.map(leftAxisKeys, (k, idx) =>
                <StackedBlockGroupedRow {...this.props} groupedDataIndices={columnGroups} parentState={this.state} data={nestedData[k]}
                    key={k} group={k} depth={0} index={idx} toggleGroupingOpen={this.toggleGroupingOpen} onSorterClick={this.handleSorterClick} sorting={sorting} sortField={sortField} />
            );
        } else {
            // TODO: Render ... plain blocks w/o left column?
        }

    }

    render(){
        return (
            <div className={"stacked-block-viz-container" + (this.props.duplicateHeaders ? ' with-duplicated-headers' : '')}>
                { this.renderContents() }
            </div>
        );
    }


}

export class StackedBlockGroupedRow extends React.PureComponent {

    static flattenChildBlocks(groups){
        if (Array.isArray(groups)) return groups;
        return _.reduce(_.pairs(groups), function(m, pair){
            if (Array.isArray(pair[1])) return m.concat(pair[1]);
            else return m.concat(StackedBlockGroupedRow.flattenChildBlocks(pair[1]));
        }, []);
    }

    static sortByArray(array1, arrayToSortBy){

        var o = _.object(
            _.map(array1, function(k){ return [k, true]; })
        );

        var orderedList = [];
        for (var i = 0; i < arrayToSortBy.length; i++){
            if (arrayToSortBy[i] && o[arrayToSortBy[i]]){
                orderedList.push(arrayToSortBy[i]);
                delete o[arrayToSortBy[i]];
            }
        }

        return orderedList.concat( _.keys(o)); // Incl remaining keys.
    }

    /**
     * returns {groupingKey, count}. count is sorted fields column group length.
     */
    static sortBlock (data, groupedDataIndices, groupingKey, sortField) {

        let allChildBlocks = null;
        if (Array.isArray(data)) {
            allChildBlocks = data;
        } else {
            allChildBlocks = StackedBlockGroupedRow.flattenChildBlocks(data);
        }

        const groupedDataIndicesPairs = (groupedDataIndices && _.pairs(groupedDataIndices)) || [];

        if (groupedDataIndicesPairs.length > 0) {
            const blocksByColumnGroup = _.object(_.map(groupedDataIndicesPairs, function ([columnKey, listOfIndicesForGroup]) {
                return [
                    columnKey,
                    _.filter(_.map(allChildBlocks, function (blockData) {
                        if (listOfIndicesForGroup.indexOf(blockData.index) > -1) {
                            return blockData;
                        } else {
                            return null;
                        }
                    }), function (block) { return block !== null; })];
            }));
            return { 'groupingKey': groupingKey, 'count': blocksByColumnGroup[sortField].length };
        }

        return null;
    }

    /** @todo Convert to functional memoized React component */
    static collapsedChildBlocks = memoize(function(data, props){

        var allChildBlocksPerChildGroup = null, // Forgot what this was -- seems to be null in /joint-analysis at least
            allChildBlocks = null;

        if (Array.isArray(data)){
            allChildBlocks = data;
        } else {
            allChildBlocks = StackedBlockGroupedRow.flattenChildBlocks(data);
        }

        if (typeof props.columnSubGrouping !== 'string' && !Array.isArray(data)) {
            allChildBlocksPerChildGroup = _.map(_.pairs(data), function(pair){
                return [pair[0], StackedBlockGroupedRow.flattenChildBlocks(pair[1])];
            });
        }

        const commonProps = _.pick(props, 'blockHeight', 'blockHorizontalSpacing', 'blockVerticalSpacing',
            'groupingProperties', 'depth', 'titleMap', 'blockClassName', 'blockRenderedContents',
            'groupedDataIndices', 'headerColumnsOrder', 'columnGrouping', 'blockPopover', 'additionalData');
        const width = (props.blockHeight + (props.blockHorizontalSpacing * 2)) + 1;
        const containerGroupStyle = {
            'width'         : width, // Width for each column
            'minWidth'      : width,
            'minHeight'     : props.blockHeight + props.blockVerticalSpacing,               // Height for each row
            'paddingLeft'   : props.blockHorizontalSpacing,
            'paddingRight'  : props.blockHorizontalSpacing,
            'paddingTop'    : props.blockVerticalSpacing
        };
        const groupedDataIndicesPairs = (props.groupedDataIndices && _.pairs(props.groupedDataIndices)) || [];
        let inner = null;
        let blocksByColumnGroup;
        let columnKeys;


        if (groupedDataIndicesPairs.length > 0){
            // If columns exist, distribute these blocks by column!
            // Otherwise (else statement @ end) we'll probably just stack em left-to-right.

            if (allChildBlocksPerChildGroup){
                // Generate block per each child or child group when nothing else to regroup by.

                blocksByColumnGroup = _.object(_.map(groupedDataIndicesPairs, function(pair){
                    var listOfIndicesForGroup = pair[1];
                    return [
                        pair[0],
                        _.filter(_.map(allChildBlocksPerChildGroup, function(cPair){
                            if (Array.isArray(cPair[1])){
                                var res = _.filter(cPair[1], function(cBlock){ return listOfIndicesForGroup.indexOf(cBlock.index) > -1; });
                                if (res.length > 0) return [cPair[0], res];
                                if (res.length === 0) return null;
                            } else if (listOfIndicesForGroup.indexOf(cPair[1].index) > -1){
                                return [cPair[0], [cPair[1]]];
                            } else return null;
                        }), function(block){ return block !== null; })];
                }));

                columnKeys = _.keys(blocksByColumnGroup);
                if (Array.isArray(props.headerColumnsOrder)){
                    columnKeys = StackedBlockGroupedRow.sortByArray(columnKeys, props.headerColumnsOrder);
                }

                inner = _.map(columnKeys, function(k){
                    return (
                        <div className="block-container-group" style={containerGroupStyle}
                            key={k} data-group-key={k}>
                            { _.map(blocksByColumnGroup[k], ([ key, blockData ], i) =>
                                <Block key={key || i} {...commonProps} data={blockData} indexInGroup={i} />
                            ) }
                        </div>
                    );
                });

            } else {

                blocksByColumnGroup = _.object(_.map(groupedDataIndicesPairs, function([ columnKey, listOfIndicesForGroup ]){
                    return [
                        columnKey,
                        _.filter(_.map(allChildBlocks, function(blockData){
                            if (listOfIndicesForGroup.indexOf(blockData.index) > -1){
                                return blockData;
                            } else {
                                return null;
                            }
                        }), function(block){ return block !== null; })];
                }));

                columnKeys = _.keys(blocksByColumnGroup);
                if (Array.isArray(props.headerColumnsOrder)){
                    columnKeys = StackedBlockGroupedRow.sortByArray(columnKeys, props.headerColumnsOrder);
                }

                inner = _.map(columnKeys, function(k){
                    var blocksForGroup = blocksByColumnGroup[k];

                    // If we have columnSubGrouping (we should, if we reached this comment, b/c otherwise we do the allChildBlocksPerGroup clause), we group these into smaller blocks/groups.
                    if (typeof props.columnSubGrouping === 'string' && props.depth <= (props.groupingProperties.length - 1)){
                        blocksForGroup = _.pairs(_.groupBy(blocksForGroup, props.columnSubGrouping));
                        if (Array.isArray(props.columnSubGroupingOrder)){
                            var blocksForGroupObj = _.object(blocksForGroup);
                            var blocksForGroupObjKeys = StackedBlockGroupedRow.sortByArray(_.keys(blocksForGroupObj), props.columnSubGroupingOrder);
                            blocksForGroup = _.map(blocksForGroupObjKeys, function(bk){ return [bk, blocksForGroupObj[bk]]; });
                        }
                    }

                    return (
                        <div className="block-container-group" style={containerGroupStyle}
                            key={k} data-block-count={blocksForGroup.length} data-group-key={k}>
                            { _.map(blocksForGroup, function(blockData, i){
                                var parentGrouping = (props.titleMap && props.titleMap[props.groupingProperties[props.depth - 1]]) || null;
                                var subGrouping = (props.titleMap && props.titleMap[props.columnSubGrouping]) || null;
                                if (Array.isArray(blockData)) {
                                    // We have columnSubGrouping so these are -pairs- of (0) columnSubGrouping val, (1) blocks
                                    blockData = blockData[1];
                                }
                                return <Block key={i} {...commonProps} {...{ parentGrouping, subGrouping }} data={blockData} indexInGroup={i} />;
                            }) }
                        </div>
                    );
                });

            }
        } else {
            // Stack blocks left-to-right if no column grouping (?)
            inner = _.map(allChildBlocks, ([ key, data ]) => <Block {...commonProps} {...{ key, data }} />);
        }

        return <div className="blocks-container" style={{ 'minHeight' : containerGroupStyle.minHeight }}>{ inner }</div>;
    });

    constructor(props){
        super(props);
        this.toggleOpen = _.throttle(this.toggleOpen.bind(this), 250);
        var initOpen = (Array.isArray(props.defaultDepthsOpen) && props.defaultDepthsOpen[props.depth]) || false;
        this.state = { 'open' : initOpen };
    }

    toggleOpen(evt){
        evt.stopPropagation();
        this.setState(function({ open }){
            return { "open" : !open };
        });
    }

    render(){
        const {
            groupingProperties, depth, titleMap, group, blockHeight, blockVerticalSpacing, blockHorizontalSpacing, headerColumnsOrder,
            data, groupedDataIndices, index, duplicateHeaders, showGroupingPropertyTitles, checkCollapsibility, headerPadding, rowLabelListingProportion, additionalData,
            onSorterClick, sorting, sortField } = this.props;
        const { open } = this.state;

        let groupingPropertyTitle = null;
        if (Array.isArray(groupingProperties) && groupingProperties[depth]){
            groupingPropertyTitle = titleMap[groupingProperties[depth]] || groupingProperties[depth];
        }

        let className = "grouping depth-" + depth + (open ? ' open' : '') + (duplicateHeaders && depth === 0 ? ' with-duplicated-headers' : '') + (' row-index-' + index) + (!showGroupingPropertyTitles ? ' no-grouping-property-titles' : '');
        let toggleIcon = null;

        const childRowsKeys = !Array.isArray(data) ? _.keys(data).sort() : null;
        const hasIdentifiableChildren = !checkCollapsibility ? true : (depth + 2 >= groupingProperties.length) && childRowsKeys && childRowsKeys.length > 0 && !(childRowsKeys.length === 1 && childRowsKeys[0] === 'No value');

        if (!Array.isArray(data) && data && hasIdentifiableChildren){
            toggleIcon = <i className={"clickable icon fas icon-fw icon-" + (open ? 'minus' : 'plus')} onClick={this.toggleOpen} />;
            className += ' may-collapse';
        } else { // ?
            toggleIcon = <i className="icon icon-fw" />;
        }

        let header = null;
        if (depth === 0 && groupedDataIndices && ((open && duplicateHeaders) || index === 0)){
            const columnWidth = (blockHeight + (blockHorizontalSpacing * 2)) + 1;
            const headerItemStyle = { 'width' : columnWidth, 'minWidth' : columnWidth };
            let columnKeys = _.keys(groupedDataIndices);
            if (Array.isArray(headerColumnsOrder)){
                columnKeys = StackedBlockGroupedRow.sortByArray(columnKeys, headerColumnsOrder);
            }

            header = (
                <div className="header-for-viz">
                    { columnKeys.map(function(columnKey){
                        //sort order icons
                        let countSortIcon;
                        if ((sorting === 'desc') && (columnKey === sortField)) {
                            countSortIcon = <SortIconDesc />;
                        } else if ((sorting === 'asc') && (columnKey === sortField)) {
                            countSortIcon = <SortIconAsc />;
                        } else {
                            countSortIcon = <SortIconBoth />;
                        }

                        const countSortIconClassName = 'column-sort-icon' + (['asc', 'desc'].indexOf(sorting) > -1 && columnKey === sortField ? ' active' : '');

                        return (
                            <div key={'col-' + columnKey} className="column-group-header" style={headerItemStyle}>
                                <div className="inner">
                                    <span>{columnKey}</span>
                                </div>
                                <div data-index={columnKey} onClick={onSorterClick}>
                                    <span className={countSortIconClassName}>{countSortIcon}</span>
                                </div>
                            </div>
                        );
                    }) }
                </div>
            );
        }

        const rowHeight = blockHeight + (blockVerticalSpacing * 2) + 1;
        const childBlocks = !open ? StackedBlockGroupedRow.collapsedChildBlocks(data, this.props) : (
            <div className="open-empty-placeholder" style={{ 'height' : rowHeight, 'marginLeft' : blockHorizontalSpacing }}/>
        );
        const maxBlocksInRow  = childBlocks && Math.max.apply(Math.max, _.pluck(_.pluck((childBlocks && childBlocks.props && childBlocks.props.children) || [], 'props'), 'data-block-count'));

        let labelSectionStyle = null;
        let listSectionStyle = null;
        if (depth === 0 && index === 0){ // Add padding-top to first 1 to align w/ top padding.
            labelSectionStyle = { 'paddingTop' : Math.max(0, headerPadding + 56 - rowHeight) };
            listSectionStyle = { 'paddingTop' : headerPadding };
        }

        //label-listing class
        let labelClassName = "col-4", listingClassName = "col-8"; //default + wide-listing
        if (rowLabelListingProportion === 'wide-label') {
            labelClassName = "col-8", listingClassName = "col-4";
        } else if (rowLabelListingProportion === 'balanced') {
            labelClassName = "col-6", listingClassName = "col-6";
        }

        //sort row label
        let labelSortIcon;
        if ((sorting === "desc") && !sortField) {
            labelSortIcon = <SortIconDesc />;
        } else if ((sorting === "asc") && !sortField) {
            labelSortIcon = <SortIconAsc />;
        } else {
            labelSortIcon = <SortIconBoth />;
        }
        const labelSortIconClassName = 'column-sort-icon' + (['asc', 'desc'].indexOf(sorting) > -1 && !sortField ? ' active' : '');

        return (
            <div className={className} data-max-blocks-vertical={maxBlocksInRow}>
                <div className="row grouping-row">
                    <div className={"col label-section " + labelClassName} style={labelSectionStyle}>
                        {(index === 0 && depth === 0) ? (
                            <div className="text-right" onClick={onSorterClick}>
                                <span className={labelSortIconClassName}>{labelSortIcon}</span>
                            </div>
                        ) : null}
                        <div className="label-container" style={{ 'minHeight' : rowHeight }}>
                            { groupingPropertyTitle && showGroupingPropertyTitles ?
                                <small className="text-400 mb-0 mt-0">{ groupingPropertyTitle }</small>
                                : null }
                            <h4 className="text-truncate"
                                data-tip={group && typeof group === 'string' && group.length > 20 ? group : null}>
                                { toggleIcon }{ group }
                            </h4>
                        </div>
                        {/* this.childLabels() */}
                    </div>
                    <div className={"col list-section " + listingClassName + (header ? ' has-header' : '')} style={listSectionStyle}>
                        {header}
                        {childBlocks}
                    </div>
                </div>

                { open && toggleIcon && depth > 0 ? <div className="close-button" onClick={this.toggleOpen}>{ toggleIcon }</div> : null }

                <div className="child-blocks">
                    { open && childRowsKeys && _.map(childRowsKeys, (k)=>
                        <StackedBlockGroupedRow {...this.props} data={data[k]} key={k} group={k} depth={depth + 1} />
                    ) }
                </div>

            </div>
        );
    }

}


const Block = React.memo(function Block(props){
    const {
        blockHeight, blockVerticalSpacing, data, parentGrouping,
        blockClassName, blockRenderedContents, blockPopover, indexInGroup
    } = props;

    const style = {
        'height' : blockHeight,
        'width' : blockHeight,
        'lineHeight' : blockHeight + 'px',
        'marginBottom' : blockVerticalSpacing,
        'marginTop' : indexInGroup && indexInGroup > 0 ? blockVerticalSpacing + 1 : 0
    };

    const blockFxnArguments = [data, props, parentGrouping];

    let className = "stacked-block";
    if (typeof blockClassName === 'function'){
        className += ' ' + blockClassName.apply(blockClassName, blockFxnArguments);
    } else if (typeof blockClassName === 'string'){
        className += ' ' + blockClassName;
    }

    let contents = ( <span>&nbsp;</span> );
    if (typeof blockRenderedContents === 'function'){
        contents = blockRenderedContents.apply(blockRenderedContents, blockFxnArguments);
    }

    let popover = null;
    if (typeof blockPopover === 'function'){
        popover = blockPopover.apply(blockPopover, blockFxnArguments);
    }

    const blockElem = <div className={className} style={style} tabIndex={1} data-place="bottom">{ contents }</div>;

    if (popover){
        return <OverlayTrigger trigger="click" placement="bottom" overlay={popover} rootClose>{ blockElem }</OverlayTrigger>;
    }

    return blockElem;
});



function FaIcon(props) {
    const { icon, iconClass } = props;
    const className = `fas icon ${icon} ${iconClass}`;
    return (
        <i className={className} align="right" />
    );
}
function SortIconDesc(props) {
    return (
        <FaIcon icon="icon-sort-down" iconClass="align-text-top" />
    );
}
function SortIconAsc(props) {
    return (
        <FaIcon icon="icon-sort-up" iconClass="align-bottom" />
    );
}
function SortIconBoth(props) {
    return (
        <FaIcon icon="icon-sort-down" iconClass="align-text-top" />
    );
}

StackedBlockVisual.Row = StackedBlockGroupedRow;
